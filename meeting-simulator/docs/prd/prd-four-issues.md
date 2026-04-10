# 四个体验问题产品方案

> 产品经理出品 | 2026-03-31 | 只出方案，不改代码

---

## 问题 1：语音输入后缺少加载状态

### 现状分析

用户点击麦克风录音，停止后进入 `mediaRecorder.onstop` 回调，发起后端 Whisper STT 请求（`speechToText`）。这段等待时间 2-5 秒，期间界面无任何变化——录音红点消失，输入框恢复空白状态，用户以为操作失败。

### 方案

**在输入框内显示转写中状态**，不新增弹层，不打断用户视线。

#### 交互流程

1. 用户点击麦克风 -> 进入录音态（现有红色脉冲 + 时长，保持不变）
2. 用户再次点击停止录音 -> 输入框进入"转写中"状态：
   - 输入框 placeholder 变为 `"语音识别中..."`
   - 输入框左侧（原麦克风按钮位置）显示一个小型 spinner（12px 灰色旋转圆圈）
   - 输入框不可编辑（`disabled`），发送按钮灰显
3. 转写成功 -> 文字填入输入框，恢复可编辑状态，自动聚焦
4. 转写失败 -> placeholder 变为 `"识别失败，请重试或手动输入"`，2 秒后恢复默认

#### 状态管理

在 `VoiceRecorder` 组件新增一个回调 `onTranscribing`，在 `onstop` 触发时通知父组件进入转写态。父组件 `UserInput` 新增 `isTranscribing` 状态控制 UI。

#### 视觉规格

| 元素 | 规格 |
|------|------|
| spinner | 12x12px，`var(--color-text-tertiary)` 色，旋转动画 |
| placeholder 文字 | `"语音识别中..."`，灰色，带省略号动画（可选） |
| 持续时间 | 跟随实际 STT 请求，无固定时长 |

---

## 问题 2：角色卡弹窗位置和排版问题

### 现状分析

当前 `RoleInfoCard` 是 bottom sheet 形式——全屏遮罩 + 底部滑入卡片。包含：头像+名字、职位、stance 标签、type 标签、briefNote。排版松散，占据屏幕下方大面积区域，打断会议节奏。

### 方案

**改为气泡卡片（Popover），从被点击的头像/名字处弹出**。

#### 触发方式

- **点击** NPC 头像或名字 -> 弹出气泡卡片
- **再次点击**或**点击卡片外任意区域** -> 关闭
- 不用长按（移动端长按体验不好），不用 hover（移动端不支持）

#### 卡片形式

**轻量气泡卡片**，从触发元素下方弹出，带小三角指向触发元素。

#### 信息精简排版

将所有信息压缩为 3 行：

```
[头像圈] Sarah Chen
         Engineering Manager

[挑战者] [反对方]  ← stance + type 标签，紧凑一行

"她对进度管理要求严格，会追问细节"  ← briefNote，斜体，单行
```

#### 视觉规格

| 元素 | 规格 |
|------|------|
| 卡片宽度 | 260px 固定宽 |
| 卡片背景 | `var(--color-surface)`，圆角 12px，阴影 `0 4px 16px rgba(0,0,0,0.12)` |
| 头像 | 28x28px 圆形，角色专属色底 + 首字母 |
| 名字 | 14px，`font-weight: 600` |
| 职位 | 12px，`var(--color-text-secondary)` |
| 标签 | 现有样式不变，间距收紧至 4px |
| briefNote | 12px，斜体，`var(--color-text-tertiary)`，最多 2 行 |
| 整体内边距 | 12px |
| 出现动画 | `opacity 0->1 + translateY(4px->0)`，150ms ease-out |
| 小三角 | 8px 等边三角，颜色同卡片背景 |

#### 定位逻辑

- 默认从触发元素下方弹出
- 如果下方空间不足（距屏幕底部 < 卡片高度 + 20px），改为上方弹出
- 水平居中对齐触发元素，左右不超出屏幕边缘（留 12px 安全边距）

---

## 问题 3：用户回答无效时的处理策略

### 现状分析

当前逻辑：`respond-meeting.js` 将输入分为 `valid`/`weak`/`invalid` 三档。`invalid` 时返回 `retryPrompt`（一段中文提示 + 英文参考说法），前端显示为系统消息并重新打开输入框。用户可以无限重试。

### 核心设计原则

1. **会议有后果**——说不好就是说不好，NPC 会有真实反应
2. **不无限重试**——最多 1 次补救机会
3. **NPC 反应符合角色**——不同角色对弱回答的反应不同
4. **给用户逃生口**——"用参考说法"按钮

### 方案：三档响应策略

#### 场景 A：valid（有效回答）

保持现有逻辑不变。NPC 正常推进对话。

#### 场景 B：weak（较弱回答）

**NPC 照接，但反应体现"你说得不够好"**

- 后端行为：`inputType: "weak"`，正常生成 `responseDialogue`，但 NPC 对话内容要体现对弱回答的反应
- NPC 角色化反应规则（写入 prompt）：
  - **leader 型**：追问细节。如 "Can you be more specific about the timeline?"
  - **collaborator 型**：帮忙补充铺路。如 "I think what [user] means is... right?"
  - **challenger 型**：施压。如 "That's quite vague. We need concrete numbers here."
- 前端行为：正常推进，不重试。weak 的后果在复盘中体现
- 复盘标记：该节点的 `betterWay` 会着重指出表达太模糊，教用户如何具体化

#### 场景 C：invalid（无效回答，如 "I don't know"）

**第一次：NPC 给一次补救机会（角色化反应 + 用户可选操作）**

后端返回结构调整：

```json
{
  "inputType": "invalid",
  "rescueDialogue": [
    { "speaker": "NPC名字", "text": "英文反应", "textZh": "中文翻译" }
  ],
  "retryHint": "中文提示，1句话，告诉用户可以怎么补救"
}
```

NPC 角色化补救反应：
- **leader 型**：给机会。"Let's take a step back. [User], can you walk us through what you do know?"
- **collaborator 型**：主动帮腔。"Maybe I can help — [User], weren't you looking into this last week?"
- **challenger 型**：直接施压。"We can't move forward without this. What's the status?"

前端行为：
1. 显示 NPC 的补救对话（角色化反应）
2. 在输入框上方显示操作区，两个选项：
   - **[用参考说法]** 按钮：点击后自动将参考说法填入输入框并发送，视为用户发言
   - **输入框**：用户自己重新组织语言
3. 这是最后一次机会，不再有第二次重试

**第二次仍然 invalid：会议继续，但该节点"失败"**

后端返回结构：

```json
{
  "inputType": "invalid",
  "isSecondAttempt": true,
  "failDialogue": [
    { "speaker": "NPC名字", "text": "英文反应", "textZh": "中文翻译" }
  ]
}
```

NPC 反应体现"这个人搞不定"：
- **leader 型**：跳过。"Alright, let's move on. We'll circle back to this offline."
- **collaborator 型**：尴尬收场。"Maybe we can take this offline and regroup."
- **challenger 型**：不满。"This is concerning. We needed this resolved today."

前端行为：
1. 显示 NPC 的失败反应对话
2. 标记该节点为"未通过"，会议继续推进到下一段
3. 不再显示输入框

#### 前端状态管理

新增 `nodeAttemptCount` 状态（`Map<nodeIndex, number>`），记录每个节点的尝试次数。

| 尝试次数 | inputType | 前端行为 |
|---------|-----------|---------|
| 第 1 次 | valid | 正常推进 |
| 第 1 次 | weak | 正常推进（NPC 反应不同） |
| 第 1 次 | invalid | 显示 NPC 补救反应 + [用参考说法] + 输入框 |
| 第 2 次 | valid/weak | 正常推进 |
| 第 2 次 | invalid | 节点失败，NPC 收场反应，强制推进 |

#### "用参考说法"按钮规格

- 位置：输入框正上方，左对齐
- 样式：胶囊按钮，`var(--color-brand)` 描边，白底，14px 文字
- 文案：`"用参考说法"`
- 点击行为：将该节点的 reference 内容自动填入输入框并触发提交
- 仅在 invalid 第一次重试时显示

---

## 问题 4：复盘 betterWay 没有分析用户意图

### 现状分析

当前 `generate-review.js` 的 prompt 中，betterWay 的指导是：

> "基于用户的表达意图，给出一个完整的地道英文句子"

但实际效果是 AI 忽略了用户真实意图（如"我不知道"），直接给出了一个标准的理想回答（和 reference 内容雷同）。根因是 prompt 没有强制要求 AI **先显式分析用户意图，再基于该意图生成改进表达**。

### 方案

#### betterWay 生成的正确流程

```
用户原话 → 识别表达意图 → 基于该意图生成改进表达
```

而不是：

```
用户原话 → 忽略意图 → 直接给参考说法
```

#### 具体场景举例

**场景 1：用户说 "I don't know"**
- 表达意图：表达不确定/没准备好/回避问题
- betterWay 应该教的是："如何在会议中优雅地表达不确定"
- 改进说法举例：`"I don't have the exact numbers yet, but here's what I can share so far..."`
- whyBetter：`"承认不确定的同时主动给出你能给的信息，避免在会议中陷入被动"`

**场景 2：用户说 "We're working on it"**
- 表达意图：表达进展中/在处理
- betterWay 应该教的是："如何把模糊的进展说得具体"
- 改进说法举例：`"We've identified the root cause and expect to have a fix by Friday."`
- whyBetter：`"用具体的时间线和进展节点替代模糊的'在做了'，让对方感到可控"`

**场景 3：用户完全乱说（如 "hello world"）**
- 表达意图：无有效意图（可能是测试/误操作）
- betterWay 应该教的是："在这个节点，你本应表达的核心观点是什么"
- 此时可以参考 reference，但要包装为教学内容
- whyBetter：`"这个节点需要你向团队说明项目进展，核心是给出具体状态和时间线"`

#### prompt 调整方案

在 `generate-review.js` 的 betterWay 部分，**新增强制分析步骤**：

```
## betterWay 生成规则（重要）

生成每个节点的 betterWay 时，必须遵循以下步骤：

### 第一步：分析用户的表达意图
- 用户说了什么？他想表达什么意思？
- 如果用户说了 "I don't know"，意图是"表达不确定"
- 如果用户说了 "We're working on it"，意图是"表达进展中"
- 如果用户说了完全无关的内容，意图是"无有效表达"

### 第二步：基于意图生成改进表达
- 如果用户有明确意图（即使表达很弱），betterWay 必须保留该意图，只改进表达方式
  - 例：用户想说"不知道" → 教如何优雅地说"不知道"
  - 例：用户想说"在做了" → 教如何具体地说"在做了"
- 如果用户无有效意图（乱码/测试），才可以给出节点应有的标准回答

### 禁止行为
- 禁止忽略用户意图直接给出 reference 的内容
- 禁止把"用户说不知道"改写成"一个完美的项目进展汇报"
- betterWay 的 sentence 必须和 reference 内容有本质区别（除非用户原话本身就接近 reference）
```

#### betterWay 输出结构微调

新增 `intentAnalysis` 字段，让 AI 显式输出意图分析（也方便调试和质量把控）：

```json
{
  "betterWay": {
    "type": "better|alternative",
    "intentAnalysis": "用户想表达'不确定/没准备好'",
    "sentence": "I don't have the exact figures yet, but here's what I can share...",
    "sentenceZh": "我还没有确切的数据，但我可以分享一下目前了解到的...",
    "highlightPattern": "I don't have X yet, but here's what I can [verb]",
    "highlightCollocation": "here's what I can share",
    "collocationExplain": {
      "I don't have X yet": "委婉承认信息不足",
      "here's what I can share": "主动提供能给的信息，化被动为主动"
    },
    "whyBetter": "承认不确定的同时主动给出你能给的信息，避免在会议中陷入被动"
  }
}
```

`intentAnalysis` 字段：
- 前端暂不展示（纯后端调试用），但保留字段以便未来在复盘 UI 中展示"你想说的是..."
- 强制 AI 先思考再输出，避免跳过意图分析直接给标准答案

---

## 优先级排序（MoSCoW）

| 优先级 | 问题 | 理由 |
|--------|------|------|
| **Must** | 问题 3：invalid 处理策略 | 直接影响核心体验，当前处理方式让用户觉得产品"傻" |
| **Must** | 问题 4：betterWay 意图分析 | 复盘是产品核心价值，当前输出质量不达标 |
| **Should** | 问题 1：语音加载状态 | 体验问题但不影响功能，用户可用文字输入绕过 |
| **Should** | 问题 2：角色卡改版 | 体验优化，不影响核心流程 |

## 下一步建议

1. 问题 3 和问题 4 涉及后端 prompt 调整 + 前端交互变更，建议先交给**架构师**评审方案的数据流设计（新增字段、状态管理），再交给**程序员**实施
2. 问题 1 和问题 2 纯前端改动，可直接交给**程序员**实施
3. 问题 3 的"用参考说法"按钮需要前端能获取到当前节点的 reference 内容，需确认数据是否已在前端可用
