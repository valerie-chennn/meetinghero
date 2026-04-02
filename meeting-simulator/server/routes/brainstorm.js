/**
 * 脑洞模式路由
 * 处理角色搜索、随机抽取、主题生成等脑洞模式专属功能
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const { callOpenAIJson } = require('../services/openai');
const {
  searchPresetCharacters,
  randomPickFromDifferentWorlds,
} = require('../data/character-pool');
const { generateBrainstormThemePrompt } = require('../prompts/generate-brainstorm');

/**
 * POST /api/brainstorm/search-characters
 * 点将局：根据关键词搜索角色
 * 优先从预设角色池匹配，命中不到则走 AI 生成
 */
router.post('/search-characters', async (req, res) => {
  try {
    const { query, sessionId } = req.body;

    // 参数校验
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return res.status(400).json({ error: '搜索关键词不能为空' });
    }
    if (query.trim().length > 50) {
      return res.status(400).json({ error: '搜索关键词不能超过 50 个字符' });
    }
    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId 不能为空' });
    }

    // 校验 session 是否存在
    const session = db.prepare('SELECT id FROM sessions WHERE id = ?').get(sessionId);
    if (!session) {
      return res.status(404).json({ error: '会话不存在，请重新完成 onboarding' });
    }

    const trimmedQuery = query.trim();
    console.log(`[Brainstorm/Search] sessionId=${sessionId}, query="${trimmedQuery}"`);

    // 1. 先尝试从预设角色池匹配
    const presetCharacters = searchPresetCharacters(trimmedQuery);
    if (presetCharacters && presetCharacters.length >= 4) {
      console.log(`[Brainstorm/Search] 命中预设角色池，返回 ${presetCharacters.length} 个角色`);
      return res.status(200).json({
        characters: presetCharacters,
        source: 'preset',
        world: presetCharacters[0]?.world || null,
        worldLabel: presetCharacters[0]?.worldLabel || null,
      });
    }

    // 2. 预设未命中，调用 AI 生成
    console.log(`[Brainstorm/Search] 预设未命中，调用 AI 生成角色...`);

    const systemPrompt = `你是一个角色搜索引擎，根据用户输入的作品/角色关键词，返回该作品或相关领域的角色列表。

要求：
1. 只返回真实存在于该作品中的角色，不确定的不返回
2. 每个角色必须有清晰的性格特点
3. 返回 4-8 个角色（不足 4 个说明作品太小众，不要强行凑数）
4. persona 字段必须简洁描述角色最鲜明的性格，≤20字
5. world 字段统一用 "custom" 表示自定义角色
6. worldLabel 字段写该作品/世界的中文名称（如"死亡笔记"、"星际穿越"）
7. id 字段用 kebab-case 格式（如 "light-yagami"）
8. name 字段规则：英文作品的角色用英文原名（如 Frank Underwood、Iron Man），中文作品的角色用中文名（如 孙悟空、贾宝玉）
9. nameEn 字段：角色的英文名，中文角色也要填（如 Sun Wukong）

严格返回 JSON，不加任何说明：

{
  "characters": [
    {
      "id": "string（kebab-case）",
      "name": "string（英文IP用英文原名，中文IP用中文名）",
      "nameEn": "string（英文名）",
      "world": "custom",
      "worldLabel": "string（作品/世界名称）",
      "persona": "string（≤20字性格描述）"
    }
  ],
  "worldLabel": "string（整体世界/作品名称）"
}`;

    const userPrompt = `用户搜索关键词："${trimmedQuery}"

请返回与此作品/关键词相关的角色列表。如果找不到至少 4 个真实角色，请返回空的 characters 数组。`;

    let aiResult;
    try {
      aiResult = await callOpenAIJson(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        { temperature: 0.7, maxTokens: 800 }
      );
    } catch (aiErr) {
      console.error('[Brainstorm/Search] AI 调用失败：', aiErr.message);
      return res.status(502).json({ error: `AI 服务调用失败: ${aiErr.message}` });
    }

    // 校验 AI 返回数量
    const aiCharacters = aiResult.characters || [];
    if (aiCharacters.length < 4) {
      console.log(`[Brainstorm/Search] AI 返回角色数量不足（${aiCharacters.length}），返回 tooFew`);
      return res.status(200).json({
        tooFew: true,
        message: '找到的角色太少，换个关键词试试',
      });
    }

    // 限制最多返回 8 个
    const limitedCharacters = aiCharacters.slice(0, 8);
    console.log(`[Brainstorm/Search] AI 返回 ${limitedCharacters.length} 个角色`);

    return res.status(200).json({
      characters: limitedCharacters,
      source: 'ai',
      world: 'custom',
      worldLabel: aiResult.worldLabel || trimmedQuery,
    });
  } catch (err) {
    console.error('[Brainstorm/Search] 意外错误：', err.message);
    return res.status(500).json({ error: '服务器内部错误，请稍后重试' });
  }
});

/**
 * GET /api/brainstorm/random-characters
 * 乱炖局：随机抽取来自不同世界的角色
 * 纯服务端随机，无需 AI，延迟 < 10ms
 */
router.get('/random-characters', (req, res) => {
  try {
    // 支持自定义数量，默认 3 个
    const count = parseInt(req.query.count) || 3;

    // 数量限制：1-7（世界数量上限）
    const safeCount = Math.min(Math.max(count, 1), 7);

    const characters = randomPickFromDifferentWorlds(safeCount);

    console.log(`[Brainstorm/Random] 随机抽取 ${characters.length} 个角色：${characters.map(c => c.name).join('、')}`);

    return res.status(200).json({ characters });
  } catch (err) {
    console.error('[Brainstorm/Random] 意外错误：', err.message);
    return res.status(500).json({ error: '服务器内部错误，请稍后重试' });
  }
});

/**
 * POST /api/brainstorm/generate-theme
 * ThemePreview 页：生成/换主题时调用
 * 轻量 AI 调用，只生成主题，不生成完整会议（控制在 500-800 token）
 */
router.post('/generate-theme', async (req, res) => {
  try {
    const { sessionId, sceneType, characters, mainWorld } = req.body;

    // 参数校验
    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId 不能为空' });
    }
    if (!sceneType || !['brainstorm-pick', 'brainstorm-random'].includes(sceneType)) {
      return res.status(400).json({ error: 'sceneType 必须为 brainstorm-pick 或 brainstorm-random' });
    }
    if (!characters || !Array.isArray(characters) || characters.length < 1) {
      return res.status(400).json({ error: 'characters 不能为空' });
    }
    if (!mainWorld) {
      return res.status(400).json({ error: 'mainWorld 不能为空' });
    }

    // 校验 session 是否存在，并获取用户信息
    const session = db.prepare('SELECT id, user_name FROM sessions WHERE id = ?').get(sessionId);
    if (!session) {
      return res.status(404).json({ error: '会话不存在，请重新完成 onboarding' });
    }

    const userName = session.user_name || '英雄';
    console.log(`[Brainstorm/Theme] sessionId=${sessionId}, sceneType=${sceneType}, mainWorld=${mainWorld}, 角色数=${characters.length}`);

    // 构造主题生成 prompt
    const { systemPrompt, userPrompt } = generateBrainstormThemePrompt({
      sceneType,
      characters,
      mainWorld,
      userName,
    });

    // 调用 AI（轻量，maxTokens 控制在 700）
    let themeData;
    try {
      themeData = await callOpenAIJson(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        { temperature: 0.9, maxTokens: 700 }
      );
    } catch (aiErr) {
      console.error('[Brainstorm/Theme] AI 调用失败：', aiErr.message);
      return res.status(502).json({ error: `AI 服务调用失败: ${aiErr.message}` });
    }

    // 校验必要字段
    if (!themeData.title || !themeData.settingZh || !themeData.userRole) {
      console.error('[Brainstorm/Theme] AI 返回格式异常：', JSON.stringify(themeData).substring(0, 200));
      return res.status(502).json({ error: 'AI 返回格式异常，请重试' });
    }

    console.log(`[Brainstorm/Theme] 主题生成成功：${themeData.title}`);

    return res.status(200).json({ theme: themeData });
  } catch (err) {
    console.error('[Brainstorm/Theme] 意外错误：', err.message);
    return res.status(500).json({ error: '服务器内部错误，请稍后重试' });
  }
});

module.exports = router;
