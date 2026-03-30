/**
 * 会议相关路由
 * 处理会议生成、用户发言响应、会议完成等操作
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const { callOpenAI, callOpenAIJson, parseJsonFromContent } = require('../services/openai');
const { generateMeetingPrompt } = require('../prompts/generate-meeting');
const { respondMeetingPrompt } = require('../prompts/respond-meeting');

/**
 * 后处理：确保每条普通 NPC 消息都有 textZh 中文翻译
 * 如果 AI 遗漏了 textZh 字段，通过额外调用批量翻译补全
 * @param {Array} dialogue - dialogue 数组
 * @returns {Promise<Array>} 补全翻译后的 dialogue
 */
async function ensureTranslations(dialogue) {
  // 找出缺少 textZh 的普通 NPC 消息（排除 narrator 和 isKeyNode）
  const missing = dialogue.filter(
    d => d.speaker !== 'narrator' && !d.isKeyNode && d.text && !d.textZh
  );

  if (missing.length === 0) return dialogue;

  console.log(`[ensureTranslations] 发现 ${missing.length} 条 NPC 消息缺少 textZh，补全翻译中...`);

  // 批量翻译缺失的消息
  const textsToTranslate = missing.map(d => d.text);
  const prompt = `将以下英文句子逐一翻译为中文，只返回 JSON 数组（每条对应一个中文翻译字符串）：\n${JSON.stringify(textsToTranslate)}`;

  try {
    const result = await callOpenAI(
      [
        { role: 'system', content: '你是翻译助手，只返回 JSON 数组。' },
        { role: 'user', content: prompt },
      ],
      { maxTokens: 1000 }
    );

    const translations = parseJsonFromContent(result);

    if (Array.isArray(translations)) {
      let idx = 0;
      dialogue.forEach(d => {
        if (d.speaker !== 'narrator' && !d.isKeyNode && d.text && !d.textZh) {
          d.textZh = translations[idx] || '';
          idx++;
        }
      });
      console.log(`[ensureTranslations] 补全翻译完成，共补全 ${idx} 条`);
    }
  } catch (e) {
    // 翻译失败时不阻断主流程，仅记录错误
    console.error('[ensureTranslations] 翻译补全失败:', e.message);
  }

  return dialogue;
}

/**
 * POST /api/meeting/generate
 * 生成一场完整的模拟会议
 */
router.post('/generate', async (req, res) => {
  try {
    const { sessionId, source = 'system', uploadContent } = req.body;

    // 校验 sessionId
    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId 不能为空' });
    }

    // 查询 session 是否存在
    const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);
    if (!session) {
      return res.status(404).json({ error: '会话不存在，请重新完成 onboarding' });
    }

    // 校验 source（generate 视为 system 的同义词，兼容前端传值）
    if (!['system', 'generate', 'upload'].includes(source)) {
      return res.status(400).json({ error: 'source 必须为 system、generate 或 upload' });
    }

    // 将 generate 统一转换为 system 处理
    const normalizedSource = source === 'generate' ? 'system' : source;

    // 如果是 upload 模式，上传内容不能为空
    if (normalizedSource === 'upload' && (!uploadContent || !uploadContent.trim())) {
      return res.status(400).json({ error: 'upload 模式下 uploadContent 不能为空' });
    }

    console.log(`[Meeting/Generate] sessionId=${sessionId}, source=${source}, level=${session.english_level}`);

    // 构造 prompt
    const { systemPrompt, userPrompt } = generateMeetingPrompt({
      englishLevel: session.english_level,
      jobTitle: session.job_title,
      industry: session.industry,
      uploadContent: normalizedSource === 'upload' ? uploadContent : undefined,
    });

    // 调用 Azure OpenAI 生成会议内容
    let meetingData;
    try {
      meetingData = await callOpenAIJson(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        { temperature: 0.8, maxTokens: 6000 }
      );
    } catch (aiErr) {
      console.error('[Meeting/Generate] OpenAI 调用失败：', aiErr.message);
      return res.status(502).json({ error: `AI 服务调用失败: ${aiErr.message}` });
    }

    // 校验返回的数据结构
    if (!meetingData.dialogue || !Array.isArray(meetingData.dialogue)) {
      return res.status(502).json({ error: 'AI 返回格式异常：缺少 dialogue 字段' });
    }
    if (!meetingData.keyNodes || !Array.isArray(meetingData.keyNodes)) {
      return res.status(502).json({ error: 'AI 返回格式异常：缺少 keyNodes 字段' });
    }

    // 后处理：确保每条 NPC 普通消息都有 textZh 中文翻译
    meetingData.dialogue = await ensureTranslations(meetingData.dialogue);

    // 生成会议 ID
    const meetingId = crypto.randomUUID();

    // 将复杂对象序列化为 JSON 字符串存入数据库
    const stmt = db.prepare(`
      INSERT INTO meetings (id, session_id, source, briefing, memo, roles, dialogue, key_nodes, ref_phrases, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'created')
    `);

    stmt.run(
      meetingId,
      sessionId,
      normalizedSource,
      JSON.stringify(meetingData.briefing || {}),
      JSON.stringify(meetingData.memo || []),
      JSON.stringify(meetingData.roles || []),
      JSON.stringify(meetingData.dialogue || []),
      JSON.stringify(meetingData.keyNodes || []),
      JSON.stringify(meetingData.references || [])
    );

    console.log(`[Meeting/Generate] 会议生成成功 meetingId=${meetingId}`);

    // 返回完整会议数据
    return res.status(201).json({
      meetingId,
      briefing: meetingData.briefing,
      memo: meetingData.memo,
      roles: meetingData.roles,
      dialogue: meetingData.dialogue,
      keyNodes: meetingData.keyNodes,
      references: meetingData.references,
    });
  } catch (err) {
    console.error('[Meeting/Generate] 意外错误：', err.message);
    return res.status(500).json({ error: '服务器内部错误，请稍后重试' });
  }
});

/**
 * POST /api/meeting/respond
 * 处理用户在关键节点的发言，返回后续对话
 */
router.post('/respond', async (req, res) => {
  try {
    const { meetingId, nodeIndex, userInput, inputLanguage } = req.body;

    // 参数校验
    if (!meetingId) {
      return res.status(400).json({ error: 'meetingId 不能为空' });
    }
    if (nodeIndex === undefined || nodeIndex === null) {
      return res.status(400).json({ error: 'nodeIndex 不能为空' });
    }
    if (!userInput || !userInput.trim()) {
      return res.status(400).json({ error: 'userInput 不能为空' });
    }
    if (!['en', 'zh', 'mixed'].includes(inputLanguage)) {
      return res.status(400).json({ error: 'inputLanguage 必须为 en、zh 或 mixed' });
    }

    // 查询会议是否存在
    const meeting = db.prepare('SELECT * FROM meetings WHERE id = ?').get(meetingId);
    if (!meeting) {
      return res.status(404).json({ error: '会议不存在' });
    }

    // 解析会议数据
    const dialogue = JSON.parse(meeting.dialogue || '[]');
    const keyNodes = JSON.parse(meeting.key_nodes || '[]');

    // 查找当前节点信息
    const currentNode = keyNodes.find((n) => n.index === nodeIndex);
    if (!currentNode) {
      return res.status(404).json({ error: `节点 ${nodeIndex} 不存在` });
    }

    // 获取当前节点在 dialogue 中的位置，提取上下文（节点前最近 6 条对话）
    const nodeDialogueIndex = dialogue.findIndex(
      (d) => d.isKeyNode && d.nodeIndex === nodeIndex
    );
    const contextDialogue = nodeDialogueIndex > 0
      ? dialogue.slice(Math.max(0, nodeDialogueIndex - 6), nodeDialogueIndex)
      : dialogue.slice(0, 6);

    console.log(`[Meeting/Respond] meetingId=${meetingId}, nodeIndex=${nodeIndex}, lang=${inputLanguage}`);

    // 构造 prompt
    const { systemPrompt, userPrompt } = respondMeetingPrompt({
      userInput: userInput.trim(),
      inputLanguage,
      nodePrompt: currentNode.prompt,
      nodeType: currentNode.type,
      dialogueContext: contextDialogue,
      englishLevel: (() => {
        // 从 session 中查询英语等级
        const session = db.prepare('SELECT english_level FROM sessions WHERE id = ?').get(meeting.session_id);
        return session?.english_level || 'B1';
      })(),
    });

    // 调用 AI 生成响应
    let responseData;
    try {
      responseData = await callOpenAIJson(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        { temperature: 0.7, maxTokens: 1000 }
      );
    } catch (aiErr) {
      console.error('[Meeting/Respond] OpenAI 调用失败：', aiErr.message);
      return res.status(502).json({ error: `AI 服务调用失败: ${aiErr.message}` });
    }

    // 保存对话记录到数据库
    const insertStmt = db.prepare(`
      INSERT INTO conversations (meeting_id, node_index, user_input, input_language, system_english, system_response)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    insertStmt.run(
      meetingId,
      nodeIndex,
      userInput.trim(),
      inputLanguage,
      responseData.systemEnglish || null,
      JSON.stringify(responseData.responseDialogue || [])
    );

    console.log(`[Meeting/Respond] 节点${nodeIndex}响应生成成功，inputType=${responseData.inputType}`);

    // 构造响应
    const response = {
      systemEnglish: responseData.systemEnglish || userInput.trim(),
      responseDialogue: responseData.responseDialogue || [],
      inputType: responseData.inputType || 'valid',
    };

    // 仅 invalid 时返回 retryPrompt
    if (responseData.inputType === 'invalid' && responseData.retryPrompt) {
      response.retryPrompt = responseData.retryPrompt;
    }

    return res.status(200).json(response);
  } catch (err) {
    console.error('[Meeting/Respond] 意外错误：', err.message);
    return res.status(500).json({ error: '服务器内部错误，请稍后重试' });
  }
});

/**
 * POST /api/meeting/complete
 * 标记会议完成
 */
router.post('/complete', (req, res) => {
  try {
    const { meetingId } = req.body;

    if (!meetingId) {
      return res.status(400).json({ error: 'meetingId 不能为空' });
    }

    // 查询会议是否存在
    const meeting = db.prepare('SELECT * FROM meetings WHERE id = ?').get(meetingId);
    if (!meeting) {
      return res.status(404).json({ error: '会议不存在' });
    }

    // 更新会议状态为已完成
    db.prepare("UPDATE meetings SET status = 'completed' WHERE id = ?").run(meetingId);

    console.log(`[Meeting/Complete] 会议已完成 meetingId=${meetingId}`);

    return res.status(200).json({ status: 'completed' });
  } catch (err) {
    console.error('[Meeting/Complete] 错误：', err.message);
    return res.status(500).json({ error: '服务器内部错误，请稍后重试' });
  }
});

module.exports = router;
