/**
 * 历史记录路由
 * 查询指定 session 下的所有练习记录（含复盘状态）
 */

const express = require('express');
const router = express.Router();
const db = require('../db');

/**
 * GET /api/history/meeting/:meetingId
 * 获取单条历史会议的完整数据（meetingData + reviewData），用于恢复复盘页
 * 注意：此路由必须定义在 /:sessionId 之前，避免被动态参数路由提前匹配
 */
router.get('/meeting/:meetingId', (req, res) => {
  const { meetingId } = req.params;

  if (!meetingId || !meetingId.trim()) {
    return res.status(400).json({ error: 'meetingId 不能为空' });
  }

  try {
    // 查询会议完整数据
    const meeting = db.prepare('SELECT * FROM meetings WHERE id = ?').get(meetingId);
    if (!meeting) {
      return res.status(404).json({ error: '会议不存在' });
    }

    // 组装 meetingData（与前端 AppContext 中 meetingData 结构一致）
    const meetingData = {
      meetingId: meeting.id,
      briefing:   JSON.parse(meeting.briefing    || '{}'),
      roles:      JSON.parse(meeting.roles       || '[]'),
      dialogue:   JSON.parse(meeting.dialogue    || '[]'),
      keyNodes:   JSON.parse(meeting.key_nodes   || '[]'),
      references: JSON.parse(meeting.ref_phrases || '[]'),
    };

    // 查询最新的复盘记录（一条会议可能多次复盘，取最新）
    const review = db.prepare(
      'SELECT * FROM reviews WHERE meeting_id = ? ORDER BY created_at DESC LIMIT 1'
    ).get(meetingId);

    let reviewData = null;
    if (review) {
      reviewData = {
        reviewId:    review.id,
        achievement: review.achievement,
        improvement: review.improvement,
        nodes:       JSON.parse(review.nodes || '[]'),
      };
    }

    console.log(`[History/Meeting] meetingId=${meetingId}, hasReview=${Boolean(review)}`);
    return res.json({ meetingData, reviewData });

  } catch (err) {
    console.error('[History/Meeting] 查询失败：', err.message);
    return res.status(500).json({ error: '服务器内部错误，请稍后重试' });
  }
});

/**
 * GET /api/history/:sessionId
 * 返回该 session 的所有会议练习记录，按时间倒序
 * 每条记录包含：meetingId、会议主题、创建时间、是否有复盘、成就文字
 */
router.get('/:sessionId', (req, res) => {
  const { sessionId } = req.params;

  if (!sessionId || !sessionId.trim()) {
    return res.status(400).json({ error: 'sessionId 不能为空' });
  }

  try {
    // 验证 session 是否存在
    const session = db.prepare('SELECT id FROM sessions WHERE id = ?').get(sessionId);
    if (!session) {
      return res.status(404).json({ error: '用户会话不存在' });
    }

    // 查询该 session 下的所有会议，LEFT JOIN 复盘表获取成就信息
    // 按创建时间倒序，最新的在最前面
    const rows = db.prepare(`
      SELECT
        m.id          AS meetingId,
        m.briefing    AS briefingJson,
        m.status      AS meetingStatus,
        m.created_at  AS createdAt,
        r.id          AS reviewId,
        r.achievement AS achievement
      FROM meetings m
      LEFT JOIN reviews r ON r.meeting_id = m.id
      WHERE m.session_id = ?
      ORDER BY m.created_at DESC
    `).all(sessionId);

    // 解析 briefing JSON，提取 topic 字段
    const history = rows.map(row => {
      let topic = '未知会议';
      try {
        const briefing = JSON.parse(row.briefingJson || '{}');
        topic = briefing.topic || briefing.title || '未知会议';
      } catch (e) {
        // JSON 解析失败时使用默认值
      }

      return {
        meetingId:   row.meetingId,
        topic,
        createdAt:   row.createdAt,
        hasReview:   Boolean(row.reviewId),
        // achievement 存储复盘成就文字
        achievement: row.achievement || null,
      };
    });

    console.log(`[History] sessionId=${sessionId}, 记录数=${history.length}`);
    return res.json({ history });

  } catch (err) {
    console.error('[History] 查询失败：', err.message);
    return res.status(500).json({ error: '服务器内部错误，请稍后重试' });
  }
});

module.exports = router;
