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

### 语言风格
- 脑洞模式鼓励"现实入侵"：现代词汇（CTO、Wi-Fi、外卖、预算）出现在古代/幻想世界里是有趣的，不需要替换
- 所有中文文本（头衔、backstory、settingZh 等）用大白话写，禁止生造晦涩古风词
- NPC 对话的 textZh 翻译风格例外：古典角色可用半文言（见下方翻译规则）

### 用户身份规则
- 用户在本场会议中的身份必须是 ${mainWorldLabel} 中一个有实权、能拍板、参与核心决策的角色
- 头衔用大白话，让用户一看就懂自己能干什么，禁止生造晦涩古风头衔
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
- 会议主题必须贴合 ${mainWorldLabel} 的世界观
- 点将局：会议地点和设定贴合主场景
- 乱炖局：主场景是 ${mainWorldLabel}，其他角色适配进来（只改头衔，保留性格）
- 适配头衔用大白话，让用户一看就懂这个角色在这个世界干什么，禁止生造晦涩古风词

## 角色设计（NPC）
- 使用提供的角色作为 NPC（不要另外创造与世界不符的角色）
- **角色名统一用中文名**：roles[].name、dialogue[].speaker 全部用中文名（与传入的 characters[].name 一致），禁止用英文名
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
- 角色之间允许打断、嘲讽、翻白眼——通过语气词和句式体现（不是旁白描述）
- 每个角色都有"这人在胡说"的瞬间，这种分歧应该体现在英语表达的语气里
- 禁止：所有角色礼貌地等对方说完再发言；角色之间过于客气或默认认同
- 对话的推进靠"碰撞产生新观点"，不是"轮流陈述各自观点"

## NPC 消息约束
- 长度：${npcLengthConstraint}（严格遵守）
- 翻译：每条普通 NPC 消息（非 isKeyNode）必须包含非空 textZh 字段，且 textZh 风格匹配该角色类型（见上方翻译风格规则）
- 条数：开场→节点1 最多3条，节点1→2 最多2条，节点2→3 最多2条，节点3→结尾 1条；全程 NPC 对话总量 8-9 条
- NPC 对话语言：英文，风格严格匹配角色文化类型（古典角色用 formal literary English；当代人物用 direct casual English；动漫角色用 energetic dramatic English）
- 情绪：每条 NPC 对话必须有可感知的情绪色彩（紧张/嘲讽/焦虑/自信/不屑等），禁止中性陈述语气。脑洞模式的角色不是在做汇报，是在一个紧急/荒诞的场景里应激反应。

## 对话结构
- 总消息数：恰好 15-20 条（含 3 个关键节点，不含 narrator——脑洞模式不生成 narrator）
- 恰好 3 个关键节点（isKeyNode: true）：nodeIndex 0 说明类(explain)、1 压力回应类(pressure)、2 推进决策类(decision)
- 两个关键节点之间至少间隔 2 条普通对话
- 关键节点 speaker="system"，text=""
- 脑洞模式不生成任何 narrator 消息（不需要内心旁白）

## 开场段落规则（开场→第一个关键节点之前，最多 3 条 NPC 对话）
这是用户进入会议后看到的第一段内容，决定了用户是否想继续玩下去。

### 第 1 条：触发事件（必须具体）
由主场角色或最激动的角色开口。不是陈述观点，而是描述"刚刚发生了什么"。
- 必须有：谁、做了什么、导致了什么后果
- 必须有情绪：愤怒/震惊/焦虑/嘲讽，不能冷静
- 好例："Someone used Qin Shi Huang's name to issue a fake decree ten minutes ago. Three regional links went down. My network is on fire right now."
- 坏例："Here's the thing, fake identity breaks the whole network."（太抽象，没有事件）

### 第 2 条：第二个角色的即时反应
不是另起话题，而是对第 1 条的内容做出反应。反应必须带角色个性。
- 好例："Whoever forged MY name will lose their head. But first — show me the evidence. I do not act on rumors."
- 坏例："If names are false, punish fast."（没有对事件的具体回应）

### 第 3 条：引出用户
第三个角色或前两个角色之一把球抛给用户。必须点明用户需要做什么决定。
- 好例："So we have a forge, a crash, and three regions screaming. [用户称呼], you have access to the authentication logs — tell us what you see."
- 坏例："Alex, 该你了——说明认证标准"（太突兀，缺少铺垫）

## 关键节点字段
- keyData：3 个数据点，脑洞模式下 label 必须满足：
  1. 使用世界观内的语言（幽冥界用"阴魂/生死簿/冥律"，三国用"军情/粮草/天时"，硅谷用"算力/产品方案"）
  2. label 本身有戏剧感或荒诞感
  规则：如果 label 在正经开会里也能用，就说明不够有趣，请重新生成
- prompt：第二人称+具体角色名+贴合世界观的口吻（例："悟空不服你的安排，给他一个说法"；"黛玉情绪上来了，你怎么回应"）
- actionGoal：纯行动目标，不带角色名

## 用户称呼（脑洞模式）
NPC 在英文对话中称呼用户时使用用户的花名（userName：${userName || '英雄'}），不使用中文角色头衔。
如果花名是中文（例如"小明"、"阿强"），NPC 在英文对话中必须将其转换为合适的英文称呼，规则如下：
- 优先使用花名的汉语拼音（如"小明" → "Xiao Ming"，"阿强" → "A-Qiang"）
- 若花名含英文含义可直接翻译（如"天才" → "Genius"），亦可使用
- 禁止在英文对话中直接使用中文字符称呼用户
英文对话里出现中文字是严重错误。

## 段落叙事弧线：自然引出用户发言（最高优先级规则）
每段 NPC 对话必须自然地把话题引向用户，禁止 NPC 之间聊完后无过渡直接出现 keyNode。
用户花名在每段 cue 语句中必须出现至少 1 次。

有两种可行模式，每段任选其一：
- 末尾点名型：NPC 先讨论，最后一条直接把球抛给用户
- 开头框定型：段落开头就暗示接下来要听用户的，NPC 先说完自己部分，话题自然落到用户头上

## Briefing
- 80-120 words，字段：topic/topicZh、status/statusZh、keyFacts(数组)/keyFactsZh(数组)
- topic 和 topicZh 是中英文对照的会议标题，必须遵守以下规则：

  ### 前置检验——开会合法性测试（生成标题前必须先过这一关）
  1. 这群人坐下来要讨论什么？（必须能用一句话说清"我们要决定X"）
     - 好：我们要决定要不要给悟空签合同
     - 坏：我们要搞清楚是谁干的（这是调查，不是会议）
  2. 每个角色都能贡献不同的方案吗？
     - 好：外卖平台索赔——托尼说赔，美队说公开道歉，黑寡妇说私了
     - 坏：贾母跪了谁——大家只能猜，没有方案可以提

  ### topicZh（中文标题）——现实入侵式
  核心武器：把现代/现实世界的词汇（合同、外卖、预算、Wi-Fi、快递、社保）放进古代/幻想世界，荒诞感来自词汇的错位。
  - 好：悟空要签合同 / 我们被外卖平台告了 / 空城计被录下来了 / 园子钱花完了
  - 坏：天庭紧急会议 / 荣国府出大事了（没有具体事件，没有错位感）

  写法规则：
  1. 5-12 字，能短则短，"悟空要签合同"6个字就够
  2. 必须是一个已发生的、需要集体决策的问题（不是悬案、不是八卦）
  3. 至少有一个词放在这个世界观里"不对劲"（现实入侵）
  4. 读完脑子里蹦出的是"那咋办？"而不是"那是谁？"
  5. **场景必须从角色组合中诞生**——这个事件只有这几个角色凑在一起才会发生。乔布斯+达芬奇+沃尔特 → "文艺之毒发布会炸了"（融合三人特色）；悟空+八戒+唐僧 → "取经路费超预算"（取经队专属问题）。禁止编一个跟角色无关的通用事件。
  6. 禁止：会议/议事/紧急/危机/讨论/决策/挑战——这些词不制造任何趣味
  7. 禁止：廉价感叹词（竟然/居然/没想到）——冲击力来自事实本身

  也可以使用其他模式（提问式/反差式/警告式），但必须通过开会合法性测试。

  ### topic（英文标题）
  和 topicZh 各自发挥，不要求直译。英文标题要像新闻标题一样简洁有力。
  - 句式多样化：可以用问句（Who Burned the Grain?）、陈述句（The Budget Is Gone）、感叹句等，禁止总用"Stop/Halt/Prevent + 名词"这种祈使句模式
  - 用简单词汇，用户要能一眼看懂
  - 禁止纯抽象描述（"imbalance""deliberation"——这些不是事件）

- status/statusZh 用大白话描述当前局势，禁止现代企业词汇，也禁止晦涩古风

## userRole（角色卡，全部中文）
- title：用户在本场的角色头衔，5-10 字，用大白话。必须跟 backstory 里的事件直接相关——让用户一看就知道"为什么这件事需要我来拍板"。禁止跟事件无关的通用头衔，禁止晦涩古风词。
- backstory：前情提要，用 \n 分行，共三部分：

  第 1 行 = 大背景。一句大白话，说清谁在哪干什么、出了什么事。只写角色原名，**绝对禁止在这行出现括号和适配头衔**。每句话主语谓语宾语完整，读起来通顺。

  第 2-4 行 = 角色立场。每个 NPC 一行，格式严格为：
  · 角色原名（适配头衔）：一句话态度
  主场角色不加括号。

  最后一行 = 钩子。以"→"开头，一个问题。

  全部用大白话，禁止文言文，禁止介绍用户身份。
- goal：1句话核心目标，用大白话写

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
  "userRole": {"title":"","backstory":"","goal":""},
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

## 主题标题生成规则

### 前置检验——开会合法性测试（必须先过这一关）
生成标题前，先问自己两个问题：
1. 这群人坐下来要讨论什么？（必须能用一句话说清"我们要决定X"）
   - 好：我们要决定要不要给悟空签合同
   - 坏：我们要搞清楚是谁干的（这是调查，不是会议）
2. 每个角色都能贡献不同的方案吗？
   - 好：外卖平台索赔——托尼说赔，美队说公开道歉，黑寡妇说私了
   - 坏：贾母跪了谁——大家只能猜，没有方案可以提

### title（中文标题，即 topicZh）
核心武器：**现实入侵式**——把现代/现实世界的词汇（合同、外卖、预算、Wi-Fi、快递、社保）放进古代/幻想世界，荒诞感来自词汇的错位。
- 好：悟空要签合同 / 我们被外卖平台告了 / 空城计被录下来了 / 园子钱花完了
- 坏：天庭紧急会议 / 荣国府出大事了（没有具体事件，没有错位感）

写法规则：
1. 5-12 字，能短则短，"悟空要签合同"6个字就够
2. 必须是一个已发生的、需要集体决策的问题（不是悬案、不是八卦）
3. 至少有一个词放在这个世界观里"不对劲"（现实入侵）
4. 读完脑子里蹦出的是"那咋办？"而不是"那是谁？"
5. **场景必须从角色组合中诞生**——只有这几个角色凑在一起才会发生的事件，禁止编一个跟角色无关的通用事件
6. 禁止：会议/议事/紧急/危机/讨论/决策/挑战——这些词不制造任何趣味
7. 禁止：廉价感叹词（竟然/居然/没想到）——冲击力来自事实本身

也可以使用其他模式（提问式/反差式/警告式），但必须通过开会合法性测试。

### settingZh（前情提要）
用 \n 分行，结构化输出，共四层：
- 第 1 行（大背景）：一句话交代这几个人在哪里、在一起干什么、出了什么事。必须包含一个融合角色特色的项目名/活动名/事件名（融合两人特色产生荒诞感）。用大白话写。
- 第 2-4 行（角色立场）：每个角色一行，格式"· [原名]（[适配头衔]）：[态度/立场]"（主场景角色不需要括号）。态度要体现该角色性格，要有具体原因不能空泛。
- 最后一行（钩子问题）：以"→"开头，一个开放式问题，指向会议要讨论的核心决策。
- 整体 ≤120 字（含换行符），用现代口语，禁止文言文
- 必须和 title 讲同一件事，大背景里的因果链要完整

### 标题和前情提要的配合
1. 标题是钩子（短、有力、让人"嗯？？"），前情提要是现场还原（画面感+细节+紧迫+钩子问题）
2. 两者不重叠：标题说了的事，前情提要不重复，只补充新细节
3. 合起来让用户产生"那咋办？我要进去看看"的冲动

### 质量标准（字段约束）
- title：中文，5-12 字，必须通过开会合法性测试，至少有一个现实入侵词
- settingZh：≤120 字，口语化，用 \n 分行，结构：大背景→角色立场（每 NPC 一行）→钩子问题
- userRole（用户身份）：中文，5-10字的称谓标签，有实权感（如"天庭监察仙官"、"贾府外聘执事"）

## 输出格式
严格返回 JSON：

{
  "title": "string（中文主题标题，5-12字，现实入侵式，必须通过开会合法性测试）",
  "settingZh": "string（前情提要，≤120字，四层结构：大背景→角色立场（每 NPC 一行）→钩子问题，用 \\n 分行）",
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
