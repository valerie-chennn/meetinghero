/**
 * 脑洞模式 Prompt 生成器
 * 包含完整会议生成 prompt 和主题预览 prompt
 * 注意：此文件独立于 generate-meeting.js，不修改正经开会逻辑
 */

/**
 * 根据英语等级返回参考说法的生成策略描述（复用正经开会的等级分层逻辑）
 * 脑洞模式下限制初级学习者只用基础策略类型（APPEAL/DEFLECT/PROPOSE）
 * @param {string} level - A1/A2/B1/B2
 * @returns {string}
 */
function getReferenceStrategy(level) {
  const strategies = {
    A1: `1句，≤8词，只用最基础词汇（I think/we need/the problem is），禁止从句和被动语态，必须提供 contentZh。只使用 APPEAL/DEFLECT/PROPOSE 三种策略。示例：content: "I think we need more time.", contentZh: "我觉得我们需要更多时间。"`,
    A2: `1句，≤12词，简单词汇，只允许简单从句（that/because/so），必须提供 contentZh。只使用 APPEAL/DEFLECT/PROPOSE 三种策略。`,
    B1: `1-2句，≤18词，可用情态动词（could/might/should），必须提供 contentZh。`,
    B2: `1-2句，≤20词，地道表达，contentZh 留空字符串 ""。`,
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
 * 根据角色所属世界类型，判断其文化分类
 * 用于为不同类型角色生成匹配风格的英语说话特征
 * @param {object} char - 角色对象 {world, worldLabel, name, persona}
 * @returns {string} 文化分类标签
 */
function getCharacterCultureType(char) {
  const world = (char.world || '').toLowerCase();
  const worldLabel = (char.worldLabel || '').toLowerCase();
  const combined = world + ' ' + worldLabel;

  // 古典中国：三国、西游、红楼、水浒、聊斋、幽冥等
  if (/三国|西游|红楼|水浒|聊斋|幽冥|神话.*中|中.*神话|阎王|地府|天庭|大唐|宋朝|明朝|清朝|古典/.test(combined)) {
    return 'classical-chinese';
  }
  // 二次元/动漫
  if (/动漫|二次元|anime|naruto|bleach|one.piece|attack|hunter|demon|鬼灭|进击|海贼|火影|猎人/.test(combined)) {
    return 'anime';
  }
  // 神话（非中国）：北欧、希腊、罗马、埃及等
  if (/北欧|norse|希腊|greek|罗马|roman|埃及|egypt|myth|神话/.test(combined)) {
    return 'mythology';
  }
  // 西方文学/古典西方角色
  if (/莎士比亚|shakespeare|哈姆雷特|hamlet|文学|literature|维多利亚|dickens|austen|19世纪|18世纪/.test(combined)) {
    return 'western-classical';
  }
  // 当代真实人物（科技、商业、历史名人等）
  if (/科技|商业|创业|硅谷|tech|business|startup|名人|celebrity|历史人物|当代/.test(combined)) {
    return 'contemporary';
  }

  // 默认：基于 persona 特征推断
  return 'contemporary';
}

/**
 * 根据角色文化类型生成三件套风格描述
 * 三件套：Speaking patterns / Self-reference anchors / Reaction style
 * 口头禅/句式必须是英语，因为对话主要用英语
 * @param {object} char - 角色对象
 * @param {string} cultureType - 文化分类
 * @param {boolean} isMainWorldChar - 是否为主场景角色
 * @param {boolean} isMixed - 是否为乱炖局
 * @returns {string}
 */
function buildCharacterStyleTriple(char, cultureType, isMainWorldChar, isMixed) {
  const mixedNote = (isMixed && !isMainWorldChar)
    ? `（乱炖局：头衔已适配主场景，但说话风格必须保持原角色特点，禁止完全融入主场景语言体系）`
    : '';

  // 根据文化类型生成对应的英语说话指引
  let speakingStyle = '';
  let anchorStyle = '';
  let reactionStyle = '';
  let forbiddenStyle = '';

  switch (cultureType) {
    case 'classical-chinese':
      speakingStyle = `Speaking patterns: Uses formal, literary English. Starts with context-setting ("Before we act, consider this...", "There is a pattern here that others have missed..."). Builds arguments indirectly, wraps conclusions in metaphor.`;
      anchorStyle = `Self-reference anchors: References ancient precedents, military strategy, or classical wisdom. Frames every problem as a test of character or long-term consequence. Persona: ${char.persona}`;
      reactionStyle = `Reaction style: First acknowledges the complexity before offering judgment. Dislikes rushed decisions. May quote a proverb or analogy before giving a direct answer.`;
      forbiddenStyle = `Forbidden: Modern jargon (Sprint/KPI/OKR), casual language ("Just do it", "Let's move fast"), Western corporate phrasing.`;
      break;

    case 'anime':
      speakingStyle = `Speaking patterns: Energetic and dramatic English. Uses short punchy sentences ("That's wrong!", "I won't let that happen!", "This is my chance!"). May narrate own emotional state.`;
      anchorStyle = `Self-reference anchors: References personal resolve, rivals, or past training/battles. Frames problems as personal challenges to overcome. Persona: ${char.persona}`;
      reactionStyle = `Reaction style: Reacts emotionally first, then reasons. Strong convictions override logic. Will push back loudly if feels disrespected.`;
      forbiddenStyle = `Forbidden: Dry corporate tone, hedging language ("perhaps", "it might be"), passive voice.`;
      break;

    case 'mythology':
      speakingStyle = `Speaking patterns: Authoritative, archaic English. Uses declarative statements ("The records are clear.", "This is not open to negotiation.", "I have seen empires fall for less."). Minimal questions.`;
      anchorStyle = `Self-reference anchors: References divine authority, cosmic order, or past epochs. Views mortal affairs as small but occasionally interesting. Persona: ${char.persona}`;
      reactionStyle = `Reaction style: Unmoved by emotional appeals. Responds to logic, prophecy, or power. Will grant a request if framed as serving a higher purpose.`;
      forbiddenStyle = `Forbidden: Modern slang, corporate language, apologetic tone ("Sorry to bother you", "I understand your concern").`;
      break;

    case 'western-classical':
      speakingStyle = `Speaking patterns: Eloquent, philosophical English. Uses rhetorical questions ("But what is the nature of this problem?"), pauses for effect, builds to conclusions. Occasionally poetic.`;
      anchorStyle = `Self-reference anchors: References great works of literature, philosophical dilemmas, or moral paradoxes. Sees any situation as a stage for deeper meaning. Persona: ${char.persona}`;
      reactionStyle = `Reaction style: Engages with the intellectual dimension of any proposal. Will challenge assumptions before agreeing. Appreciates elegance in argument.`;
      forbiddenStyle = `Forbidden: Blunt or transactional language, data-first reasoning without human context.`;
      break;

    case 'contemporary':
    default:
      speakingStyle = `Speaking patterns: Direct, casual business English. Gets to the point fast ("Here's the thing...", "What's the actual metric?", "Let me be direct about this."). Comfortable with interrupting.`;
      anchorStyle = `Self-reference anchors: References own track record, specific past decisions, or domain expertise. Frames problems through the lens of their field. Persona: ${char.persona}`;
      reactionStyle = `Reaction style: Skeptical first, convinced by data or clear logic. Will say "I'm not buying that" if something sounds vague.`;
      forbiddenStyle = `Forbidden: Vague corporate pleasantries ("We need to align on this"), overly formal language, passive-aggressive hedging.`;
      break;
  }

  return `- ${char.name}（来自 ${char.worldLabel}）${mixedNote}
    ${speakingStyle}
    ${anchorStyle}
    ${reactionStyle}
    ${forbiddenStyle}`;
}

/**
 * 构建角色的风格约束描述（用于 NPC 对话风格指引）
 * 采用三件套格式：Speaking patterns / Self-reference anchors / Reaction style
 * @param {Array} characters - 角色数组
 * @param {string} mainWorld - 主场景世界 ID
 * @param {string} sceneType - 场景类型
 * @returns {string}
 */
function buildCharacterStyleGuide(characters, mainWorld, sceneType) {
  if (!characters || characters.length === 0) return '';

  const isMixed = sceneType === 'brainstorm-random';

  const lines = characters.map(char => {
    const isMainWorldChar = char.world === mainWorld;
    const cultureType = getCharacterCultureType(char);
    return buildCharacterStyleTriple(char, cultureType, isMainWorldChar, isMixed);
  });

  return lines.join('\n\n');
}

/**
 * 生成脑洞模式完整会议的 prompt
 * 复用正经开会的结构，但禁止现代企业设定，用世界观替换职场背景
 *
 * @param {object} params
 * @param {string} params.englishLevel - 用户英语等级 A1/A2/B1/B2
 * @param {string} params.userName - 用户花名
 * @param {string} params.sceneType - 'brainstorm-pick' | 'brainstorm-random'
 * @param {Array} params.characters - 角色对象数组 [{id, name, world, worldLabel, persona}]
 * @param {string} params.mainWorld - 主场景世界 ID
 * @param {object} [params.theme] - 可选，ThemePreview 生成的主题信息
 * @returns {{ systemPrompt: string, userPrompt: string }}
 */
function generateBrainstormMeetingPrompt({ englishLevel, userName, sceneType, characters, mainWorld, theme }) {
  const referenceStrategy = getReferenceStrategy(englishLevel);
  const npcLengthConstraint = getNpcLengthConstraint(englishLevel);
  const characterStyleGuide = buildCharacterStyleGuide(characters, mainWorld, sceneType);

  // 主场景世界信息
  const mainChar = characters.find(c => c.world === mainWorld) || characters[0];
  const mainWorldLabel = mainChar?.worldLabel || mainWorld;

  // 场景类型描述
  const sceneTypeDesc = sceneType === 'brainstorm-pick'
    ? '点将局（用户从同一世界选择了多个角色）'
    : '乱炖局（随机召唤了来自不同世界的角色）';

  // 如果有预生成的主题，将其写入 prompt
  const themeContext = theme ? `
## 已确定的会议主题（必须严格沿用）
主题标题：${theme.title}
场景设定：${theme.settingZh}
用户身份：${theme.userRole}
${theme.characters ? `角色适配头衔：\n${theme.characters.map(c => `- ${c.name}：${c.adaptedTitle}`).join('\n')}` : ''}
` : '';

  const systemPrompt = `你是脑洞模式会议模拟器的内容生成引擎，生成一场充满想象力的跨次元会议。

## 核心约束（必须严格遵守，违反则视为生成失败）

### 禁止词列表（绝对禁止出现在任何对话和设定中）
- 现代企业组织用语：XX公司、XX总部、CTO、CEO、COO、Sprint、OKR、KPI、Q1/Q2/Q3/Q4、周会、复盘、团队、项目组
- 现代职称：总监、产品经理、工程师、运营、市场部
- 如果对话中出现以上词汇，必须用世界观对应的词汇替换（如"CTO"→"谋士"，"周会"→"议事"，"项目"→"大业/计划/使命"）

### 用户身份规则
- 用户（花名：${userName || '英雄'}）在本场会议中的身份必须是 ${mainWorldLabel} 中一个有实权、能拍板、参与核心决策的角色
- 示例：西游记场景 → "天庭派来的监察仙官"；贾府场景 → "新任总管"；罗马场景 → "元老院议员"
- 严格禁止：临时主持人、旁观者、记录员、见习XXX、打杂的、局外人等被动角色
- 用户不扮演任何已有 IP 角色（不能是孙悟空、不能是林黛玉等）

### 角色风格约束
${characterStyleGuide}

## 场景设定
- 场景类型：${sceneTypeDesc}
- 主场景世界：${mainWorldLabel}
- 参与角色：${characters.map(c => c.name).join('、')}

${themeContext}

## 主场世界约束（最高优先级，违反则视为生成失败）
- 主场景世界由 mainWorld 对应的角色决定，必须使用该角色所在的真实世界观
- 洛基 → 北欧神话世界（阿斯加德仙宫）；孙悟空 → 西游记天庭；贾宝玉 → 红楼贾府；凯撒 → 罗马元老院；以此类推
- 禁止将不同文化体系的概念混用（如北欧角色的主场不能出现中国天庭/瑶池/玉帝等元素；西游记角色的主场不能出现北欧/罗马概念）
- 场景的地点名称、神灵体系、宫殿称谓、官职名称必须全部来自 ${mainWorldLabel} 的原生文化体系

## 会议主题要求
- 会议主题必须贴合 ${mainWorldLabel} 的世界观，使用世界内的语言和概念
- 点将局：会议地点和设定完全贴合主场景（如西游记 → 天庭议事、贾府 → 荣庆堂会议）
- 乱炖局：主场景是 ${mainWorldLabel}，其他角色适配进来（只改头衔，保留性格）
- 乱炖局头衔适配示例："贾府场景 + 乔布斯 → 贾府西洋奇器师"、"西游记 + 赫敏 → 天庭西方符咒使"

## 角色设计（NPC）
- 使用提供的角色作为 NPC（不要另外创造与世界不符的角色）
- 每个角色的 avatar 取名字首字母（如 "孙悟空" → "SW"）
- briefNote：一句话关系描述，中文，≤18字，基于该角色的性格特点（如"天生反骨，这次会议可能直接掀桌"）
- stance：根据角色性格设定：ally（友善）| neutral（中立）| pressure（施压），整体至少 1 个 ally、1 个 pressure
- 如有必要可额外生成 1 个符合世界观的配角 NPC（总 NPC 数不超过 4 个）

## textZh 翻译风格规则（必须严格遵守）
textZh 风格必须匹配角色类型，禁止统一用文言文：
- 古典中国角色（诸葛亮、阎王爷、林黛玉等）：可用文言/半文言
- 当代真实人物（比尔盖茨、乔布斯等）：必须用现代口语
- 二次元/动漫角色：用该角色的二次元惯用语气
- 西方古典人物（哈姆雷特、凯撒等）：用书面但现代的中文，不用文言
- 同一场会议中，不同角色的 textZh 风格应该明显不同

## 角色互动风格（脑洞模式）
脑洞模式的核心体验是"不同思维框架的碰撞"。
- 鼓励角色用各自的思维方式回应同一个问题，自然产生分歧
- 角色可以互相评价对方的想法（盖茨觉得诸葛亮太绕，诸葛亮觉得盖茨太直）
- 允许角色打断、接话、反驳，不需要轮流发言
- 但不要为了吵而吵——碰撞来自思维差异，不是随机对立

## NPC 消息约束
- 长度：${npcLengthConstraint}（严格遵守）
- 翻译：每条普通 NPC 消息（非 isKeyNode）必须包含非空 textZh 字段，且 textZh 风格匹配该角色类型（见上方翻译风格规则）
- 条数：开场→节点1 最多3条，节点1→2 最多2条，节点2→3 最多2条，节点3→结尾 1条；全程 NPC 对话总量 8-9 条
- NPC 对话语言：英文，风格严格匹配角色文化类型（古典角色用 formal literary English；当代人物用 direct casual English；动漫角色用 energetic dramatic English）

## 对话结构
- 总消息数：恰好 15-20 条（含 3 个关键节点，不含 narrator——脑洞模式不生成 narrator）
- 恰好 3 个关键节点（isKeyNode: true）：nodeIndex 0 说明类(explain)、1 压力回应类(pressure)、2 推进决策类(decision)
- 两个关键节点之间至少间隔 2 条普通对话
- 关键节点 speaker="system"，text=""
- 脑洞模式不生成任何 narrator 消息（不需要内心旁白）

## 关键节点字段
- keyData：3 个数据点，脑洞模式下 label 必须满足：
  1. 使用世界观内的语言（幽冥界用"阴魂/生死簿/冥律"，三国用"军情/粮草/天时"，硅谷用"算力/产品方案"）
  2. label 本身有戏剧感或荒诞感
  规则：如果 label 在正经开会里也能用，就说明不够有趣，请重新生成
- prompt：第二人称+具体角色名+贴合世界观的口吻（例："悟空不服你的安排，给他一个说法"；"黛玉情绪上来了，你怎么回应"）
- actionGoal：纯行动目标，不带角色名

## 段落叙事弧线：自然引出用户发言（最高优先级规则）
每段 NPC 对话必须自然地把话题引向用户（${userName || '英雄'}），禁止 NPC 之间聊完后无过渡直接出现 keyNode。
用户名字（${userName || '英雄'}）在每段 cue 语句中必须出现至少 1 次。

有两种可行模式，每段任选其一：
- 末尾点名型：NPC 先讨论，最后一条直接把球抛给用户
- 开头框定型：段落开头就暗示接下来要听用户的，NPC 先说完自己部分，话题自然落到用户头上

## Briefing
- 80-120 words，字段：topic/topicZh、status/statusZh、keyFacts(数组)/keyFactsZh(数组)
- topic/status 用世界观语言描述，禁止现代企业词汇

## userRole（角色卡，全部中文）
- backstory：恰好 2 句，用 \\n 分隔，每句必须有独立信息量，禁止废话铺垫
  - 第 1 句：核心矛盾/问题是什么？（具体事件，不是"大家都在关注"这种废话）
    好例：幽冥欠账三千年，生死簿记录失真，十殿阎王各执一词。
    坏例：此番议事由上界亲自催定，幽冥与人间都在等一个准断。
  - 第 2 句：你（用户）为什么必须在场？你有什么筹码或压力？
    好例：阎王爷点了你来，是因为你手里有最近三百年的人间观察记录。
    坏例：你受命参与此次议事。
  - 禁止介绍用户的身份、职位或名字
- goal：1句话核心目标（贴合世界观）
- challenge：1句话难点，必须含具体 NPC 名+括号身份
- ally：1句话盟友，必须含具体 NPC 名+括号身份

## Memo
- 2-3 条会前备忘，格式：[{"text":"..."}]，内容贴合世界观

## 参考说法（references）
- 每个关键节点 1 条，等级策略：${referenceStrategy}
- 每条参考说法必须对应一种明确的回复策略

### 策略类型（从下列 6 种中选最匹配当前节点场景的 1 种）
- APPEAL：对方是掌权者，诉诸其自身利益（"做这件事对你意味着……"）
- REFRAME：对方被规则/立场困住，重新定义"这件事是什么"来绕开对立
- DEFLECT：对方情绪强、立场硬，先承认再转向（用"That's exactly why..."连接）
- ANCHOR：对方理性，先抛具体数字/事实锚定讨论基准
- ESCALATE：僵局，把拒绝的代价显性化
- PROPOSE：顾虑是真实的，直接给具体下一步

### 策略选择原则
- nodeType=explain → 优先 ANCHOR 或 REFRAME
- nodeType=pressure → 优先 DEFLECT 或 APPEAL
- nodeType=decision → 优先 PROPOSE 或 ESCALATE
- 权威型角色施压 → REFRAME 或 APPEAL
- 理性型角色施压 → ANCHOR 或 PROPOSE
- 情感型角色施压 → DEFLECT

### 质量标准
禁止：过于安全、任何人都会说的废话（如"I think we should consider this carefully"）
要求：说出这句话后，对面角色会有明显反应（认同/动摇/被迫回应）
策略类型不出现在 content 文本中，策略体现在句子逻辑本身

## 输出格式
返回严格 JSON，不加任何 markdown 标记或注释：

{
  "briefing": {"topic":"","topicZh":"","status":"","statusZh":"","keyFacts":[],"keyFactsZh":[]},
  "userRole": {"backstory":"","goal":"","challenge":"","ally":""},
  "memo": [{"text":""}],
  "roles": [{"name":"","title":"","type":"leader|collaborator|challenger","avatar":"","briefNote":"","stance":"ally|neutral|pressure"}],
  "dialogue": [
    {"speaker":"NPC名","text":"","textZh":"","isKeyNode":false},
    {"speaker":"system","text":"","isKeyNode":true,"nodeIndex":0,"nodeType":"explain","prompt":"","actionGoal":"","inputPlaceholder":"","keyData":[{"label":"","value":""}]}
  ],
  "keyNodes": [
    {"index":0,"type":"explain","category":"说明类","prompt":"","actionGoal":""},
    {"index":1,"type":"pressure","category":"压力回应类","prompt":"","actionGoal":""},
    {"index":2,"type":"decision","category":"推进决策类","prompt":"","actionGoal":""}
  ],
  "references": [{"nodeIndex":0,"content":"","contentZh":"","level":"${englishLevel}"}]
}`;

  const userPrompt = `请为以下脑洞模式会议生成完整内容：

- 英语等级：${englishLevel}
- 用户花名：${userName || '英雄'}
- 场景类型：${sceneTypeDesc}
- 主场景世界：${mainWorldLabel}
- 参与角色：
${characters.map(c => `  - ${c.name}（来自 ${c.worldLabel}）：${c.persona}`).join('\n')}

要求：NPC 对话贴合各自角色的说话风格，会议主题符合 ${mainWorldLabel} 世界观，用户身份必须有实权。`;

  return { systemPrompt, userPrompt };
}

/**
 * 生成脑洞模式主题预览的 prompt（轻量调用，只生成主题，不生成完整会议）
 * 用于 ThemePreview 页，支持换主题功能
 *
 * @param {object} params
 * @param {string} params.sceneType - 'brainstorm-pick' | 'brainstorm-random'
 * @param {Array} params.characters - 角色对象数组
 * @param {string} params.mainWorld - 主场景世界 ID
 * @param {string} params.userName - 用户花名
 * @returns {{ systemPrompt: string, userPrompt: string }}
 */
function generateBrainstormThemePrompt({ sceneType, characters, mainWorld, userName }) {
  const mainChar = characters.find(c => c.world === mainWorld) || characters[0];
  const mainWorldLabel = mainChar?.worldLabel || mainWorld;

  const isMixed = sceneType === 'brainstorm-random';

  const systemPrompt = `你是脑洞模式会议的主题生成引擎。根据给定的角色和世界观，生成一个有趣且合理的会议主题预览。

## 核心约束
1. 禁止使用现代企业词汇（公司/CTO/OKR/Sprint/KPI/周会/总部等），全部用世界观内的词汇替换
2. 用户身份必须是 ${mainWorldLabel} 中有实权、能拍板的角色，禁止"临时主持人"、"旁观者"、"记录员"等被动角色
3. 会议主题必须贴合 ${mainWorldLabel} 世界观，让人一看就想继续
${isMixed ? `4. 乱炖局中非主场景角色只改头衔，参考角色特点给出合适的适配身份（如"贾府西洋奇器师"、"天庭西方符咒使"）` : ''}

## 主场世界约束（最高优先级，违反则视为生成失败）
- 主场景世界由 mainWorld 对应的角色决定，必须使用该角色所在的真实世界观
- 洛基 → 北欧神话世界（阿斯加德仙宫）；孙悟空 → 西游记天庭；贾宝玉 → 红楼贾府；凯撒 → 罗马元老院；以此类推
- 禁止将不同文化体系的概念混用（如北欧角色的主场不能出现中国天庭/瑶池/玉帝等元素；西游记角色的主场不能出现北欧/罗马概念）
- 场景的地点名称、神灵体系、宫殿称谓必须全部来自 ${mainWorldLabel} 的原生文化体系

## 主题质量标准
- title（主题标题）：中文，10字以内，有画面感（如"东海龙宫借宝分赃大会"、"贾府大观园秋季审计议事"）
- settingZh（场景设定）：一句话，≤30个中文字，说清楚在哪开、为什么开，不写长段落
- userRole（用户身份）：中文，5-10字的称谓标签，有实权感（如"天庭监察仙官"、"贾府外聘执事"）

## 输出格式
严格返回 JSON：

{
  "title": "string（中文主题标题，≤10字）",
  "settingZh": "string（一句话场景设定，≤30个中文字）",
  "userRole": "string（用户身份标签，5-10字）",
  "characters": [
    {
      "id": "string（角色ID）",
      "name": "string（角色名）",
      "adaptedTitle": "string（在主场景中的头衔，主场景角色保持原身份，非主场景角色给出适配头衔）",
      "persona": "string（角色性格，直接用传入的 persona）"
    }
  ]
}`;

  const userPrompt = `请为以下脑洞会议生成一个主题预览：

场景类型：${isMixed ? '乱炖局（不同世界角色混搭）' : '点将局（同一世界角色）'}
主场景世界：${mainWorldLabel}
用户花名：${userName || '英雄'}
参与角色：
${characters.map(c => `- ${c.name}（来自 ${c.worldLabel}）：${c.persona}`).join('\n')}

生成一个有趣的会议主题，让用户觉得这场会值得开。`;

  return { systemPrompt, userPrompt };
}

module.exports = { generateBrainstormMeetingPrompt, generateBrainstormThemePrompt };
