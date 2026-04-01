# 会议对话流规范（Dialogue Flow Spec）

> 版本：v1.0
> 状态：正式规范
> 适用范围：前端 `Meeting.jsx`、后端 `generate-meeting.js`、所有代码改动必须符合此规范

---

## 一、元素类型定义

| 类型标识 | 视觉样式 | 数据标识 | 含义 |
|---------|---------|---------|------|
| NPC 消息 | 白色气泡，左对齐 | `isKeyNode: false`，`speaker` 为角色名 | AI 角色的正常发言 |
| keyNode 卡片 | 橙色提示框 | `isKeyNode: true` | 用户发言的关键节点，暂停等待用户输入 |
| narrator 内心独白 | 紫色框 | `speaker: "narrator"` | i人内心小人吐槽，增加代入感 |
| 用户消息 | 蓝色渐变气泡，右对齐 | `isUser: true` 或 `type: "user"` | 用户的实际发言 |
| 已发言标记 | 绿色小卡片 | keyNode 的 `isCompleted: true` 状态 | 标记用户已完成该节点 |
| 系统消息 | 分隔线样式 | `isSystem: true` | 系统提示（如无效输入提醒） |

---

## 二、完整对话流时序规范

### 核心原则

1. **keyNode 卡片是用户发言前的最后一条消息**——keyNode 出现后，紧接用户输入区，不再插入任何 NPC 消息或 narrator
2. **narrator 与 keyNode 之间必须至少隔 1 条 NPC 消息**——narrator 不能是 keyNode 前的最后一条，也不能是 keyNode 后的第一条
3. **两次用户发言之间的 NPC 消息（含 narrator）不超过 3 条**——节奏感的硬性保障
4. **narrator 只能出现在两条 NPC 消息之间**——不能打头，不能收尾，不能紧靠 keyNode

### 标准时序（文字描述）

```
会议开始
  │
  ├─ [开场段] NPC 消息 × 1~3 条
  │    ├─ 第 1 条 NPC 消息（开场白/介绍）
  │    ├─ [narrator 可插入此处] ← 第 1 条 NPC 后，第 2 条 NPC 前
  │    ├─ 第 2 条 NPC 消息（铺垫信息）
  │    └─ [如有第 3 条，narrator 不再插入，避免超上限]
  │
  ├─ [keyNode 0] 橙色卡片 ← 此处无任何 NPC 或 narrator 紧挨
  │
  ├─ [用户发言 0]
  │
  ├─ [过渡段 1] NPC 消息 × 1~2 条 + narrator × 0~1 条，总计 ≤ 3 条
  │    ├─ 第 1 条 NPC 消息（对用户发言的回应）
  │    ├─ [narrator 可插入此处] ← 第 1 条 NPC 后，第 2 条 NPC 前
  │    └─ 第 2 条 NPC 消息（推进话题）
  │
  ├─ [keyNode 1] 橙色卡片 ← keyNode 前最后一条必须是 NPC 消息，不得是 narrator
  │
  ├─ [用户发言 1]
  │
  ├─ [过渡段 2] NPC 消息 × 1~2 条 + narrator × 0~1 条，总计 ≤ 3 条
  │    ├─ 第 1 条 NPC 消息
  │    ├─ [narrator 可插入此处]
  │    └─ 第 2 条 NPC 消息（可选）
  │
  ├─ [keyNode 2] 橙色卡片 ← 同上规则
  │
  ├─ [用户发言 2]
  │
  ├─ [收尾段] NPC 消息 × 1 条（感谢/总结）
  │    └─ 第 1 条 NPC 消息（会议收尾）
  │    ← narrator 不出现在收尾段
  │
会议结束
```

---

## 三、各段的消息上限规则

| 段落 | 允许的消息类型 | 数量上限 | 备注 |
|-----|-------------|--------|------|
| 会议开始 → keyNode 0 | NPC 消息 + narrator | **NPC ≤ 3 条，narrator ≤ 1 条，总计 ≤ 3 条** | 开场段稍宽松，最多 3 条，给用户建立语境 |
| keyNode 出现后 → 用户发言 | 无 | **0 条** | keyNode 卡片出现后立即显示输入框，不插入任何内容 |
| 用户发言后 → 下一个 keyNode | NPC 消息 + narrator | **总计 ≤ 3 条**（NPC ≤ 2 条 + narrator ≤ 1 条） | 核心节奏规则，超出部分丢弃 |
| 最后一个用户发言后 → 会议结束 | NPC 消息 | **1 条** | 仅收尾感谢，不加 narrator |

**全局硬性规则（前端 `npcSinceUserRef` 计数器保障）：**
- 计数器在用户发言后归零
- 每显示一条 NPC 消息或 narrator，计数器 +1
- 计数器 ≥ 3 时，跳过后续所有消息直到遇到下一个 keyNode

---

## 四、橙色 keyNode 卡片的出现时机

### 出现条件

- 当 dialogue 数组中遇到 `isKeyNode: true` 的消息时，触发 keyNode 卡片渲染
- 必须且仅在此条件下出现

### keyNode 卡片前面应该是什么

**必须是一条 NPC 普通消息。** 即 keyNode 卡片前的最后一条可见消息是 NPC 的白色气泡。

**禁止情形：**
- keyNode 前紧挨 narrator（紫色框）
- keyNode 前紧挨另一个 keyNode（不会出现，但需防御）
- keyNode 前紧挨用户消息（不合逻辑）

**后端生成规则：** dialogue 数组中，每个 `isKeyNode: true` 条目的前一条必须是普通 NPC 消息（`isKeyNode: false`，`speaker` 非 `"narrator"`）。

**前端保障机制（后处理规则）：** `processDialogue` 函数的后处理阶段，需删除所有紧挨 keyNode 前面的 narrator——即：如果 `result[i].speaker === 'narrator'` 且 `result[i+1].isKeyNode === true`，则跳过该 narrator。

### keyNode 卡片后面应该是什么

**立即暂停播放，显示用户输入区。** keyNode 卡片后面在用户发言前不出现任何消息。

用户发言后，keyNode 卡片状态变为"已发言"（绿色），且继续播放后续 dialogue。

### 时机精确描述

```
[NPC 消息 n]          ← keyNode 前的最后一条消息
[keyNode 卡片]        ← 橙色框，显示 prompt + keyData
[用户输入框显示]       ← 立即出现，无延迟
[用户提交发言]
[keyNode 变为已发言标记]
[继续播放后续 NPC 消息]
```

---

## 五、紫色 narrator 的出现时机

### 出现条件

narrator 消息必须同时满足以下**所有条件**才能出现：

1. **位于两条 NPC 普通消息之间**——narrator 前一条是 NPC 消息，后一条也是 NPC 消息
2. **与任何 keyNode 之间至少隔 1 条 NPC 普通消息**——narrator 前后两条位置都不能是 keyNode
3. **当前段（自上次用户发言起）消息总计数 < 3**——不超过段落上限
4. **全局计数器 npcSinceUserRef < 3**——不超过全局上限

### narrator 与 keyNode 的位置关系

```
✅ 正确：
[NPC 消息 A]
[narrator]        ← 前后都是 NPC，距离 keyNode 至少 1 条
[NPC 消息 B]
[NPC 消息 C]
[keyNode]

❌ 错误（narrator 紧挨 keyNode 前）：
[NPC 消息 A]
[NPC 消息 B]
[narrator]        ← 下一条就是 keyNode，违规！
[keyNode]

❌ 错误（narrator 紧挨 keyNode 后）：
[keyNode]
[narrator]        ← 上一条是 keyNode，违规！
[NPC 消息 A]
```

### narrator 与 NPC 消息的位置关系

```
✅ 正确：每段只在第 1~2 条 NPC 消息后插入一次
[NPC 消息 1]
[narrator]        ← 第 1 条 NPC 说完后插入，评论第 1 条
[NPC 消息 2]
[keyNode]         ← 此时距 narrator 隔了 1 条 NPC，符合规则

❌ 错误：narrator 后紧跟 keyNode
[NPC 消息 1]
[NPC 消息 2]
[narrator]
[keyNode]         ← narrator 和 keyNode 之间没有 NPC 消息，违规！
```

### narrator 的内容规则（后端生成要求）

- 使用中文，第一人称"我"视角，语气微紧张、轻微自嘲
- 必须包含具体角色名字，不用"他/她/这人"等模糊指代
- 评论的是紧挨其前面那条 NPC 消息的发言者
- 长度一句话，不超过 12 个字
- 每场会议恰好 2 条 narrator

### 前端注入 narrator 的规则（当后端未生成足够时）

前端 `processDialogue` 函数的注入条件：
- 当前段已输出 NPC 消息数量 = 2
- 当前段消息总计数 < 3（还有配额）
- 下一条消息不是 keyNode（保证 narrator 和 keyNode 之间有间隔）
- 下一条消息不是另一个 narrator

---

## 六、示例时序（3 个 keyNode 的完整会议）

以下为一场标准会议的完整消息序列，共约 14 条可见消息：

```
序号  类型              角色/来源   内容摘要
----  ----------------  ---------  ----------------------------------
 1    NPC 消息          leader     开场白，介绍今天的议程
 2    narrator [后端]   narrator   "Owen 要开始点名了…"         ← 第 1 条 NPC 后插入
 3    NPC 消息          leader     把话题引向用户负责的模块
─────────────────────────────────────────────────────────────────────
 4    keyNode 卡片      system     节点 0：explain 类，prompt + keyData
─────────────────────────────────────────────────────────────────────
 5    用户消息          user       "The backend is delayed due to..."
─────────────────────────────────────────────────────────────────────
 6    NPC 消息          collaborator  "That makes sense, but..."
 7    narrator [前端注入] narrator  "Daniel 和 Sarah 在互相甩锅啊"  ← 第 1 条后插入
 8    NPC 消息          challenger "So you're saying we'll miss the deadline?"
─────────────────────────────────────────────────────────────────────
 9    keyNode 卡片      system     节点 1：pressure 类，prompt + keyData
─────────────────────────────────────────────────────────────────────
10    用户消息          user       "We can adjust the scope to..."
─────────────────────────────────────────────────────────────────────
11    NPC 消息          leader     "Alright, let's make a call then."
12    narrator [后端]   narrator   "Mia 要拍板了，快想好说什么"   ← 第 1 条后插入
13    NPC 消息          collaborator  "I agree, we should lock this down."
─────────────────────────────────────────────────────────────────────
14    keyNode 卡片      system     节点 2：decision 类，prompt + keyData
─────────────────────────────────────────────────────────────────────
15    用户消息          user       "Let's go with option B and..."
─────────────────────────────────────────────────────────────────────
16    NPC 消息          leader     "Great. Thanks everyone, let's wrap up."
─────────────────────────────────────────────────────────────────────
    系统消息            system     "会议结束"
```

**关键节点验证：**
- 消息 4（keyNode 0）前一条是消息 3（NPC）✅
- 消息 9（keyNode 1）前一条是消息 8（NPC）✅
- 消息 14（keyNode 2）前一条是消息 13（NPC）✅
- narrator（消息 2）前是 NPC，后是 NPC，距离 keyNode 4 隔了消息 3（NPC）✅
- narrator（消息 7）前是 NPC 6，后是 NPC 8，距离 keyNode 9 隔了消息 8（NPC）✅
- narrator（消息 12）前是 NPC 11，后是 NPC 13，距离 keyNode 14 隔了消息 13（NPC）✅
- 每段用户发言后 NPC + narrator 总计：段1=3条(6,7,8)✅，段2=3条(11,12,13)✅，段3=1条(16)✅

---

## 七、前端实现要点

### processDialogue 函数的规则优先级

1. **最高优先：** 后处理删除紧挨 keyNode 前后的 narrator
2. **次优先：** 全局计数（npcSinceUserRef）≥ 3 时跳过消息
3. **注入时机：** 当前段 NPC 数量 = 2，且下一条不是 keyNode，且总计数 < 3

### 播放延时规范

| 消息类型 | 建议延时 |
|---------|---------|
| 普通 NPC 消息 | 1200ms |
| narrator 消息 | 1500ms（稍慢，给阅读时间） |
| keyNode 前的最后一条 NPC | 800ms（加速，营造节奏感） |
| responseDialogue 消息 | 800ms |

### npcSinceUserRef 计数器管理

- **归零时机：** 用户提交发言后（`handleSubmit` 开头）
- **+1 时机：** 每条 NPC 消息和 narrator 被 `push` 到 `displayedMessages` 时
- **跳过条件：** `npcSinceUserRef.current >= 3` 时直接 `playDialogueFrom(startIndex + 1)`
- **注意：** keyNode 卡片不计入此计数

---

## 八、后端生成规则约束

### dialogue 数组的合法结构检查

后端生成完毕后，应自查以下规则（可在后端校验或在前端 processDialogue 兜底）：

```
检查项 1：每个 keyNode 的前一条消息必须是普通 NPC 消息
  遍历 dialogue，找到所有 isKeyNode=true 的条目 i
  检查 dialogue[i-1] 是否满足：isKeyNode=false 且 speaker!='narrator'

检查项 2：每个 keyNode 的后一条消息不能是 narrator
  检查 dialogue[i+1] 是否 speaker!='narrator'

检查项 3：narrator 前后都必须是普通 NPC 消息
  找到所有 speaker='narrator' 的条目 j
  检查 dialogue[j-1].isKeyNode===false 且 dialogue[j-1].speaker!='narrator'
  检查 dialogue[j+1].isKeyNode===false 且 dialogue[j+1].speaker!='narrator'

检查项 4：每两个 keyNode 之间的普通 NPC 消息数量 ≤ 3（不含 narrator）
  统计相邻两个 keyNode 之间 speaker!='narrator' 且 isKeyNode=false 的条目数
```

### 开场段（节点 0 之前）NPC 数量

- **后端生成：** 1~3 条 NPC 消息 + 1 条 narrator（narrator 在第 1~2 条 NPC 之间）
- **前端显示上限：** 3 条（含 narrator），超出丢弃
- **推荐结构：** `[NPC] [narrator] [NPC]`（共 3 条，刚好填满配额）

### 节点间段落 NPC 数量

- **后端生成：** 2 条 NPC + 1 条 narrator（可选），总计 ≤ 3 条
- **前端显示上限：** 3 条（硬性截断）

---

## 九、常见错误及修复方式

| 错误现象 | 根本原因 | 修复方式 |
|---------|---------|---------|
| narrator 紧挨 keyNode（narrator 在 keyNode 前） | 后端生成位置错误，或前端后处理未生效 | 前端后处理必须在 processDialogue 最后一步执行；后端 prompt 加强约束 |
| NPC 气泡数量超过 3 个 | npcSinceUserRef 计数器未正确触发跳过 | 检查 processDialogue 中 `msgCount >= 3` 的跳过逻辑，以及 playDialogueFrom 中的 `npcSinceUserRef.current >= 3` 条件 |
| keyNode 出现在两个 NPC 气泡之间（而非最后） | 后端生成的 dialogue 顺序错误，keyNode 前有多余消息 | 后端严格按照"keyNode 前最后一条必须是 NPC"生成；前端 processDialogue 不改变 keyNode 位置 |
| narrator 和 keyNode 紧挨出现（紫橙相邻） | 后处理规则未过滤到 narrator-keyNode 相邻情形 | processDialogue 的 final 循环中，检查 `next.isKeyNode` 和 `prev.isKeyNode` 两个方向 |
| 用户不知道什么时候轮到自己 | keyNode 卡片不够突出，或 keyNode 前消息过多导致卡片被淹没 | 严格执行 ≤3 条上限；keyNode 卡片出现后立即 setShowInput(true)，不延迟 |

---

*本规范由产品经理制定，2026-03-31*
*所有前端和后端改动必须通过本规范的时序校验*
