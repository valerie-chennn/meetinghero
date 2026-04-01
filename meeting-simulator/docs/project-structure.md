# MeetingHero 项目结构说明

## 目录树

```
meeting-simulator/
├── .env                          # 环境变量（Azure 密钥，不提交 Git）
├── package.json                  # 根目录脚本（同时启动前后端）
│
├── client/                       # 前端（React 18 + Vite）
│   ├── vite.config.js            # Vite 配置，含 /api 代理规则
│   └── src/
│       ├── main.jsx              # 应用入口
│       ├── App.jsx               # 路由表（所有页面在此注册）
│       ├── App.css               # 全局样式变量和基础样式
│       ├── api/
│       │   └── index.js          # 所有 API 调用封装（唯一前后端通信层）
│       ├── context/
│       │   ├── AppContext.jsx    # 全局状态管理（sessionId/meetingData 等）
│       │   └── ToastContext.jsx  # 全局 Toast 提示
│       ├── pages/                # 页面组件（每个页面 .jsx + .module.css）
│       │   ├── Home.jsx          # 首页：模式入口
│       │   ├── Onboarding.jsx    # 花名 + 英语等级（2 步）
│       │   ├── WorkInfoStep.jsx  # 补充职位 + 行业（正经开会专属）
│       │   ├── SourceSelect.jsx  # 会议来源选择（生成 / 上传）
│       │   ├── BrainstormEntry.jsx   # 脑洞模式入口：点将局 / 乱炖局
│       │   ├── CharacterSearch.jsx   # 点将局：搜索角色
│       │   ├── CharacterSelect.jsx   # 点将局：确认角色选择
│       │   ├── RandomDraw.jsx        # 乱炖局：随机抽签
│       │   ├── ThemePreview.jsx      # 主题预览（含换主题）
│       │   ├── Loading.jsx       # 加载页：会议生成中
│       │   ├── PreMeeting.jsx    # 会前 Briefing
│       │   ├── Meeting.jsx       # 会中聊天流（核心页面）
│       │   ├── Review.jsx        # 会后总结：称号 + 角色私信
│       │   ├── ReviewNodes.jsx   # 复盘学习：逐节点练习
│       │   ├── Complete.jsx      # 完成页：难度反馈 + 再来一场
│       │   └── History.jsx       # 历史记录列表
│       └── components/           # 可复用 UI 组件
│           ├── BriefingCard.jsx  # 会前 Briefing 卡片
│           ├── ChatBubble.jsx    # 对话气泡
│           ├── Reference.jsx     # 参考说法展示
│           ├── ReviewCard.jsx    # 复盘卡片
│           ├── TtsButton.jsx     # 文字转语音按钮
│           ├── UserInput.jsx     # 用户输入框
│           └── VoiceRecorder.jsx # 语音录入组件
│
├── server/                       # 后端（Node.js + Express）
│   ├── index.js                  # 服务入口：中间件 + 路由挂载 + 错误处理
│   ├── db.js                     # 数据库初始化：建表 + 迁移
│   ├── data/
│   │   ├── meeting-simulator.db  # SQLite 数据库文件
│   │   └── character-pool.js    # 脑洞模式角色静态数据（7 个世界约 60 个角色）
│   ├── routes/                   # 路由处理层
│   │   ├── onboarding.js        # /api/onboarding
│   │   ├── meeting.js           # /api/meeting
│   │   ├── brainstorm.js        # /api/brainstorm
│   │   ├── review.js            # /api/review
│   │   ├── history.js           # /api/history
│   │   ├── speech.js            # /api/speech（TTS/STT）
│   │   └── upload.js            # /api/upload
│   ├── services/                 # 外部服务封装层
│   │   ├── openai.js            # Azure OpenAI 调用
│   │   └── speech.js            # Azure Speech TTS + Whisper STT
│   └── prompts/                  # AI Prompt 模板
│       ├── generate-meeting.js  # 正经开会会议生成
│       ├── generate-brainstorm.js # 脑洞模式会议生成 + 主题预览
│       ├── respond-meeting.js   # 用户发言响应
│       └── generate-review.js  # 复盘生成 + 练习反馈
│
├── design-system/
│   └── meetinghero/MASTER.md    # 设计规范主文档
└── docs/                         # 产品和技术文档
```

## 分层职责

### 前端

| 层级 | 路径 | 职责 | 规则 |
|------|------|------|------|
| 路由层 | `App.jsx` | 注册所有页面路由 | 新增页面必须在此注册 |
| 全局状态 | `context/AppContext.jsx` | 跨页面共享数据 | 只放跨页面状态，页面内部用 `useState` |
| 全局通知 | `context/ToastContext.jsx` | Toast 提示 | 用 `useToast()` 调用 |
| API 层 | `api/index.js` | 所有后端接口调用 | 页面不直接用 `fetch`，统一走这里 |
| 页面层 | `pages/` | 每个路由对应一个页面 | 每个页面 `.jsx` + `.module.css` 一对一 |
| 组件层 | `components/` | 多页面复用的 UI 片段 | 只放纯 UI 逻辑，不直接调 API |

### 后端

| 层级 | 路径 | 职责 | 规则 |
|------|------|------|------|
| 入口 | `index.js` | Express 初始化、路由挂载 | 不写业务逻辑 |
| 数据库 | `db.js` | 建表、迁移、导出 db 实例 | 所有路由共用同一连接 |
| 路由层 | `routes/` | 请求处理、参数校验、写库 | 一个功能域一个文件 |
| 服务层 | `services/` | 封装外部 API | 路由通过 require 调用 |
| Prompt 层 | `prompts/` | 构造 AI prompt | 每个文件导出 `xxxPrompt({...})` 函数 |
| 静态数据 | `data/` | 预设数据（角色池等） | 纯 JS 对象，无网络依赖 |

## 前端页面流转

### 正经开会
```
/ → /onboarding → /work-info → /source → /loading → /pre-meeting → /meeting → /review → /review/nodes → /complete
```

### 脑洞模式
```
/ → /onboarding → /brainstorm → [点将局] /brainstorm/search → /brainstorm/characters → /brainstorm/theme
                               [乱炖局] /brainstorm/random → /brainstorm/theme
                               → /loading → /pre-meeting → /meeting → /review → /review/nodes → /complete
```

## 后端路由总览

| 方法 | 路径 | 说明 | AI 调用 |
|------|------|------|---------|
| POST | /api/onboarding | 创建 session | 否 |
| POST | /api/onboarding/update-work-info | 补填职位行业 | 否 |
| POST | /api/brainstorm/search-characters | 搜索角色 | 预设优先，冷门走 AI |
| GET | /api/brainstorm/random-characters | 随机抽角色 | 否 |
| POST | /api/brainstorm/generate-theme | 生成主题预览 | 是（轻量，700 tokens） |
| POST | /api/meeting/generate | 生成完整会议 | 是（重量，4500 tokens） |
| POST | /api/meeting/respond | 关键节点响应 | 是 |
| POST | /api/meeting/complete | 标记会议完成 | 否 |
| POST | /api/review/generate | 生成复盘报告 | 是 |
| POST | /api/review/practice | 练习反馈 | 是 |
| GET | /api/history/:sessionId | 历史记录列表 | 否 |
| POST | /api/speech/tts | 文字转语音 | Azure TTS |
| POST | /api/speech/stt | 语音转文字 | Azure Whisper |
| POST | /api/upload/parse | 上传文件解析 | 否 |

## 数据库表结构

| 表 | 主键 | 核心字段 | 说明 |
|----|------|---------|------|
| sessions | id (UUID) | english_level, job_title, industry, user_name | 用户基础信息 |
| meetings | id (UUID) | session_id, dialogue (JSON), key_nodes (JSON), scene_type, status | 一场完整会议 |
| conversations | id (自增) | meeting_id, node_index, user_input, system_english | 用户每个节点的发言 |
| reviews | id (UUID) | meeting_id, achievement, nodes (JSON) | 复盘报告 |

## 关键注意事项

- **sceneType** 是区分正经开会/脑洞模式的唯一开关：`'formal'` / `'brainstorm-pick'` / `'brainstorm-random'`
- **AppContext** 只持久化 5 个字段到 localStorage，脑洞模式数据刷新即失
- **数据库迁移**：新增字段用 `ALTER TABLE ADD COLUMN`（失败静默），修改字段需要写迁移函数
- **AI 轻量调用**控制 `maxTokens` 在 500-800，参考 generate-theme 接口
