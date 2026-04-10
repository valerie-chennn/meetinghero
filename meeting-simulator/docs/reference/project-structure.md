# MeetingHero 项目结构说明

本文档描述当前 React Native 发布版的真实代码结构，而不是旧 Web 版本的历史结构。

## 1. 当前形态

- 正式前端：`mobile/`，Expo Managed React Native
- 正式后端：`server/`，Express + SQLite
- 生产部署：API-only，Nginx 只做反向代理
- 旧 Web：`client/`，仅作历史参考，不再参与正式发布

## 2. 顶层目录

```text
meeting-simulator/
├── package.json
├── Dockerfile
├── Dockerfile.nginx
├── docker-compose.yml
├── nginx.conf
├── mobile/
├── server/
├── docs/
├── client/
└── design-system/
```

说明：

- `mobile/` 是当前唯一正式客户端
- `server/` 提供移动端所需的全部 API 与 SQLite 数据
- `client/` 可以继续作为迁移对照，但不应该再承担新需求

## 3. 根脚本

文件：`meeting-simulator/package.json`

| 命令 | 作用 |
| --- | --- |
| `npm run install:all` | 安装 `server/` 和 `mobile/` 依赖 |
| `npm run dev` | 同时启动 API 和 Expo Metro |
| `npm run dev:server` | 只启动 API |
| `npm run dev:mobile` | 只启动 Expo |
| `npm test` | 并行执行 server/mobile 测试 |

默认开发端口：

- API：`3001`
- Expo Metro：`8081`

## 4. Mobile 结构

```text
mobile/
├── app/                        # Expo Router 路由层
├── src/
│   ├── api/                    # API 请求与类型
│   ├── components/             # RN 组件
│   ├── context/                # AppState 持久化状态
│   ├── hooks/                  # 录音等 hooks
│   ├── screens/                # 页面实现
│   ├── test/                   # 测试工具
│   ├── theme/                  # 颜色、间距
│   └── utils/                  # 响应式、音频、文本工具
├── app.json
├── eas.json
├── jest.config.js
└── babel.config.js
```

### 4.1 路由

| 路径 | 文件 | 说明 |
| --- | --- | --- |
| `/` | `app/index.tsx` | 根据 `userName` 重定向 |
| `/onboarding` | `app/onboarding.tsx` | 输入花名 |
| `/chat/[roomId]` | `app/chat/[roomId].tsx` | 群聊主页面 |
| `/settlement/[sessionId]` | `app/settlement/[sessionId].tsx` | 结算页 |
| `/feed` | `app/(tabs)/feed.tsx` | Feed |
| `/expressions` | `app/(tabs)/expressions.tsx` | 表达本 |
| `/profile` | `app/(tabs)/profile.tsx` | 我的 |

### 4.2 全局状态

文件：`mobile/src/context/AppStateContext.tsx`

持久化字段：

- `userId`
- `userName`
- `completedRoomIds`

存储位置：

- AsyncStorage
- key 前缀：`app_`

会话态字段：

- `currentRoomId`
- `currentChatSessionId`
- `chatDialogueScript`
- `chatProgress`
- `userTurnCount`
- `settlementData`
- `feedScrollIndex`
- `cardsSinceLastChat`
- `dmBannerShown`

### 4.3 页面职责

| 页面 | 文件 | 职责 |
| --- | --- | --- |
| Loading | `src/screens/LoadingScreen.tsx` | 启动态占位 |
| Onboarding | `src/screens/OnboardingScreen.tsx` | 花名输入与用户初始化 |
| Feed | `src/screens/FeedScreen.tsx` | 整屏纵向新闻流 |
| Chat | `src/screens/ChatScreen.tsx` | 群聊状态机、TTS/STT、用户发言 |
| Settlement | `src/screens/SettlementScreen.tsx` | newsletter + expression cards |
| Expressions | `src/screens/ExpressionsScreen.tsx` | 历史表达卡片 |
| Profile | `src/screens/ProfileScreen.tsx` | 用户统计 |

### 4.4 语音链路

| 文件 | 作用 |
| --- | --- |
| `src/hooks/useVoiceRecorder.ts` | `expo-audio` 录音与上传 |
| `src/utils/audio.ts` | TTS 缓存与播放 |
| `src/api/client.ts` | TTS 文件缓存，API base URL |
| `src/api/index.ts` | STT / TTS 请求封装 |

### 4.5 响应式

文件：`mobile/src/utils/responsive.ts`

断点：

- `< 600`: compact
- `600 - 899`: medium
- `>= 900`: expanded

策略：

- 手机和小平板统一单列
- 大平板只增加宽度和留白，不做双栏重排

## 5. Server 结构

```text
server/
├── index.js
├── db.js
├── routes/
├── prompts/
├── services/
└── data/
```

### 5.1 API 入口

文件：`server/index.js`

职责：

- 加载 `.env`
- 初始化数据库
- 配置 CORS / JSON body parser
- 挂载 `/api/speech` 和 `/api/v2/*`
- 提供 `/health`
- 仅暴露 API，不再托管前端静态文件

### 5.2 路由

| 前缀 | 文件 | 说明 |
| --- | --- | --- |
| `/api/speech` | `routes/speech.js` | TTS / STT |
| `/api/v2/users` | `routes/v2-users.js` | 用户初始化与统计 |
| `/api/v2/feed` | `routes/v2-feed.js` | Feed 列表 |
| `/api/v2/chat` | `routes/v2-chat.js` | join/respond/complete/settlement/hint/dm |
| `/api/v2/expressions` | `routes/v2-expressions.js` | 表达卡片查询与状态更新 |

### 5.3 数据库

文件：`server/db.js`

特点：

- 使用 `better-sqlite3`
- 默认数据库：`server/data/meeting-simulator.db`
- 可通过 `DB_PATH` 重定向测试数据库
- 启动时自动执行 schema 初始化与增量迁移
- 自动 seed `v2_rooms` / `v2_feed_items`

### 5.4 语音后端

文件：

- `server/routes/speech.js`
- `server/services/speech.js`

当前支持：

- TTS 返回 `audio/mpeg`
- STT 接受 `m4a / aac / mp4 / webm`
- Whisper 上传时透传真实 mime 和扩展名

## 6. 部署结构

### 6.1 Docker

| 文件 | 作用 |
| --- | --- |
| `Dockerfile` | 只构建 API 容器 |
| `Dockerfile.nginx` | 只构建 Nginx 反向代理容器 |
| `docker-compose.yml` | `api` + `nginx` |

### 6.2 Nginx

文件：`nginx.conf`

当前行为：

- `/api/*` 代理到 `api:3001`
- `/health` 代理到 `api:3001`
- 非 API 请求返回 404 JSON

## 7. 环境变量

### 7.1 Mobile

- `EXPO_PUBLIC_API_BASE_URL`

### 7.2 Server

- `PORT`
- `CORS_ALLOWED_ORIGINS`
- `AZURE_OPENAI_*`
- `AZURE_SPEECH_*`
- `AZURE_WHISPER_*`
- `ELEVENLABS_API_KEY`

## 8. 测试入口

### 8.1 Mobile

- `mobile/src/context/AppStateContext.test.tsx`
- `mobile/src/screens/*.test.tsx`

### 8.2 Server

- `server/__tests__/v2-chat.test.js`
- `server/__tests__/speech.test.js`

## 9. 历史目录说明

`client/` 仍然保留，是为了：

- 对照旧 Web 逻辑
- 参考历史 UI 和文案
- 在迁移期查数据流

但当前正式需求如果要落地，应优先改：

- `mobile/`
- `server/`

而不是继续在 `client/` 上追加功能。
