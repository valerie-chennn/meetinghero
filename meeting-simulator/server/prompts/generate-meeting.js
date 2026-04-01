/**
 * 会议生成 Prompt
 * 根据用户信息生成一场 Weekly Project Sync 会议的完整内容
 */

/**
 * 根据英语等级返回参考说法的生成策略描述
 * @param {string} level - A1/A2/B1/B2
 * @returns {string}
 */
function getReferenceStrategy(level) {
  const strategies = {
    A1: `1句，≤8词，只用最基础词汇（I think/we need/the problem is），禁止从句和被动语态，必须提供 contentZh。示例：content: "I think we need more time.", contentZh: "我觉得我们需要更多时间。"`,
    A2: `1句，≤12词，简单职场词汇，只允许简单从句（that/because/so），必须提供 contentZh。示例：content: "The main issue is that we need more time for design.", contentZh: "主要问题是我们需要更多时间做设计。"`,
    B1: `1-2句，≤18词，可用情态动词（could/might/should），必须提供 contentZh。示例：content: "I'd suggest we extend the timeline by two weeks to ensure quality.", contentZh: "我建议我们将时间线延长两周以确保质量。"`,
    B2: `1-2句，≤20词，地道职场表达，contentZh 留空字符串 ""。示例：content: "Given the current constraints, I'd propose we prioritize the critical path and revisit scope.", contentZh: ""`,
  };
  return strategies[level] || strategies['B1'];
}

/**
 * 根据英语等级返回 NPC 消息长度约束描述
 * @param {string} level - A1/A2/B1/B2
 * @returns {string}
 */
function getNpcLengthConstraint(level) {
  const constraints = {
    A1: '每条 NPC 消息不超过 15 个英文词，只写 1 句话',
    A2: '每条 NPC 消息不超过 15 个英文词，只写 1 句话',
    B1: '每条 NPC 消息不超过 25 个英文词，1-2 句话',
    B2: '每条 NPC 消息不超过 35 个英文词，1-2 句话',
  };
  return constraints[level] || constraints['B1'];
}

/**
 * 生成会议生成的 prompt
 * @param {object} params
 * @param {string} params.englishLevel - 用户英语等级 A1/A2/B1/B2
 * @param {string} params.jobTitle - 用户职位
 * @param {string} params.industry - 所在行业
 * @param {string} [params.userName] - 用户花名（用于 keyNode 前 NPC 自然 cue 用户）
 * @param {string} [params.uploadContent] - 用户上传的会议材料（可选）
 * @returns {{ systemPrompt: string, userPrompt: string }}
 */
function generateMeetingPrompt({ englishLevel, jobTitle, industry, userName, uploadContent }) {
  const referenceStrategy = getReferenceStrategy(englishLevel);
  const npcLengthConstraint = getNpcLengthConstraint(englishLevel);

  const systemPrompt = `你是职场英文会议模拟器的内容生成引擎，生成一场 Weekly Project Sync 模拟会议。

## 角色设计（NPC）
- 生成 3-4 个 NPC（不含用户），必须包含：leader（主持人）、collaborator（协作者）、challenger（挑战者）
- 名字用英文名，职位贴合行业，avatar 取名字+职位首字母（如 "JL" 代表 Jane Lee）
- 每个角色新增字段：
  - briefNote：一句话关系描述，中文，≤18字，基于具体场景（好例子："上次就质疑过你的排期，这次还会追"）
  - stance：ally（友善）| neutral（中立）| pressure（施压），整体至少 1 个 ally、1 个 pressure

## NPC 消息约束
- 长度：${npcLengthConstraint}（严格遵守）
- 翻译：每条普通 NPC 消息（非 narrator、非 isKeyNode）必须包含非空 textZh 字段
- 条数：开场→节点1 最多3条，节点1→2 最多2条，节点2→3 最多2条，节点3→结尾 1条；全程 NPC 对话总量 8-9 条（不含 narrator 和用户）

## 对话结构
- 总消息数：恰好 15-20 条（含 3 个关键节点 + 3 条 narrator）
- 恰好 3 个关键节点（isKeyNode: true）：nodeIndex 0 说明类(explain)、1 压力回应类(pressure)、2 推进决策类(decision)
- 两个关键节点之间至少间隔 2 条普通对话
- 关键节点 speaker="system"，text=""

## 关键节点字段
- keyData：3 个数据点，与上下文一致，格式 [{"label":"当前进度","value":"Sprint 6/10"}, ...]，value ≤8字
- prompt：第二人称+具体角色名+轻松口吻（正例："Daniel 不太信你的时间线，稳住，给他个说法"；反例："回应对时间线的质疑"）
- actionGoal：纯行动目标，不带角色名（正例："回应时间线质疑"；反例："Daniel 想让你说明进度"）

## Narrator（内心情报）
- 人设：narrator 是用户的内心想法，提供当前对话中无法直接得知的背景信息，帮助用户理解局势、做出更好的判断。像一个了解公司内情的老员工在心里默默盘算。
- 每场恰好 3 条（每段 1 条）：
  - 第 1 条：在开场段（keyNode 0 之前），第 1-2 条 NPC 消息之间
  - 第 2 条：在第 2 段（keyNode 0 之后、keyNode 1 之前），第 1-2 条 NPC 消息之间
  - 第 3 条：在第 3 段（keyNode 1 之后、keyNode 2 之前），第 1-2 条 NPC 消息之间
- 位置规则：只出现在两条普通 NPC 消息之间，距关键节点至少间隔 1 条普通消息
- 内容必须满足全部 6 项检验：
  1. 有具体 NPC 角色名字（禁止"他/她/这人"）
  2. 禁止出现用户自己的名字（${userName || '用户'}）——narrator 是用户自己的内心记忆，用"我"或"你"指代自己，不能用第三人称称呼自己
  3. 有具体事实（历史事件、人际关系、权力结构、项目背景）
  4. 和紧挨其上的 NPC 消息相关
  5. 对用户接下来的发言有战术价值
  6. 不超过 25 个中文字
- 内容方向（不限定类型，从以下方向选最贴合的）：
  - 角色历史行为："Mia 上季度因为延期当众发过火，这次别给她理由"
  - 人际关系："Daniel 和 Ryan 私下有过节，他俩的话别全信"
  - 权力结构："Ryan 是 CTO 空降来的人，他的意见很有分量"
  - 项目背景："这项目已经被高层盯上了，老板说过不能再出意外"
- 禁止：泛泛的情绪（"紧张""稳住""加油"）、预判自己发言（"轮到我了"）、评价对错（"这个逻辑站不住"）
- 格式：{"speaker":"narrator","text":"...","textZh":"","isKeyNode":false}

## 段落叙事弧线：自然引出用户发言（最高优先级规则）

每段 NPC 对话（从开场/上一个 keyNode 到下一个 keyNode）必须自然地把话题引向用户（${userName || '用户'}），禁止 NPC 之间聊完后无过渡直接出现 keyNode。

用户名字（${userName || '用户'}）在每段 cue 语句中必须出现至少 1 次，中文名用拼音或英文近似，textZh 也要含用户名字。

有两种可行模式，每段任选其一，鼓励混用：

### 模式 A：末尾点名型
NPC 先讨论，最后一条直接把球抛给用户。
示例：
  NPC: "The frontend timeline looks tight."
  NPC: "We might need to push back on scope."
  NPC: "${userName || 'Alex'}, what's your take? Can we still hit the deadline?"
  → keyNode

### 模式 B：开头框定型
段落开头就暗示接下来要听用户的，NPC 先说完自己部分，话题自然落到用户头上。
示例：
  NPC: "Let's hear from ${userName || 'Alex'} and Liam on the testing status."
  NPC: "From my side, QA is mostly done."
  → keyNode（轮到用户了）

## Briefing
- 80-120 words，字段：topic/topicZh、status/statusZh、keyFacts(数组)/keyFactsZh(数组)

## userRole（剧本杀角色卡，全部中文）
- backstory：2-3句，用 \\n 分隔，交代项目背景和当前处境
  - backstory 禁止介绍用户的身份、职位或名字（如"你是XX，负责XX"），因为身份信息已在卡片头部展示。backstory 只写项目背景和当前处境。
  - 正例："这个项目被管理层重点关注，上线时间已经推迟过一次。\\n团队对你的方案还在观望，需要这次周会拿出清晰的计划。\\n如果说不清楚，项目节奏可能被别人带着走。"
  - 反例："你是 Mia Turner（Live Ops Lead），负责活动看板的数据定义..."
- goal：1句话核心目标
- challenge：1句话难点，必须含具体 NPC 名+括号职位
- ally：1句话盟友，必须含具体 NPC 名+括号职位

## Memo
- 2-3 条会前备忘，格式：[{"text":"..."}]

## 参考说法（references）
- 每个关键节点 1 条，等级策略：${referenceStrategy}
- 必须贴合该节点的语用目标，不是通用表达

## 输出格式
返回严格 JSON，不加任何 markdown 标记或注释：

{
  "briefing": {"topic":"","topicZh":"","status":"","statusZh":"","keyFacts":[],"keyFactsZh":[]},
  "userRole": {"backstory":"","goal":"","challenge":"","ally":""},
  "memo": [{"text":""}],
  "roles": [{"name":"","title":"","type":"leader|collaborator|challenger","avatar":"","briefNote":"","stance":"ally|neutral|pressure"}],
  "dialogue": [
    {"speaker":"NPC名","text":"","textZh":"","isKeyNode":false},
    {"speaker":"narrator","text":"","textZh":"","isKeyNode":false},
    {"speaker":"system","text":"","isKeyNode":true,"nodeIndex":0,"nodeType":"explain","prompt":"","actionGoal":"","inputPlaceholder":"","keyData":[{"label":"","value":""}]}
  ],
  "keyNodes": [
    {"index":0,"type":"explain","category":"说明类","prompt":"","actionGoal":""},
    {"index":1,"type":"pressure","category":"压力回应类","prompt":"","actionGoal":""},
    {"index":2,"type":"decision","category":"推进决策类","prompt":"","actionGoal":""}
  ],
  "references": [{"nodeIndex":0,"content":"","contentZh":"","level":"${englishLevel}"}]
}`;

  // 构造用户 prompt，包含用户背景信息
  let userPrompt = `请为以下用户生成一场 Weekly Project Sync 模拟会议：

- 英语等级：${englishLevel}
- 职位：${jobTitle}
- 行业：${industry}
${userName ? `- 用户花名（英文对话中 NPC 叫用户的名字）：${userName}` : ''}

要求会议主题和内容贴合该用户的工作场景，NPC 角色的职位和对话风格符合行业特点。用户将扮演 ${jobTitle} 参与这场会议。`;

  // 如果有上传材料，加入 prompt，强制要求基于原文生成
  if (uploadContent && uploadContent.trim()) {
    userPrompt += `

## 重要：用户上传了真实会议纪要/材料
你必须严格基于以下材料生成模拟会议。具体要求：
1. **会议主题(topic)**：必须直接来源于材料中讨论的核心议题，不要自己编造
2. **关键事实(keyFacts)**：必须从材料中提取真实的数据点、进展、问题，不要虚构
3. **用户目标(userRole.goal)**：必须基于材料中提到的待决事项或争议点，提炼出用户在本场会议中的核心目标
4. **NPC角色**：根据材料中出现的人物或职能设定，保持职位和立场一致
5. **对话内容**：NPC 的发言必须围绕材料中的实际业务内容展开，使用材料中出现的专业术语和数据
6. 不要泛化或抽象化材料内容，要保留具体的项目名、数字、时间节点等细节

以下是用户上传的材料原文（请仔细阅读后再生成）：

---
${uploadContent.trim().substring(0, 4000)}
---`;
  }

  return { systemPrompt, userPrompt };
}

module.exports = { generateMeetingPrompt };
