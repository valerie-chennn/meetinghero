/**
 * 会中响应 Prompt
 * 处理用户在关键节点的发言，判断有效性并生成后续对话
 *
 * 支持三档响应：
 * - valid：正常推进
 * - weak：NPC 照接，但语气体现"你说得不够好"
 * - invalid：NPC 给补救反应，允许重试；第 2 次则收场并强制推进
 *
 * 支持 failedNodeCount 累积影响 NPC 语气
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
 * @param {number} [params.retryCount=0] - 当前节点已重试次数（0 或 1）
 * @param {number} [params.failedNodeCount=0] - 本次会议中已失败的节点数（0-2）
 * @returns {{ systemPrompt: string, userPrompt: string }}
 */
function respondMeetingPrompt({
  userInput,
  inputLanguage,
  nodePrompt,
  nodeType,
  dialogueContext,
  englishLevel,
  retryCount = 0,
  failedNodeCount = 0,
}) {
  // 将对话上下文格式化为字符串
  const contextStr = (dialogueContext || [])
    .slice(-6)
    .map(({ speaker, text }) => `${speaker}: ${text}`)
    .join('\n');

  // 根据累积失败数生成 NPC 语气说明
  let npcToneNote = '';
  if (failedNodeCount === 1) {
    npcToneNote = '\n- NPC 语气应更加不耐烦，措辞更直接、更有压迫感';
  } else if (failedNodeCount >= 2) {
    npcToneNote = '\n- NPC 明显失去信任，语气冷淡甚至带有轻蔑，对用户失去期待';
  }

  // 是否为第 2 次 invalid（需要生成 failureResponse 收场）
  const isSecondInvalid = retryCount >= 1;

  const systemPrompt = `你是一个职场英文会议模拟器的实时响应引擎。

## 你的任务
用户在会议关键节点进行了发言，你需要：
1. 判断输入有效性
2. 如果是中文或中英混合输入，生成意译英文（基于语用目标，非逐字翻译）
3. 生成会议继续进行的后续对话（1-3 条）

## 有效性判断标准
- valid（有效）：内容与节点任务相关，表达清晰，可推动会议进行
- weak（较弱）：内容相关但表达模糊、过短，或意思没有完全传达（如 "We're working on it"）
- invalid（无效）：内容与节点任务完全无关，拒绝回答，或为乱码/无意义输入（如 "I don't know"）

## 意译原则（针对中文/混合输入）
- 不是逐字翻译，而是基于节点语用目标生成地道英文表达
- 保持说话者意图，使用职场英文惯用表达
- 语言等级参考用户等级（${englishLevel}），但意译结果本身要地道自然

## 不同 inputType 的后续对话要求

### valid
- NPC 反应积极，正常推进会议，1-3 条对话${npcToneNote}

### weak
- NPC 照接，会议继续，但 NPC 语气或措辞体现"你说得不够清楚/不够有力"
- 例如：轻微皱眉、追问细节、用 "Hmm" 开头表示存疑、或礼貌但不满的回应
- 不重试，直接推进${npcToneNote}

### invalid（第 1 次，retryCount=0）
- NPC 给出角色化补救反应（roleplay 语境下的自然对话，不是系统提示）
- 例如："Take your time. Can you at least share what you do know about the timeline?"
- retryPrompt：NPC 角色的对话（英文 + 中文翻译），引导用户重新尝试
- responseDialogue 可为空数组或仅包含补救对话本身${npcToneNote}

### invalid（第 2 次，retryCount=1，需要生成 failureResponse）
- NPC 给出收场反应，表示放弃追问，自行推进话题
- failureResponse：NPC 的收场语（英文 + 中文翻译），${failedNodeCount >= 2 ? '语气非常冷淡甚至终结性' : failedNodeCount === 1 ? '语气明显不满' : '语气带有失望但专业'}
- responseDialogue 包含收场对话（1-2 条）

## 输出格式
必须返回严格的 JSON，不添加任何额外内容：

{
  "systemEnglish": "string（若输入为英文则直接返回优化后的英文；若中文则返回意译英文；invalid 时可为空字符串）",
  "responseDialogue": [
    { "speaker": "NPC名字", "text": "英文对话内容", "textZh": "中文翻译" }
  ],
  "inputType": "valid|weak|invalid",
  "retryPrompt": { "text": "NPC 角色英文补救对话", "textZh": "中文翻译" }（仅第 1 次 invalid 时包含此字段）,
  "failureResponse": { "text": "NPC 英文收场对话", "textZh": "中文翻译" }（仅第 2 次 invalid 时包含此字段）
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

## 当前状态
- 本节点已重试次数：${retryCount}（0=首次，1=第二次）
- 本场会议已失败节点数：${failedNodeCount}
${isSecondInvalid ? '- 注意：这是第 2 次无效输入，需要生成 failureResponse（收场对话），不再生成 retryPrompt' : ''}

请根据以上信息生成响应。`;

  return { systemPrompt, userPrompt };
}

module.exports = { respondMeetingPrompt };
