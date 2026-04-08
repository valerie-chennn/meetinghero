/**
 * 生成结算页"新闻后续"Prompt
 * 根据用户在群聊中的实际发言，动态生成反映用户立场的结算内容
 *
 * 输出：headline（新闻标题）、bullets（3条后续故事点）、absurdAttributes（2-3条能力变化）
 */

/**
 * 生成结算新闻的 prompt
 * @param {object} params
 * @param {string} params.newsTopic - 房间新闻标题（原始种子标题）
 * @param {string} params.publisher - 报头，如"东海商报 · 后续"
 * @param {Array<string>} params.userMessages - 用户 3 次发言文本数组（按顺序）
 * @param {Array<string>} params.npcReplies - NPC 对用户每次发言的回复文本数组
 * @param {Array<{name: string, delta: number}>} params.absurdAttributesPool - 种子属性池
 * @returns {{ systemPrompt: string, userPrompt: string }}
 */
function generateSettlementPrompt({
  newsTopic,
  publisher,
  userMessages,
  npcReplies,
  absurdAttributesPool,
}) {
  const systemPrompt = `你是一个荒诞新闻撰稿人，专门为英语学习 App 生成互动群聊的"事件结果"。

## 你的任务
根据用户在群聊中的实际发言立场，生成一篇反映其真实选择的新闻后续内容。

## 生成规则

### headline（新闻标题）
- 20字以内中文
- 必须反映用户实际选择的立场结果
- 示例逻辑：
  - 用户一路反对卖马 → "白龙马留队，审计员力挡闲鱼交易"
  - 用户一路支持卖马 → "白龙马闲鱼成交，审计员拍板二手交易"
  - 用户和稀泥 → "卖马风波平息，各方在审计员调解下握手言和"
- 带具体情节，不要泛泛的总结

### bullets（3条故事后续）
- 每条 20字以内中文
- 有具体情节细节，跟用户发言内容挂钩
- 好的例子："八戒提议每周给白龙马额外一筐苹果作为补偿"
- 差的例子："你促成了和解"（太模糊）
- 要有故事感，可以有轻微荒诞元素

### absurdAttributes（2-3条能力变化）
- 从候选属性池中挑选最匹配用户立场的 2-3 个
- 根据用户实际立场调整 delta 值（范围 -5 到 +5）
- 如果属性池里没有特别匹配的，可以生成池外属性（自行创造有趣的属性名）
- delta 为正表示提升，为负表示下降

## 输出格式
必须返回严格的 JSON，不带 markdown 代码块：
{
  "headline": "反映用户立场的标题（≤20字）",
  "bullets": [
    "第1条具体后续故事点",
    "第2条具体后续故事点",
    "第3条具体后续故事点"
  ],
  "absurdAttributes": [
    { "name": "属性名", "delta": 3 },
    { "name": "属性名", "delta": -1 }
  ]
}`;

  // 格式化对话历史
  const dialogueLines = [];
  const maxTurns = Math.max(userMessages.length, npcReplies.length);
  for (let i = 0; i < maxTurns; i++) {
    if (userMessages[i]) {
      dialogueLines.push(`用户第${i + 1}次发言：${userMessages[i]}`);
    }
    if (npcReplies[i]) {
      dialogueLines.push(`NPC回复：${npcReplies[i]}`);
    }
  }

  // 格式化属性池
  const poolText = absurdAttributesPool && absurdAttributesPool.length > 0
    ? absurdAttributesPool.map(a => `- ${a.name}（参考delta: ${a.delta}）`).join('\n')
    : '（无候选池，请自行创造 2-3 个有趣属性）';

  const userPrompt = `## 新闻话题
${newsTopic}

## 报头
${publisher}

## 用户实际对话记录
${dialogueLines.length > 0 ? dialogueLines.join('\n') : '（用户未发言）'}

## 候选属性池
${poolText}

请根据用户的实际发言立场，生成结算新闻内容。`;

  return { systemPrompt, userPrompt };
}

module.exports = { generateSettlementPrompt };
