# MeetingHero 推流版 — 项目结构说明

> 推流版（v2）：英语群聊模拟器。用户在手机壳 UI 中参与预制+AI实时的英文群聊，帮助练习职场英语。
> 旧版（双门版）已封存在 git tag `v0.1-dual-mode`，本文档仅描述推流版现状。

---

## 一、目录树

```
meeting-simulator/
├── package.json                  # 根级脚本（concurrently 同时起前后端）
├── docker-compose.yml            # 生产部署：app（Node）+ nginx 两个服务
├── Dockerfile                    # Node.js 后端镜像
├── Dockerfile.nginx              # Nginx 反代 + 前端静态文件镜像
├── .env                          # 环境变量（不入库）
│
├── client/                       # 前端（React 18 + Vite）
│   ├── index.html
│   ├── vite.config.js            # 代理 /api → localhost:3001
│   ├── src/
│   │   ├── main.jsx              # React 入口，挂载 App
│   │   ├── App.jsx               # 路由、音频解锁、AppShell（手机壳容器）
│   │   ├── api/
│   │   │   └── index.js          # 所有后端 API 封装（v2 接口 + TTS/STT）
│   │   ├── context/
│   │   │   ├── AppContext.jsx    # 全局状态（userId/userName/completedRoomIds 持久化）
│   │   │   └── ToastContext.jsx  # 全局 Toast 提示
│   │   ├── hooks/
│   │   │   └── useVoiceRecorder.js  # 语音录音（MediaRecorder + Web Speech fallback）
│   │   ├── pages/
│   │   │   ├── SplashPage.jsx       # 开屏动画
│   │   │   ├── OnboardingPage.jsx   # 首次进入，输入花名
│   │   │   ├── FeedPage.jsx         # 首页，竖向滚动 Feed 卡片列表
│   │   │   ├── ChatPage.jsx         # 群聊主页面（核心，脚本播放状态机）
│   │   │   ├── SettlementPage.jsx   # 结算页（表达卡片 + AI 动态新闻）
│   │   │   ├── ExpressionsPage.jsx  # 表达本（已收藏的卡片列表）
│   │   │   └── ProfilePage.jsx      # 我的（用户统计数据）
│   │   └── components/
│   │       ├── TabNavigator.jsx     # 底部 Tab 栏（Feed / 表达本 / 我的）
│   │       ├── DmBanner.jsx         # NPC 私信浮层（3秒自动消失）
│   │       ├── UserInput.jsx        # 用户输入区（文字/语音切换，未在 ChatPage 使用）
│   │       └── VoiceRecorder.jsx    # 语音录音按钮 UI
│
└── server/                       # 后端（Node.js + Express + SQLite）
    ├── index.js                  # Express 入口，路由挂载，错误处理
    ├── db.js                     # SQLite 初始化（better-sqlite3），表结构，schema 迁移
    ├── routes/
    │   ├── speech.js             # TTS（ElevenLabs/Azure）和 STT（Whisper）
    │   ├── v2-users.js           # 用户初始化、统计数据
    │   ├── v2-feed.js            # Feed 列表、房间详情
    │   ├── v2-chat.js            # 群聊核心：join/respond/complete/settlement/hint
    │   └── v2-expressions.js    # 表达卡片：查询/收藏/取消收藏/标记练习
    ├── prompts/
    │   ├── respond-chat.js       # NPC 实时回复 prompt
    │   ├── better-version.js     # 更好说法 prompt（4步推理）
    │   ├── generate-hint.js      # 💡参考说法 prompt
    │   └── generate-settlement.js # 结算新闻 prompt（headline + epilogue + 称号）
    ├── services/
    │   └── openai.js             # Azure OpenAI 调用封装（callOpenAIJson）
    └── data/
        ├── seed-rooms.js         # 种子数据：5 个预制群聊房间
        └── meeting-simulator.db  # SQLite 数据库文件（运行时生成，不入库）
```

---

## 二、前端架构

### 路由表

从 `client/src/App.jsx` 提取：

| 路径 | 组件 | 说明 |
|------|------|------|
| `/` | `RootRedirect` | 有 userName → `/feed`，否则 → `/onboarding` |
| `/onboarding` | `OnboardingPage` | 首次进入，输入花名 |
| `/feed` | `FeedPage` | 首页 Feed 列表 |
| `/chat/:roomId` | `ChatPage` | 群聊页 |
| `/settlement/:sessionId` | `SettlementPage` | 结算页 |
| `/expressions` | `ExpressionsPage` | 表达本 |
| `/profile` | `ProfilePage` | 我的 |
| `/reset` | `ResetPage` | 清除所有数据并跳回首页 |
| `*` | 重定向 | → `/feed` |

Tab 栏在 `/chat/`、`/settlement/`、`/onboarding`、`/` 路径下隐藏。

### 页面流转

```
SplashPage（开屏覆盖层）
    ↓ 自动完成
RootRedirect
    ├─ 无 userName → OnboardingPage（填花名）
    │       ↓ 提交
    └─ 有 userName → FeedPage（首页）
                ↓ 点击卡片
            ChatPage（群聊）
                ↓ 脚本播完 + 完成发言
            SettlementPage（结算）
                ↓ 点"继续"
            FeedPage（首页）

Tab 栏：FeedPage ↔ ExpressionsPage ↔ ProfilePage 三者互切
```

### 全局状态（AppContext）

文件：`client/src/context/AppContext.jsx`

**持久化字段**（存 localStorage，刷新保留）：

| 字段 | 类型 | 说明 |
|------|------|------|
| `userId` | string | 设备级 UUID，首次访问自动生成 |
| `userName` | string | 用户花名，Onboarding 填写后保存 |
| `completedRoomIds` | string[] | 已完成的 roomId 列表，过滤 Feed 已做过的卡片 |

localStorage key 格式：`app_<字段名>`，如 `app_userId`。

**会话级字段**（不持久化，刷新清空）：

| 字段 | 说明 |
|------|------|
| `currentRoomId` | 当前进入的房间 ID |
| `currentChatSessionId` | 当前群聊会话 ID |
| `chatDialogueScript` | join 返回的完整对话脚本数组 |
| `chatProgress` | 脚本播放光标（当前播到第几条） |
| `userTurnCount` | 用户已发言次数 |
| `settlementData` | 结算数据 |
| `feedScrollIndex` | Feed 当前滚动位置（用于恢复） |
| `cardsSinceLastChat` | 回到 Feed 后划过的卡片数（触发私信 Banner 用） |
| `dmBannerShown` | 本 session 已显示的私信 Banner 数（最多 2 条） |

**暴露的方法**：`updateState(updates)`、`resetState()`（保留用户信息）、`clearAll()`（完全重置）。

### API 层

文件：`client/src/api/index.js`，通过 Vite 代理转发到 `localhost:3001`。

| 函数 | HTTP | 后端路径 | 说明 |
|------|------|----------|------|
| `initUser(userId, nickname)` | POST | `/api/v2/users/init` | 初始化或更新用户花名 |
| `getFeedList(page, pageSize)` | GET | `/api/v2/feed` | 获取 Feed 分页列表 |
| `joinChat(userId, roomId)` | POST | `/api/v2/chat/join` | 加入群聊，返回完整脚本 |
| `respondChat(chatSessionId, turnIndex, userInput)` | POST | `/api/v2/chat/respond` | 用户发言，AI 返回 NPC 回复 + 更好说法 |
| `completeChat(chatSessionId, force)` | POST | `/api/v2/chat/complete` | 完成群聊，触发结算生成 |
| `getSettlement(chatSessionId)` | GET | `/api/v2/chat/:id/settlement` | 拉取结算数据 |
| `generateHint(chatSessionId)` | POST | `/api/v2/chat/:id/generate-hint` | 动态生成💡参考说法 |
| `getExpressions(userId)` | GET | `/api/v2/expressions` | 拉取已收藏卡片列表 |
| `saveExpression(id, userId)` | POST | `/api/v2/expressions/:id/save` | 收藏卡片 |
| `deleteExpression(id, userId)` | DELETE | `/api/v2/expressions/:id` | 取消收藏 |
| `practiceExpression(id, userId)` | POST | `/api/v2/expressions/:id/practice` | 标记已练习 |
| `getUserStats(userId)` | GET | `/api/v2/users/:userId/stats` | 用户统计数据 |
| `textToSpeech(text, language, voiceId)` | POST | `/api/speech/tts` | TTS，返回音频 Blob |
| `speechToText(audioBlob)` | POST | `/api/speech/stt` | STT，返回文字 |

### 页面职责表

| 页面 | 职责 |
|------|------|
| `SplashPage` | 开屏动画覆盖层，动画结束后通知父组件（`onDone`），由 `AppShell` 管理显示/隐藏 |
| `OnboardingPage` | 首次进入填花名（随机生成 + 可自定义），调用 `initUser`，完成后跳 Feed |
| `FeedPage` | 竖向全屏滑动的新闻卡片列表，点击卡片进入 ChatPage；每隔若干张卡片展示 NPC 私信 Banner |
| `ChatPage` | 群聊核心页面，脚本播放状态机驱动，支持 TTS 播报、打字机效果、语音/文字发言 |
| `SettlementPage` | 展示结算新闻（AI 动态生成的 headline + epilogue + 称号）和表达卡片 |
| `ExpressionsPage` | 表达本，展示用户历史会话中被自动收藏的全部表达卡片，支持取消收藏 |
| `ProfilePage` | 我的，展示用户花名和统计数据（完成群聊数、总发言次数、收藏数） |

### 组件职责表

| 组件 | 职责 |
|------|------|
| `TabNavigator` | 底部 Tab 栏（Feed / 表达本 / 我的），在聊天/结算/onboarding 页自动隐藏 |
| `DmBanner` | NPC 私信浮层，固定顶部，3 秒后自动关闭，也可手动关闭 |
| `UserInput` | 通用用户输入区（文字输入 + 语音录音切换），当前 ChatPage 未使用此组件，直接内联实现 |
| `VoiceRecorder` | 语音录音按钮 UI，与 `useVoiceRecorder` 配合 |

### Hooks

| Hook | 文件 | 说明 |
|------|------|------|
| `useVoiceRecorder` | `hooks/useVoiceRecorder.js` | MediaRecorder 录音 + Web Speech API 静默识别（Whisper 失败时作 fallback），返回 `isRecording`、`duration`、`toggleRecording` 等 |
| `useAudioUnlock` | `App.jsx` 内联 | 监听用户首次点击/触摸，创建全局解锁 Audio 单例 `window.__unlockedAudio`，解除 iOS Safari autoplay 限制 |
| `useApp` | `context/AppContext.jsx` | 读取和更新全局状态的快捷 Hook |

---

## 三、后端架构

### 路由挂载

文件：`server/index.js`

| 挂载前缀 | 路由文件 |
|----------|----------|
| `/api/speech` | `routes/speech.js` |
| `/api/v2/users` | `routes/v2-users.js` |
| `/api/v2/feed` | `routes/v2-feed.js` |
| `/api/v2/chat` | `routes/v2-chat.js` |
| `/api/v2/expressions` | `routes/v2-expressions.js` |

### API 路由总览

| 方法 | 路径 | 说明 | 调 AI |
|------|------|------|-------|
| POST | `/api/v2/users/init` | 创建或更新用户（幂等） | 否 |
| GET | `/api/v2/users/:userId/stats` | 用户统计（完成数/发言数/收藏数） | 否 |
| GET | `/api/v2/feed` | Feed 分页列表 | 否 |
| GET | `/api/v2/feed/:roomId` | 单条房间详情 | 否 |
| POST | `/api/v2/chat/join` | 加入群聊，创建会话，返回脚本 | 否 |
| POST | `/api/v2/chat/respond` | 用户发言，并行生成 NPC 回复 + 更好说法 | 是（两个并行） |
| POST | `/api/v2/chat/complete` | 完成群聊，AI 生成结算新闻，标记表达卡片 | 是 |
| GET | `/api/v2/chat/:chatSessionId/settlement` | 拉取结算数据 | 否 |
| POST | `/api/v2/chat/:chatSessionId/generate-hint` | 动态生成💡参考说法 | 是 |
| GET | `/api/v2/chat/:chatSessionId/dm-banner` | 获取 NPC 私信 Banner 文案（硬编码随机） | 否 |
| GET | `/api/v2/expressions` | 查询用户已收藏卡片 | 否 |
| POST | `/api/v2/expressions/:id/save` | 收藏卡片 | 否 |
| DELETE | `/api/v2/expressions/:id` | 取消收藏 | 否 |
| POST | `/api/v2/expressions/:id/practice` | 标记已练习 | 否 |
| POST | `/api/speech/tts` | 文字转语音（ElevenLabs 优先，Azure 备用） | 否 |
| POST | `/api/speech/stt` | 语音转文字（Azure Whisper） | 否 |
| GET | `/health` | 健康检查（返回 AI 配置状态） | 否 |

### Prompt 层

| 文件 | 用途 | 调用时机 |
|------|------|----------|
| `prompts/respond-chat.js` | 让 NPC 以自身性格自然回应用户发言（A2 难度，隐性纠错） | `POST /respond` 中，与 better-version 并行调用 |
| `prompts/better-version.js` | 4步推理生成更好说法（意图分析→betterVersion→feedbackType→learningType+字段） | `POST /respond` 中，与 respond-chat 并行调用 |
| `prompts/generate-hint.js` | 读 NPC 最后一条 @用户的消息，生成一句 A2 级别的参考回应 | 用户进入 mic 阶段时后台预加载，点💡时展示 |
| `prompts/generate-settlement.js` | 根据用户实际发言立场生成荒诞结算新闻（headline + epilogue 数组 + 称号） | `POST /complete` 时调用 |

### 数据库表结构

文件：`server/db.js`，使用 better-sqlite3，数据库路径 `server/data/meeting-simulator.db`。

**v2 推流版核心表（v2_ 开头）：**

**v2_users** — 用户表

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | TEXT PK | 设备级 UUID，前端生成 |
| `nickname` | TEXT | 用户花名 |
| `created_at` | DATETIME | 创建时间 |

**v2_rooms** — 群聊房间表

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | TEXT PK | 房间 ID（如 `room-001`） |
| `news_title` | TEXT | 新闻标题（中文，含报纸来源前缀） |
| `news_title_en` | TEXT | 新闻标题英文翻译 |
| `npc_a_name` | TEXT | NPC A 名字 |
| `npc_a_reaction` | TEXT | NPC A 的中文短评（Feed 卡片展示） |
| `npc_a_reaction_en` | TEXT | NPC A 短评英文翻译 |
| `npc_b_name` | TEXT | NPC B 名字 |
| `npc_b_reaction` | TEXT | NPC B 的中文短评 |
| `npc_b_reaction_en` | TEXT | NPC B 短评英文翻译 |
| `group_name` | TEXT | 群名（进入群聊后展示） |
| `group_notice` | TEXT | 群公告 |
| `user_role_name` | TEXT | 用户角色中文名 |
| `user_role_name_en` | TEXT | 用户角色英文名（A2 短语） |
| `user_role_desc` | TEXT | 用户角色描述 |
| `npc_profiles` | TEXT | NPC 数组 JSON（含 id/name/gender/voiceId/persona） |
| `dialogue_script` | TEXT | 对话脚本 JSON 数组（预制脚本，含 user_cue） |
| `settlement_template` | TEXT | 结算模板 JSON（含 newsletter.publisher） |
| `tags` | TEXT | 标签数组 JSON（第一个元素为 IP 名，如"西游记"） |
| `difficulty` | TEXT | 难度（默认 `A2`） |
| `bg_color` | TEXT | Feed 卡片背景色 |
| `likes` | INTEGER | 点赞数（静态） |
| `comment_count` | INTEGER | 评论数（静态） |
| `is_active` | INTEGER | 是否上线（1=上线） |
| `sort_order` | INTEGER | 排序权重 |

**v2_feed_items** — Feed 排序表

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | TEXT PK | |
| `room_id` | TEXT UNIQUE | 关联 v2_rooms |
| `sort_order` | INTEGER | 排序（降序） |
| `is_visible` | INTEGER | 是否在 Feed 中可见 |

**v2_chat_sessions** — 群聊会话表

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | TEXT PK | 随机 UUID |
| `user_id` | TEXT | 关联 v2_users |
| `room_id` | TEXT | 关联 v2_rooms |
| `status` | TEXT | `active` / `completed` |
| `user_turn_count` | INTEGER | 用户已发言次数（上限 3） |
| `settlement_newsletter` | TEXT | AI 动态生成的结算新闻 JSON |
| `started_at` | DATETIME | 创建时间 |
| `completed_at` | DATETIME | 完成时间（用于计算对话时长） |

**v2_user_messages** — 用户发言记录表

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | INTEGER PK | 自增 |
| `chat_session_id` | TEXT | 关联 v2_chat_sessions |
| `turn_index` | INTEGER | 第几次发言（1/2/3） |
| `user_input` | TEXT | 用户原文 |
| `better_version` | TEXT | AI 生成的更好说法 |
| `npc_reply` | TEXT | NPC 回复 JSON |

**v2_expression_cards** — 表达卡片表

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | INTEGER PK | 自增 |
| `user_id` | TEXT | 关联 v2_users |
| `chat_session_id` | TEXT | 关联 v2_chat_sessions |
| `turn_index` | INTEGER | 对应第几次发言 |
| `user_said` | TEXT | 用户原文 |
| `better_version` | TEXT | 更好说法 |
| `feedback_type` | TEXT | `更地道的说法` / `进阶表达` / `同样好用的说法` |
| `highlighted_phrases` | TEXT | 高亮短语 JSON 数组 |
| `learning_type` | TEXT | `pattern` / `collocations` |
| `pattern` | TEXT | 句型骨架（learningType=pattern 时） |
| `collocations_json` | TEXT | 搭配词组 JSON 数组（learningType=collocations 时） |
| `is_saved` | INTEGER | 是否已收藏（complete 时自动设为 1） |
| `is_featured` | INTEGER | 是否为本场最有价值卡片（complete 时按优先级选一张） |
| `is_practiced` | INTEGER | 是否已练习 |

**注意**：db.js 中仍保留旧版双门版表（`sessions`、`meetings`、`conversations`、`reviews`），仅做向后兼容，推流版不使用这些表。

### 种子数据结构

文件：`server/data/seed-rooms.js`，启动时通过 `INSERT OR IGNORE` 写入，重启幂等。

每个种子房间的 `dialogue_script` 字段是 JSON 数组，元素类型：

| type | 字段 | 说明 |
|------|------|------|
| `npc` | `speaker`（npc_a/npc_b）、`text`（英文）、`textZh`（中文） | NPC 预制发言 |
| `user_cue` | `speaker`（@谁）、`hint`、`hintZh`、`options`（3个预设选项） | 提示用户发言的节点，每个选项有 `label` 和 `example` |
| `system` | `text` | 系统消息 |

`@{username}` 是占位符，前端展示和 TTS 时替换为用户花名。

---

## 四、核心流程：群聊播放引擎

文件：`client/src/pages/ChatPage.jsx`（约 700+ 行，最复杂的文件）

### phase 状态机

```
idle
 │ joinChat 完成，延迟 400ms 启动
 ↓
dots          NPC "打字中"跳动点动画（最少 800ms，同时预加载 TTS）
 ↓
typing_en     TTS 开始播放，同时 Typewriter 组件逐字染色显示英文
 ↓
typing_zh     英文打完后，中文翻译静态展示（无打字机效果）
 ↓
typing_done   中文显示完毕，等待 TTS 播完
 ↓
wait_tap      显示"点击屏幕继续"提示，等用户点击（下一条为 user_cue 时跳过此步）
 ↓
mic           用户发言阶段（语音/文字输入），等用户提交
 ↓
done          所有脚本播放完毕（或用户主动结束），显示"继续"按钮
```

`phase` 通过 `phaseWaitersRef` 实现异步等待：`startPlayback` 是一个 async 函数，内部 `await waitForPhase('typing_zh')` 等 Typewriter 的 `onDone` 回调触发再继续。

### 脚本播放流程

1. 进入 ChatPage → `joinChat(userId, roomId)` → 拿到完整 `dialogueScript` + `npcProfiles`
2. 延迟 400ms 后启动 `startPlayback`，从 index 0 开始按序播放脚本
3. 每条 `npc` 消息：dots → typing_en（TTS + 打字机）→ typing_zh → typing_done → wait_tap
4. 遇到 `user_cue`：进入 `mic` 阶段，后台异步预加载💡参考说法
5. 用户发言（语音或文字）→ `respondChat` → 返回 `npcReply` + `betterVersion`
6. NPC 回复作为动态消息追加到聊天列表（同样走打字机流程）
7. 三次发言后，显示"结束对话"按钮 → `completeChat` → 跳转 SettlementPage

**用户发言防重复**：`isSubmitting` state，提交期间禁止重复点击。

**连续 NPC 消息处理**：`consecutiveNpcRef` 计数，超过 3 条连续 NPC 消息时强制插入 wait_tap，避免用户眼花缭乱。

### TTS 播放机制

- `ttsCache`：`Map<key, Promise<Blob>>`，key = `${text}|${voiceId}`
- `prefetchTts`：提前发起 TTS 请求存入缓存，dots 阶段时调用
- `prefetchUpcoming`：每次播完当前条，预加载后续 2 条 NPC 消息的 TTS
- `playTts`：从缓存取 Blob，通过 `window.__unlockedAudio` 播放

**TTS 文本清洗**（`cleanTextForTts`）：
- 把 `@{username}` 替换为实际花名
- 去除剩余 `@` 符号（TTS 不应读出 @ 符号）
- 合并多余空格

### Typewriter 组件

内联定义在 `ChatPage.jsx`，不是独立文件。

- 将文本分词为 char token（每字一个）和 mention token（`@{username}` 整体一个）
- 根据文本长度动态计算打字速度（英文 60ms/char，总时长限 800ms-6000ms）
- 用 `interval` 逐步推进 `highlightIdx`，已染色字为深色（`charBright`），未染色为浅灰（`charDim`）
- `highlightIdx` 推到末尾时触发 `onDone`，驱动 phase 从 `typing_en` → `typing_zh`
- 仅英文走打字机效果，中文翻译在 `typing_zh` 阶段静态显示（无打字机）

---

## 五、部署

### 本地开发

```bash
# 根目录
npm run dev    # concurrently 同时起前端（Vite, :5173）和后端（Node, :3001）

# 分开启动
npm run dev:server   # 仅后端
npm run dev:client   # 仅前端
```

Vite 配置了 `/api` 代理 → `localhost:3001`，前端直接用 `/api/...` 路径。

### 环境变量（.env）

```
AZURE_OPENAI_ENDPOINT=
AZURE_OPENAI_API_KEY=
AZURE_OPENAI_DEPLOYMENT=
AZURE_SPEECH_KEY=
AZURE_SPEECH_REGION=
ELEVENLABS_API_KEY=
PORT=3001
```

### Docker 部署

```bash
docker compose up -d --build
```

两个服务：
- `app`：Node.js 后端，`PORT=3001`，挂载 `./server/data` 持久化数据库
- `nginx`：反代 + 静态文件，默认监听 80，可通过 `NGINX_PORT` 覆盖

**重要**：前端打包进 nginx 镜像，只改了前端代码必须同时 rebuild nginx 服务，否则前端仍是旧版本。

### 云端同步（腾讯云）

```bash
rsync -avz --exclude='node_modules' --exclude='.git' --exclude='*.db' \
  meeting-simulator/ ubuntu@<ip>:/path/to/meeting-simulator/
ssh ubuntu@<ip> "cd /path && docker compose up -d --build"
```

---

## 六、关键注意事项

### iOS Safari 音频限制

iOS Safari 要求每个 `Audio` 实例必须在 user gesture（点击/触摸）内执行过一次 `play()` 才能解锁。解锁后，改变这个实例的 `src` 并在任意时机 `play()` 都不会被拦截。

解决方案（`App.jsx` 中的 `useAudioUnlock`）：
1. 监听用户首次 `click` / `touchstart`
2. 在回调中 `new Audio()` 并立即 `play()` 一段静音 wav，存为 `window.__unlockedAudio`
3. `ChatPage.playTts` 复用 `window.__unlockedAudio`，不 `new Audio()`，避免新实例未解锁问题

### TTS 归一化历史教训

曾尝试多种运行时归一化方案（Web Audio API 动态 filter、mp3 响度处理等），在 iPhone Safari 均翻车：
- Web Audio API 在 iPhone 上有不可预期的卡顿/静音问题
- 运行时处理延迟叠加 TTS 延迟，用户体验差

**结论**：运行时归一化在 iPhone Safari 走不通。需要统一音量时，唯一可靠方案是**离线预处理**（在服务端或构建阶段统一响度）。

### sceneType 已废弃

旧版（双门版）有 `sceneType` 区分 `formal` / `brainstorm-pick` / `brainstorm-random` 三种模式。推流版（v2）不区分模式，相关字段在数据库表中仍有残留（`scene_type`、`brainstorm_world` 等列），但 v2 路由不使用它们。

### 旧版双门版

- 代码封存在 git tag `v0.1-dual-mode`
- `server/db.js` 中仍保留旧表 schema（`sessions`、`meetings`、`conversations`、`reviews`）做向后兼容
- 旧版页面和路由（MeetingPage、ReviewPage 等）已不存在于当前代码库
