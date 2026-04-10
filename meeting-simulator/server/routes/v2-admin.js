/**
 * v2 管理员路由
 * 提供 AI 生成房间、审核（激活/拒绝）房间等管理功能
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const { generateRoomsInBackground } = require('../services/room-generator');

// ==================== 路由定义 ====================

/**
 * POST /api/v2/admin/generate-rooms
 * 批量 AI 生成房间（is_active=0，需人工审核后激活）
 * Body: { count: number }
 */
router.post('/generate-rooms', async (req, res) => {
  const count = Math.max(1, Math.min(parseInt(req.body.count) || 3, 10)); // 1-10 个

  try {
    const result = await generateRoomsInBackground(count);
    res.json(result);
  } catch (err) {
    console.error('[v2-admin/generate-rooms] 未预期错误:', err.message);
    res.status(500).json({ error: '生成失败，请稍后重试' });
  }
});

/**
 * GET /api/v2/admin/rooms/pending
 * 查询所有待审核（is_active=0）的房间列表
 */
router.get('/rooms/pending', (req, res) => {
  const rows = db.prepare(`
    SELECT id, news_title, npc_a_name, npc_b_name, tags, difficulty, created_at
    FROM v2_rooms
    WHERE is_active = 0
    ORDER BY created_at DESC
  `).all();

  // 解析 tags JSON
  const rooms = rows.map(row => ({
    ...row,
    tags: (() => {
      try { return JSON.parse(row.tags); } catch { return []; }
    })(),
  }));

  res.json({ rooms });
});

/**
 * POST /api/v2/admin/rooms/:roomId/activate
 * 激活房间（is_active=1，is_visible=1），使其出现在 Feed 流
 */
router.post('/rooms/:roomId/activate', (req, res) => {
  const { roomId } = req.params;

  const roomResult = db.prepare('UPDATE v2_rooms SET is_active = 1 WHERE id = ?').run(roomId);
  if (roomResult.changes === 0) {
    return res.status(404).json({ error: `房间 ${roomId} 不存在` });
  }

  db.prepare('UPDATE v2_feed_items SET is_visible = 1 WHERE room_id = ?').run(roomId);

  console.log(`[activate-room] 房间已激活: ${roomId}`);
  res.json({ success: true, roomId });
});

/**
 * POST /api/v2/admin/rooms/:roomId/reject
 * 拒绝并删除房间（同时清理对应的 feed_items）
 */
router.post('/rooms/:roomId/reject', (req, res) => {
  const { roomId } = req.params;

  // 先删 feed_items（外键依赖）
  db.prepare('DELETE FROM v2_feed_items WHERE room_id = ?').run(roomId);

  // 再删房间本体
  const roomResult = db.prepare('DELETE FROM v2_rooms WHERE id = ?').run(roomId);
  if (roomResult.changes === 0) {
    return res.status(404).json({ error: `房间 ${roomId} 不存在` });
  }

  console.log(`[reject-room] 房间已删除: ${roomId}`);
  res.json({ success: true, roomId });
});

module.exports = router;
