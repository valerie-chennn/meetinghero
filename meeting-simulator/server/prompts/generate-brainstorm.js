/**
 * 脑洞模式 Prompt 生成器
 * 包含完整会议生成 prompt 和主题预览 prompt
 * 注意：此文件独立于 generate-meeting.js，不修改正经开会逻辑
 */

/**
 * 根据英语等级返回参考说法的生成策略描述（复用正经开会的等级分层逻辑）
 * @param {string} level - A1/A2/B1/B2
 * @returns {string}
 */
function getReferenceStrategy(level) {
  const strategies = {
    A1: `1句，≤8词，只用最基础词汇（I think/we need/the problem is），禁止从句和被动语态，必须提供 contentZh。示例：content: "I think we need more time.", contentZh: "我觉得我们需要更多时间。"`,
    A2: `1句，≤12词，简单词汇，只允许简单从句（that/because/so），必须提供 contentZh。`,
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
 * 构建角色的风格约束描述（用于 NPC 对话风格指引）
 * @param {Array} characters - 角色数组
 * @param {string} mainWorld - 主场景世界 ID
 * @param {string} sceneType - 场景类型
 * @returns {string}
 */
function buildCharacterStyleGuide(characters, mainWorld, sceneType) {
  if (!characters || characters.length === 0) return '';

  const lines = characters.map(char => {
    const isMainWorldChar = char.world === mainWorld;
    const isMixed = sceneType === 'brainstorm-random';

    if (isMixed && !isMainWorldChar) {
      // 乱炖局中非主场景角色：只改头衔，保留说话风格
      return `- ${char.name}（来自 ${char.worldLabel}，在本场景中头衔已适配为主场景身份）：
    说话风格必须保持原角色特点——${char.persona}
    禁止让 ${char.name} 完全融入主场景的语言体系，TA 的口头禅、思维方式、处事态度必须保留`;
    } else {
      // 点将局或主场景角色：正常贴合世界观
      return `- ${char.name}：${char.persona}
    TA 的对话必须体现这个性格特点，语言风格贴合 ${char.worldLabel} 世界观`;
    }
  });

  return lines.join('\n');
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

## NPC 消息约束
- 长度：${npcLengthConstraint}（严格遵守）
- 翻译：每条普通 NPC 消息（非 isKeyNode）必须包含非空 textZh 字段
- 条数：开场→节点1 最多3条，节点1→2 最多2条，节点2→3 最多2条，节点3→结尾 1条；全程 NPC 对话总量 8-9 条
- NPC 对话语言：英文，但风格贴合角色（孙悟空用口语、林黛玉诗意、乔布斯简洁有力）

## 对话结构
- 总消息数：恰好 15-20 条（含 3 个关键节点，不含 narrator——脑洞模式不生成 narrator）
- 恰好 3 个关键节点（isKeyNode: true）：nodeIndex 0 说明类(explain)、1 压力回应类(pressure)、2 推进决策类(decision)
- 两个关键节点之间至少间隔 2 条普通对话
- 关键节点 speaker="system"，text=""
- 脑洞模式不生成任何 narrator 消息（不需要内心旁白）

## 关键节点字段
- keyData：3 个数据点，贴合世界观（禁止 Sprint/KPI 等现代词，用"进展/阶段/状态"替代）
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
- backstory：2-3句，用 \\n 分隔，交代本次会议背景和当前处境
  - 禁止介绍用户的身份、职位或名字
  - 只写背景和处境，体现世界观（如"玉帝钦点了这次议事，三界都在看结果"）
- goal：1句话核心目标（贴合世界观）
- challenge：1句话难点，必须含具体 NPC 名+括号身份
- ally：1句话盟友，必须含具体 NPC 名+括号身份

## Memo
- 2-3 条会前备忘，格式：[{"text":"..."}]，内容贴合世界观

## 参考说法（references）
- 每个关键节点 1 条，等级策略：${referenceStrategy}
- 必须贴合该节点的语用目标

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
