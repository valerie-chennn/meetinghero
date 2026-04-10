# MeetingHero 文档索引

当前项目文档统一收敛在 `meeting-simulator/docs/` 下，按用途分为 5 类：

- `prd/`：产品需求、交互方案、体验问题拆解
- `tech-spec/`：技术方案、架构设计、实现约束
- `design/`：视觉和交互设计稿
- `strategy/`：产品方向、路线图、转型讨论
- `reference/`：代码协作时会频繁查阅的参考文档

## 当前主线

当前代码主线是 v2 推流版：`Feed -> Chat -> Settlement -> Expressions/Profile`。

优先参考：

- `reference/project-structure.md`
- `tech-spec/arch-feed-version.md`
- `prd/meeting-hero-review-flow-prd.md`

说明：

- 一部分文档来自旧会议版或转型讨论期，不等于“已实现”
- 设计/PRD/技术方案可能存在时间差，落地前应再对照当前代码

## PRD

| 文件 | 主题 | 状态判断 |
| --- | --- | --- |
| `prd/meeting-hero-review-flow-prd.md` | 复盘教学流程重设计 | 待落地，偏 v2 学习链路 |
| `prd/node-failure-consequence-prd.md` | 节点失败后果机制 | 偏旧会议节点模型，需评估后再落地 |
| `prd/prd-brainstorm-mode.md` | 脑洞模式 | 待开发 |
| `prd/prd-four-issues.md` | 四个体验问题方案 | 可作为体验优化输入 |
| `prd/prd-unlock-expression-and-narrator-redesign.md` | 表达差异化与 narrator 重定义 | 部分思路已影响现版本 |

## Tech Spec

| 文件 | 主题 | 状态判断 |
| --- | --- | --- |
| `tech-spec/arch-feed-version.md` | 推流版架构设计 | 与当前 v2 最相关 |
| `tech-spec/p0-tech-spec.md` | P0 技术实现方案 | 偏旧会议版 |
| `tech-spec/tech-spec-brainstorm-mode.md` | 脑洞模式技术方案 | 待评审 |

## Design

| 文件 | 主题 | 状态判断 |
| --- | --- | --- |
| `design/feed-redesign.md` | Feed 页面重设计 | 与当前 Feed 直接相关 |
| `design/design-brainstorm-mode.md` | 脑洞模式设计方案 | 待开发 |
| `design/mission-briefing-card.md` | Mission Briefing 卡片设计 | 偏旧方案资产 |
| `design/narrator-rhythm-redesign.md` | narrator 节奏调整 | 偏旧会议版 |
| `design/participant-label-redesign.md` | 参会者标签重设计 | 偏旧会议版 |

## Strategy

| 文件 | 主题 | 状态判断 |
| --- | --- | --- |
| `strategy/product-pivot-plan.md` | 产品方向重新定位 | 转型背景文档 |
| `strategy/product-directions-deep-dive.md` | 产品方向深挖 | 战略讨论文档 |
| `strategy/product-roadmap.md` | 产品路线图 | 规划性文档 |

## Reference

| 文件 | 主题 | 用途 |
| --- | --- | --- |
| `reference/project-structure.md` | 项目结构说明 | 查目录、入口、数据流 |
| `reference/dialogue-flow-spec.md` | 对话流规范 | 查旧会议版交互约束 |
