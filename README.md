# MeetingHero

MeetingHero 现在的正式交付形态是 React Native App + 独立 API 服务。

用户在 iPhone、Android 和 tablets 上进入剧情化英文群聊，完成 `Feed -> Chat -> Settlement -> Expressions / Profile` 的完整练习链路。Web 前端不再作为正式发布面维护，仓库里的旧 `client/` 目录只保留作历史参考。

## 技术栈

- Mobile: Expo Managed + React Native + Expo Router + TypeScript
- API: Node.js + Express + SQLite (`better-sqlite3`)
- AI: Azure OpenAI
- Voice: ElevenLabs / Azure TTS + Azure Whisper STT
- Release: EAS Build + Docker + Nginx(API-only)

## 本地开发

```bash
cd meeting-simulator
npm run install:all
npm run dev
```

默认会同时启动：

- API: `http://localhost:3001`
- Expo Metro: `http://localhost:8081`

真机调试时，在 `meeting-simulator/mobile/.env` 或 shell 环境里提供：

```bash
EXPO_PUBLIC_API_BASE_URL=https://your-api-host
```

后端支持的关键环境变量：

- `AZURE_OPENAI_ENDPOINT`
- `AZURE_OPENAI_API_KEY`
- `AZURE_SPEECH_KEY`
- `AZURE_SPEECH_REGION`
- `AZURE_WHISPER_API_KEY`
- `AZURE_WHISPER_ENDPOINT`
- `AZURE_WHISPER_DEPLOYMENT`
- `AZURE_WHISPER_API_VERSION`
- `ELEVENLABS_API_KEY`
- `CORS_ALLOWED_ORIGINS`

## 测试

```bash
cd meeting-simulator
npm test
```

当前已覆盖：

- Server: `join -> respond -> complete -> settlement` 主链路，STT 多 mime/扩展名，未配置与超时分支
- Mobile: onboarding、feed、chat 基础态、settlement、expressions、profile、状态持久化

## 发布

移动端构建：

```bash
cd meeting-simulator/mobile
npm run doctor
eas build --platform ios --profile production
eas build --platform android --profile production
```

服务端部署：

- Docker 镜像只构建 API，不再打包 Web 静态文件
- Nginx 只负责反向代理和 TLS
- 生产 API 必须使用 HTTPS，且能被真机访问

## 文档

- 项目 README: [meeting-simulator/README.md](/Users/nathanshan/Desktop/meetinghero/meeting-simulator/README.md)
- 文档索引: [meeting-simulator/docs/README.md](/Users/nathanshan/Desktop/meetinghero/meeting-simulator/docs/README.md)
- 项目结构: [meeting-simulator/docs/reference/project-structure.md](/Users/nathanshan/Desktop/meetinghero/meeting-simulator/docs/reference/project-structure.md)
