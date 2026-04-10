# 架构设计：MeetingHero 推流版 Demo

版本：v1.0  
日期：2026-04-07  
状态：待确认

---

## 背景

从双门版（正经开会 + 脑洞模式）转型为抖音信息流模式（刷 Feed → 群聊 → 结算）。核心循环变了，但底层技术栈不变，部分服务层可复用。

**转型带来的根本变化：**

| 维度 | 双门版 | 推流版 |
|------|--------|--------|
| 入口 | 用户填表 → 系统生成会议 | 系统预制房间 → 用户滑动选择 |
| 内容 | 实时 AI 生成对话脚本 | 预制脚本 + 实时 NPC 响应 |
| 状态 | 一次性会议流 | 持续 Feed 消费循环 |
| 身份 | 用户自定义职位/行业 | 每个房间预设用户扮演角色 |

---

## 1. 数据库 Schema 设计

### 1.1 设计原则

- MVP 阶段保留旧表（sessions/meetings/conversations/reviews）但不再写入，平行建新表
- 新表均以 `v2_` 前缀区分，避免迁移风险，旧功能代码仍可跑通
- 房间内容完全预制（首批 20-30 个），不需要运行时生成
- 用户无需注册，设备级标识（uuid 存 localStorage）

### 1.2 表结构

```sql
-- 用户表：设备级，无注册，首次访问自动创建
CREATE TABLE v2_users (
  id         TEXT PRIMARY KEY,            -- 前端生成的 uuid，存 localStorage
  nickname   TEXT,                        -- 用户花名（onboarding 时填写）
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 房间表：预制内容，由运营/开发手动录入
-- 一个 room 对应一个新闻事件 + 完整群聊脚本
CREATE TABLE v2_rooms (
  id               TEXT PRIMARY KEY,
  news_title       TEXT NOT NULL,         -- 新闻标题（Feed 卡片第一行）
  npc_a_name       TEXT NOT NULL,         -- NPC A 名字
  npc_a_reaction   TEXT NOT NULL,         -- NPC A 对新闻的反应（Feed 卡片第二行）
  npc_b_name       TEXT NOT NULL,         -- NPC B 名字
  npc_b_reaction   TEXT NOT NULL,         -- NPC B 对新闻的反应（Feed 卡片第三行）
  group_name       TEXT NOT NULL,         -- 群名
  group_notice     TEXT,                  -- 群公告（可空）
  user_role_name   TEXT NOT NULL,         -- 用户扮演的角色名
  user_role_desc   TEXT,                  -- 用户角色描述（可空）
  npc_profiles     TEXT NOT NULL,         -- JSON: [{id, name, gender, voiceId, persona}]
  dialogue_script  TEXT NOT NULL,         -- JSON: 预制 NPC 对话脚本（见下方格式说明）
  settlement_template TEXT NOT NULL,      -- JSON: 结算大框架（事件结果 + 表达卡片模板）
  tags             TEXT,                  -- JSON: 话题标签，如 ["职场", "科技"]
  difficulty       TEXT DEFAULT 'A2',     -- 难度：A2 / B1
  is_active        INTEGER DEFAULT 1,     -- 是否上线（软删除用）
  sort_order       INTEGER DEFAULT 0,     -- Feed 排序权重（越大越靠前）
  created_at       DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Feed 展示表：控制 Feed 列表的显示状态，与 room 1:1 但分离关注点
-- 目的：未来可以支持 Feed 个性化排序而不改 rooms 表
CREATE TABLE v2_feed_items (
  id         TEXT PRIMARY KEY,
  room_id    TEXT NOT NULL UNIQUE,
  sort_order INTEGER DEFAULT 0,           -- Feed 展示顺序（冗余 rooms.sort_order，方便独立调整）
  is_visible INTEGER DEFAULT 1,
  FOREIGN KEY (room_id) REFERENCES v2_rooms(id)
);

-- 群聊会话表：用户每次进入群聊生成一条
CREATE TABLE v2_chat_sessions (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL,
  room_id         TEXT NOT NULL,
  status          TEXT DEFAULT 'active',  -- active | completed
  user_turn_count INTEGER DEFAULT 0,      -- 用户已发言次数（最多 3 次）
  npc_turn_count  INTEGER DEFAULT 0,      -- NPC 已播放轮次
  started_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at    DATETIME,
  FOREIGN KEY (user_id) REFERENCES v2_users(id),
  FOREIGN KEY (room_id) REFERENCES v2_rooms(id)
);

-- 用户消息表：记录用户在群聊中的每次发言
CREATE TABLE v2_user_messages (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_session_id  TEXT NOT NULL,
  turn_index       INTEGER NOT NULL,      -- 第几次发言（1/2/3）
  user_input       TEXT NOT NULL,         -- 用户原文
  better_version   TEXT,                  -- AI 生成的更好说法（异步填入）
  npc_reply        TEXT,                  -- NPC 对用户发言的回复（JSON）
  created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (chat_session_id) REFERENCES v2_chat_sessions(id)
);

-- 表达卡片表：结算后生成，用户可收藏
CREATE TABLE v2_expression_cards (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id          TEXT NOT NULL,
  chat_session_id  TEXT NOT NULL,
  turn_index       INTEGER NOT NULL,      -- 对应第几次发言
  user_said        TEXT NOT NULL,         -- 用户说的原文
  better_version   TEXT NOT NULL,         -- 更好的说法
  context_note     TEXT,                  -- 语境说明（可空）
  is_saved         INTEGER DEFAULT 0,     -- 是否收藏到表达本
  created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES v2_users(id),
  FOREIGN KEY (chat_session_id) REFERENCES v2_chat_sessions(id)
);

-- 索引
CREATE INDEX idx_v2_chat_sessions_user ON v2_chat_sessions(user_id);
CREATE INDEX idx_v2_chat_sessions_room ON v2_chat_sessions(room_id);
CREATE INDEX idx_v2_expression_cards_user ON v2_expression_cards(user_id, is_saved);
```

### 1.3 关键 JSON 字段格式说明

**`v2_rooms.dialogue_script`**（预制 NPC 对话脚本）：

```json
[
  { "speaker": "system", "text": "你被拉入群聊「科技早报」" },
  { "speaker": "npc_a", "text": "Did you see the news about...", "textZh": "你看到那条关于...的新闻了吗" },
  { "speaker": "npc_b", "text": "Crazy right?", "textZh": "太疯狂了吧" },
  { "speaker": "user_cue", "hint": "What do you think about this?" },
  { "speaker": "npc_a", "text": "...", "textZh": "..." }
]
```

`user_cue` 是 NPC 自然 cue 用户发言的信号节点，前端遇到此类型切换到输入模式。

**`v2_rooms.settlement_template`**（结算框架）：

```json
{
  "event_result": "经过讨论，群友们认为...",
  "expression_hints": [
    { "slot": 1, "context": "当你表达赞同时", "example": "That makes a lot of sense." },
    { "slot": 2, "context": "当你提出质疑时", "example": "Have you considered...?" },
    { "slot": 3, "context": "当你总结观点时", "example": "To sum it up..." }
  ]
}
```

---

## 2. API 接口契约

### 2.1 用户初始化

```
POST /api/v2/users/init
入参: { userId: string, nickname?: string }
      userId 由前端生成并存 localStorage，nickname 可选（首次访问时填）
出参: { userId: string, nickname: string | null, isNew: boolean }
错误: 无（幂等，重复调用更新 nickname）
```

### 2.2 Feed 相关

```
GET /api/v2/feed?page=1&pageSize=10
入参: query param: page(默认1), pageSize(默认10)
出参: {
  items: [{
    feedItemId: string,
    roomId: string,
    newsTitle: string,
    npcAName: string, npcAReaction: string,
    npcBName: string, npcBReaction: string,
    tags: string[],
    difficulty: string
  }],
  total: number,
  hasMore: boolean
}
错误: 无

GET /api/v2/feed/:roomId
入参: roomId
出参: 同上单条，加 groupName / groupNotice / userRoleName / userRoleDesc
错误: 404 房间不存在
```

### 2.3 群聊相关

```
POST /api/v2/chat/join
入参: { userId: string, roomId: string }
出参: {
  chatSessionId: string,
  groupName: string,
  groupNotice: string | null,
  userRoleName: string,
  userRoleDesc: string | null,
  npcProfiles: [{ id, name, gender, voiceId }],
  dialogueScript: [DialogueTurn],   // 完整脚本，前端按顺序播放
  totalUserTurns: 3                 // 固定值
}
错误: 400 userId/roomId 缺失 | 404 房间不存在

说明：每次 join 都创建新的 chat_session，即使同一 room 重复进入也允许
```

```
POST /api/v2/chat/respond
入参: {
  chatSessionId: string,
  turnIndex: number,       // 第几次发言（1/2/3）
  userInput: string        // 用户原文
}
出参: {
  messageId: number,
  npcReply: {              // 实时 AI 生成的 NPC 回复
    speaker: string,       // npc_a 或 npc_b
    text: string,
    textZh: string,
    voiceId: string
  },
  betterVersion: string,   // 对用户发言的隐性纠正（更好的说法），可为 null
  isLastTurn: boolean      // 是否是最后一次发言
}
错误: 400 参数缺失 | 404 会话不存在 | 409 turn_index 不合法（已超过3次）
```

```
POST /api/v2/chat/complete
入参: { chatSessionId: string }
出参: { success: true }
错误: 404 会话不存在 | 400 用户发言不足3次（强制完成时传 force: true 可绕过）

说明：将 chat_session.status 设为 completed，触发结算数据预生成
```

### 2.4 结算相关

```
GET /api/v2/chat/:chatSessionId/settlement
入参: chatSessionId（路径参数）
出参: {
  eventResult: string,           // 事件结果文本
  expressionCards: [{
    id: number,
    turnIndex: number,
    userSaid: string,
    betterVersion: string,
    contextNote: string | null,
    isSaved: boolean
  }]
}
错误: 404 会话不存在 | 400 会话未完成

说明：expressionCards 基于 v2_user_messages 生成，betterVersion 在 respond 阶段已存入，
      此处直接读库，无需实时生成
```

### 2.5 表达本相关

```
GET /api/v2/expressions?userId=xxx
入参: query param: userId
出参: {
  cards: [{
    id: number,
    userSaid: string,
    betterVersion: string,
    contextNote: string | null,
    savedAt: string
  }]
}
错误: 400 userId 缺失

POST /api/v2/expressions/:id/save
入参: { userId: string }（body）
出参: { id: number, isSaved: true }
错误: 404 卡片不存在 | 403 非本人卡片

DELETE /api/v2/expressions/:id
入参: { userId: string }（body）
出参: { id: number, isSaved: false }
错误: 404 卡片不存在 | 403 非本人卡片
```

### 2.6 NPC 私信 Banner

```
GET /api/v2/chat/:chatSessionId/dm-banner
入参: chatSessionId
出参: {
  hasBanner: boolean,
  banner: {                         // hasBanner=false 时为 null
    npcName: string,
    npcAvatar: string,
    message: string,
    messageZh: string
  } | null
}
错误: 404 会话不存在

说明：后端判断条件：chat_session.status=completed 且该 session 的 dm_banner_count < 2
      前端在用户回 Feed 后划过 2 张卡片时调用此接口
```

### 2.7 TTS/STT（直接复用现有）

```
POST /api/speech/tts   — 无变化，直接复用
POST /api/speech/stt   — 无变化，直接复用
```

---

## 3. 前端路由 + Tab 导航设计

### 3.1 路由结构

```
/                       → 重定向到 /feed（或 /onboarding 如果未初始化）
/onboarding             → 填花名（简化版，只填名字，不填职位/行业）
/feed                   → Tab1 主页：Feed 滚动列表
/chat/:roomId           → 群聊全屏页（覆盖 Tab 导航栏）
/settlement/:sessionId  → 结算全屏页（覆盖 Tab 导航栏）
/expressions            → Tab2 表达本
/profile                → Tab3 我的（空壳）
/reset                  → 清除数据（开发用）
*                       → 重定向到 /feed
```

### 3.2 Tab 导航逻辑

- Tab 导航栏始终渲染，在 `/chat` 和 `/settlement` 路由时隐藏（`display:none`）
- 三个 Tab：Feed（主页图标）/ 表达本（书本图标）/ 我的（人像图标）
- Tab 切换不重新挂载组件（使用 `display:none` 切换，保留 Feed 的滚动位置）

```
AppShell
├── TabNavigator（/chat 和 /settlement 时隐藏）
│   ├── Tab: Feed        → /feed
│   ├── Tab: 表达本      → /expressions
│   └── Tab: 我的        → /profile
└── <Routes>
    ├── /feed            → FeedPage（Tab 内容）
    ├── /chat/:roomId    → ChatPage（全屏，无 Tab）
    ├── /settlement/:id  → SettlementPage（全屏，无 Tab）
    ├── /expressions     → ExpressionsPage（Tab 内容）
    └── /profile         → ProfilePage（Tab 内容）
```

### 3.3 导航规则

- Feed → 群聊：点"加入"按钮，`navigate('/chat/:roomId')`
- 群聊 → 结算：用户第3次发言后收到 NPC 最终回复，自动跳 `/settlement/:sessionId`
- 结算 → Feed：点"回首页"按钮，`navigate('/feed', { replace: true })`
- 结算 → Feed 后的私信 Banner：回到 Feed 后，前端计数划过 2 张卡片触发请求

---

## 4. 前端 AppContext 状态重构

### 4.1 删除的旧字段

以下字段全部删除，不再保留：

```
meetingId, meetingData, reviewData, conversations,
pendingMode, sceneType, brainstormWorld, brainstormCharacters,
brainstormMainWorld, themeRefreshCount, brainstormTheme,
jobTitle, industry
```

### 4.2 新字段定义

```javascript
// 持久化字段（存 localStorage）
PERSIST_KEYS = ['userId', 'userName']

// 初始状态
{
  // ── 持久化字段 ──
  userId: null,         // 设备级用户 ID（uuid，首次访问生成）
  userName: null,       // 用户花名

  // ── 会话级字段（不持久化，页面刷新后清空）──
  currentRoomId: null,       // 当前进入的房间 ID
  currentChatSessionId: null, // 当前群聊会话 ID
  chatDialogueScript: [],     // join 返回的完整对话脚本（内存中按顺序播放）
  chatProgress: 0,            // 当前播放到第几条脚本（光标）
  userTurnCount: 0,           // 用户已发言次数
  settlementData: null,       // 结算数据（complete 后拉取）

  // ── Feed 状态（会话级）──
  feedScrollIndex: 0,         // Feed 当前滚动位置（用于恢复）
  cardsSinceLastChat: 0,      // 回到 Feed 后划过的卡片数（触发私信 Banner 用）
  dmBannerShown: 0,           // 本 session 已显示的私信 Banner 数（最多 2 条）
}
```

### 4.3 降级处理

- 旧 session 无 `userId` 时：首次访问自动生成并持久化，无需提示用户
- 旧 session 有残留的双门版字段（`meetingId` 等）：`clearAll` 时一并清除，不会报错

---

## 5. 前后端数据流

### 5.1 核心循环：Feed → 群聊 → 结算 → Feed

```
[前端 FeedPage]
    │ 页面加载
    ▼
GET /api/v2/feed         → 拿到 Feed 列表，渲染卡片
    │
    │ 用户点"加入"
    ▼
POST /api/v2/chat/join   → 返回 chatSessionId + dialogueScript（完整脚本）
    │
    │ navigate('/chat/:roomId')，脚本存入 AppContext.chatDialogueScript
    ▼
[前端 ChatPage]
    │ 自动播放脚本（按 chatProgress 光标顺序）
    │   - NPC 消息：渲染气泡 + 调 TTS 播放
    │   - user_cue：停止自动播放，切换到用户输入模式
    ▼
用户输入（文字或语音）
    │
POST /api/v2/chat/respond（传 turnIndex + userInput）
    │ 返回 npcReply + betterVersion
    ▼
渲染 NPC 回复气泡 + 播放 TTS
    │
    │ 如果 isLastTurn=true，等 NPC 播放完毕
    ▼
POST /api/v2/chat/complete
    │
    │ navigate('/settlement/:sessionId')
    ▼
[前端 SettlementPage]
    │
GET /api/v2/chat/:sessionId/settlement
    │ 返回 eventResult + expressionCards
    ▼
渲染结算一屏（事件结果 + 表达卡片 + 回首页按钮）
    │
    │ 用户点收藏
POST /api/v2/expressions/:id/save
    │
    │ 用户点"回首页"
    ▼
navigate('/feed', { replace: true })
将 cardsSinceLastChat 重置为 0
```

### 5.2 NPC 私信 Banner 触发逻辑

```
[前端 FeedPage]
    │
    │ 用户每滑过一张卡片
    ▼
cardsSinceLastChat += 1
    │
    │ 当 cardsSinceLastChat >= 2 且 dmBannerShown < 2
    │ 且存在已完成的 chatSessionId
    ▼
GET /api/v2/chat/:chatSessionId/dm-banner
    │
    │ hasBanner=true
    ▼
渲染 Banner 浮层（NPC 头像 + 消息文本）
dmBannerShown += 1
cardsSinceLastChat = 0  // 重置计数
```

**后端判断逻辑（dm-banner 接口）：**
1. 查 `v2_chat_sessions`，确认 status=completed
2. 查该 session 对应 room 的 NPC profile，随机选一个 NPC 生成私信文案
3. 记录已发送次数到 `v2_chat_sessions.dm_sent_count`（需加此列）
4. dm_sent_count >= 2 则返回 hasBanner=false

### 5.3 用户首次访问流程

```
前端启动
    │
    │ localStorage 读 userId
    ├─ 有 userId → 跳过初始化
    └─ 无 userId
        │
        │ 生成 uuid 存 localStorage
        ▼
    POST /api/v2/users/init（只建记录，不做 onboarding）
        │
        │ 有 userName → 直接进 Feed
        └─ 无 userName → 进 /onboarding（只填花名，一步完成）
```

---

## 6. 目录结构变更

### 6.1 后端：新增文件

```
server/
├── routes/
│   ├── v2-users.js          # 新增：用户初始化
│   ├── v2-feed.js           # 新增：Feed 接口
│   ├── v2-chat.js           # 新增：群聊接口（join/respond/complete/dm-banner）
│   └── v2-expressions.js    # 新增：表达本接口
├── prompts/
│   ├── respond-chat.js      # 新增：NPC 实时回复 prompt（替代 respond-meeting.js）
│   └── better-version.js    # 新增：生成"更好说法" prompt
├── data/
│   └── seed-rooms.js        # 新增：预制房间数据种子文件
└── index.js                 # 修改：挂载新路由
```

### 6.2 后端：保留不改（复用）

```
server/
├── db.js                    # 保留：在末尾追加新建表的 SQL，不改旧表
├── services/openai.js       # 保留：直接复用
├── services/speech.js       # 保留：直接复用
└── routes/speech.js         # 保留：直接复用（/api/speech/tts 和 stt 路径不变）
```

### 6.3 后端：旧文件状态

```
server/routes/meeting.js     # 保留不动（旧流程仍可访问，不主动调用）
server/routes/review.js      # 保留不动
server/routes/onboarding.js  # 保留不动
server/routes/brainstorm.js  # 保留不动
server/routes/history.js     # 保留不动
server/prompts/              # 全部保留，新 prompt 单独建文件
```

### 6.4 前端：新增文件

```
client/src/
├── pages/
│   ├── FeedPage.jsx         # 新增：Feed 主页（竖向滑动卡片）
│   ├── FeedPage.module.css
│   ├── ChatPage.jsx         # 新增：群聊页
│   ├── ChatPage.module.css
│   ├── SettlementPage.jsx   # 新增：结算页
│   ├── SettlementPage.module.css
│   ├── ExpressionsPage.jsx  # 新增：表达本
│   ├── ExpressionsPage.module.css
│   ├── ProfilePage.jsx      # 新增：我的（空壳）
│   └── ProfilePage.module.css
├── components/
│   ├── TabNavigator.jsx     # 新增：底部 Tab 导航栏
│   ├── TabNavigator.module.css
│   ├── DmBanner.jsx         # 新增：NPC 私信 banner 浮层
│   └── DmBanner.module.css
├── context/
│   └── AppContext.jsx       # 修改：重构状态字段（保留文件，清空重写内容）
├── api/
│   └── index.js             # 修改：追加新 v2 接口封装（保留旧接口封装）
└── App.jsx                  # 修改：新路由 + AppShell 结构
```

### 6.5 前端：旧页面处理

```
# 以下页面全部保留文件，但从 App.jsx 路由中移除（避免误入）
# 不删文件是为了方便回退对比
client/src/pages/Home.jsx
client/src/pages/Meeting.jsx
client/src/pages/Review.jsx
client/src/pages/ReviewNodes.jsx
client/src/pages/Complete.jsx
client/src/pages/History.jsx
client/src/pages/BrainstormEntry.jsx
client/src/pages/CharacterSearch.jsx
client/src/pages/CharacterSelect.jsx
client/src/pages/RandomDraw.jsx
client/src/pages/SourceSelect.jsx
client/src/pages/PreMeeting.jsx
client/src/pages/WorkInfoStep.jsx
```

---

## 7. 关键设计决策记录

### 决策 1：平行建表（v2_ 前缀），不替换旧表

选择：新表用 `v2_` 前缀，旧表原封不动。  
放弃：直接 DROP 旧表重建。  
原因：Demo 阶段可能需要随时切回旧版对比，保留旧表零成本，SQLite 不会因为多几张空表有性能影响。  
代价：上线后需要做一次 cleanup 迁移。

### 决策 2：完整脚本在 join 时一次性下发

选择：`POST /api/v2/chat/join` 返回完整 `dialogueScript`，前端按光标播放。  
放弃：每条 NPC 消息单独请求（类似 SSE 流）。  
原因：预制脚本体积可控（15 条左右），一次性拿完更简单，避免多次往返延迟。NPC 用户交互部分（respond 接口）才是实时的。  
代价：脚本较长时首次 join 响应时间稍长，但 15 条消息的 JSON 远小于 1KB，可忽略。

### 决策 3：betterVersion 在 respond 阶段同步生成

选择：用户发言后，`respond` 接口同步返回 `npcReply` + `betterVersion`。  
放弃：结算时批量生成。  
原因：结算时再生成会引入 AI 调用延迟，破坏结算页的流畅体验。respond 阶段已有 AI 调用，顺带处理成本极低。  
代价：respond 接口响应时间增加约 1-2s（一次额外的短 prompt）。如果体验差可以改为异步。

### 决策 4：英语等级 Demo 阶段固定为 A2-B1，不做动态调整

选择：所有房间难度预制为 A2/B1，不在运行时根据用户表现调整。  
放弃：动态难度系统。  
原因：MVP 阶段验证内容本身是否有吸引力，难度系统属于留存层功能，不是第一批要验证的假设。

---

## 8. 最高风险点 + 降级预案

| 风险 | 发生概率 | 影响 | 降级方案 |
|------|---------|------|---------|
| AI respond 接口延迟 > 5s，用户等待感差 | 中 | 高 | 前端提前渲染"NPC 正在输入..."动效；若延迟持续，将 betterVersion 改为异步（respond 先返回 npcReply，betterVersion 在结算页单独请求） |
| ElevenLabs TTS 调用失败 | 低 | 中 | 现有 fallback 机制（Azure TTS）已可用，直接复用 |
| 预制脚本内容单一，用户很快刷完 | 高 | 中 | MVP 阶段接受，首批 20-30 个房间够验证一周。内容补充是运营问题，不是架构问题 |
| userId（localStorage）被清除，用户数据丢失 | 中 | 低 | 表达本数据丢失可接受（Demo 阶段），onboarding 重新填花名即可恢复使用 |
| 同一用户同时在多设备使用 | 低 | 低 | userId 是设备级，多设备数据互不同步，Demo 阶段接受 |

---

## 9. MVP 边界（现在必须定 vs 可以推迟）

### 现在必须定的

- v2_ 表结构（改动成本高，数据迁移麻烦）
- API 路径和字段名（前后端并行开发依赖）
- dialogueScript 的 JSON 格式（影响前端播放逻辑和后端种子数据）
- userId 的生成策略（设备级 uuid，存 localStorage）

### 可以推迟的

- NPC 私信 Banner 的文案生成逻辑（可先用硬编码文案）
- 表达本的排序/过滤功能
- `v2_feed_items` 的个性化排序（MVP 阶段固定顺序）
- 结算页动效细节
- `/profile` 页面内容

---

*文档由架构师生成，基于对现有代码库（db.js、AppContext.jsx、speech.js、meeting.js、index.js）的实际读取，而非凭记忆推断。*
