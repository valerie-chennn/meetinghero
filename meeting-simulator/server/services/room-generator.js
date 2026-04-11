/**
 * room-generator.js
 * 房间预生成服务：封装 AI 生成房间的核心逻辑，可独立调用，不依赖 Express req/res
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const db = require('../db');
const { callOpenAIJson } = require('./openai');
const { generateRoomPrompt } = require('../prompts/generate-room');
const { CHARACTER_POOL } = require('../data/character-pool');

// ==================== Seedream 图片生成 ====================

const SEEDREAM_API_KEY = '4a0259b1-f164-4fca-aa43-6c7c20ba0178';
const SEEDREAM_MODEL = 'doubao-seedream-5-0-260128';
const SEEDREAM_ENDPOINT = 'https://ark.cn-beijing.volces.com/api/v3/images/generations';
const COVERS_DIR = process.env.COVERS_DIR || path.join(__dirname, '../../client/public/images/covers');

/**
 * 调用豆包 Seedream API 生成封面图
 * @param {string} prompt - 图片描述
 * @returns {Promise<Buffer>} 图片 Buffer
 */
function generateCoverImage(prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: SEEDREAM_MODEL,
      prompt,
      size: '3840x1280',
      response_format: 'b64_json',
      n: 1,
    });

    const url = new URL(SEEDREAM_ENDPOINT);
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SEEDREAM_API_KEY}`,
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`Seedream API 返回 ${res.statusCode}: ${data.slice(0, 300)}`));
          return;
        }
        try {
          const json = JSON.parse(data);
          if (json.data?.[0]?.b64_json) {
            resolve(Buffer.from(json.data[0].b64_json, 'base64'));
          } else if (json.data?.[0]?.url) {
            // 返回 URL 则下载
            const imgUrl = json.data[0].url;
            const client = imgUrl.startsWith('https') ? https : require('http');
            client.get(imgUrl, (imgRes) => {
              const chunks = [];
              imgRes.on('data', chunk => chunks.push(chunk));
              imgRes.on('end', () => resolve(Buffer.concat(chunks)));
              imgRes.on('error', reject);
            }).on('error', reject);
          } else {
            reject(new Error('Seedream 响应格式异常'));
          }
        } catch (e) {
          reject(new Error('解析 Seedream 响应失败: ' + e.message));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(60000, () => { req.destroy(); reject(new Error('Seedream 请求超时')); });
    req.write(body);
    req.end();
  });
}

// ==================== 语音 ID 配置 ====================

// ElevenLabs 男声 voice ID 列表
const VOICE_MALE = ['TxGEqnHWrfWFTfGW9XjX', 'VR6AewLTigWG4xSOukaG', 'JBFqnCBsd6RMkjVDRZzb'];
// ElevenLabs 女声 voice ID 列表
const VOICE_FEMALE = ['EXAVITQu4vr4xnSDxMaL', '21m00Tcm4TlvDq8ikWAM', 'AZnzlk1XvdvUeBnXmlld'];

/**
 * 根据性别分配 voice ID，同房间不允许重复
 * @param {string} npcAGender - "male" 或 "female"
 * @param {string} npcBGender - "male" 或 "female"
 * @returns {{ voiceA: string, voiceB: string }}
 */
function assignVoiceIds(npcAGender, npcBGender) {
  const poolA = npcAGender === 'female' ? VOICE_FEMALE : VOICE_MALE;
  const poolB = npcBGender === 'female' ? VOICE_FEMALE : VOICE_MALE;

  const voiceA = poolA[Math.floor(Math.random() * poolA.length)];
  let voiceB = poolB[Math.floor(Math.random() * poolB.length)];

  // 同房间不能使用相同的 voice ID
  if (voiceA === voiceB) {
    const alternatives = poolB.filter(v => v !== voiceA);
    voiceB = alternatives.length > 0
      ? alternatives[Math.floor(Math.random() * alternatives.length)]
      : poolB[0];
  }

  return { voiceA, voiceB };
}

// ==================== 颜色主题映射 ====================

// 按 IP 标签映射的颜色主题，与前端 FeedPage.jsx 的 TAG_THEMES 保持一致
const TAG_THEMES = {
  '西游记':   { bg_color: '#F7F2EC', header_bg: '#F0EBE4', header_text: '#3A2E22', accent_color: '#C41E1E', accent_dark: '#1A1A1A' },
  '三国':     { bg_color: '#F7F2EC', header_bg: '#F0EBE4', header_text: '#3A2E22', accent_color: '#C41E1E', accent_dark: '#1A1A1A' },
  '红楼梦':   { bg_color: '#F7F2EC', header_bg: '#F0EBE4', header_text: '#3A2E22', accent_color: '#C41E1E', accent_dark: '#1A1A1A' },
  '甄嬛传':   { bg_color: '#FFF1F2', header_bg: '#FFE4E6', header_text: '#4C0519', accent_color: '#BE123C', accent_dark: '#881337' },
  '宫斗':     { bg_color: '#FFF1F2', header_bg: '#FFE4E6', header_text: '#4C0519', accent_color: '#BE123C', accent_dark: '#881337' },
  '哈利波特': { bg_color: '#FFF7ED', header_bg: '#FEF3C7', header_text: '#78350F', accent_color: '#92400E', accent_dark: '#78350F' },
  '综艺':     { bg_color: '#FFF7ED', header_bg: '#FEF3C7', header_text: '#78350F', accent_color: '#92400E', accent_dark: '#78350F' },
  '迪士尼':   { bg_color: '#F5F3FF', header_bg: '#EDE9FE', header_text: '#3B0764', accent_color: '#6D28D9', accent_dark: '#3B0764' },
  '指环王':   { bg_color: '#ECFDF5', header_bg: '#D1FAE5', header_text: '#064E3B', accent_color: '#047857', accent_dark: '#064E3B' },
  '漫威':     { bg_color: '#FFF1F2', header_bg: '#FFE4E6', header_text: '#4C0519', accent_color: '#BE123C', accent_dark: '#881337' },
  '权力的游戏': { bg_color: '#F7F2EC', header_bg: '#F0EBE4', header_text: '#3A2E22', accent_color: '#C41E1E', accent_dark: '#1A1A1A' },
  '希腊神话': { bg_color: '#ECFDF5', header_bg: '#D1FAE5', header_text: '#064E3B', accent_color: '#047857', accent_dark: '#064E3B' },
  '中国神话': { bg_color: '#F7F2EC', header_bg: '#F0EBE4', header_text: '#3A2E22', accent_color: '#C41E1E', accent_dark: '#1A1A1A' },
  '海贼王':   { bg_color: '#FFF7ED', header_bg: '#FEF3C7', header_text: '#78350F', accent_color: '#92400E', accent_dark: '#78350F' },
  '火影忍者': { bg_color: '#FFF7ED', header_bg: '#FEF3C7', header_text: '#78350F', accent_color: '#92400E', accent_dark: '#78350F' },
};

// 默认主题（无法匹配时使用）
const DEFAULT_THEME = {
  bg_color: '#F7F2EC',
  header_bg: '#F0EBE4',
  header_text: '#3A2E22',
  accent_color: '#C41E1E',
  accent_dark: '#1A1A1A',
};

/**
 * 根据 tags[0] 获取颜色主题
 * @param {string[]} tags - 标签数组
 * @returns {object} 颜色主题对象
 */
function getThemeByTags(tags) {
  if (!tags || tags.length === 0) return DEFAULT_THEME;
  return TAG_THEMES[tags[0]] || DEFAULT_THEME;
}

// ==================== 角色随机选取 ====================

/**
 * 随机选取两个来自不同世界的角色，用于一次房间生成
 * @returns {{ npcA: object, npcB: object }}
 */
function pickNpcPair() {
  const worldKeys = Object.keys(CHARACTER_POOL);

  // 随机打乱世界顺序，取前 2 个不同的世界
  const shuffled = [...worldKeys].sort(() => Math.random() - 0.5);
  const worldA = shuffled[0];
  const worldB = shuffled[1];

  const charsA = CHARACTER_POOL[worldA];
  const charsB = CHARACTER_POOL[worldB];

  const npcA = charsA[Math.floor(Math.random() * charsA.length)];
  const npcB = charsB[Math.floor(Math.random() * charsB.length)];

  return { npcA, npcB };
}

// ==================== 数据校验 ====================

/**
 * 校验 AI 返回的 JSON 结构是否符合要求
 * @param {object} result - AI 生成的房间数据
 * @returns {{ valid: boolean, reason?: string }}
 */
function validateRoomData(result) {
  // 基本字段非空检查
  if (!result.npc_a_name) return { valid: false, reason: 'npc_a_name 为空' };
  if (!result.npc_b_name) return { valid: false, reason: 'npc_b_name 为空' };
  if (!result.group_name) return { valid: false, reason: 'group_name 为空' };

  // news_title 必须以【开头
  if (!result.news_title || !result.news_title.startsWith('【')) {
    return { valid: false, reason: 'news_title 必须以【开头' };
  }

  // dialogue_script 结构校验
  if (!Array.isArray(result.dialogue_script)) {
    return { valid: false, reason: 'dialogue_script 不是数组' };
  }
  if (result.dialogue_script.length !== 7) {
    return { valid: false, reason: `dialogue_script 长度为 ${result.dialogue_script.length}，应为 7` };
  }

  // 恰好 3 个 user_cue
  const userCues = result.dialogue_script.filter(item => item.type === 'user_cue');
  if (userCues.length !== 3) {
    return { valid: false, reason: `user_cue 数量为 ${userCues.length}，应为 3` };
  }

  // 每个 user_cue 必须有 3 个 options
  for (let i = 0; i < userCues.length; i++) {
    const cue = userCues[i];
    if (!Array.isArray(cue.options) || cue.options.length !== 3) {
      return { valid: false, reason: `user_cue[${i}] 的 options 数量不是 3` };
    }
  }

  // settlement_template 结构校验
  const st = result.settlement_template;
  if (!st) return { valid: false, reason: 'settlement_template 缺失' };
  if (!st.newsletter?.publisher) return { valid: false, reason: 'settlement_template.newsletter.publisher 缺失' };
  if (!st.newsletter?.headline) return { valid: false, reason: 'settlement_template.newsletter.headline 缺失' };
  if (!Array.isArray(st.newsletter?.bullets)) return { valid: false, reason: 'settlement_template.newsletter.bullets 不是数组' };
  if (!Array.isArray(st.absurd_attributes_pool)) return { valid: false, reason: 'settlement_template.absurd_attributes_pool 不是数组' };

  // gender 字段校验
  if (result.npc_a_gender && !['male', 'female'].includes(result.npc_a_gender)) {
    return { valid: false, reason: `npc_a_gender 值无效: ${result.npc_a_gender}` };
  }
  if (result.npc_b_gender && !['male', 'female'].includes(result.npc_b_gender)) {
    return { valid: false, reason: `npc_b_gender 值无效: ${result.npc_b_gender}` };
  }

  return { valid: true };
}

// ==================== DB 操作语句 ====================

const insertRoom = db.prepare(`
  INSERT INTO v2_rooms (
    id, news_title, npc_a_name, npc_a_reaction, npc_b_name, npc_b_reaction,
    news_title_en, npc_a_reaction_en, npc_b_reaction_en,
    group_name, group_notice,
    user_role_name, user_role_name_en, user_role_desc, npc_profiles, dialogue_script,
    settlement_template, tags, difficulty, is_active, sort_order,
    bg_color, header_bg, header_text, accent_color, accent_dark, cover_image, likes, comment_count
  ) VALUES (
    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?,
    ?, ?, ?, ?, ?, ?, ?, ?
  )
`);

const insertFeedItem = db.prepare(`
  INSERT OR IGNORE INTO v2_feed_items (id, room_id, sort_order, is_visible) VALUES (?, ?, ?, 1)
`);

// ==================== 核心生成函数 ====================

/**
 * 在后台批量生成房间，新房间 sort_order 排在现有种子房间之后（Feed 按 DESC 排序，所以用 MIN - 10）
 * @param {number} count - 生成数量，默认 3，范围 1-10
 * @returns {Promise<{ success: number, failed: number, results: Array, errors: Array }>}
 */
async function generateRoomsInBackground(count = 3) {
  count = Math.max(1, Math.min(count, 10));

  // 获取已有的 news_title 用于去重
  const existingRows = db.prepare('SELECT news_title FROM v2_rooms').all();
  const existingTitles = existingRows.map(r => r.news_title);

  // 获取当前最小 sort_order，新房间排在种子后面（Feed 按 DESC 排序，sort_order 更小 = 排后面）
  const minSortRow = db.prepare('SELECT MIN(sort_order) as minSort FROM v2_rooms').get();
  let nextSortOrder = (minSortRow?.minSort || 0) - 10;

  const timestamp = Date.now();
  const results = [];
  const errors = [];

  console.log(`[room-generator] 开始生成 ${count} 个房间，已有 ${existingTitles.length} 个标题`);

  // 串行生成，避免 API 限流
  for (let i = 0; i < count; i++) {
    try {
      // 随机选取两个来自不同世界的角色
      const { npcA, npcB } = pickNpcPair();
      console.log(`[room-generator] [${i + 1}/${count}] 角色对: ${npcA.name} × ${npcB.name}`);

      // 生成 prompt
      const { systemPrompt, userPrompt } = generateRoomPrompt({
        npcA,
        npcB,
        existingTitles: [...existingTitles, ...results.map(r => r.newsTitle)],
      });

      // 调用 AI 生成（高温度 0.9，增加创意性）
      const aiResult = await callOpenAIJson([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ], { temperature: 0.9, maxTokens: 4096 });

      // 校验 AI 返回的数据结构
      const { valid, reason } = validateRoomData(aiResult);
      if (!valid) {
        throw new Error(`AI 返回数据校验失败: ${reason}`);
      }

      // 分配 voice ID
      const { voiceA, voiceB } = assignVoiceIds(
        aiResult.npc_a_gender || 'male',
        aiResult.npc_b_gender || 'male'
      );

      // 组装 npc_profiles
      const npcProfiles = JSON.stringify([
        {
          id: 'npc_a',
          name: aiResult.npc_a_name,
          gender: aiResult.npc_a_gender || 'male',
          voiceId: voiceA,
          persona: aiResult.npc_a_persona,
        },
        {
          id: 'npc_b',
          name: aiResult.npc_b_name,
          gender: aiResult.npc_b_gender || 'male',
          voiceId: voiceB,
          persona: aiResult.npc_b_persona,
        },
      ]);

      // 获取颜色主题
      const tags = Array.isArray(aiResult.tags) ? aiResult.tags : [];
      const theme = getThemeByTags(tags);

      // 生成 room ID
      const roomId = `room-gen-${timestamp}-${i + 1}`;
      const feedItemId = `feed-gen-${timestamp}-${i + 1}`;

      // 生成封面图（Seedream API）
      let coverImagePath = null;
      if (aiResult.image_prompt) {
        try {
          // 确保目录存在
          if (!fs.existsSync(COVERS_DIR)) {
            fs.mkdirSync(COVERS_DIR, { recursive: true });
          }
          console.log(`[room-generator] [${i + 1}/${count}] 生成封面图...`);
          const imgBuffer = await generateCoverImage(aiResult.image_prompt);
          const imgFileName = `${roomId}.webp`;
          fs.writeFileSync(path.join(COVERS_DIR, imgFileName), imgBuffer);
          coverImagePath = `/images/covers/${imgFileName}`;
          console.log(`[room-generator] [${i + 1}/${count}] 封面图完成 (${(imgBuffer.length / 1024).toFixed(1)}KB)`);
        } catch (imgErr) {
          // 图片生成失败不影响房间创建，只记日志
          console.error(`[room-generator] [${i + 1}/${count}] 封面图生成失败:`, imgErr.message);
        }
      }

      // 随机 likes 和 comment_count
      const likes = Math.floor(Math.random() * (5000 - 500 + 1)) + 500;
      const commentCount = Math.floor(Math.random() * (300 - 50 + 1)) + 50;

      // 同步写入 DB（better-sqlite3 同步 API）
      insertRoom.run(
        roomId,
        aiResult.news_title,
        aiResult.npc_a_name,
        aiResult.npc_a_reaction,
        aiResult.npc_b_name,
        aiResult.npc_b_reaction,
        aiResult.news_title_en || null,
        aiResult.npc_a_reaction_en || null,
        aiResult.npc_b_reaction_en || null,
        aiResult.group_name,
        aiResult.group_notice || null,
        aiResult.user_role_name,
        aiResult.user_role_name_en || null,
        aiResult.user_role_desc || null,
        npcProfiles,
        JSON.stringify(aiResult.dialogue_script),
        JSON.stringify(aiResult.settlement_template),
        JSON.stringify(tags),
        aiResult.difficulty || 'A2',
        nextSortOrder,
        theme.bg_color,
        theme.header_bg,
        theme.header_text,
        theme.accent_color,
        theme.accent_dark,
        coverImagePath,
        likes,
        commentCount
      );

      insertFeedItem.run(feedItemId, roomId, nextSortOrder);

      nextSortOrder -= 10;

      results.push({ roomId, newsTitle: aiResult.news_title });
      console.log(`[room-generator] [${i + 1}/${count}] 成功: ${roomId} "${aiResult.news_title}"`);

    } catch (err) {
      console.error(`[room-generator] [${i + 1}/${count}] 失败:`, err.message);
      errors.push({ index: i + 1, error: err.message });
    }
  }

  console.log(`[room-generator] 生成完成: 成功 ${results.length}, 失败 ${errors.length}`);
  return {
    success: results.length,
    failed: errors.length,
    results,
    errors,
  };
}

module.exports = {
  generateRoomsInBackground,
  generateCoverImage,
  assignVoiceIds,
  getThemeByTags,
  pickNpcPair,
  validateRoomData,
  insertRoom,
  insertFeedItem,
};
