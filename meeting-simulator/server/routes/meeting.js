/**
 * 会议相关路由
 * 处理会议生成、用户发言响应、会议完成等操作
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const { callOpenAI, callOpenAIJson, parseJsonFromContent } = require('../services/openai');
const { generateMeetingPrompt } = require('../prompts/generate-meeting');
const { generateBrainstormMeetingPrompt } = require('../prompts/generate-brainstorm');
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
    const { sessionId, source = 'system', uploadContent, sceneType, characters, mainWorld, theme } = req.body;

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

    // 判断是否为脑洞模式
    const isBrainstorm = sceneType && (sceneType === 'brainstorm-pick' || sceneType === 'brainstorm-random');

    // 脑洞模式额外校验
    if (isBrainstorm) {
      if (!characters || !Array.isArray(characters) || characters.length < 1) {
        return res.status(400).json({ error: '脑洞模式需要提供参与角色' });
      }
      if (!mainWorld) {
        return res.status(400).json({ error: '脑洞模式需要提供主场景世界' });
      }
    } else {
      // 正经开会模式校验 job_title 和 industry
      if (!session.job_title || !session.industry) {
        return res.status(400).json({ error: '正经开会模式需要先填写职位和行业信息' });
      }
    }

    console.log(`[Meeting/Generate] sessionId=${sessionId}, source=${source}, level=${session.english_level}, sceneType=${sceneType || 'formal'}`);

    // 根据 sceneType 选择对应的 prompt 函数
    let promptResult;
    if (isBrainstorm) {
      // 脑洞模式：使用脑洞专属 prompt
      promptResult = generateBrainstormMeetingPrompt({
        englishLevel: session.english_level,
        userName: session.user_name || undefined,
        sceneType,
        characters,
        mainWorld,
        theme: theme || undefined,
      });
    } else {
      // 正经开会模式：使用原有 prompt（不变）
      promptResult = generateMeetingPrompt({
        englishLevel: session.english_level,
        jobTitle: session.job_title,
        industry: session.industry,
        userName: session.user_name || undefined,
        uploadContent: normalizedSource === 'upload' ? uploadContent : undefined,
      });
    }
    const { systemPrompt, userPrompt } = promptResult;

    // 调用 Azure OpenAI 生成会议内容
    let meetingData;
    try {
      meetingData = await callOpenAIJson(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        { temperature: 0.8, maxTokens: 4500 }
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

    // 后处理：强制确保 userRole 中的角色名和 roles 一致
    if (meetingData.userRole && meetingData.roles && meetingData.roles.length > 0) {
      const roles = meetingData.roles;

      // 按 stance 和 type 查找对应角色（带兜底）
      const pressureRole = roles.find(r => r.stance === 'pressure')
        || roles.find(r => r.type === 'challenger')
        || roles[0];
      const allyRole = roles.find(r => r.stance === 'ally')
        || roles.find(r => r.type === 'collaborator')
        || roles[1] || roles[0];

      /**
       * 英文人名正则：匹配 "FirstName LastName" 并可选带括号职位
       * 支持英文圆括号 () 和中文圆括号（）
       */
      const NAME_PATTERN = /[A-Z][a-z]+(?:\s[A-Z][a-z]+)*(?:\s*[（(][^）)]+[）)])?/g;

      // ========== 修正 challenge：强制使用 pressureRole 的名字 ==========
      if (meetingData.userRole.challenge && pressureRole) {
        const roleName = pressureRole.name;
        const roleTitle = pressureRole.title;
        const text = meetingData.userRole.challenge;

        // 只检查完整全名是否存在，不检查 firstName（避免 "Daniel Kim" vs "Daniel Reed" 误判）
        if (!text.includes(roleName)) {
          const realLabel = `${roleName}（${roleTitle}）`;
          // 替换所有英文人名模式（含可选括号职位）
          let fixed = text.replace(NAME_PATTERN, realLabel);
          // 如果没匹配到（可能是单词名），尝试单词名替换
          if (fixed === text) {
            fixed = text.replace(/[A-Z][a-z]{2,}(?:\s*[（(][^）)]+[）)])?/, realLabel);
          }
          if (fixed !== text) {
            console.log(`[Meeting/Generate] userRole.challenge 角色名已修正: "${text}" → "${fixed}"`);
          }
          meetingData.userRole.challenge = fixed;
        }
      }

      // ========== 修正 ally：强制使用 allyRole 的名字 ==========
      if (meetingData.userRole.ally && allyRole) {
        const roleName = allyRole.name;
        const roleTitle = allyRole.title;
        const text = meetingData.userRole.ally;

        if (!text.includes(roleName)) {
          const realLabel = `${roleName}（${roleTitle}）`;
          let fixed = text.replace(NAME_PATTERN, realLabel);
          if (fixed === text) {
            fixed = text.replace(/[A-Z][a-z]{2,}(?:\s*[（(][^）)]+[）)])?/, realLabel);
          }
          if (fixed !== text) {
            console.log(`[Meeting/Generate] userRole.ally 角色名已修正: "${text}" → "${fixed}"`);
          }
          meetingData.userRole.ally = fixed;
        }
      }

      // ========== 修正 backstory：删除身份介绍 + 修正 NPC 名字 ==========
      if (meetingData.userRole.backstory) {
        let fixed = meetingData.userRole.backstory;

        // 按换行分段，删除包含"你是...英文人名"的身份介绍行
        const lines = fixed.split('\n');
        const filteredLines = lines.filter(line => {
          // 匹配"你是 Name（Title），负责..."格式的身份介绍
          if (/你是\s*[A-Z][a-z]+/.test(line)) return false;
          return true;
        });
        fixed = filteredLines.join('\n');

        // 修正 backstory 中的 NPC 名字：不属于 roles 全名列表的英文人名替换为最接近的角色
        const userName = session.user_name || '';
        const allRoleNames = roles.map(r => r.name).filter(Boolean);

        const allMatches = [...fixed.matchAll(new RegExp(NAME_PATTERN.source, 'g'))];
        if (allMatches.length > 0) {
          // 从后往前替换，避免 index 偏移
          for (let i = allMatches.length - 1; i >= 0; i--) {
            const match = allMatches[i];
            const pureName = match[0].replace(/\s*[（(][^）)]+[）)]$/, '').trim();
            // 跳过用户名
            if (userName && (pureName === userName || pureName.startsWith(userName))) continue;
            // 只用全名精确匹配，不用 firstName
            const isKnown = allRoleNames.some(name => name === pureName);
            if (!isKnown) {
              const roleIdx = Math.min(i, roles.length - 1);
              const realLabel = `${roles[roleIdx].name}（${roles[roleIdx].title}）`;
              fixed = fixed.substring(0, match.index) + realLabel + fixed.substring(match.index + match[0].length);
            }
          }
        }

        if (fixed !== meetingData.userRole.backstory) {
          console.log(`[Meeting/Generate] userRole.backstory 已修正: "${meetingData.userRole.backstory}" → "${fixed}"`);
          meetingData.userRole.backstory = fixed;
        }
      }
    }

    // 生成会议 ID
    const meetingId = crypto.randomUUID();

    // 将复杂对象序列化为 JSON 字符串存入数据库（含脑洞模式新增字段）
    const stmt = db.prepare(`
      INSERT INTO meetings (id, session_id, source, briefing, memo, roles, dialogue, key_nodes, ref_phrases, user_role,
        scene_type, brainstorm_world, brainstorm_characters, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'created')
    `);

    // 脑洞模式数据：存储场景类型和角色信息
    const finalSceneType = isBrainstorm ? sceneType : 'formal';
    const brainstormWorld = isBrainstorm ? (mainWorld || null) : null;
    const brainstormCharacters = isBrainstorm && characters ? JSON.stringify(characters.map(c => c.id || c.name)) : null;

    stmt.run(
      meetingId,
      sessionId,
      normalizedSource,
      JSON.stringify(meetingData.briefing || {}),
      JSON.stringify(meetingData.memo || []),
      JSON.stringify(meetingData.roles || []),
      JSON.stringify(meetingData.dialogue || []),
      JSON.stringify(meetingData.keyNodes || []),
      JSON.stringify(meetingData.references || []),
      JSON.stringify(meetingData.userRole || null),
      finalSceneType,
      brainstormWorld,
      brainstormCharacters
    );

    console.log(`[Meeting/Generate] 会议生成成功 meetingId=${meetingId}`);

    // 返回完整会议数据（含 sceneType 供前端区分渲染方式）
    return res.status(201).json({
      meetingId,
      sceneType: finalSceneType,
      briefing: meetingData.briefing,
      memo: meetingData.memo,
      roles: meetingData.roles,
      dialogue: meetingData.dialogue,
      keyNodes: meetingData.keyNodes,
      references: meetingData.references,
      userRole: meetingData.userRole || null,
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
    // 新增 retryCount（当前节点已重试次数）和 failedNodeCount（已失败节点数）
    const { meetingId, nodeIndex, userInput, inputLanguage, retryCount = 0, failedNodeCount = 0 } = req.body;

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

    // 构造 prompt（含重试状态和累积失败数）
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
      retryCount: Number(retryCount) || 0,
      failedNodeCount: Number(failedNodeCount) || 0,
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

    if (responseData.inputType === 'invalid') {
      // 第 1 次 invalid：返回 retryPrompt（NPC 角色化补救对话）
      if (responseData.retryPrompt) {
        response.retryPrompt = responseData.retryPrompt;
      }
      // 第 2 次 invalid：返回 failureResponse（NPC 收场对话）
      if (responseData.failureResponse) {
        response.failureResponse = responseData.failureResponse;
      }
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
