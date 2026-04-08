/**
 * v2 群聊路由
 * 处理加入群聊、用户发言、完成群聊、获取结算、NPC 私信 Banner
 */

const express = require('express');
const { randomUUID } = require('crypto');
const router = express.Router();
const db = require('../db');
const { callOpenAIJson } = require('../services/openai');
const { respondChatPrompt } = require('../prompts/respond-chat');
const { betterVersionPrompt } = require('../prompts/better-version');
const { generateHintPrompt } = require('../prompts/generate-hint');

/**
 * 从属性池中随机选取 2-3 个荒诞属性
 * @param {Array} pool - 属性池数组
 * @returns {Array} 随机选出的属性数组
 */
function pickAbsurdAttributes(pool) {
  if (!pool || !Array.isArray(pool) || pool.length === 0) return [];
  // 随机选 2 或 3 个，不超过池子大小
  const count = Math.min(pool.length, 2 + Math.floor(Math.random() * 2));
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

// NPC 私信 Banner 硬编码文案（避免 AI 调用延迟）
const DM_BANNERS = [
  {
    message: "Hey! You did great back there. I honestly wasn't expecting you to have that take.",
    messageZh: '嘿！你表现得很棒。说实话，我没想到你会有那个观点。',
  },
  {
    message: "That conversation was actually fun. Not a lot of people engage like that.",
    messageZh: '那次聊天真的挺有趣的。能这样积极参与的人不多。',
  },
  {
    message: "Quick DM — your point about that topic was pretty sharp. Nice.",
    messageZh: '私信一下——你对那个话题的观点很犀利。不错。',
  },
  {
    message: "I meant to say this in the group: your English is getting better. Keep it up!",
    messageZh: '我本来想在群里说：你的英语在进步。继续加油！',
  },
  {
    message: "Glad you jumped in. That chat needed someone with a different perspective.",
    messageZh: '很高兴你参与了。那次对话需要一个有不同视角的人。',
  },
];

/**
 * POST /api/v2/chat/join
 * 加入群聊，创建新会话并返回完整对话脚本
 * 入参: { userId, roomId }
 * 出参: { chatSessionId, groupName, groupNotice, userRoleName, userRoleDesc, npcProfiles, dialogueScript, totalUserTurns }
 */
router.post('/join', (req, res) => {
  try {
    const { userId, roomId } = req.body;

    if (!userId || !userId.trim()) {
      return res.status(400).json({ error: 'userId 不能为空' });
    }
    if (!roomId || !roomId.trim()) {
      return res.status(400).json({ error: 'roomId 不能为空' });
    }

    // 查询房间是否存在且激活
    const room = db.prepare('SELECT * FROM v2_rooms WHERE id = ? AND is_active = 1').get(roomId.trim());
    if (!room) {
      return res.status(404).json({ error: '房间不存在或已下线' });
    }

    // 确保用户存在（自动创建，避免外键约束失败）
    db.prepare('INSERT OR IGNORE INTO v2_users (id) VALUES (?)').run(userId.trim());

    // 创建新会话（每次 join 都创建新会话，允许重复进入同一房间）
    const chatSessionId = randomUUID();
    db.prepare(`
      INSERT INTO v2_chat_sessions (id, user_id, room_id, status, user_turn_count, npc_turn_count, dm_sent_count)
      VALUES (?, ?, ?, 'active', 0, 0, 0)
    `).run(chatSessionId, userId.trim(), roomId.trim());

    console.log(`[v2-chat/join] 用户 ${userId} 加入房间 ${roomId}，会话 ${chatSessionId}`);

    return res.status(201).json({
      chatSessionId,
      groupName: room.group_name,
      groupNotice: room.group_notice || null,
      userRoleName: room.user_role_name,
      userRoleDesc: room.user_role_desc || null,
      npcProfiles: JSON.parse(room.npc_profiles),
      dialogueScript: JSON.parse(room.dialogue_script),
      totalUserTurns: 3,
    });
  } catch (err) {
    console.error('[v2-chat/join] 错误：', err.message);
    return res.status(500).json({ error: '服务器内部错误，请稍后重试' });
  }
});

/**
 * POST /api/v2/chat/respond
 * 处理用户发言，同步生成 NPC 回复和"更好说法"
 * 入参: { chatSessionId, turnIndex, userInput }
 * 出参: { messageId, npcReply, betterVersion, isLastTurn }
 */
router.post('/respond', async (req, res) => {
  try {
    const { chatSessionId, turnIndex, userInput } = req.body;

    // 参数校验
    if (!chatSessionId || !chatSessionId.trim()) {
      return res.status(400).json({ error: 'chatSessionId 不能为空' });
    }
    if (turnIndex === undefined || turnIndex === null) {
      return res.status(400).json({ error: 'turnIndex 不能为空' });
    }
    const turnNum = parseInt(turnIndex);
    if (isNaN(turnNum) || turnNum < 1 || turnNum > 3) {
      return res.status(409).json({ error: 'turnIndex 必须为 1、2 或 3' });
    }
    if (!userInput || !userInput.trim()) {
      return res.status(400).json({ error: 'userInput 不能为空' });
    }

    // 查询会话是否存在且激活
    const session = db.prepare('SELECT * FROM v2_chat_sessions WHERE id = ?').get(chatSessionId.trim());
    if (!session) {
      return res.status(404).json({ error: '会话不存在' });
    }
    if (session.status !== 'active') {
      return res.status(409).json({ error: '会话已结束，无法继续发言' });
    }
    if (session.user_turn_count >= 3) {
      return res.status(409).json({ error: '已达到最大发言次数（3次）' });
    }
    // 乱序发言保护：turnIndex 必须等于当前次数 +1
    if (turnNum !== session.user_turn_count + 1) {
      return res.status(409).json({ error: `发言顺序错误，期望 turnIndex=${session.user_turn_count + 1}，收到 ${turnNum}` });
    }

    // 查询房间数据
    const room = db.prepare('SELECT * FROM v2_rooms WHERE id = ?').get(session.room_id);
    if (!room) {
      return res.status(404).json({ error: '房间数据异常' });
    }

    const npcProfiles = JSON.parse(room.npc_profiles);
    const dialogueScript = JSON.parse(room.dialogue_script);

    // 确定回复的 NPC：轮流（奇数轮 npc_a，偶数轮 npc_b）
    const respondingNpcIndex = (turnNum - 1) % npcProfiles.length;
    const respondingNpc = npcProfiles[respondingNpcIndex];

    // 构建对话上下文：预制脚本 + 用户之前的发言和 NPC 回复
    const scriptContext = dialogueScript
      .filter(t => t.type !== 'user_cue')
      .slice(0, turnNum * 4)
      .map(t => ({ type: t.type, speaker: t.speaker, text: t.text }));

    // 加载该会话之前的用户消息和 NPC 回复，让后续轮次有连贯上下文
    const priorMessages = db.prepare(`
      SELECT user_input, npc_reply FROM v2_user_messages
      WHERE chat_session_id = ? AND turn_index < ?
      ORDER BY turn_index ASC
    `).all(chatSessionId.trim(), turnNum);

    const userHistory = [];
    for (const pm of priorMessages) {
      userHistory.push({ type: 'user', speaker: 'user', text: pm.user_input });
      if (pm.npc_reply) {
        try {
          const reply = JSON.parse(pm.npc_reply);
          userHistory.push({ type: 'npc', speaker: reply.speaker, text: reply.text });
        } catch (e) { /* 解析失败跳过 */ }
      }
    }

    const contextMessages = [...scriptContext, ...userHistory];

    console.log(`[v2-chat/respond] 会话 ${chatSessionId}，第 ${turnNum} 次发言`);

    // 并行调用：NPC 回复 + 更好说法
    const [npcReplyResult, betterVersionResult] = await Promise.allSettled([
      // 调用 NPC 回复 prompt
      callOpenAIJson(
        (() => {
          const { systemPrompt, userPrompt } = respondChatPrompt({
            userInput: userInput.trim(),
            respondingNpc,
            allNpcProfiles: npcProfiles,
            dialogueContext: contextMessages,
            newsTopic: room.news_title,
            groupName: room.group_name,
            turnIndex: turnNum,
          });
          return [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ];
        })(),
        { temperature: 0.8, maxTokens: 300 }
      ),
      // 调用"更好说法" prompt
      callOpenAIJson(
        (() => {
          const contextSummary = contextMessages.slice(-3).map(t => {
            const name = t.speaker === 'npc_a' ? npcProfiles[0]?.name : npcProfiles[1]?.name;
            return `${name || t.speaker}: ${t.text}`;
          }).join('\n');
          const { systemPrompt, userPrompt } = betterVersionPrompt({
            userInput: userInput.trim(),
            dialogueContext: contextSummary,
            newsTopic: room.news_title,
            turnIndex: turnNum,
          });
          return [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ];
        })(),
        { temperature: 0.5, maxTokens: 200 }
      ),
    ]);

    // 处理 NPC 回复结果
    let npcReply = null;
    if (npcReplyResult.status === 'fulfilled') {
      const replyData = npcReplyResult.value;
      npcReply = {
        speaker: replyData.speaker || respondingNpc.id,
        text: replyData.text || '',
        textZh: replyData.textZh || '',
        voiceId: respondingNpc.voiceId || '',
      };
    } else {
      console.error('[v2-chat/respond] NPC 回复生成失败：', npcReplyResult.reason?.message);
      // 降级：使用兜底文案
      npcReply = {
        speaker: respondingNpc.id,
        text: 'Interesting point!',
        textZh: '有意思的观点！',
        voiceId: respondingNpc.voiceId || '',
      };
    }

    // 处理"更好说法"结果（失败时不影响主流程）
    let betterVersion = null;
    let feedbackType = null;
    let highlights = null;   // 数组，高亮短语
    let explanation = null;
    if (betterVersionResult.status === 'fulfilled') {
      const bvData = betterVersionResult.value;
      betterVersion = bvData.betterVersion || null;
      feedbackType = bvData.feedbackType || null;
      // highlights 可能是数组，解析后存为字符串；返回给前端时仍为数组
      if (Array.isArray(bvData.highlights)) {
        highlights = bvData.highlights;
      } else {
        highlights = [];
      }
      explanation = bvData.explanation || null;
    } else {
      console.error('[v2-chat/respond] 更好说法生成失败：', betterVersionResult.reason?.message);
    }

    // 存入 v2_user_messages（只存原有字段，新字段在 expression_cards 里存）
    const insertResult = db.prepare(`
      INSERT INTO v2_user_messages (chat_session_id, turn_index, user_input, better_version, context_note, npc_reply)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      chatSessionId.trim(),
      turnNum,
      userInput.trim(),
      betterVersion || null,
      explanation || null,   // context_note 字段复用为 explanation，向后兼容
      JSON.stringify(npcReply)
    );

    // 同步写入 v2_expression_cards（包含新字段），让 complete 接口无需再次生成
    if (betterVersion) {
      db.prepare(`
        INSERT INTO v2_expression_cards
          (user_id, chat_session_id, turn_index, user_said, better_version, context_note,
           feedback_type, highlighted_phrases, explanation, is_saved)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
      `).run(
        session.user_id,
        chatSessionId.trim(),
        turnNum,
        userInput.trim(),
        betterVersion,
        explanation || null,
        feedbackType || null,
        highlights ? JSON.stringify(highlights) : null,
        explanation || null
      );
    }

    // 更新会话的发言次数
    db.prepare('UPDATE v2_chat_sessions SET user_turn_count = user_turn_count + 1 WHERE id = ?').run(
      chatSessionId.trim()
    );

    const isLastTurn = turnNum >= 3;

    return res.status(200).json({
      messageId: insertResult.lastInsertRowid,
      npcReply,
      betterVersion,
      feedbackType,
      highlights,
      explanation,
      isLastTurn,
    });
  } catch (err) {
    console.error('[v2-chat/respond] 意外错误：', err.message);
    return res.status(500).json({ error: '服务器内部错误，请稍后重试' });
  }
});

/**
 * POST /api/v2/chat/complete
 * 完成群聊，生成表达卡片
 * 入参: { chatSessionId, force? }
 * 出参: { success: true }
 */
router.post('/complete', (req, res) => {
  try {
    const { chatSessionId, force } = req.body;

    if (!chatSessionId || !chatSessionId.trim()) {
      return res.status(400).json({ error: 'chatSessionId 不能为空' });
    }

    const session = db.prepare('SELECT * FROM v2_chat_sessions WHERE id = ?').get(chatSessionId.trim());
    if (!session) {
      return res.status(404).json({ error: '会话不存在' });
    }

    // 幂等保护：已完成的会话直接返回成功
    if (session.status === 'completed') {
      return res.status(200).json({ success: true });
    }
    // 非强制完成时，要求至少有一次发言
    if (!force && session.user_turn_count < 1) {
      return res.status(400).json({ error: '至少需要发言一次才能完成，或传 force=true 强制完成' });
    }

    // 查询房间的结算模板，提前抽取荒诞属性并持久化
    const roomForComplete = db.prepare('SELECT settlement_template FROM v2_rooms WHERE id = ?').get(session.room_id);
    const templateForComplete = roomForComplete ? JSON.parse(roomForComplete.settlement_template) : {};
    const absurdAttrs = pickAbsurdAttributes(templateForComplete.absurd_attributes_pool);

    // 更新会话状态为 completed，同时写入荒诞属性
    db.prepare(`
      UPDATE v2_chat_sessions
      SET status = 'completed', completed_at = CURRENT_TIMESTAMP, absurd_attributes = ?
      WHERE id = ?
    `).run(JSON.stringify(absurdAttrs), chatSessionId.trim());

    // 查询该会话已在 respond 阶段生成的表达卡片
    const existingCards = db.prepare(`
      SELECT * FROM v2_expression_cards
      WHERE chat_session_id = ?
      ORDER BY turn_index ASC
    `).all(chatSessionId.trim());

    // 兜底：如果 respond 阶段没写入卡片（旧数据或异常），从 v2_user_messages 补生成
    if (existingCards.length === 0) {
      const messages = db.prepare(`
        SELECT * FROM v2_user_messages
        WHERE chat_session_id = ?
        ORDER BY turn_index ASC
      `).all(chatSessionId.trim());

      const insertCard = db.prepare(`
        INSERT INTO v2_expression_cards (user_id, chat_session_id, turn_index, user_said, better_version, context_note, is_saved)
        VALUES (?, ?, ?, ?, ?, ?, 0)
      `);
      for (const msg of messages) {
        if (msg.better_version) {
          insertCard.run(
            session.user_id,
            chatSessionId.trim(),
            msg.turn_index,
            msg.user_input,
            msg.better_version,
            msg.context_note || null
          );
        }
      }
    }

    // 重新查询卡片（包含兜底生成的）
    const allCards = db.prepare(`
      SELECT * FROM v2_expression_cards
      WHERE chat_session_id = ?
      ORDER BY turn_index ASC
    `).all(chatSessionId.trim());

    // 按优先级挑选 featured 卡片：
    //   "更地道的说法" > "进阶表达" > "同样好用的说法" > 其他（无 feedback_type 的老数据）
    // 同类型中取 turn_index 最小的
    const feedbackPriority = { '更地道的说法': 1, '进阶表达': 2, '同样好用的说法': 3 };
    let featuredCard = null;
    for (const card of allCards) {
      if (!featuredCard) {
        featuredCard = card;
        continue;
      }
      const currPri = feedbackPriority[card.feedback_type] || 99;
      const bestPri = feedbackPriority[featuredCard.feedback_type] || 99;
      if (currPri < bestPri) {
        featuredCard = card;
      }
    }

    // 所有卡片 is_saved 设为 1（自动收藏），featured 那张额外设 is_featured = 1
    if (allCards.length > 0) {
      db.prepare(`
        UPDATE v2_expression_cards SET is_saved = 1 WHERE chat_session_id = ?
      `).run(chatSessionId.trim());

      if (featuredCard) {
        db.prepare(`
          UPDATE v2_expression_cards SET is_featured = 1 WHERE id = ?
        `).run(featuredCard.id);
      }
    }

    const cardCount = allCards.length;
    console.log(`[v2-chat/complete] 会话 ${chatSessionId} 完成，共 ${cardCount} 张卡片，featured: ${featuredCard?.id || '无'}`);

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[v2-chat/complete] 错误：', err.message);
    return res.status(500).json({ error: '服务器内部错误，请稍后重试' });
  }
});

/**
 * GET /api/v2/chat/:chatSessionId/settlement
 * 获取结算数据
 * 出参: { eventResult, expressionCards }
 */
router.get('/:chatSessionId/settlement', (req, res) => {
  try {
    const { chatSessionId } = req.params;

    const session = db.prepare('SELECT * FROM v2_chat_sessions WHERE id = ?').get(chatSessionId);
    if (!session) {
      return res.status(404).json({ error: '会话不存在' });
    }
    if (session.status !== 'completed') {
      return res.status(400).json({ error: '会话尚未完成，无法查看结算' });
    }

    // 查询房间的结算模板
    const room = db.prepare('SELECT settlement_template FROM v2_rooms WHERE id = ?').get(session.room_id);
    const settlementTemplate = room ? JSON.parse(room.settlement_template) : {};

    // 查询该会话的表达卡片
    const cards = db.prepare(`
      SELECT * FROM v2_expression_cards
      WHERE chat_session_id = ?
      ORDER BY turn_index ASC
    `).all(chatSessionId);

    const expressionCards = cards.map(card => ({
      id: card.id,
      turnIndex: card.turn_index,
      userSaid: card.user_said,
      feedbackType: card.feedback_type || null,                    // 新增：反馈类型
      betterVersion: card.better_version,
      highlights: card.highlighted_phrases                         // 新增：高亮短语数组
        ? (() => { try { return JSON.parse(card.highlighted_phrases); } catch (e) { return []; } })()
        : [],
      explanation: card.explanation || null,                       // 新增：解释文字
      isFeatured: card.is_featured === 1,                         // 新增：是否 featured
      isSaved: card.is_saved === 1,
    }));

    return res.status(200).json({
      // 结算类型和结构化结果
      settlementType: settlementTemplate.type || 'news',
      eventResult: settlementTemplate.event_result || '',
      structuredResult: settlementTemplate.structured_result || null,
      // newsletter: 报纸风结算内容（publisher/headline/bullets）
      newsletter: settlementTemplate.newsletter || null,
      // 荒诞属性：从 complete 阶段持久化的结果中读取
      absurdAttributes: session.absurd_attributes ? JSON.parse(session.absurd_attributes) : [],
      // 表达卡片（保持不变）
      expressionCards,
    });
  } catch (err) {
    console.error('[v2-chat/settlement] 错误：', err.message);
    return res.status(500).json({ error: '服务器内部错误，请稍后重试' });
  }
});

/**
 * POST /api/v2/chat/:chatSessionId/generate-hint
 * 动态生成💡参考说法
 * 读最近一条 NPC @用户消息，用 AI 生成一句符合用户水平的英文回应
 * 出参: { hint: string }
 */
router.post('/:chatSessionId/generate-hint', async (req, res) => {
  try {
    const { chatSessionId } = req.params;

    const session = db.prepare('SELECT * FROM v2_chat_sessions WHERE id = ?').get(chatSessionId);
    if (!session) {
      return res.status(404).json({ error: '会话不存在' });
    }

    // 查房间信息
    const room = db.prepare('SELECT id, news_title, dialogue_script, npc_profiles FROM v2_rooms WHERE id = ?').get(session.room_id);
    if (!room) {
      return res.status(404).json({ error: '房间不存在' });
    }

    const dialogueScript = JSON.parse(room.dialogue_script);
    const npcProfiles = JSON.parse(room.npc_profiles);

    // 根据 user_turn_count 定位当前的 user_cue（第 N 次发言对应第 N 个 user_cue）
    // user_turn_count 是已完成的发言次数，当前要回应第 (user_turn_count + 1) 个 cue
    const targetCueIndex = session.user_turn_count; // 0-based：第一次是第 0 个
    let cueCount = 0;
    let currentCueIdx = -1;
    for (let i = 0; i < dialogueScript.length; i++) {
      if (dialogueScript[i].type === 'user_cue') {
        if (cueCount === targetCueIndex) {
          currentCueIdx = i;
          break;
        }
        cueCount++;
      }
    }

    if (currentCueIdx === -1) {
      return res.status(400).json({ error: '找不到对应的发言节点' });
    }

    // 找 user_cue 前面最后一条 npc 消息（真正的 @用户消息）
    let cueMessage = null;
    let speakerName = 'NPC';
    for (let i = currentCueIdx - 1; i >= 0; i--) {
      if (dialogueScript[i].type === 'npc') {
        cueMessage = dialogueScript[i].text;
        const profile = npcProfiles.find(p => p.id === dialogueScript[i].speaker);
        if (profile) speakerName = profile.name;
        break;
      }
    }

    // 兜底：如果找不到 @ 消息，用 user_cue 的 hint
    if (!cueMessage) {
      cueMessage = dialogueScript[currentCueIdx].hint || '';
    }

    // 查用户花名，用于替换 @{username}
    const user = db.prepare('SELECT nickname FROM v2_users WHERE id = ?').get(session.user_id);
    const nickname = (user && user.nickname) || 'you';

    // 把 @{username} 替换为实际花名，让 AI 看到的是完整语境
    const cueWithName = (cueMessage || '').replace(/@\{username\}/g, '@' + nickname);

    // 调 AI 生成参考说法
    const { systemPrompt, userPrompt } = generateHintPrompt({
      cueMessage: cueWithName,
      speakerName,
      newsTopic: room.news_title || '',
      userLevel: 'A2',
    });

    const result = await callOpenAIJson([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);

    const hint = (result && result.hint) || '';
    if (!hint) {
      // AI 返回空 → 降级用 seed 里的 fallback
      const fallback = dialogueScript[currentCueIdx].options?.[0]?.example || 'What do you mean?';
      return res.status(200).json({ hint: fallback });
    }

    return res.status(200).json({ hint });
  } catch (err) {
    console.error('[v2-chat/generate-hint] 错误：', err.message);
    // 失败时降级：尝试从 seed 拿 fallback
    try {
      const { chatSessionId } = req.params;
      const session = db.prepare('SELECT room_id, user_turn_count FROM v2_chat_sessions WHERE id = ?').get(chatSessionId);
      const room = db.prepare('SELECT dialogue_script FROM v2_rooms WHERE id = ?').get(session.room_id);
      const script = JSON.parse(room.dialogue_script);
      const targetIdx = session.user_turn_count;
      let cnt = 0;
      for (const turn of script) {
        if (turn.type === 'user_cue') {
          if (cnt === targetIdx) {
            return res.status(200).json({ hint: turn.options?.[0]?.example || 'What do you mean?' });
          }
          cnt++;
        }
      }
    } catch (_) { /* 兜底也失败就返回固定 fallback */ }
    return res.status(200).json({ hint: 'What do you mean?' });
  }
});

/**
 * GET /api/v2/chat/:chatSessionId/dm-banner
 * 获取 NPC 私信 Banner
 * 出参: { hasBanner, banner }
 */
router.get('/:chatSessionId/dm-banner', (req, res) => {
  try {
    const { chatSessionId } = req.params;

    const session = db.prepare('SELECT * FROM v2_chat_sessions WHERE id = ?').get(chatSessionId);
    if (!session) {
      return res.status(404).json({ error: '会话不存在' });
    }

    // 只有已完成、有至少一次发言、且发送次数 < 2 才返回 Banner
    if (session.status !== 'completed' || session.user_turn_count < 1 || session.dm_sent_count >= 2) {
      return res.status(200).json({ hasBanner: false, banner: null });
    }

    // 查询房间的 NPC 信息，随机选一个 NPC
    const room = db.prepare('SELECT npc_profiles FROM v2_rooms WHERE id = ?').get(session.room_id);
    const npcProfiles = room ? JSON.parse(room.npc_profiles) : [];

    if (npcProfiles.length === 0) {
      return res.status(200).json({ hasBanner: false, banner: null });
    }

    // 随机选择 NPC 和 Banner 文案
    const npc = npcProfiles[Math.floor(Math.random() * npcProfiles.length)];
    const bannerTemplate = DM_BANNERS[Math.floor(Math.random() * DM_BANNERS.length)];

    // 更新 dm_sent_count
    db.prepare('UPDATE v2_chat_sessions SET dm_sent_count = dm_sent_count + 1 WHERE id = ?').run(chatSessionId);

    return res.status(200).json({
      hasBanner: true,
      banner: {
        npcName: npc.name,
        npcAvatar: null, // 暂无头像，前端用默认头像
        message: bannerTemplate.message,
        messageZh: bannerTemplate.messageZh,
      },
    });
  } catch (err) {
    console.error('[v2-chat/dm-banner] 错误：', err.message);
    return res.status(500).json({ error: '服务器内部错误，请稍后重试' });
  }
});

module.exports = router;
