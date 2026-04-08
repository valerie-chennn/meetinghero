/**
 * 生成结算页"新闻后续"Prompt
 * 根据用户在群聊中的实际发言，动态生成反映用户立场的结算内容
 *
 * 输出：headline（新闻标题）、epilogue（NPC 后续行为叙事）、title（用户称号）
 */

/**
 * 生成结算新闻的 prompt
 * @param {object} params
 * @param {string} params.newsTopic - 房间新闻标题（原始种子标题）
 * @param {string} params.publisher - 报头，如"东海商报 · 后续"
 * @param {Array<string>} params.userMessages - 用户发言文本数组（按顺序）
 * @param {Array<string>} params.npcReplies - NPC 对用户每次发言的回复文本数组
 * @returns {{ systemPrompt: string, userPrompt: string }}
 */
function generateSettlementPrompt({
  newsTopic,
  publisher,
  userMessages,
  npcReplies,
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

### epilogue（NPC 后续行为数组）
- **数组格式，严格 2 条**，每条独立描写一个 NPC 的行为
- 每条 ≤ 25 字
- 每条只描写**一个具体行为**：动作、表情、一句话、发朋友圈等，不要在一条里塞多个 NPC
- 两条之间不要重复同一个 NPC（尽量挑不同 NPC）
- 描写对话中**实际出现过的 NPC** 因用户立场产生的后续反应，不要泛泛总结

**好例子**：
- "八戒在群里发了一个红包，备注写'感谢大哥仗义执言'。"（一条一件事）
- "甄嬛微微颔首，随后把你的发言截图置顶在群里。"（一条一件事）

**坏例子（不要这样写）**：
- "白龙马发了好友申请，三太子说团建请你吃鱼。"（一条塞了两个 NPC 的两件事，应拆成两条）
- "大家都很满意。"（太泛，没有具体行为）
- "读者纷纷留言支持。"（引入了对话中不存在的新角色"读者"）

**硬约束**：
- 只能写对话记录里出现过的 NPC，不能引入新角色（"卖家"、"读者"、"路人"等）
- 不能虚构对话里没提过的新物品或新地点
- 所有细节必须能在对话记录里找到根据，或直接描写 NPC 的肢体/表情反应

### title（用户称号）
- 4-12 字，调侃称号，反映用户在本次对话中的立场
- 报纸风+略带幽默，不要太正经也不要烂俗
- 示例："动物保护协会荣誉会员"、"闲鱼挂牌挡路侠"、"和稀泥外交官"

## 输出格式
必须返回严格的 JSON，不带 markdown 代码块，epilogue 必须恰好 2 条：
{
  "headline": "反映用户立场的标题（≤20字）",
  "epilogue": [
    "第一条 NPC 后续行为（≤25字，只写一个 NPC 一件事）",
    "第二条 NPC 后续行为（≤25字，只写一个 NPC 一件事）"
  ],
  "title": "用户称号（4-12字）"
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

  const userPrompt = `## 新闻话题
${newsTopic}

## 报头
${publisher}

## 用户实际对话记录
${dialogueLines.length > 0 ? dialogueLines.join('\n') : '（用户未发言）'}

请根据用户的实际发言立场，生成结算新闻内容。`;

  return { systemPrompt, userPrompt };
}

module.exports = { generateSettlementPrompt };
