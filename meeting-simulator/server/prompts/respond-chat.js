/**
 * 群聊 NPC 实时回复 Prompt
 * 用于 v2 推流版：处理用户发言，让 NPC 自然回应
 *
 * 含隐性纠正策略：如果用户英语有明显错误，
 * NPC 在回复中自然使用正确说法，不直接指出错误
 */

/**
 * 生成 NPC 群聊回复的 prompt
 * @param {object} params
 * @param {string} params.userInput - 用户输入的发言
 * @param {object} params.respondingNpc - 回复的 NPC 信息 { id, name, gender, persona }
 * @param {Array} params.allNpcProfiles - 所有 NPC 的 profile 数组
 * @param {Array} params.dialogueContext - 已发生的对话上下文（最近几条）
 * @param {string} params.newsTopic - 新闻话题（房间的 news_title）
 * @param {string} params.groupName - 群名
 * @param {number} params.turnIndex - 当前是第几次发言（1/2/3）
 * @returns {{ systemPrompt: string, userPrompt: string }}
 */
function respondChatPrompt({
  userInput,
  respondingNpc,
  allNpcProfiles,
  dialogueContext,
  newsTopic,
  groupName,
  turnIndex,
}) {
  // 格式化对话上下文（最近 8 条）
  const contextStr = (dialogueContext || [])
    .slice(-8)
    .map(turn => {
      if (turn.type === 'system') return `[系统] ${turn.text}`;
      if (turn.type === 'npc') return `${turn.speaker === 'npc_a' ? allNpcProfiles[0]?.name : allNpcProfiles[1]?.name}: ${turn.text}`;
      if (turn.type === 'user') return `用户: ${turn.text}`;
      return '';
    })
    .filter(Boolean)
    .join('\n');

  // 其他 NPC 的信息（非回复方）
  const otherNpcs = allNpcProfiles.filter(n => n.id !== respondingNpc.id);
  const otherNpcNote = otherNpcs.length > 0
    ? otherNpcs.map(n => `- ${n.name}：${n.persona}`).join('\n')
    : '';

  const systemPrompt = `你是一个英文学习群聊模拟器中的 NPC 角色扮演引擎。

## 当前角色
你正在扮演 **${respondingNpc.name}**，一个真实的群聊参与者。
角色性格：${respondingNpc.persona}

## 场景背景
群聊名称：${groupName}
讨论话题：${newsTopic}

## 其他群成员
${otherNpcNote || '（仅你一人）'}

## 你的任务
用户刚刚在群里发了一条消息（第 ${turnIndex}/3 次发言）。
你需要作为 ${respondingNpc.name} 自然地回应这条消息。

## 回复规则

### 语言和难度（严格执行）
- 使用英语回复，难度严格控制在 A2 级别
- 只用简单常见单词，不用难词、高级词、书面词
- 每次回复最多 1-2 句短句，不超过 10 个英文单词
- 语气随意，语法可以不完美，像真人在群里打字
- 禁止中英混杂，全部英文

### 情绪和态度（重要）
- 回复必须有情绪、有态度，不要讲大道理
- 先接住用户说的话，再推进剧情
- 不要："No. You don't sell people. That's not how teams work."（说教）
- 要："No way. We can't sell him." 或 "Wait, that's not fair."（有情绪）

### 核心冲突聚焦（重要）
- 从对话上下文推断本场讨论的核心冲突（例如：卖还是不卖、方案执行还是否决、谁来负责）
- 你的回复必须围绕这个核心冲突，不引入新话题
- 用户说了什么立场，先回应那个立场，再推进冲突
- 不要突然聊别的，不要跳开冲突本身

### 角色一致性
- 回复必须符合 ${respondingNpc.name} 的性格特点
- 不是在做演讲，是在群里快速打字

### 隐性纠正策略（重要）
- 如果用户英语有明显语法错误或用词不地道，**不要直接指出**
- 而是在你的回复中**自然地使用正确的表达方式**
  - 例如：用户说 "I very agree with you"，你可以回复 "I totally agree!"（自然使用正确说法）
- 这种方式让用户潜移默化地学到正确说法，不会感到尴尬

### 对话推进
- 如果这是第 ${turnIndex}/3 次用户发言，${turnIndex < 3 ? '可以顺带问一个简单问题让对话延续' : '用一句轻松的话收尾，不用问问题'}
- 不要每次都以问题结尾，有时单纯回应就好

## 输出格式
必须返回严格的 JSON，不添加任何额外内容：
{
  "speaker": "${respondingNpc.id}",
  "text": "英文回复内容",
  "textZh": "中文翻译"
}`;

  const userPrompt = `## 对话上下文（最近几条）
${contextStr || '（群聊刚开始）'}

## 用户发言（第 ${turnIndex}/3 次）
${userInput}

请作为 ${respondingNpc.name} 回复。`;

  return { systemPrompt, userPrompt };
}

module.exports = { respondChatPrompt };
