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
const { generateSettlementPrompt } = require('../prompts/generate-settlement');

function countEnglishWords(text) {
  if (!text || typeof text !== 'string') return 0;
  const tokens = text.trim().split(/\s+/);
  return tokens.filter((token) => /[a-zA-Z]/.test(token)).length;
}

function formatDuration(sec) {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function safeJsonParse(value, fallback) {
  if (!value) return fallback;

  try {
    return JSON.parse(value);
  } catch (error) {
    return fallback;
  }
}

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

router.post('/join', async (req, res) => {
  try {
    const { userId, roomId } = req.body;

    if (!userId || !userId.trim()) {
      return res.status(400).json({ error: 'userId 不能为空' });
    }
    if (!roomId || !roomId.trim()) {
      return res.status(400).json({ error: 'roomId 不能为空' });
    }

    const trimmedUserId = userId.trim();
    const trimmedRoomId = roomId.trim();

    const room = await db.queryOne(
      'SELECT * FROM v2_rooms WHERE id = ? AND is_active = 1',
      [trimmedRoomId]
    );
    if (!room) {
      return res.status(404).json({ error: '房间不存在或已下线' });
    }

    await db.execute('INSERT IGNORE INTO v2_users (id) VALUES (?)', [trimmedUserId]);

    const chatSessionId = randomUUID();
    await db.execute(
      `
        INSERT INTO v2_chat_sessions (id, user_id, room_id, status, user_turn_count, npc_turn_count, dm_sent_count)
        VALUES (?, ?, ?, 'active', 0, 0, 0)
      `,
      [chatSessionId, trimmedUserId, trimmedRoomId]
    );

    console.log(`[v2-chat/join] 用户 ${userId} 加入房间 ${roomId}，会话 ${chatSessionId}`);

    return res.status(201).json({
      chatSessionId,
      groupName: room.group_name,
      groupNotice: room.group_notice || null,
      userRoleName: room.user_role_name,
      userRoleNameEn: room.user_role_name_en || null,
      userRoleDesc: room.user_role_desc || null,
      npcProfiles: safeJsonParse(room.npc_profiles, []),
      dialogueScript: safeJsonParse(room.dialogue_script, []),
      totalUserTurns: 3,
    });
  } catch (err) {
    console.error('[v2-chat/join] 错误：', err.message);
    return res.status(500).json({ error: '服务器内部错误，请稍后重试' });
  }
});

router.post('/respond', async (req, res) => {
  try {
    const { chatSessionId, turnIndex, userInput } = req.body;

    if (!chatSessionId || !chatSessionId.trim()) {
      return res.status(400).json({ error: 'chatSessionId 不能为空' });
    }
    if (turnIndex === undefined || turnIndex === null) {
      return res.status(400).json({ error: 'turnIndex 不能为空' });
    }

    const turnNum = parseInt(turnIndex, 10);
    if (Number.isNaN(turnNum) || turnNum < 1 || turnNum > 3) {
      return res.status(409).json({ error: 'turnIndex 必须为 1、2 或 3' });
    }
    if (!userInput || !userInput.trim()) {
      return res.status(400).json({ error: 'userInput 不能为空' });
    }

    const trimmedSessionId = chatSessionId.trim();
    const trimmedUserInput = userInput.trim();

    const session = await db.queryOne('SELECT * FROM v2_chat_sessions WHERE id = ?', [trimmedSessionId]);
    if (!session) {
      return res.status(404).json({ error: '会话不存在' });
    }
    if (session.status !== 'active') {
      return res.status(409).json({ error: '会话已结束，无法继续发言' });
    }
    if (session.user_turn_count >= 3) {
      return res.status(409).json({ error: '已达到最大发言次数（3次）' });
    }
    if (turnNum !== session.user_turn_count + 1) {
      return res.status(409).json({
        error: `发言顺序错误，期望 turnIndex=${session.user_turn_count + 1}，收到 ${turnNum}`,
      });
    }

    const room = await db.queryOne('SELECT * FROM v2_rooms WHERE id = ?', [session.room_id]);
    if (!room) {
      return res.status(404).json({ error: '房间数据异常' });
    }

    const npcProfiles = safeJsonParse(room.npc_profiles, []);
    const dialogueScript = safeJsonParse(room.dialogue_script, []);
    const respondingNpcIndex = (turnNum - 1) % npcProfiles.length;
    const respondingNpc = npcProfiles[respondingNpcIndex];

    const scriptContext = dialogueScript
      .filter((turn) => turn.type !== 'user_cue')
      .slice(0, turnNum * 4)
      .map((turn) => ({ type: turn.type, speaker: turn.speaker, text: turn.text }));

    const priorMessages = await db.queryAll(
      `
        SELECT user_input, npc_reply FROM v2_user_messages
        WHERE chat_session_id = ? AND turn_index < ?
        ORDER BY turn_index ASC
      `,
      [trimmedSessionId, turnNum]
    );

    const userHistory = [];
    for (const priorMessage of priorMessages) {
      userHistory.push({ type: 'user', speaker: 'user', text: priorMessage.user_input });

      const parsedReply = safeJsonParse(priorMessage.npc_reply, null);
      if (parsedReply) {
        userHistory.push({ type: 'npc', speaker: parsedReply.speaker, text: parsedReply.text });
      }
    }

    const contextMessages = [...scriptContext, ...userHistory];

    console.log(`[v2-chat/respond] 会话 ${chatSessionId}，第 ${turnNum} 次发言`);

    const llmWallStart = Date.now();
    let respondChatMs = 0;
    let betterVersionMs = 0;

    const [npcReplyResult, betterVersionResult] = await Promise.allSettled([
      (async () => {
        const startedAt = Date.now();
        try {
          const { systemPrompt, userPrompt } = respondChatPrompt({
            userInput: trimmedUserInput,
            respondingNpc,
            allNpcProfiles: npcProfiles,
            dialogueContext: contextMessages,
            newsTopic: room.news_title,
            groupName: room.group_name,
            turnIndex: turnNum,
          });

          return await callOpenAIJson(
            [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            { temperature: 0.8, maxTokens: 300 }
          );
        } finally {
          respondChatMs = Date.now() - startedAt;
        }
      })(),
      (async () => {
        const startedAt = Date.now();
        try {
          const contextSummary = contextMessages
            .slice(-3)
            .map((turn) => {
              const speakerName = turn.speaker === 'npc_a'
                ? npcProfiles[0]?.name
                : turn.speaker === 'npc_b'
                  ? npcProfiles[1]?.name
                  : turn.speaker;

              return `${speakerName || turn.speaker}: ${turn.text}`;
            })
            .join('\n');

          const { systemPrompt, userPrompt } = betterVersionPrompt({
            userInput: trimmedUserInput,
            dialogueContext: contextSummary,
            newsTopic: room.news_title,
            turnIndex: turnNum,
          });

          return await callOpenAIJson(
            [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            { temperature: 0.5, maxTokens: 200 }
          );
        } finally {
          betterVersionMs = Date.now() - startedAt;
        }
      })(),
    ]);

    const llmWallClock = Date.now() - llmWallStart;
    console.log(
      `[v2-chat/respond] LLM timings: respondChat=${respondChatMs}ms, betterVersion=${betterVersionMs}ms, wallClock=${llmWallClock}ms`
    );

    let npcReply = null;
    if (npcReplyResult.status === 'fulfilled') {
      const replyData = npcReplyResult.value;
      npcReply = {
        speaker: replyData.speaker || respondingNpc.id,
        text: replyData.text || '',
        textZh: replyData.textZh || '',
        emotion: replyData.emotion || 'neutral',
        voiceId: respondingNpc.voiceId || '',
      };
    } else {
      console.error('[v2-chat/respond] NPC 回复生成失败：', npcReplyResult.reason?.message);
      npcReply = {
        speaker: respondingNpc.id,
        text: 'Interesting point!',
        textZh: '有意思的观点！',
        emotion: 'neutral',
        voiceId: respondingNpc.voiceId || '',
      };
    }

    let betterVersion = null;
    let feedbackType = null;
    let highlights = null;
    let intentAnalysis = null;
    let learningType = null;
    let pattern = null;
    let collocations = null;

    if (betterVersionResult.status === 'fulfilled') {
      const betterVersionData = betterVersionResult.value;
      betterVersion = betterVersionData.betterVersion || null;
      feedbackType = betterVersionData.feedbackType || null;
      intentAnalysis = betterVersionData.intentAnalysis || null;
      learningType = betterVersionData.learningType || null;
      pattern = betterVersionData.pattern || null;

      if (Array.isArray(betterVersionData.collocations) && betterVersionData.collocations.length > 0) {
        collocations = betterVersionData.collocations.slice(0, 2);
      }

      if (Array.isArray(betterVersionData.highlights) && betterVersionData.highlights.length > 0) {
        highlights = betterVersionData.highlights;
      } else if (collocations) {
        highlights = collocations.map((item) => item.phrase);
      } else {
        highlights = [];
      }
    } else {
      console.error('[v2-chat/respond] 更好说法生成失败：', betterVersionResult.reason?.message);
    }

    const writeResult = await db.transaction(async (tx) => {
      const insertMessageResult = await tx.execute(
        `
          INSERT INTO v2_user_messages (chat_session_id, turn_index, user_input, better_version, context_note, npc_reply)
          VALUES (?, ?, ?, ?, ?, ?)
        `,
        [
          trimmedSessionId,
          turnNum,
          trimmedUserInput,
          betterVersion || null,
          null,
          JSON.stringify(npcReply),
        ]
      );

      if (betterVersion) {
        await tx.execute(
          `
            INSERT INTO v2_expression_cards
              (user_id, chat_session_id, turn_index, user_said, better_version,
               feedback_type, highlighted_phrases, intent_analysis,
               learning_type, pattern, collocations_json, is_saved)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
          `,
          [
            session.user_id,
            trimmedSessionId,
            turnNum,
            trimmedUserInput,
            betterVersion,
            feedbackType || null,
            highlights ? JSON.stringify(highlights) : null,
            intentAnalysis || null,
            learningType || null,
            pattern || null,
            collocations ? JSON.stringify(collocations) : null,
          ]
        );
      }

      await tx.execute(
        'UPDATE v2_chat_sessions SET user_turn_count = user_turn_count + 1 WHERE id = ?',
        [trimmedSessionId]
      );

      return insertMessageResult;
    });

    return res.status(200).json({
      messageId: writeResult.insertId,
      npcReply,
      betterVersion,
      feedbackType,
      learningType,
      pattern,
      collocations,
      highlights,
      isLastTurn: turnNum >= 3,
    });
  } catch (err) {
    console.error('[v2-chat/respond] 意外错误：', err.message);
    return res.status(500).json({ error: '服务器内部错误，请稍后重试' });
  }
});

router.post('/complete', async (req, res) => {
  try {
    const { chatSessionId, force } = req.body;

    if (!chatSessionId || !chatSessionId.trim()) {
      return res.status(400).json({ error: 'chatSessionId 不能为空' });
    }

    const trimmedSessionId = chatSessionId.trim();
    const session = await db.queryOne('SELECT * FROM v2_chat_sessions WHERE id = ?', [trimmedSessionId]);
    if (!session) {
      return res.status(404).json({ error: '会话不存在' });
    }

    if (session.status === 'completed') {
      return res.status(200).json({ success: true });
    }
    if (!force && session.user_turn_count < 1) {
      return res.status(400).json({ error: '至少需要发言一次才能完成，或传 force=true 强制完成' });
    }

    const roomForComplete = await db.queryOne(
      'SELECT settlement_template, news_title FROM v2_rooms WHERE id = ?',
      [session.room_id]
    );
    const templateForComplete = safeJsonParse(roomForComplete?.settlement_template, {});
    const newsTitle = roomForComplete?.news_title || '';

    const userMessages = await db.queryAll(
      `
        SELECT user_input, npc_reply FROM v2_user_messages
        WHERE chat_session_id = ?
        ORDER BY turn_index ASC
      `,
      [trimmedSessionId]
    );

    const userMsgTexts = userMessages.map((message) => message.user_input || '');
    const npcReplyTexts = userMessages.map((message) => {
      const parsedReply = safeJsonParse(message.npc_reply, null);
      if (!parsedReply) return '';
      return parsedReply.textZh || parsedReply.text || '';
    });

    let dynamicNewsletter = null;

    try {
      const publisher = templateForComplete.newsletter?.publisher || '今日快报';
      const { systemPrompt, userPrompt } = generateSettlementPrompt({
        newsTopic: newsTitle,
        publisher,
        userMessages: userMsgTexts,
        npcReplies: npcReplyTexts,
      });

      const aiResult = await callOpenAIJson(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        { temperature: 0.8, maxTokens: 500 }
      );

      if (aiResult && aiResult.headline) {
        dynamicNewsletter = {
          publisher,
          headline: aiResult.headline,
          epilogue: Array.isArray(aiResult.epilogue)
            ? aiResult.epilogue.slice(0, 2)
            : (aiResult.epilogue || ''),
          title: aiResult.title || '',
        };
        console.log(
          `[v2-chat/complete] AI 结算新闻生成成功：${aiResult.headline}｜称号：${aiResult.title}`
        );
      }
    } catch (aiErr) {
      console.error('[v2-chat/complete] AI 结算生成失败，降级到空内容：', aiErr.message);
    }

    const allCards = await db.transaction(async (tx) => {
      await tx.execute(
        `
          UPDATE v2_chat_sessions
          SET status = 'completed', completed_at = CURRENT_TIMESTAMP,
              settlement_newsletter = ?
          WHERE id = ?
        `,
        [dynamicNewsletter ? JSON.stringify(dynamicNewsletter) : null, trimmedSessionId]
      );

      const cards = await tx.queryAll(
        `
          SELECT * FROM v2_expression_cards
          WHERE chat_session_id = ?
          ORDER BY turn_index ASC
        `,
        [trimmedSessionId]
      );

      const feedbackPriority = {
        '更地道的说法': 1,
        '进阶表达': 2,
        '同样好用的说法': 3,
      };

      let featuredCard = null;
      for (const card of cards) {
        if (!featuredCard) {
          featuredCard = card;
          continue;
        }

        const currentPriority = feedbackPriority[card.feedback_type] || 99;
        const bestPriority = feedbackPriority[featuredCard.feedback_type] || 99;
        if (currentPriority < bestPriority) {
          featuredCard = card;
        }
      }

      if (cards.length > 0) {
        await tx.execute(
          'UPDATE v2_expression_cards SET is_saved = 1, is_featured = 0 WHERE chat_session_id = ?',
          [trimmedSessionId]
        );

        if (featuredCard) {
          await tx.execute('UPDATE v2_expression_cards SET is_featured = 1 WHERE id = ?', [
            featuredCard.id,
          ]);
        }
      }

      return { cards, featuredCard };
    });

    console.log(
      `[v2-chat/complete] 会话 ${chatSessionId} 完成，共 ${allCards.cards.length} 张卡片，featured: ${allCards.featuredCard?.id || '无'}`
    );

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[v2-chat/complete] 错误：', err.message);
    return res.status(500).json({ error: '服务器内部错误，请稍后重试' });
  }
});

router.get('/:chatSessionId/settlement', async (req, res) => {
  try {
    const { chatSessionId } = req.params;

    const session = await db.queryOne('SELECT * FROM v2_chat_sessions WHERE id = ?', [chatSessionId]);
    if (!session) {
      return res.status(404).json({ error: '会话不存在' });
    }
    if (session.status !== 'completed') {
      return res.status(400).json({ error: '会话尚未完成，无法查看结算' });
    }

    const room = await db.queryOne(
      'SELECT settlement_template, tags FROM v2_rooms WHERE id = ?',
      [session.room_id]
    );
    const settlementTemplate = safeJsonParse(room?.settlement_template, {});

    let ipName = '';
    if (room?.tags) {
      const tags = safeJsonParse(room.tags, []);
      ipName = Array.isArray(tags) && tags[0] ? tags[0] : '';
    }

    const dynamicNewsletter = safeJsonParse(session.settlement_newsletter, null);
    const rawNewsletter = dynamicNewsletter || settlementTemplate.newsletter || {};

    const newsletter = {
      publisher: rawNewsletter.publisher || '',
      ipName,
      headline: rawNewsletter.headline || '',
      epilogue: rawNewsletter.epilogue || '',
      title: rawNewsletter.title || '',
    };

    let duration = '0:00';
    if (session.completed_at && session.started_at) {
      const startMs = new Date(session.started_at).getTime();
      const endMs = new Date(session.completed_at).getTime();
      if (!Number.isNaN(startMs) && !Number.isNaN(endMs)) {
        duration = formatDuration((endMs - startMs) / 1000);
      }
    }

    const userInputRows = await db.queryAll(
      `
        SELECT user_input FROM v2_user_messages
        WHERE chat_session_id = ?
        ORDER BY turn_index ASC
      `,
      [chatSessionId]
    );
    const allUserText = userInputRows.map((row) => row.user_input || '').join(' ');
    const wordCount = countEnglishWords(allUserText);

    const cards = await db.queryAll(
      `
        SELECT * FROM v2_expression_cards
        WHERE chat_session_id = ?
        ORDER BY turn_index ASC
      `,
      [chatSessionId]
    );

    const expressionCards = cards.map((card) => ({
      id: card.id,
      turnIndex: card.turn_index,
      userSaid: card.user_said,
      feedbackType: card.feedback_type || null,
      betterVersion: card.better_version,
      learningType: card.learning_type || null,
      pattern: card.pattern || null,
      collocations: safeJsonParse(card.collocations_json, null),
      highlights: safeJsonParse(card.highlighted_phrases, []),
      isFeatured: card.is_featured === 1,
      isSaved: card.is_saved === 1,
    }));

    return res.status(200).json({
      newsletter,
      stats: {
        duration,
        wordCount,
      },
      expressionCards,
    });
  } catch (err) {
    console.error('[v2-chat/settlement] 错误：', err.message);
    return res.status(500).json({ error: '服务器内部错误，请稍后重试' });
  }
});

router.post('/:chatSessionId/generate-hint', async (req, res) => {
  try {
    const { chatSessionId } = req.params;

    const session = await db.queryOne('SELECT * FROM v2_chat_sessions WHERE id = ?', [chatSessionId]);
    if (!session) {
      return res.status(404).json({ error: '会话不存在' });
    }

    const room = await db.queryOne(
      'SELECT id, news_title, dialogue_script, npc_profiles FROM v2_rooms WHERE id = ?',
      [session.room_id]
    );
    if (!room) {
      return res.status(404).json({ error: '房间不存在' });
    }

    const dialogueScript = safeJsonParse(room.dialogue_script, []);
    const npcProfiles = safeJsonParse(room.npc_profiles, []);

    const targetCueIndex = session.user_turn_count;
    let cueCount = 0;
    let currentCueIdx = -1;

    for (let index = 0; index < dialogueScript.length; index += 1) {
      if (dialogueScript[index].type === 'user_cue') {
        if (cueCount === targetCueIndex) {
          currentCueIdx = index;
          break;
        }
        cueCount++;
      }
    }

    if (currentCueIdx === -1) {
      return res.status(400).json({ error: '找不到对应的发言节点' });
    }

    let cueMessage = null;
    let speakerName = 'NPC';
    for (let index = currentCueIdx - 1; index >= 0; index -= 1) {
      if (dialogueScript[index].type === 'npc') {
        cueMessage = dialogueScript[index].text;
        const profile = npcProfiles.find((npc) => npc.id === dialogueScript[index].speaker);
        if (profile) {
          speakerName = profile.name;
        }
        break;
      }
    }

    if (!cueMessage) {
      cueMessage = dialogueScript[currentCueIdx].hint || '';
    }

    const user = await db.queryOne('SELECT nickname FROM v2_users WHERE id = ?', [session.user_id]);
    const nickname = user?.nickname || 'you';
    const cueWithName = cueMessage.replace(/@\{username\}/g, `@${nickname}`);

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

    const hint = result?.hint || '';
    if (!hint) {
      const fallback = dialogueScript[currentCueIdx].options?.[0]?.example || 'What do you mean?';
      return res.status(200).json({ hint: fallback });
    }

    return res.status(200).json({ hint });
  } catch (err) {
    console.error('[v2-chat/generate-hint] 错误：', err.message);

    try {
      const { chatSessionId } = req.params;
      const session = await db.queryOne(
        'SELECT room_id, user_turn_count FROM v2_chat_sessions WHERE id = ?',
        [chatSessionId]
      );
      const room = session
        ? await db.queryOne('SELECT dialogue_script FROM v2_rooms WHERE id = ?', [session.room_id])
        : null;
      const script = safeJsonParse(room?.dialogue_script, []);
      const targetIdx = session?.user_turn_count || 0;

      let cueCount = 0;
      for (const turn of script) {
        if (turn.type === 'user_cue') {
          if (cueCount === targetIdx) {
            return res.status(200).json({ hint: turn.options?.[0]?.example || 'What do you mean?' });
          }
          cueCount++;
        }
      }
    } catch (fallbackError) {
      console.error('[v2-chat/generate-hint] fallback 失败：', fallbackError.message);
    }

    return res.status(200).json({ hint: 'What do you mean?' });
  }
});

router.get('/:chatSessionId/dm-banner', async (req, res) => {
  try {
    const { chatSessionId } = req.params;

    const session = await db.queryOne('SELECT * FROM v2_chat_sessions WHERE id = ?', [chatSessionId]);
    if (!session) {
      return res.status(404).json({ error: '会话不存在' });
    }

    if (session.status !== 'completed' || session.user_turn_count < 1 || session.dm_sent_count >= 2) {
      return res.status(200).json({ hasBanner: false, banner: null });
    }

    const room = await db.queryOne('SELECT npc_profiles FROM v2_rooms WHERE id = ?', [session.room_id]);
    const npcProfiles = safeJsonParse(room?.npc_profiles, []);
    if (npcProfiles.length === 0) {
      return res.status(200).json({ hasBanner: false, banner: null });
    }

    const npc = npcProfiles[Math.floor(Math.random() * npcProfiles.length)];
    const bannerTemplate = DM_BANNERS[Math.floor(Math.random() * DM_BANNERS.length)];

    await db.execute(
      'UPDATE v2_chat_sessions SET dm_sent_count = dm_sent_count + 1 WHERE id = ?',
      [chatSessionId]
    );

    return res.status(200).json({
      hasBanner: true,
      banner: {
        npcName: npc.name,
        npcAvatar: null,
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
