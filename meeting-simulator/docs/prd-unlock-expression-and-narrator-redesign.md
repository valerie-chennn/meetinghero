# PRD: "解锁新表达"差异化 + Narrator 重新定义为"原主记忆"

> 产品经理输出 | 2026-03-31

---

## 问题 1：复盘"解锁新表达"差异太小

### 问题诊断

当前 `betterWay` 在 type="alternative" 时，AI 生成的"新表达"只是对用户原话做微调（同义词替换、缩写），没有真正的句式差异。

**根因**：prompt 中虽然写了"sentence 必须和用户原话完全不同（不同句式、不同词汇），不是微调"，但缺少**具体的差异化策略指导**和**反面示例**，AI 容易退化为润色。

### 核心原则

> alternative 不是润色，是"换一个角度说同一件事"。用户看到后的反应应该是"哦原来还能这样说"，而不是"这不就是我说的吗"。

### 差异化策略（供 prompt 使用）

当 type="alternative" 时，必须采用以下至少一种策略：

| 策略 | 说明 |
|------|------|
| 换句式结构 | 主动句换被动句、陈述句换反问句、平铺换倒装 |
| 换切入角度 | 从结果切入换成从原因切入，从自己视角换成团队视角 |
| 换沟通策略 | 直接陈述换成先铺垫再给结论，或用数据开头代替观点开头 |
| 换表达层次 | 从汇报事实升级到给出判断/建议，或从抽象概括换成具体举例 |

### 示例对照（3 组）

**示例 1：汇报进度**

- 用户说：*"We are on Sprint 6, and the test result is positive."*
- 当前 AI 给的（差）：*"We're now in Sprint 6, and the test results look encouraging."* -- 只是缩写+同义词
- 应该给的（好）：*"Testing is looking solid -- we've cleared Sprint 6 with no blockers so far."* -- 换了切入角度（从测试结果切入而非 sprint 编号），换了句式（先给结论再补充细节）

**示例 2：回应质疑**

- 用户说：*"I think the timeline is okay. We can finish it on time."*
- 差的 alternative：*"I believe the timeline is reasonable. We should be able to deliver on schedule."* -- 只是 think->believe, okay->reasonable
- 好的 alternative：*"Let me walk you through the milestones -- here's why I'm confident we'll land on time."* -- 换策略（从断言换成邀请对方看证据），换句式（祈使句开头）

**示例 3：推进决策**

- 用户说：*"I suggest we go with option A. It's faster and cheaper."*
- 差的 alternative：*"I'd recommend we choose option A since it's more efficient and cost-effective."* -- suggest->recommend, faster->efficient
- 好的 alternative：*"If speed and budget are our top priorities, option A checks both boxes."* -- 换结构（条件句开头），换角度（从"我建议"换成"如果团队目标是..."，更有说服力）

### Prompt 修改方案

在 `generate-review.js` 的 `betterWay` 生成规则中，**第三步**之后新增约束。

**新增内容（加在现有 "如果 type 是 alternative" 规则之后）**：

```
## alternative 类型的强制差异化规则

当 type = "alternative" 时，你的 sentence 必须通过以下检验：
1. 【句式检验】sentence 的主语、句型结构必须和用户原话不同（不能只是 I think → I believe）
2. 【词汇检验】sentence 中至少 60% 的实义词必须和用户原话不同
3. 【策略检验】sentence 必须采用和用户不同的沟通策略（至少一种）：
   - 换切入角度：从结果→原因，从自己→团队，从事实→判断
   - 换句式结构：陈述→反问/条件句/倒装/祈使
   - 换沟通节奏：先结论后细节 ↔ 先铺垫后结论
   - 换抽象层次：概括→举例，或举例→概括

反面示例（禁止）：
- 用户："We are on Sprint 6, the test result is positive."
- 错误 alternative："We're now in Sprint 6, and the results look encouraging." ← 只是同义词替换，不算 alternative

正面示例（要求）：
- 用户："We are on Sprint 6, the test result is positive."
- 正确 alternative："Testing is looking solid -- we've cleared Sprint 6 with no blockers so far." ← 换了切入角度+句式
```

**同时修改 `whyBetter` 字段要求**：当 type="alternative" 时，whyBetter 必须说明"换了什么角度/策略"，而不是"用词更地道"。

---

## 问题 2：Narrator 重新定义为"原主记忆"

### 新定位

**narrator = 原主的记忆碎片**

用户是"穿越者"，对会议室里的人和事一无所知。narrator 提供的是"前世的记忆"——那些只有在这个公司待过才知道的内幕信息。每条 narrator 必须包含一个**具体的、不可能从当前对话推断出的信息**。

### 与旧方案的区别

| 维度 | 旧方案（内心独白） | 新方案（原主记忆） |
|------|-------------------|-------------------|
| 内容 | 评论当前 NPC 的性格/潜台词 | 提供历史事件、人际关系、权力结构等背景 |
| 信息量 | 低（"Mia 向来不给面子"是判断，不是信息） | 高（"上次 Mia 在季度会上直接叫停了项目"是事实） |
| 对用户的帮助 | 情绪层面（"小心这个人"） | 决策层面（"知道这个信息后，我该怎么回应"） |
| 语气 | 第一人称内心独白 | 第三人称记忆闪回，像突然想起来的画面 |

### Narrator 人设描述（给后端 prompt 用）

```
## Narrator（原主记忆）

narrator 是用户脑海中闪过的记忆碎片——来自"原主"（穿越前这个身体的主人）在公司的真实经历。

### 定位
- 用户是穿越者，对这些同事的过往一无所知
- narrator 提供的是：只有在这个公司待过才知道的具体信息
- 每条 narrator 必须让用户获得一个对接下来发言有帮助的情报

### 内容方向（不限定类型，但必须有具体信息量）
- 角色历史行为："上次 Mia 在季度会上直接拍桌子叫停了项目"
- 人际关系："Daniel 和 Sarah 私下不合，提案别同时 cue 两人"
- 项目背景："这个项目已经延期两次，老板说过不能再延"
- 权力结构："Ryan 是 CTO 空降的人，他的意见基本等于决策"
- 个人习惯："Karen 只看数据，没数字的方案她从来不买账"
- 历史承诺："你上个月答应过 Q2 前交付，现在团队都记着呢"

### 硬性约束
- 每条 ≤25 个中文字符
- 必须包含具体的人名（NPC 角色名）
- 必须和当前上下文相关（紧挨其上的 NPC 发言触发了这段记忆）
- 信息必须对用户接下来的发言有战术价值
- 禁止空洞的情绪判断（"小心这个人""他不好惹"）
- 禁止预判用户行为（"轮到你了""该你说了"）
- 语气：像突然闪过的画面，简洁断言式
```

### 3 条示例（对应不同会议段落）

**段落 1：开场，leader 正在介绍本周进度**

> NPC (Daniel, PM Lead): "Let's start with the sprint update. We're a bit behind on the dashboard module."

narrator: `上次 dashboard 延期，Daniel 在周会上直接点名批评了前端组`

作用：用户知道 Daniel 对 dashboard 延期很敏感，汇报时要主动给出补救计划，不能只说"在做了"。

**段落 2：第二个关键节点前，challenger 正在质疑时间线**

> NPC (Mia, QA Lead): "I'm not sure two weeks is realistic for the remaining test coverage."

narrator: `Mia 上季度预测过三次延期风险，每次都被证明是对的`

作用：用户知道 Mia 的质疑有历史可信度，不应该硬怼，而应该拿数据回应或部分认同。

**段落 3：临近决策，有人提出替代方案**

> NPC (Ryan, Engineering Director): "What if we descope the analytics feature for now?"

narrator: `Ryan 是 CTO 钦点来主导技术方向的，他的提议基本会被采纳`

作用：用户知道 Ryan 的话有分量，如果要反对需要非常充分的理由，或者顺水推舟借力。

### Prompt 约束条件

```
## Narrator 生成规则（必须严格遵守）

1. 每场恰好 3 条 narrator（每个会议段落 1 条）
2. 第 1 条：开场后第 1-2 条 NPC 消息之后
3. 第 2 条：第 1 个关键节点和第 2 个关键节点之间
4. 第 3 条：第 2 个关键节点之后、第 3 个关键节点之前
5. narrator 必须紧跟在一条 NPC 消息之后，且该 NPC 消息的内容触发了这段记忆
6. 格式：{"speaker":"narrator","text":"（中文，≤25字，原主的记忆）","textZh":"","isKeyNode":false}
7. text 字段为中文（因为是用户脑海中的记忆）

### 内容检验清单（每条 narrator 必须通过）
- [ ] 包含具体 NPC 名字？
- [ ] 包含具体的历史事件/关系/事实（不是泛泛判断）？
- [ ] 和紧挨其上的 NPC 发言相关？
- [ ] 对用户接下来的发言有战术帮助？
- [ ] ≤25 个中文字符？
```

### 数量变更说明

narrator 从 2 条改为 3 条（每段 1 条）。这需要同步修改：
- `generate-meeting.js` 中的 narrator 数量约束（2 → 3）
- dialogue 总消息数上限可能需要微调（15-20 → 15-22，多了 1 条 narrator）
- 前端不需要改动（narrator 渲染逻辑与数量无关）

---

## 需要修改的文件清单

| 文件 | 修改内容 |
|------|---------|
| `server/prompts/generate-meeting.js` | narrator 规则重写（2→3条，内容从内心独白改为原主记忆） |
| `server/prompts/generate-review.js` | betterWay alternative 类型新增强制差异化规则 |

### 不需要修改的部分

- 前端渲染逻辑：narrator 和 betterWay 的渲染组件无需改动，数据结构不变
- 数据库 schema：无变更
- API 接口：无变更

---

## 下一步建议

1. **交给 Programmer 实施 prompt 修改** -- 两个文件的改动量不大，可以一起做
2. **实施后需要跑 2-3 场完整会议验证** -- 重点看：
   - narrator 是否真的给出了具体信息而非空洞判断
   - alternative 表达是否和用户原话有明显差异
3. **如果 AI 仍然退化为润色**，考虑在后处理阶段加一个"差异度检查"（计算用户原话和 alternative 的词汇重叠率，超过 50% 就重新生成）
