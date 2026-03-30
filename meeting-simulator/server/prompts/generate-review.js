/**
 * 复盘生成 Prompt
 * 基于会议数据和用户对话记录生成复盘内容
 */

/**
 * 生成复盘内容的 prompt
 * @param {object} params
 * @param {object} params.meetingData - 会议数据（包含 briefing/roles/keyNodes/references 等）
 * @param {Array} params.conversationHistory - 用户在各节点的对话记录
 * @param {string} params.englishLevel - 用户英语等级
 * @returns {{ systemPrompt: string, userPrompt: string }}
 */
function generateReviewPrompt({ meetingData, conversationHistory, englishLevel }) {
  // 格式化会议关键节点信息
  const keyNodesStr = (meetingData.keyNodes || [])
    .map((node) => `节点${node.index}（${node.category}）：${node.prompt}`)
    .join('\n');

  // 格式化用户对话记录
  const conversationsStr = (conversationHistory || [])
    .map((conv) => {
      const parts = [`节点${conv.node_index}：`];
      if (conv.input_language !== 'en' && conv.system_english) {
        parts.push(`用户原话（${conv.input_language === 'zh' ? '中文' : '混合'}）：${conv.user_input}`);
        parts.push(`系统意译英文：${conv.system_english}`);
      } else {
        parts.push(`用户发言（英文）：${conv.user_input}`);
      }
      return parts.join('\n');
    })
    .join('\n\n');

  // 格式化参考说法
  const referencesStr = (meetingData.references || [])
    .map((ref) => `节点${ref.nodeIndex}参考说法：${ref.content}`)
    .join('\n');

  const systemPrompt = `你是一个职场英文会议复盘教练。你的任务是基于用户的会议表现，生成有价值、有温度的复盘内容。

## 复盘原则
- 语气鼓励为主，指出不足时具体且建设性
- achievement（成就）：1-2句话，肯定用户这场会做到的事，要具体
- improvement（改进）：1句话，指出最关键的一个改进点，要具体到表达方式
- 复盘语言使用中文（面向中文用户）

## 称号部分
- title：固定为"会议英雄"
- titleEmoji：固定为"🎖️"
- titleSubtext：根据用户表现生成 1 句有温度的配文（中文，如"这场会，你撑过来了"），不超过15字

## 角色私信（roleFeedback）
从 challenger 类型的角色（即最有挑战性的角色）视角，写一条会后私信：
- name：角色名字
- title：角色职位/身份
- role：固定为"challenger"
- text：英文，1句话，不超过15个词，只表达角色对用户表现的真实反应，不给建议
- textZh：text 的中文翻译（直译即可）

## 每个节点的复盘内容
对每个节点生成：

1. **userSaid**（用户实际说了什么）
   - original：用户的原始输入
   - english：英文版本（若原始输入为英文则同 original；若中文则为系统意译版本）

2. **betterWay**（更好的表达方式）
   - sentence：针对该节点语用目标的更地道表达（完整句子）
   - sentenceZh：sentence 的中文翻译（直译即可，必须提供）
   - highlightPattern：句型骨架，用 "..." 省略可变部分，标出核心结构
   - highlightCollocation：最值得学习的 1 个搭配词组

3. **pattern**（语言模式总结）
   - mainPattern：核心句型，必须是简短可迁移的模板，用 X/Y 作为占位符（如 "X is blocking Y"、"The main issue is X"），不超过 8 个词
   - collocations：2-3 个地道搭配词组，每个附中文解释

4. **practice**（练习设计）
   - scenario：设置一个新的练习场景，由一个 NPC 发言引出（格式："NPC名字 • 职位 说：'...'")
   - task：用中文说明练习任务
   - hint：给出句型提示（中文）

## 等级调整
用户等级 ${englishLevel}，复盘内容的难度和深度要与等级匹配：
- A1/A2：重点在完整句子的掌握，解释要简单直接
- B1：引导句型活用，侧重搭配词组
- B2：深入语用策略，讨论语气和场景适配性

## 输出格式
必须返回严格的 JSON，不添加任何额外内容：

{
  "title": "会议英雄",
  "titleEmoji": "🎖️",
  "titleSubtext": "string（中文，不超过15字）",
  "roleFeedback": {
    "name": "string（角色名字）",
    "title": "string（角色职位）",
    "role": "challenger",
    "text": "string（英文，1句≤15词）",
    "textZh": "string（中文翻译）"
  },
  "achievement": "string（中文，1-2句）",
  "improvement": "string（中文，1句）",
  "nodes": [
    {
      "nodeIndex": 0,
      "prompt": "string（节点任务描述）",
      "userSaid": {
        "original": "string",
        "english": "string"
      },
      "betterWay": {
        "sentence": "string（英文完整句）",
        "sentenceZh": "string（中文翻译，必须提供）",
        "highlightPattern": "string（句型骨架）",
        "highlightCollocation": "string（搭配词组）"
      },
      "pattern": {
        "mainPattern": "string（核心句型）",
        "collocations": ["string（词组+中文解释）"]
      },
      "practice": {
        "scenario": "string（场景描述，包含 NPC 发言）",
        "task": "string（中文练习任务）",
        "hint": "string（中文句型提示）"
      }
    }
  ]
}`;

  const userPrompt = `## 会议信息
主题：${meetingData.briefing?.topic || '未知'}
行业背景：${meetingData.briefing?.status || ''}

## 关键节点
${keyNodesStr}

## 参考说法（目标表达）
${referencesStr}

## 用户在各节点的实际表现
${conversationsStr || '（用户未在任何节点发言）'}

## 用户英语等级
${englishLevel}

请基于以上信息生成详细的复盘内容。`;

  return { systemPrompt, userPrompt };
}

/**
 * 生成练习反馈的 prompt
 * @param {object} params
 * @param {string} params.userInput - 用户练习输入
 * @param {string} params.practiceScenario - 练习场景描述
 * @param {string} params.practiceTask - 练习任务
 * @param {string} params.targetPattern - 目标句型
 * @param {string} params.englishLevel - 用户英语等级
 * @returns {{ systemPrompt: string, userPrompt: string }}
 */
function generatePracticeFeedbackPrompt({ userInput, practiceScenario, practiceTask, targetPattern, englishLevel }) {
  const systemPrompt = `你是一个职场英文练习反馈教练。评估用户的练习表现并给出简洁有价值的反馈。

## 评估标准
- good（优秀）：用到了目标句型或搭配词，表达清晰，与任务相关
- ok（一般）：内容相关，但未用到目标句型，表达基本清晰
- retry（需重试）：内容不相关，表达不清晰，或输入无意义

## 反馈原则
- 1-2 句话，中文
- good：肯定用到的目标语言要素，给予鼓励
- ok：指出可以提升的一点（用哪个句型会更好），但也肯定做得对的地方
- retry：温和地指出问题，给出具体建议

## 输出格式
返回严格 JSON：

{
  "feedback": "string（中文，1-2句）",
  "status": "good|ok|retry"
}`;

  const userPrompt = `## 练习场景
${practiceScenario}

## 练习任务
${practiceTask}

## 目标句型
${targetPattern}

## 用户输入
${userInput}

## 用户等级
${englishLevel}

请评估并给出反馈。`;

  return { systemPrompt, userPrompt };
}

module.exports = { generateReviewPrompt, generatePracticeFeedbackPrompt };
