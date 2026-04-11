/**
 * 为 seed 房间批量生成 topic 封面图，并回写数据库 cover_image 路径。
 * 用法：
 *   node scripts/generate-seed-covers.js
 *   node scripts/generate-seed-covers.js --force
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const db = require('../db');
const { callOpenAIJson } = require('../services/openai');
const { generateCoverImage, saveCoverImageBuffer, ensureCoversDir } = require('../services/room-generator');
const { SEED_ROOMS } = require('../data/seed-rooms');
const { NEW_SEED_ROOMS } = require('../data/new-seed-rooms-006-020');

const rooms = [...SEED_ROOMS, ...NEW_SEED_ROOMS];
const force = process.argv.includes('--force');
const promptManifestPath = path.join(os.tmpdir(), 'meetinghero-seed-cover-prompts.json');

function parseNewsTitle(title) {
  const match = String(title || '').match(/【(.+?)】([\s\S]+)/);
  if (match) {
    return {
      source: match[1],
      headline: match[2].replace(/\s+/g, ' ').trim(),
    };
  }

  return {
    source: '',
    headline: String(title || '').replace(/\s+/g, ' ').trim(),
  };
}

function getExistingCoverPath(roomId) {
  const extensions = ['webp', 'jpg', 'jpeg', 'png'];
  for (const ext of extensions) {
    const absolutePath = path.join(__dirname, '../../client/public/images/covers', `${roomId}.${ext}`);
    if (fs.existsSync(absolutePath)) {
      return `/images/covers/${roomId}.${ext}`;
    }
  }
  return null;
}

function normalizeImagePrompt(prompt) {
  return [
    String(prompt || '').replace(/\s+/g, ' ').trim(),
    'No readable text, letters, words, numbers, logos, labels, captions, subtitles, speech bubbles, interface text, headlines, signs, watermarks, or UI chrome anywhere in the image.',
    'Avoid close-up screens, documents, posters, charts, folders, packaging, or boxes that could display writing; if they appear, keep them distant, abstract, and blank.',
  ].join(' ');
}

async function generatePromptMap(seedRooms) {
  const payload = seedRooms.map((room) => {
    const { source, headline } = parseNewsTitle(room.news_title);
    return {
      roomId: room.id,
      source,
      headline,
      tags: JSON.parse(room.tags || '[]'),
      npcAName: room.npc_a_name,
      npcBName: room.npc_b_name,
      npcAReaction: room.npc_a_reaction,
      npcBReaction: room.npc_b_reaction,
      groupName: room.group_name,
      notice: room.group_notice,
      userRole: room.user_role_name,
    };
  });

  const systemPrompt = [
    'You write English image prompts for a satirical newspaper editorial illustration generator.',
    'Return strict JSON only in the shape {"prompts":[{"roomId":"room-001","imagePrompt":"..."}]}.',
    'Write exactly one imagePrompt for each roomId provided.',
    'Each imagePrompt must be 45-90 words.',
    'Every prompt must describe the core scene from the headline as a wide 3:1 newspaper editorial illustration.',
    'Style requirements: ink and watercolor sketch, warm sepia tones, cross-hatching details, vintage newspaper print aesthetic.',
    'Show the two named characters in a specific action or confrontation tied to the topic.',
    'Use props and environmental storytelling instead of readable screens or documents.',
    'Absolutely no readable text, letters, words, numbers, logos, labels, captions, speech bubbles, interface chrome, watermark, split-panel layout, poster typography, screen text, or document text anywhere in the frame.',
    'Avoid close-up phones, monitors, papers, signs, banners, charts, folders, shipping boxes, desks with labels, or any surface likely to generate visible writing.',
    'Do not just restate the title. Turn it into a vivid visual scene.',
  ].join(' ');

  const userPrompt = [
    'Write image prompts for these rooms.',
    JSON.stringify(payload, null, 2),
  ].join('\n\n');

  const result = await callOpenAIJson([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ], { temperature: 0.4, maxTokens: 4000 });

  if (!Array.isArray(result?.prompts)) {
    throw new Error('OpenAI 未返回 prompts 数组');
  }

  const promptMap = new Map();
  for (const item of result.prompts) {
    if (item?.roomId && item?.imagePrompt) {
      promptMap.set(item.roomId, item.imagePrompt);
    }
  }

  for (const room of seedRooms) {
    if (!promptMap.has(room.id)) {
      throw new Error(`缺少房间 ${room.id} 的 imagePrompt`);
    }
  }

  return promptMap;
}

async function main() {
  ensureCoversDir();
  await db.init();

  console.log(`[seed-covers] 开始处理 ${rooms.length} 个 seed 房间${force ? '（强制覆盖）' : ''}`);

  const promptMap = await generatePromptMap(rooms);
  const manifest = rooms.map((room) => ({
    roomId: room.id,
    imagePrompt: normalizeImagePrompt(promptMap.get(room.id)),
  }));
  fs.writeFileSync(promptManifestPath, JSON.stringify(manifest, null, 2));

  let generatedCount = 0;
  let skippedCount = 0;

  for (let index = 0; index < rooms.length; index += 1) {
    const room = rooms[index];
    const existingCoverPath = getExistingCoverPath(room.id);

    if (!force && existingCoverPath) {
      console.log(`[seed-covers] [${index + 1}/${rooms.length}] 跳过 ${room.id}，已存在 ${existingCoverPath}`);
      skippedCount += 1;
      continue;
    }

    const imagePrompt = normalizeImagePrompt(promptMap.get(room.id));
    console.log(`[seed-covers] [${index + 1}/${rooms.length}] 生成 ${room.id}`);
    console.log(`[seed-covers] prompt: ${imagePrompt}`);

    const buffer = await generateCoverImage(imagePrompt);
    const coverPath = saveCoverImageBuffer(room.id, buffer);

    await db.execute('UPDATE v2_rooms SET cover_image = ? WHERE id = ?', [coverPath, room.id]);

    console.log(`[seed-covers] [${index + 1}/${rooms.length}] 完成 ${room.id} -> ${coverPath} (${(buffer.length / 1024).toFixed(1)}KB)`);
    generatedCount += 1;
  }

  console.log(`[seed-covers] 完成：新生成 ${generatedCount}，跳过 ${skippedCount}`);
}

main().catch((error) => {
  console.error('[seed-covers] 失败：', error.message);
  process.exit(1);
});
