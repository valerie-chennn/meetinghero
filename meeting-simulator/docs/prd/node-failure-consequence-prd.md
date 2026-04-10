# MeetingHero 节点失败后果机制 PRD

**版本**: v1.0
**日期**: 2026-03-31
**作者**: 产品经理
**状态**: 待架构师 / 设计师评审

---

## 背景与目标

### 现状

用户在 keyNode 输入无效时，系统只显示一条 `retryPrompt`（中文提示），用户可无限重试。没有后果、没有情绪反馈、没有累积影响。这使得会议模拟缺乏真实感和紧张感。

### 目标

让"说错话"有真实后果，NPC 有情绪反应，会议氛围会恶化，甚至会议可以失败。但同时，失败本身是学习机会——复盘环节会针对失败节点给出更深入的策略指导。

### 设计红线

- 不能让用户觉得"被惩罚"，而是"会议真的会这样"
- 失败后的复盘价值必须高于成功，让用户愿意重来
- 整体体验是"严格但公平的教练"，不是"刁钻的考官"

---

## 一、单节点失败流程（2次无效 = 节点失败）

### 状态机

```
用户输入 → AI 判断 inputType
  ├─ valid/weak → 节点通过，正常继续
  └─ invalid（第1次）→ 温和补救提示 → 用户重试
       ├─ valid/weak → 节点通过（标记为"rescued"）
       └─ invalid（第2次）→ 节点失败（failed）
            → 触发角色情绪反应
            → 会议继续到下一节点（不卡死）
```

### 第1次 invalid：补救机会

当前行为不变。NPC 温和提示，用户获得重试机会。同时前端显示参考说法按钮更明显（高亮闪烁），暗示"你可以用这个"。

retryPrompt 由 AI 生成，但增加一条 UI 层提示：

> 提示：点击下方"参考说法"可以直接使用

### 第2次 invalid：节点失败

节点标记为 `failed`。不再给重试机会。触发以下事件序列：

1. **AI 生成失败反应对话**（1-3条 NPC 消息，带角色情绪）
2. **前端播放"气氛尴尬"过渡**（短暂静默 + 界面微震/变暗）
3. **会议自动推进到下一节点**（由另一个 NPC 强行转话题）

---

## 二、角色情绪反应模板

节点失败时，后端 prompt 需要根据角色类型生成不同风格的反应。以下是模板框架（实际文案由 AI 基于上下文动态生成，但 prompt 中给出风格指引）：

### Leader 角色

| 累计失败数 | 情绪 | 反应风格 | 示例（仅供 prompt 参考） |
|-----------|------|---------|----------------------|
| 1个节点失败 | 不悦/强势推进 | 微微皱眉，快速接管话题 | "Alright, let's move on. We can circle back to this later." / textZh: "好吧，先跳过。回头再说。" |
| 2个节点失败 | 失望/不信任 | 语气明显冷淡，质疑能力 | "I expected more preparation on this. Let's hear from someone else." / textZh: "我以为你会准备好的。让别人来说吧。" |
| 3个节点失败 | 愤怒/终止 | 直接叫停会议 | "I think we need to reschedule. This isn't productive." / textZh: "我觉得我们需要改期。这样下去没有意义。" |

### Challenger 角色

| 累计失败数 | 情绪 | 反应风格 | 示例 |
|-----------|------|---------|------|
| 1个节点失败 | 得意/施压 | 趁机追问或嘲讽 | "See, that's exactly what I was worried about." / textZh: "看吧，我担心的就是这个。" |
| 2个节点失败 | 强势/接管 | 直接否定用户，提出自己方案 | "Maybe I should take the lead on this part." / textZh: "这部分也许我来主导比较好。" |
| 3个节点失败 | 公开质疑 | 向 leader 建议换人 | "With all due respect, do we have the right person on this?" / textZh: "恕我直言，这个人选对吗？" |

### Collaborator / Ally 角色

| 累计失败数 | 情绪 | 反应风格 | 示例 |
|-----------|------|---------|------|
| 1个节点失败 | 尴尬/帮圆 | 试图帮用户打圆场 | "I think what they meant was... anyway, good point to discuss offline." / textZh: "我觉得他们想说的是......总之，可以线下再聊。" |
| 2个节点失败 | 无奈/沉默 | 不再帮忙，沉默旁观 | （不发言，或只说 "Yeah..." 之类敷衍） |
| 3个节点失败 | 同情但无力 | 表情尴尬，无话可说 | "..." / textZh:（沉默） |

---

## 三、累计失败升级机制

### 会议氛围系统（meetingMood）

引入一个前后端共享的"会议氛围值"，影响后续 NPC 的语气和行为：

| 累计失败数 | 氛围等级 | 对后续节点的影响 |
|-----------|---------|---------------|
| 0 | normal | 正常会议，NPC 友好 |
| 1 | tense | NPC 语气更直接，challenger 更积极施压，但会议整体还行 |
| 2 | hostile | NPC 明显不耐烦，leader 语气冷淡，challenger 公开质疑 |
| 3 | collapsed | 会议终止，进入特殊结束流程 |

### 氛围传递规则

- 氛围值在 respond API 中作为 context 传给 AI，影响后续节点的 NPC 对话风格
- 前端根据氛围值调整 UI（背景色微调、消息间距变化等，由设计师定义）

---

## 四、会议失败：特殊结束

### 触发条件

3个 keyNode 全部失败（累计失败数 = 3）。

### 结束流程

1. **Leader 终止会议**（AI 生成终止对话，1-2条）
2. **前端播放"会议终止"动画**（屏幕渐暗，会议窗口关闭效果）
3. **进入"会议失败"结果页**（替代正常的 Complete 页）

### 会议失败结果页内容

```
标题：这场会议没有达到预期
副标题：但这正是最好的学习机会

[会议回顾卡片]
- 节点1：[失败] 说明进度 — 未能有效传达信息
- 节点2：[失败] 回应质疑 — 未能应对挑战
- 节点3：[失败] 推进决策 — 未能推动结论

[鼓励文案]
真实会议中，准备不足确实会导致这样的结果。
好消息是：复盘环节会详细分析每个节点的应对策略。

[按钮]
[查看详细复盘] ← 主按钮（进入复盘，复盘内容针对失败场景特别优化）
[重新开始这场会议] ← 次按钮
```

### 设计原则

- 不用"失败""游戏结束"这类游戏化词汇
- 用职场语言："没有达到预期""需要重新准备"
- 强调复盘的价值，引导用户继续学习而非退出

---

## 五、失败节点在复盘中的展示

### 节点状态标记

复盘数据中每个节点增加 `outcome` 字段：

| 状态 | 含义 | 复盘展示策略 |
|------|------|------------|
| passed | 用户第1次就通过 | 正常复盘流程 |
| rescued | 第1次失败，重试后通过 | 标注"经过提示后成功应对"，复盘内容偏鼓励 |
| failed | 2次都失败，节点未通过 | 特殊复盘卡片，重点分析"为什么这里难" |

### Failed 节点的复盘卡片设计

与正常节点的3步复盘不同，failed 节点使用**特殊的4步流程**：

```
步骤 1：发生了什么（情境还原）
- 展示完整上下文：NPC 说了什么 → 你被要求做什么 → 你实际说了什么
- 用红色边框标注"未能有效应对"

步骤 2：为什么这里难（难点分析，额外步骤）
- AI 分析该节点的难点（中文，1-2句）
- 例："这个节点要求你在被质疑时保持冷静并用数据回应。难点在于需要同时管理情绪和信息。"
- 展示"常见陷阱"：大多数人在这种场景下会犯的错误

步骤 3：推荐应对策略 + 参考表达
- 不只给一个"更好的表达"，而是给出完整的应对策略
- 策略（中文）+ 具体英文表达 + 句型分析
- 比正常节点多一个"策略层"的指导

步骤 4：练习（与正常节点相同）
- 新场景练习，使用推荐句型
```

### 复盘总结页的差异化展示

- 失败节点在总结页用醒目标记（如红色标签"需要练习"）
- 总结文案调整：从"你掌握了这些句型"变为"这些是你下次需要准备的"
- 如果全部失败：总结页标题从"会议英雄"变为"下次会更好"

---

## 六、后端 Prompt 配合方案

### 6.1 respond-meeting.js 修改

respond API 需要接收并处理以下新参数：

```javascript
// 新增参数
{
  retryCount: 0 | 1,        // 当前节点已重试次数（前端维护）
  failedNodeCount: 0 | 1 | 2, // 之前已失败的节点数（前端维护）
  meetingMood: "normal" | "tense" | "hostile"  // 当前会议氛围
}
```

### 6.2 System Prompt 新增段落

在 respond-meeting.js 的 systemPrompt 中新增以下内容：

```
## 节点失败处理

当前会议氛围：${meetingMood}
之前已失败节点数：${failedNodeCount}

### 当 inputType 为 invalid 且为第2次重试（retryCount = 1）时：
- inputType 仍标记为 "invalid"
- 新增字段 nodeFailed: true
- responseDialogue 必须体现角色的情绪反应：
  - leader 角色：${leaderReactionGuide}
  - challenger 角色：${challengerReactionGuide}
  - collaborator 角色：${collaboratorReactionGuide}
- responseDialogue 最后一条必须是转场消息，由某个 NPC 强行切换话题到下一议程
- 所有 responseDialogue 消息必须包含 textZh

### 会议氛围对语气的影响：
- normal：正常职场语气
- tense：所有 NPC 语气更简短直接，少客套
- hostile：leader 明显不耐烦，challenger 攻击性更强，collaborator 沉默或敷衍

### 当 failedNodeCount >= 2 且当前节点也是 invalid 时（即第3次失败）：
- 新增字段 meetingTerminated: true
- responseDialogue 生成 leader 终止会议的对话（1-2条）
- 终止对话语气视 leader 性格而定，但必须明确表达"会议到此结束"
```

### 6.3 respond API 返回值扩展

```json
{
  "systemEnglish": "...",
  "responseDialogue": [...],
  "inputType": "valid|weak|invalid",
  "retryPrompt": "...（仅第1次 invalid）",
  "nodeFailed": true,          // 新增：第2次 invalid 时为 true
  "meetingTerminated": false,   // 新增：3个节点都失败时为 true
  "meetingMood": "tense"        // 新增：返回更新后的氛围值
}
```

### 6.4 generate-review.js 修改

复盘 prompt 需要接收节点 outcome 信息：

```
## 用户在各节点的实际表现
节点0（说明类）：
- 结果：failed（2次无效回答）
- 用户第1次输入：xxx
- 用户第2次输入：xxx

节点1（压力回应类）：
- 结果：passed
- 用户发言：xxx

节点2（推进决策类）：
- 结果：rescued（第2次尝试通过）
- 用户第1次输入：xxx（无效）
- 用户第2次输入：xxx（有效）
```

新增 prompt 指令：

```
## 失败节点的复盘策略
对于 outcome 为 "failed" 的节点：
- 新增 failureAnalysis 字段：
  - difficulty: 中文，1句话，分析该节点的难点
  - commonTrap: 中文，1句话，大多数人在这种场景下的常见错误
  - strategy: 中文，1-2句话，应对策略（策略层面，不是具体句子）
- betterWay 的 whyBetter 字段要更详细（2句话而非1句）
- 整体语气从"还可以更好"调整为"这是一个重要的学习点"

对于 outcome 为 "rescued" 的节点：
- 在 betterWay 中额外提及"经过提示后你成功调整了"，给予肯定
```

复盘输出 JSON 的节点对象扩展：

```json
{
  "nodeIndex": 0,
  "outcome": "failed",
  "failureAnalysis": {
    "difficulty": "这个节点要求你在被质疑时用数据支撑观点...",
    "commonTrap": "大多数人会直接辩解而不是先认可对方的担忧...",
    "strategy": "先认可对方的关切（acknowledge），再用数据回应..."
  },
  "userSaid": {...},
  "betterWay": {...},
  "pattern": {...},
  "practice": {...}
}
```

### 6.5 数据库变更

conversations 表新增字段：

```sql
ALTER TABLE conversations ADD COLUMN retry_count INTEGER DEFAULT 0;
ALTER TABLE conversations ADD COLUMN outcome TEXT DEFAULT 'passed';
-- outcome: 'passed' | 'rescued' | 'failed'
```

meetings 表新增字段：

```sql
ALTER TABLE meetings ADD COLUMN failed_node_count INTEGER DEFAULT 0;
ALTER TABLE meetings ADD COLUMN meeting_mood TEXT DEFAULT 'normal';
ALTER TABLE meetings ADD COLUMN is_terminated INTEGER DEFAULT 0;
```

---

## 七、前端状态管理要点（供架构师/开发参考）

前端需要维护以下状态：

```javascript
// 每个节点的重试计数
const [retryCountByNode, setRetryCountByNode] = useState({});  // { 0: 0, 1: 1, 2: 0 }

// 节点结果
const [nodeOutcomes, setNodeOutcomes] = useState({});  // { 0: 'passed', 1: 'failed', 2: 'rescued' }

// 累计失败数
const [failedNodeCount, setFailedNodeCount] = useState(0);

// 会议氛围
const [meetingMood, setMeetingMood] = useState('normal');

// 会议是否终止
const [isTerminated, setIsTerminated] = useState(false);
```

关键交互逻辑：

1. 第1次 invalid → retryCount 加1，显示 retryPrompt + 高亮参考说法
2. 第2次 invalid → 标记 failed，failedNodeCount 加1，播放失败反应对话，自动推进
3. failedNodeCount 达到 3 → 播放终止对话，跳转到失败结果页

---

## 八、验收标准

| 指标 | 目标值 |
|------|------|
| 节点失败时 NPC 情绪反应的自然度（用户测试评分） | >= 4/5 |
| 会议失败后用户进入复盘的比例（而非直接退出） | >= 60% |
| 失败节点复盘完成率（走完全部步骤） | >= 50% |
| 会议失败后用户重新开始的比例 | >= 30% |
| 用户对"失败也是学习"的认同度（问卷） | >= 70% |

---

## 九、风险与约束

1. **AI 情绪反应质量**：角色的情绪文案完全由 AI 生成，可能不够自然或过于尖锐。需要人工抽检前50场，调整 prompt 中的语气指引。
2. **打击感控制**：连续失败可能导致用户沮丧退出。失败结果页的鼓励文案和"复盘价值"引导至关重要。
3. **前端状态复杂度增加**：retryCount、outcome、mood 等新状态需要仔细管理，防止边界情况（如网络重试导致重复计数）。
4. **数据库迁移**：需要处理现有数据的 schema 变更，conversations 和 meetings 表需要新增字段。

---

## 十、下一步

1. **架构师评审**：会议氛围状态管理方案、前后端通信协议变更
2. **UI 设计师**：失败结果页视觉设计、氛围变化的 UI 反馈（背景/动画）、failed 节点复盘卡片设计
3. **开发工程师**：respond API 参数扩展、conversations/meetings 表迁移脚本
4. **测试工程师**：设计全路径测试用例（0/1/2/3 失败的所有组合）
