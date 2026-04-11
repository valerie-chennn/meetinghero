/**
 * v2 Feed 路由
 * 提供 Feed 列表和单条房间详情接口
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const { generateRoomsInBackground } = require('../services/room-generator');

let isGenerating = false;

/**
 * GET /api/v2/feed
 * 获取 Feed 列表（分页）
 * 查询参数: page（默认1）, pageSize（默认10）
 * 出参: { items, total, hasMore }
 */
router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize, 10) || 10));
    const offset = (page - 1) * pageSize;

    const totalRow = await db.queryOne(
      `
        SELECT COUNT(*) AS count
        FROM v2_feed_items fi
        JOIN v2_rooms r ON fi.room_id = r.id
        WHERE fi.is_visible = 1 AND r.is_active = 1
      `
    );
    const total = totalRow?.count || 0;

    const rows = await db.queryAll(
      `
        SELECT
          fi.id AS feed_item_id,
          r.id AS room_id,
          r.news_title,
          r.npc_a_name,
          r.npc_a_reaction,
          r.npc_b_name,
          r.npc_b_reaction,
          r.news_title_en,
          r.npc_a_reaction_en,
          r.npc_b_reaction_en,
          r.tags,
          r.difficulty,
          r.bg_color,
          r.header_bg,
          r.header_text,
          r.accent_color,
          r.accent_dark,
          r.cover_image,
          r.likes,
          r.comment_count
        FROM v2_feed_items fi
        JOIN v2_rooms r ON fi.room_id = r.id
        WHERE fi.is_visible = 1 AND r.is_active = 1
        ORDER BY fi.sort_order DESC, r.created_at DESC
        LIMIT ? OFFSET ?
      `,
      [pageSize, offset]
    );

    const items = rows.map((row) => ({
      feedItemId: row.feed_item_id,
      roomId: row.room_id,
      newsTitle: row.news_title,
      npcAName: row.npc_a_name,
      npcAReaction: row.npc_a_reaction,
      npcBName: row.npc_b_name,
      npcBReaction: row.npc_b_reaction,
      newsTitleEn: row.news_title_en,
      npcAReactionEn: row.npc_a_reaction_en,
      npcBReactionEn: row.npc_b_reaction_en,
      tags: row.tags ? JSON.parse(row.tags) : [],
      difficulty: row.difficulty,
      bgColor: row.bg_color || '#F7F2EC',
      headerBg: row.header_bg || null,
      headerText: row.header_text || null,
      accentColor: row.accent_color || null,
      accentDark: row.accent_dark || null,
      coverImage: row.cover_image || null,
      likes: row.likes || 0,
      commentCount: row.comment_count || 0,
    }));

    res.status(200).json({
      items,
      total,
      hasMore: offset + items.length < total,
    });

    const currentOffset = offset;
    const currentItemsLength = items.length;

    setImmediate(async () => {
      if (isGenerating) return;

      try {
        const totalActive = await db.queryOne(`
          SELECT COUNT(*) AS count
          FROM v2_rooms r
          JOIN v2_feed_items fi ON fi.room_id = r.id
          WHERE fi.is_visible = 1 AND r.is_active = 1
        `);
        const remaining = (totalActive?.count || 0) - (currentOffset + currentItemsLength);
        if (remaining <= 5) {
          isGenerating = true;
          console.log(`[v2-feed] 剩余房间 ${remaining} <= 5，触发预生成 3 个房间...`);
          const result = await generateRoomsInBackground(3);
          console.log(`[v2-feed] 预生成完成: 成功 ${result.success}, 失败 ${result.failed}`);
        }
      } catch (generationError) {
        console.error('[v2-feed] 预生成检查失败:', generationError.message);
      } finally {
        isGenerating = false;
      }
    });

    return;
  } catch (err) {
    console.error('[v2-feed/list] 错误：', err.message);
    return res.status(500).json({ error: '服务器内部错误，请稍后重试' });
  }
});

/**
 * GET /api/v2/feed/:roomId
 * 获取单条房间详情
 * 出参: 完整房间信息（含 groupName、npcProfiles 等）
 */
router.get('/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;

    const row = await db.queryOne(
      `
        SELECT
          fi.id AS feed_item_id,
          r.*
        FROM v2_rooms r
        LEFT JOIN v2_feed_items fi ON fi.room_id = r.id
        WHERE r.id = ? AND r.is_active = 1
      `,
      [roomId]
    );

    if (!row) {
      return res.status(404).json({ error: '房间不存在或已下线' });
    }

    return res.status(200).json({
      feedItemId: row.feed_item_id,
      roomId: row.id,
      newsTitle: row.news_title,
      npcAName: row.npc_a_name,
      npcAReaction: row.npc_a_reaction,
      npcBName: row.npc_b_name,
      npcBReaction: row.npc_b_reaction,
      groupName: row.group_name,
      groupNotice: row.group_notice,
      userRoleName: row.user_role_name,
      userRoleDesc: row.user_role_desc,
      tags: row.tags ? JSON.parse(row.tags) : [],
      difficulty: row.difficulty,
      bgColor: row.bg_color || '#F7F2EC',
      headerBg: row.header_bg || null,
      headerText: row.header_text || null,
      accentColor: row.accent_color || null,
      accentDark: row.accent_dark || null,
      coverImage: row.cover_image || null,
      likes: row.likes || 0,
      commentCount: row.comment_count || 0,
    });
  } catch (err) {
    console.error('[v2-feed/detail] 错误：', err.message);
    return res.status(500).json({ error: '服务器内部错误，请稍后重试' });
  }
});

module.exports = router;
