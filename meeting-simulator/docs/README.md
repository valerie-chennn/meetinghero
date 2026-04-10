# MeetingHero 文档索引

当前仓库已经切到 React Native 正式发布形态，文档使用建议如下：

- 先看 [../README.md](/Users/nathanshan/Desktop/meetinghero/meeting-simulator/README.md)：本地开发、环境变量、EAS 发布、API 部署
- 再看 [reference/project-structure.md](/Users/nathanshan/Desktop/meetinghero/meeting-simulator/docs/reference/project-structure.md)：目录、状态、接口、部署入口

文档目录仍按 5 类维护：

- `prd/`: 产品需求、交互方案、体验问题拆解
- `tech-spec/`: 技术方案、架构设计、实现约束
- `design/`: 视觉和交互设计稿
- `strategy/`: 产品方向、路线图、转型讨论
- `reference/`: 当前代码协作最常查的事实文档

## 当前主线

当前正式版本：

- 前端：Expo React Native
- 后端：Express + SQLite API-only
- 主链路：`Feed -> Chat -> Settlement -> Expressions / Profile`

优先参考：

- `reference/project-structure.md`
- `tech-spec/arch-feed-version.md`
- `../README.md`

注意：

- `client/` 相关内容属于旧 Web 版本遗留参考，不再代表正式交付面
- 旧会议版和转型期文档依然保留，但不等于已实现现状
- 落地前始终以当前代码和 `reference/` 文档为准

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
| `reference/project-structure.md` | 项目结构说明 | 查目录、入口、状态、部署方式 |
| `reference/dialogue-flow-spec.md` | 对话流规范 | 查旧会议版交互约束 |
