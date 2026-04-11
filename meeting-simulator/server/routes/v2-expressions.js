/**
 * v2 表达本路由
 * 处理表达卡片的查询、收藏、取消收藏
 */

const express = require('express');
const router = express.Router();
const db = require('../db');

/**
 * GET /api/v2/expressions
 * 获取用户已收藏的表达卡片列表
 * 查询参数: userId
 * 出参: { cards }
 */
router.get('/', async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId || !userId.trim()) {
      return res.status(400).json({ error: 'userId 不能为空' });
    }

    const cards = await db.queryAll(
      `
        SELECT * FROM v2_expression_cards
        WHERE user_id = ?
        ORDER BY created_at DESC
      `,
      [userId.trim()]
    );

    const total = cards.length;
    const savedCount = cards.filter((card) => card.is_saved === 1).length;
    const practicedCount = cards.filter((card) => card.is_practiced === 1).length;

    return res.status(200).json({
      cards: cards.map((card) => ({
        id: card.id,
        userSaid: card.user_said,
        betterVersion: card.better_version,
        contextNote: card.context_note,
        isSaved: card.is_saved === 1,
        isPracticed: card.is_practiced === 1,
        savedAt: card.created_at,
      })),
      stats: { total, savedCount, practicedCount },
    });
  } catch (err) {
    console.error('[v2-expressions/list] 错误：', err.message);
    return res.status(500).json({ error: '服务器内部错误，请稍后重试' });
  }
});

/**
 * POST /api/v2/expressions/:id/save
 * 收藏表达卡片
 * 入参: { userId }
 * 出参: { id, isSaved: true }
 */
router.post('/:id/save', async (req, res) => {
  try {
    const cardId = parseInt(req.params.id, 10);
    const { userId } = req.body;

    if (Number.isNaN(cardId)) {
      return res.status(400).json({ error: '卡片 ID 无效' });
    }
    if (!userId || !userId.trim()) {
      return res.status(400).json({ error: 'userId 不能为空' });
    }

    const card = await db.queryOne('SELECT * FROM v2_expression_cards WHERE id = ?', [cardId]);
    if (!card) {
      return res.status(404).json({ error: '卡片不存在' });
    }
    if (card.user_id !== userId.trim()) {
      return res.status(403).json({ error: '无权操作他人的卡片' });
    }

    await db.execute('UPDATE v2_expression_cards SET is_saved = 1 WHERE id = ?', [cardId]);
    return res.status(200).json({ id: cardId, isSaved: true });
  } catch (err) {
    console.error('[v2-expressions/save] 错误：', err.message);
    return res.status(500).json({ error: '服务器内部错误，请稍后重试' });
  }
});

/**
 * DELETE /api/v2/expressions/:id
 * 取消收藏表达卡片
 * 入参: { userId }（body）
 * 出参: { id, isSaved: false }
 */
router.delete('/:id', async (req, res) => {
  try {
    const cardId = parseInt(req.params.id, 10);
    const { userId } = req.body;

    if (Number.isNaN(cardId)) {
      return res.status(400).json({ error: '卡片 ID 无效' });
    }
    if (!userId || !userId.trim()) {
      return res.status(400).json({ error: 'userId 不能为空' });
    }

    const card = await db.queryOne('SELECT * FROM v2_expression_cards WHERE id = ?', [cardId]);
    if (!card) {
      return res.status(404).json({ error: '卡片不存在' });
    }
    if (card.user_id !== userId.trim()) {
      return res.status(403).json({ error: '无权操作他人的卡片' });
    }

    await db.execute('UPDATE v2_expression_cards SET is_saved = 0 WHERE id = ?', [cardId]);
    return res.status(200).json({ id: cardId, isSaved: false });
  } catch (err) {
    console.error('[v2-expressions/delete] 错误：', err.message);
    return res.status(500).json({ error: '服务器内部错误，请稍后重试' });
  }
});

/**
 * POST /api/v2/expressions/:id/practice
 * 标记表达卡片为已练习
 * 入参: { userId }
 * 出参: { id, isPracticed: true }
 */
router.post('/:id/practice', async (req, res) => {
  try {
    const cardId = parseInt(req.params.id, 10);
    const { userId } = req.body;

    if (Number.isNaN(cardId)) {
      return res.status(400).json({ error: '卡片 ID 无效' });
    }
    if (!userId || !userId.trim()) {
      return res.status(400).json({ error: 'userId 不能为空' });
    }

    const card = await db.queryOne('SELECT * FROM v2_expression_cards WHERE id = ?', [cardId]);
    if (!card) {
      return res.status(404).json({ error: '卡片不存在' });
    }
    if (card.user_id !== userId.trim()) {
      return res.status(403).json({ error: '无权操作' });
    }

    await db.execute('UPDATE v2_expression_cards SET is_practiced = 1 WHERE id = ?', [cardId]);
    return res.status(200).json({ id: cardId, isPracticed: true });
  } catch (err) {
    console.error('[v2-expressions/practice] 错误：', err.message);
    return res.status(500).json({ error: '服务器内部错误' });
  }
});

module.exports = router;
