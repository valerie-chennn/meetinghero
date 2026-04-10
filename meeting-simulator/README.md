# MeetingHero App

MeetingHero 是一个移动端英语群聊模拟器。当前正式产品只发布 React Native App，后端以 API-only 方式独立部署。

## 当前产品主链路

`Feed -> Chat -> Settlement -> Expressions / Profile`

- Feed: 纵向整屏新闻流
- Chat: 预制脚本 + AI NPC 回复 + 3 次用户发言
- Settlement: AI newsletter + featured expression card
- Expressions: 历史表达卡片沉淀
- Profile: 用户统计与基础设置

## 目录

```text
meeting-simulator/
├── mobile/                  # Expo React Native 应用
├── server/                  # Express + SQLite API
├── docs/                    # 项目文档
├── client/                  # 旧 Web 前端，仅作历史参考
├── Dockerfile               # API 生产镜像
├── Dockerfile.nginx         # API 反向代理镜像
└── docker-compose.yml       # API + Nginx 生产编排
```

## 环境要求

- Node.js 20+
- npm 10+
- Xcode / Android Studio / Expo Go 或 Development Build

## 安装

```bash
npm run install:all
```

等价于分别安装：

- `server/` 的运行和测试依赖
- `mobile/` 的 Expo / React Native / Jest 依赖

## 运行

根目录脚本：

```bash
npm run dev
npm run dev:server
npm run dev:mobile
npm test
```

`npm run dev` 会同时启动：

- `server`: `http://localhost:3001`
- `mobile`: Expo Metro `http://localhost:8081`

## Mobile 配置

`mobile/app.json` 当前默认配置：

- App name: `MeetingHero`
- URL scheme: `meetinghero`
- iOS bundle id: `com.meetinghero.app.dev`
- Android package: `com.meetinghero.app.dev`
- iPad / tablet 支持: 已开启
- 麦克风权限文案: 已配置

真机联调时必须把 API 指向一个手机可访问的 HTTPS 地址：

```bash
EXPO_PUBLIC_API_BASE_URL=https://api.example.com
```

如果只在同一局域网调试，也可以临时指向局域网地址，但发布前必须切回 HTTPS。

## Voice 链路

- TTS: `POST /api/speech/tts`，返回 `audio/mpeg`
- STT: `POST /api/speech/stt`
- STT 支持上传格式：
  - `audio/m4a`
  - `audio/x-m4a`
  - `audio/aac`
  - `audio/mp4`
  - `video/mp4`
  - `audio/webm`

前端使用：

- `expo-audio` 录音与播放
- `expo-file-system` 缓存 TTS 文件
- AsyncStorage 持久化 `app_userId` / `app_userName` / `app_completedRoomIds`

## API 配置

`server/.env` 里至少需要根据使用场景配置：

```bash
PORT=3001
CORS_ALLOWED_ORIGINS=http://localhost:8081

AZURE_OPENAI_ENDPOINT=
AZURE_OPENAI_API_KEY=

AZURE_SPEECH_KEY=
AZURE_SPEECH_REGION=

AZURE_WHISPER_API_KEY=
AZURE_WHISPER_ENDPOINT=
AZURE_WHISPER_DEPLOYMENT=
AZURE_WHISPER_API_VERSION=

ELEVENLABS_API_KEY=
```

说明：

- React Native 真机本身不依赖 CORS
- `CORS_ALLOWED_ORIGINS` 主要用于浏览器调试、局域网页面或其他 web 工具

## 测试与验证

自动化测试：

```bash
cd server && npm test
cd mobile && npm test -- --runInBand
cd mobile && npx tsc --noEmit
cd mobile && npm run doctor
```

当前自动化覆盖：

- Server
  - 群聊主链路
  - STT 多格式上传
  - Whisper 未配置分支
  - Whisper 超时分支
- Mobile
  - Onboarding 提交
  - Feed 过滤和跳转
  - Chat 基础态
  - Settlement 卡片入口
  - Expressions / Profile
  - AppState 持久化

建议的发布前手工 QA：

- iPhone 小屏
- iPhone 大屏
- Android 手机
- iPad 竖屏 / 横屏
- Android tablet

核心场景：

- 首次安装直到完成一轮聊天
- 关闭 App 后恢复用户信息
- 麦克风权限拒绝
- TTS 播放与 STT 上传
- 网络异常 / AI 超时
- 平板旋转后的布局稳定性
- Android 返回键与 iOS 页面返回

## 构建与发布

`mobile/eas.json` 已配置：

- `development`
- `preview`
- `production`

常用命令：

```bash
cd mobile
eas build --platform ios --profile development
eas build --platform android --profile preview
eas build --platform ios --profile production
eas build --platform android --profile production
```

服务端发布：

- `Dockerfile` 只构建 API
- `Dockerfile.nginx` 只拷贝 Nginx 配置
- `nginx.conf` 只代理 `/api` 和 `/health`
- 非 API 路径统一返回 404 JSON，不再回落到 SPA

## 参考文档

- [docs/README.md](/Users/nathanshan/Desktop/meetinghero/meeting-simulator/docs/README.md)
- [docs/reference/project-structure.md](/Users/nathanshan/Desktop/meetinghero/meeting-simulator/docs/reference/project-structure.md)
