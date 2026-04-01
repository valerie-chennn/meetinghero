/**
 * 复盘相关路由
 * 处理会后复盘生成和练习反馈
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const { callOpenAIJson } = require('../services/openai');
const { generateReviewPrompt, generatePracticeFeedbackPrompt } = require('../prompts/generate-review');

/**
 * POST /api/review/generate
 * 基于会议表现生成复盘报告
 */
router.post('/generate', async (req, res) => {
  try {
    const { meetingId } = req.body;

    if (!meetingId) {
      return res.status(400).json({ error: 'meetingId 不能为空' });
    }

    // 查询会议数据
    const meeting = db.prepare('SELECT * FROM meetings WHERE id = ?').get(meetingId);
    if (!meeting) {
      return res.status(404).json({ error: '会议不存在' });
    }

    // 查询该会议的所有对话记录
    const conversations = db.prepare(
      'SELECT * FROM conversations WHERE meeting_id = ? ORDER BY node_index ASC'
    ).all(meetingId);

    // 查询用户英语等级
    const session = db.prepare('SELECT english_level FROM sessions WHERE id = ?').get(meeting.session_id);
    const englishLevel = session?.english_level || 'B1';

    // 解析会议数据
    const meetingData = {
      briefing: JSON.parse(meeting.briefing || '{}'),
      roles: JSON.parse(meeting.roles || '[]'),
      keyNodes: JSON.parse(meeting.key_nodes || '[]'),
      references: JSON.parse(meeting.ref_phrases || '[]'),
    };

    // 获取脑洞模式相关信息（用于私信风格约束）
    const sceneType = meeting.scene_type || 'formal';
    const isBrainstorm = sceneType === 'brainstorm-pick' || sceneType === 'brainstorm-random';

    // 脑洞模式：从 roles 中提取角色的 persona 信息用于私信风格指引
    let brainstormCharacters = null;
    if (isBrainstorm) {
      // roles 中的 briefNote 包含了角色性格，这里用 name + briefNote 作为 persona 指引
      const roles = meetingData.roles || [];
      brainstormCharacters = roles.map(r => ({
        name: r.name,
        persona: r.briefNote || r.title || '',
      }));
    }

    console.log(`[Review/Generate] meetingId=${meetingId}, 对话记录数=${conversations.length}, sceneType=${sceneType}`);

    // 构造 prompt（脑洞模式传入角色风格信息）
    const { systemPrompt, userPrompt } = generateReviewPrompt({
      meetingData,
      conversationHistory: conversations,
      englishLevel,
      sceneType,
      brainstormCharacters,
    });

    // 调用 AI 生成复盘
    let reviewData;
    try {
      reviewData = await callOpenAIJson(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        { temperature: 0.6, maxTokens: 4000 }
      );
    } catch (aiErr) {
      console.error('[Review/Generate] OpenAI 调用失败：', aiErr.message);
      return res.status(502).json({ error: `AI 服务调用失败: ${aiErr.message}` });
    }

    // 生成复盘 ID
    const reviewId = crypto.randomUUID();

    // 保存复盘到数据库
    db.prepare(`
      INSERT INTO reviews (id, meeting_id, achievement, improvement, nodes)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      reviewId,
      meetingId,
      reviewData.achievement || '',
      reviewData.improvement || '',
      JSON.stringify(reviewData.nodes || [])
    );

    console.log(`[Review/Generate] 复盘生成成功 reviewId=${reviewId}`);

    return res.status(201).json({
      reviewId,
      // 称号字段
      title: reviewData.title || '会议英雄',
      titleEmoji: reviewData.titleEmoji || '🎖️',
      titleSubtext: reviewData.titleSubtext || '这场会，你撑过来了',
      // 策略亮点
      highlight: reviewData.highlight || null,
      lowlight: reviewData.lowlight || null,
      // 角色私信（新版多条 + 旧版单条向后兼容）
      roleFeedbacks: reviewData.roleFeedbacks || [],
      roleFeedback: reviewData.roleFeedback || (reviewData.roleFeedbacks && reviewData.roleFeedbacks[0]) || null,
      achievement: reviewData.achievement,
      improvement: reviewData.improvement,
      nodes: reviewData.nodes,
    });
  } catch (err) {
    console.error('[Review/Generate] 意外错误：', err.message);
    return res.status(500).json({ error: '服务器内部错误，请稍后重试' });
  }
});

/**
 * POST /api/review/practice
 * 评估用户的练习表现并给出反馈
 */
router.post('/practice', async (req, res) => {
  try {
    const { meetingId, nodeIndex, userInput } = req.body;

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

    // 查询会议和复盘数据
    const meeting = db.prepare('SELECT * FROM meetings WHERE id = ?').get(meetingId);
    if (!meeting) {
      return res.status(404).json({ error: '会议不存在' });
    }

    // 查询最新的复盘记录
    const review = db.prepare(
      'SELECT * FROM reviews WHERE meeting_id = ? ORDER BY created_at DESC LIMIT 1'
    ).get(meetingId);

    if (!review) {
      return res.status(404).json({ error: '复盘数据不存在，请先生成复盘' });
    }

    // 解析复盘节点数据
    const reviewNodes = JSON.parse(review.nodes || '[]');
    const targetNode = reviewNodes.find((n) => n.nodeIndex === nodeIndex);

    if (!targetNode) {
      return res.status(404).json({ error: `复盘节点 ${nodeIndex} 不存在` });
    }

    // 查询用户英语等级
    const session = db.prepare('SELECT english_level FROM sessions WHERE id = ?').get(meeting.session_id);
    const englishLevel = session?.english_level || 'B1';

    console.log(`[Review/Practice] meetingId=${meetingId}, nodeIndex=${nodeIndex}`);

    // 构造 prompt
    const { systemPrompt, userPrompt } = generatePracticeFeedbackPrompt({
      userInput: userInput.trim(),
      practiceScenario: targetNode.practice?.scenario || '',
      practiceTask: targetNode.practice?.task || '',
      targetPattern: targetNode.pattern?.mainPattern || '',
      englishLevel,
    });

    // 调用 AI 生成反馈
    let feedbackData;
    try {
      feedbackData = await callOpenAIJson(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        { temperature: 0.5, maxTokens: 500 }
      );
    } catch (aiErr) {
      console.error('[Review/Practice] OpenAI 调用失败：', aiErr.message);
      return res.status(502).json({ error: `AI 服务调用失败: ${aiErr.message}` });
    }

    console.log(`[Review/Practice] 反馈生成成功，status=${feedbackData.status}`);

    return res.status(200).json({
      feedback: feedbackData.feedback || '反馈生成失败，请重试',
      status: feedbackData.status || 'ok',
    });
  } catch (err) {
    console.error('[Review/Practice] 意外错误：', err.message);
    return res.status(500).json({ error: '服务器内部错误，请稍后重试' });
  }
});

module.exports = router;
