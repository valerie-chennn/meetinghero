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
router.post('/init', async (req, res) => {
  try {
    const { userId, nickname } = req.body;

    if (!userId || !userId.trim()) {
      return res.status(400).json({ error: 'userId 不能为空' });
    }

    const trimmedUserId = userId.trim();

    const existing = await db.queryOne('SELECT * FROM v2_users WHERE id = ?', [trimmedUserId]);

    if (existing) {
      if (nickname !== undefined) {
        await db.execute('UPDATE v2_users SET nickname = ? WHERE id = ?', [
          nickname ? nickname.trim() : null,
          trimmedUserId,
        ]);
      }

      const updated = await db.queryOne('SELECT * FROM v2_users WHERE id = ?', [trimmedUserId]);
      return res.status(200).json({
        userId: updated.id,
        nickname: updated.nickname,
        isNew: false,
      });
    }

    await db.execute('INSERT INTO v2_users (id, nickname) VALUES (?, ?)', [
      trimmedUserId,
      nickname ? nickname.trim() : null,
    ]);

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
router.get('/:userId/stats', async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId || !userId.trim()) {
      return res.status(400).json({ error: 'userId 不能为空' });
    }
    const uid = userId.trim();

    const chatCountRow = await db.queryOne(
      'SELECT COUNT(*) AS count FROM v2_chat_sessions WHERE user_id = ? AND status = ?',
      [uid, 'completed']
    );

    const messageCountRow = await db.queryOne(
      `
        SELECT COUNT(*) AS count FROM v2_user_messages um
        JOIN v2_chat_sessions cs ON um.chat_session_id = cs.id
        WHERE cs.user_id = ?
      `,
      [uid]
    );

    const savedCountRow = await db.queryOne(
      'SELECT COUNT(*) AS count FROM v2_expression_cards WHERE user_id = ? AND is_saved = 1',
      [uid]
    );

    return res.status(200).json({
      chatCount: chatCountRow?.count || 0,
      messageCount: messageCountRow?.count || 0,
      savedCount: savedCountRow?.count || 0,
    });
  } catch (err) {
    console.error('[v2-users/stats] 错误：', err.message);
    return res.status(500).json({ error: '服务器内部错误' });
  }
});

module.exports = router;
