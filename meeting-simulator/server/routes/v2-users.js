/**
 * v2 用户路由
 * 处理用户初始化（设备级，无需注册）
 */

const express = require('express');
const router = express.Router();
const db = require('../db');

/**
 * POST /api/v2/users/init
 * 创建或更新用户记录（幂等）
 * 入参: { userId, nickname? }
 * 出参: { userId, nickname, isNew }
 */
router.post('/init', (req, res) => {
  try {
    const { userId, nickname } = req.body;

    if (!userId || !userId.trim()) {
      return res.status(400).json({ error: 'userId 不能为空' });
    }

    const trimmedUserId = userId.trim();

    // 查询用户是否已存在
    const existing = db.prepare('SELECT * FROM v2_users WHERE id = ?').get(trimmedUserId);

    if (existing) {
      // 用户已存在：如果传了 nickname 则更新，否则保留原值
      if (nickname !== undefined) {
        db.prepare('UPDATE v2_users SET nickname = ? WHERE id = ?').run(
          nickname ? nickname.trim() : null,
          trimmedUserId
        );
      }
      const updated = db.prepare('SELECT * FROM v2_users WHERE id = ?').get(trimmedUserId);
      return res.status(200).json({
        userId: updated.id,
        nickname: updated.nickname,
        isNew: false,
      });
    }

    // 用户不存在：创建新记录
    db.prepare('INSERT INTO v2_users (id, nickname) VALUES (?, ?)').run(
      trimmedUserId,
      nickname ? nickname.trim() : null
    );

    return res.status(201).json({
      userId: trimmedUserId,
      nickname: nickname ? nickname.trim() : null,
      isNew: true,
    });
  } catch (err) {
    console.error('[v2-users/init] 错误：', err.message);
    return res.status(500).json({ error: '服务器内部错误，请稍后重试' });
  }
});

/**
 * GET /api/v2/users/:userId/stats
 * 获取用户统计数据
 * 出参: { chatCount, messageCount, savedCount }
 */
router.get('/:userId/stats', (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId || !userId.trim()) {
      return res.status(400).json({ error: 'userId 不能为空' });
    }
    const uid = userId.trim();

    // 参与群聊数（已完成的会话）
    const chatCount = db.prepare(
      'SELECT COUNT(*) as count FROM v2_chat_sessions WHERE user_id = ? AND status = ?'
    ).get(uid, 'completed')?.count || 0;

    // 总发言次数
    const messageCount = db.prepare(`
      SELECT COUNT(*) as count FROM v2_user_messages um
      JOIN v2_chat_sessions cs ON um.chat_session_id = cs.id
      WHERE cs.user_id = ?
    `).get(uid)?.count || 0;

    // 表达收藏数
    const savedCount = db.prepare(
      'SELECT COUNT(*) as count FROM v2_expression_cards WHERE user_id = ? AND is_saved = 1'
    ).get(uid)?.count || 0;

    return res.status(200).json({
      chatCount,
      messageCount,
      savedCount,
    });
  } catch (err) {
    console.error('[v2-users/stats] 错误：', err.message);
    return res.status(500).json({ error: '服务器内部错误' });
  }
});

module.exports = router;
