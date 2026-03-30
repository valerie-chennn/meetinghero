/**
 * 会中响应 Prompt
 * 处理用户在关键节点的发言，判断有效性并生成后续对话
 */

/**
 * 生成会中响应的 prompt
 * @param {object} params
 * @param {string} params.userInput - 用户输入的文字
 * @param {string} params.inputLanguage - 输入语言 "en"|"zh"|"mixed"
 * @param {string} params.nodePrompt - 当前节点的任务提示（中文）
 * @param {string} params.nodeType - 节点类型 "explain"|"pressure"|"decision"
 * @param {Array} params.dialogueContext - 当前节点之前的对话上下文（最近 6 条）
 * @param {string} params.englishLevel - 用户英语等级
 * @returns {{ systemPrompt: string, userPrompt: string }}
 */
function respondMeetingPrompt({ userInput, inputLanguage, nodePrompt, nodeType, dialogueContext, englishLevel }) {
  // 将对话上下文格式化为字符串
  const contextStr = (dialogueContext || [])
    .slice(-6)
    .map(({ speaker, text }) => `${speaker}: ${text}`)
    .join('\n');

  const systemPrompt = `你是一个职场英文会议模拟器的实时响应引擎。

## 你的任务
用户在会议关键节点进行了发言，你需要：
1. 判断输入有效性
2. 如果是中文或中英混合输入，生成意译英文（基于语用目标，非逐字翻译）
3. 生成会议继续进行的后续对话（1-3 条）

## 有效性判断标准
- valid（有效）：内容与节点任务相关，表达清晰，可推动会议进行
- weak（较弱）：内容相关但表达模糊、过短，或意思没有完全传达
- invalid（无效）：内容与节点任务完全无关，或为乱码、无意义输入

## 意译原则（针对中文/混合输入）
- 不是逐字翻译，而是基于节点语用目标生成地道英文表达
- 保持说话者意图，使用职场英文惯用表达
- 语言等级参考用户等级（${englishLevel}），但意译结果本身要地道自然

## 后续对话生成原则
- 基于用户发言的英文版本（无论原始输入语言）
- NPC 的反应要符合其角色性格（leader/collaborator/challenger）
- 1-3 条对话，推动会议自然进行
- 仅当 inputType 为 "invalid" 时，生成 retryPrompt（中文，引导用户重新尝试）

## 输出格式
必须返回严格的 JSON，不添加任何额外内容：

{
  "systemEnglish": "string（若输入为英文则直接返回优化后的英文；若中文则返回意译英文）",
  "responseDialogue": [
    { "speaker": "NPC名字", "text": "英文对话内容" }
  ],
  "inputType": "valid|weak|invalid",
  "retryPrompt": "string（仅 invalid 时包含此字段，中文提示）"
}`;

  const userPrompt = `## 会议上下文（当前节点前的最近对话）
${contextStr || '（会议刚开始）'}

## 当前节点信息
- 节点类型：${nodeType}
- 节点任务：${nodePrompt}
- 用户英语等级：${englishLevel}

## 用户发言
- 输入语言：${inputLanguage}
- 输入内容：${userInput}

请根据以上信息生成响应。`;

  return { systemPrompt, userPrompt };
}

module.exports = { respondMeetingPrompt };
