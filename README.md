# MeetingHero 推流版

英语群聊模拟器 — 用户在手机壳 UI 中参与预制+AI实时的英文群聊对话，练习职场英语。

## 技术栈

- 前端：React 18 + Vite
- 后端：Node.js + Express + SQLite (better-sqlite3)
- AI：Azure OpenAI
- 语音：ElevenLabs TTS + Azure Whisper STT
- 部署：Docker + Nginx + 腾讯云

## 本地运行

```bash
cd meeting-simulator
npm run dev          # 同时起前端 (:5173) 和后端 (:3001)
```

需要在 `meeting-simulator/.env` 配置 Azure OpenAI / Speech / ElevenLabs 密钥。

## 项目文档

- 文档总索引： [meeting-simulator/docs/README.md](meeting-simulator/docs/README.md)
- 项目结构： [meeting-simulator/docs/reference/project-structure.md](meeting-simulator/docs/reference/project-structure.md)

## 版本说明

| 版本 | 分支/标签 | 说明 |
|------|----------|------|
| 推流版 (v2) | `main` HEAD | 当前版本，Feed 流 + 群聊模式 |
| 双门版 (v1) | tag `v0.1-dual-mode` | 已封存，正经开会 + 脑洞模式 |
