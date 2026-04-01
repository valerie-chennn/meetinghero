# 技术方案：脑洞模式（Brainstorm Mode）

**版本**：v1.0  
**日期**：2026-04-01  
**状态**：待评审  
**负责架构师**：architect agent

---

## 一、技术可行性评审

### 1.1 CharacterSearch：AI 返回角色列表

**问题**：用户输入关键词后，AI 需要返回 4-8 个角色对象（含 name/persona/world 等字段）。

**可行性**：完全可行，使用已有的 `callOpenAIJson` 即可。

**延迟评估**：
- 该调用仅需要返回 4-8 个角色的结构化 JSON，token 总量约 400-600，基于当前 Azure OpenAI 链路，预计 **1.5-3 秒**。
- 热门 IP（西游记、哈利波特等约 20 个）使用服务端预设静态数据，**零延迟**直接返回，不走 AI。
- 冷门 IP 走 AI 生成，3 秒内对用户可接受（配合加载态）。

**坑点**：
- AI 对冷门 IP 可能返回不够 4 个角色，或返回不存在的角色名。需在后端做数量校验：`characters.length < 4` 时返回特殊标志 `tooFew: true`，前端展示"换一个试试"。
- AI 可能混入用户已选过的角色世界（乱炖局场景不适用，此处是点将局，问题不大）。
- 热门 IP 命中策略：前端传入的 `query` 与预设 IP 名做模糊匹配（`includes` 即可），命中则跳过 AI。

**结论**：可行，延迟可接受，需加热门 IP 预设和数量兜底。

---

### 1.2 乱炖局：主场景随机选择 + 角色身份适配

**问题**：3 个来自不同世界的角色，需要在 Prompt 里实现"主场景世界随机选一个，其他角色只改头衔保持性格"。

**可行性**：完全可行，关键在 Prompt 设计，实现成本低。

**方案**：
- `mainWorld` 由**前端随机选取**（从 3 个角色的 `world` 字段中 `Math.random()` 取一个），传入 API，不在后端随机（减少后端逻辑，前端展示时也能实时体现选定结果）。
- Prompt 模板中明确列出每个角色的适配规则：
  ```
  角色适配规则（针对非主场景角色）：
  - 只替换其在主世界中的身份头衔（参考角色特点给出合适头衔）
  - 保留其原有说话风格（persona 字段）
  - 禁止修改角色性格、口头禅、行为模式
  ```
- 传入每个角色的 `persona` 标签，让 AI 生成对话时强制引用风格约束。

**坑点**：
- AI 可能无视"只改头衔"的约束，让乔布斯变成一个完全不像乔布斯的人。风险等级：**中**。缓解方案：在 Prompt 末尾加"违规检查"提示，用角色的 1-2 个口头禅举例（"乔布斯说话风格示例：'One more thing.' / 'This is insanely great.'"）。
- 主场景世界如果是"当代名人"（如乔布斯）作为主场景，适配其他角色的头衔会显得突兀（"贾府西洋机关师"合理，"乔布斯公司的孙悟空"就奇怪）。PRD 的乱炖局角色池应避免让"当代名人"成为主场景，或在 prompt 中针对 `contemporary` 世界做特殊处理（建议后续迭代，MVP 先不管）。

**结论**：可行，靠 Prompt 工程解决，需要精心设计示例约束。

---

### 1.3 数据库 Schema 变更（SQLite ALTER TABLE）

**问题**：meetings 表需要新增 3 列：`scene_type`、`brainstorm_world`、`brainstorm_characters`。

**可行性**：完全可行，现有代码已有先例（`db.js` 中对 `user_role` 和 `user_name` 的处理方式）。

**方案**：在 `db.js` 的 `initSchema()` 中追加三个 `ALTER TABLE ... ADD COLUMN` 语句，包在 `try/catch` 中，列已存在时静默忽略。

```javascript
// meetings 表新增字段
const meetingNewCols = [
  `ALTER TABLE meetings ADD COLUMN scene_type TEXT DEFAULT 'formal'`,
  `ALTER TABLE meetings ADD COLUMN brainstorm_world TEXT`,
  `ALTER TABLE meetings ADD COLUMN brainstorm_characters TEXT`,
];
meetingNewCols.forEach(sql => {
  try { db.exec(sql); } catch (e) { /* 列已存在，忽略 */ }
});
```

同样，`sessions` 表需要新增 `job_title` 和 `industry` 的可空处理——当前这两列是 `NOT NULL`，脑洞模式创建 session 时不传这两个字段会失败。

**坑点（重要）**：
- `sessions` 表的 `job_title TEXT NOT NULL` 和 `industry TEXT NOT NULL` 约束：脑洞模式用户完成 2 步 Onboarding 后调用 `createSession`，此时没有 `jobTitle/industry`，会被数据库约束拒绝。
- **解决方案**：SQLite 不支持 `ALTER COLUMN` 删除 NOT NULL 约束，需要建新表迁移。方案如下：
  1. `CREATE TABLE sessions_new` 把 `job_title`/`industry` 改为 `TEXT DEFAULT NULL`
  2. `INSERT INTO sessions_new SELECT ...` 迁移数据
  3. `DROP TABLE sessions`，`ALTER TABLE sessions_new RENAME TO sessions`
  
  这个迁移写在 `initSchema()` 里，检测到旧表有 NOT NULL 约束时执行（通过 `PRAGMA table_info(sessions)` 判断）。
  
  风险等级：**高**，数据迁移操作，必须先备份 `.db` 文件，在开发环境验证后再上生产。

- `onboarding.js` 路由需要同步修改：去掉对 `jobTitle/industry` 的必填校验，改为只在传入时校验。

---

## 二、API 端点设计

### 新增端点

#### 2.1 `POST /api/brainstorm/search-characters`

用途：点将局角色搜索，返回角色列表。

**入参**：
```json
{
  "query": "西游记",
  "sessionId": "xxx"
}
```

**出参（正常）**：
```json
{
  "world": "chinese-classic",
  "worldLabel": "中国古典",
  "characters": [
    {
      "id": "sun-wukong",
      "name": "孙悟空",
      "world": "chinese-classic",
      "worldLabel": "中国古典",
      "persona": "天生反骨，不服管教，武力第一"
    }
  ],
  "source": "preset"
}
```
`source` 字段：`"preset"` 表示来自静态数据，`"ai"` 表示 AI 生成。

**出参（角色不足）**：
```json
{
  "tooFew": true,
  "message": "找到的角色太少，换个关键词试试"
}
```

**逻辑**：
1. 用 `query` 匹配预设热门 IP 列表（`character-pool.js` 中的 `HOT_IPS` map）
2. 命中 → 直接返回预设角色列表，`source: "preset"`
3. 未命中 → 调用 AI，prompt 要求返回 4-8 个角色 JSON
4. 校验数量：< 4 个返回 `tooFew: true`

**校验**：
- `query` 不能为空，长度 1-50 字符
- `sessionId` 必须存在（验证用户已完成 onboarding）

---

#### 2.2 `GET /api/brainstorm/random-characters`

用途：乱炖局，随机抽取 3 个来自不同世界的角色。

**入参**（Query Params）：无（纯随机）

**出参**：
```json
{
  "characters": [
    {
      "id": "sun-wukong",
      "name": "孙悟空",
      "world": "chinese-classic",
      "worldLabel": "中国古典",
      "persona": "天生反骨，不服管教，武力第一"
    },
    {
      "id": "steve-jobs",
      "name": "乔布斯",
      "world": "contemporary",
      "worldLabel": "当代名人",
      "persona": "追求极致，偏执完美主义，改变世界的执念"
    },
    {
      "id": "hamlet",
      "name": "哈姆雷特",
      "world": "western-literature",
      "worldLabel": "西方文学",
      "persona": "多疑内敛，哲思深沉，行动力差但洞察力强"
    }
  ]
}
```

**逻辑**：纯服务端随机，从 `character-pool.js` 各世界中各随机取 1 个，保证 3 个角色来自 3 个不同世界。无需 AI 调用，同步返回，延迟 < 10ms。

---

#### 2.3 `POST /api/brainstorm/generate-theme`

用途：ThemePreview 页生成/换主题时调用。

**入参**：
```json
{
  "sessionId": "xxx",
  "sceneType": "brainstorm-pick",
  "characters": [
    { "id": "sun-wukong", "name": "孙悟空", "world": "chinese-classic", "worldLabel": "中国古典", "persona": "..." }
  ],
  "mainWorld": "chinese-classic"
}
```

**出参**：
```json
{
  "theme": {
    "title": "天庭西天取经路线招标大会",
    "settingZh": "地点：南天门内议事堂。玉帝已明旨，此次取经路线必须在今日定下，三界眼睛都盯着。",
    "userRole": "天庭派来的监察仙官",
    "characters": [
      {
        "id": "sun-wukong",
        "name": "孙悟空",
        "adaptedTitle": "取经护卫队长",
        "persona": "天生反骨，不服管教，武力第一"
      }
    ]
  }
}
```

**逻辑**：
- 调用 AI，使用 `generateBrainstormThemePrompt` 生成主题预览数据
- 这是独立的轻量 AI 调用（只生成 theme，不生成完整会议），token 约 300-500，延迟约 1-2 秒
- 不写数据库（主题是临时预览，`themeRefreshCount` 存前端 state）

**注意**：这个端点和 `/generate` 分离，是为了支持"换 3 次主题"的体验——每次换主题只花 1-2 秒而不是 5-8 秒。

---

### 改动现有端点

#### 2.4 `POST /api/onboarding`（改动）

**改动点**：`jobTitle` 和 `industry` 改为可选字段，不再强制校验非空。

**新入参**：
```json
{
  "userName": "小明",
  "englishLevel": "B1",
  "jobTitle": null,
  "industry": null
}
```

当 `jobTitle/industry` 为 null/空时，写入数据库存 `null`（依赖 Schema 变更）。

---

#### 2.5 `POST /api/meeting/generate`（改动）

**改动点**：新增 `sceneType`、`characters`、`mainWorld` 字段；根据 `sceneType` 分支调用不同 prompt 函数。

**新增入参字段**：
```json
{
  "sessionId": "xxx",
  "source": "system",
  "sceneType": "brainstorm-pick",
  "characters": [...],
  "mainWorld": "chinese-classic"
}
```

**新增出参**（已有出参不变，新增 `sceneType`）：
```json
{
  "meetingId": "xxx",
  "sceneType": "brainstorm-pick",
  "briefing": {},
  "..."
}
```

**逻辑变化**：
```javascript
// 根据 sceneType 选择 prompt 函数
const { systemPrompt, userPrompt } = sceneType && sceneType.startsWith('brainstorm')
  ? generateBrainstormMeetingPrompt({ englishLevel, userName, sceneType, characters, mainWorld })
  : generateMeetingPrompt({ englishLevel, jobTitle, industry, userName, uploadContent });
```

写库时新增 3 列：
```javascript
stmt = db.prepare(`
  INSERT INTO meetings (id, session_id, source, briefing, memo, roles, dialogue, 
    key_nodes, ref_phrases, user_role, scene_type, brainstorm_world, brainstorm_characters, status)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'created')
`);
```

---

#### 2.6 `POST /api/onboarding/update-work-info`（新增）

用途：正经开会补充信息步骤，已有 `sessionId` 的老用户补填职位和行业。

**入参**：
```json
{
  "sessionId": "xxx",
  "jobTitle": "产品经理",
  "industry": "互联网"
}
```

**出参**：
```json
{ "success": true }
```

**逻辑**：`UPDATE sessions SET job_title=?, industry=? WHERE id=?`。不做原有 session 的整体替换，只更新这两列。

---

## 三、文件变更清单

### 新增文件

| 文件 | 说明 |
|------|------|
| `server/data/character-pool.js` | 静态角色池数据（50-70 个角色） + 热门 IP 预设映射 |
| `server/routes/brainstorm.js` | 新增三个脑洞模式专属端点 |
| `server/prompts/generate-brainstorm.js` | `generateBrainstormMeetingPrompt` + `generateBrainstormThemePrompt` |
| `client/src/pages/BrainstormEntry.jsx` | 脑洞模式入口页 |
| `client/src/pages/CharacterSearch.jsx` | 角色搜索页（点将局） |
| `client/src/pages/CharacterSelect.jsx` | 角色选择页（点将局） |
| `client/src/pages/RandomDraw.jsx` | 随机抽签页（乱炖局） |
| `client/src/pages/ThemePreview.jsx` | 主题预览页（点将局+乱炖局共用） |
| `client/src/pages/WorkInfoStep.jsx` | 正经开会补充信息页 |
| `client/src/api/brainstorm.js` | 脑洞模式相关 API 封装 |

### 修改文件

| 文件 | 改动内容 |
|------|---------|
| `server/db.js` | 1. `sessions` 表迁移（job_title/industry 改可空）；2. `meetings` 表新增 3 列 |
| `server/index.js` | 注册 `/api/brainstorm` 路由 |
| `server/routes/onboarding.js` | 去掉 jobTitle/industry 必填校验；新增 `POST /api/onboarding/update-work-info` 子路由（或单独 router） |
| `server/routes/meeting.js` | `/generate` 端点支持 sceneType 分支 prompt + 写库新增 3 列 |
| `server/prompts/generate-meeting.js` | 导出新增，添加 `module.exports` 中的 `generateBrainstormMeetingPrompt`（**实际实现在 generate-brainstorm.js**，此文件不改动主函数） |
| `client/src/App.jsx` | 注册新页面路由（6 条） |
| `client/src/context/AppContext.jsx` | `buildInitialState` 新增 4 个字段；`PERSIST_KEYS` 不变 |
| `client/src/api/index.js` | 新增 `generateMeeting` 支持 brainstorm 参数（或直接在 brainstorm.js 单独封装） |
| `client/src/pages/Home.jsx` | 首页改为两个入口卡片，加"正经开会 → 检测 jobTitle 跳转"逻辑 |
| `client/src/pages/Onboarding.jsx` | 步骤数从 4 改为 2，去掉职位/行业步骤，英语等级描述文案更新 |
| `client/src/pages/Loading.jsx` | 接收 `sceneType` 参数，调用对应生成 API（已有逻辑兼容） |

---

## 四、实施顺序建议

### 阶段一：基础设施（优先，无依赖）

以下任务相互独立，可并行：

**任务 A（后端）**：
1. `server/data/character-pool.js` — 录入角色池数据，热门 IP 映射
2. `server/db.js` — Schema 变更（`sessions` 表迁移 + `meetings` 新增 3 列）
3. `server/routes/onboarding.js` — 去掉强制校验，新增 `update-work-info` 端点

**任务 B（前端）**：
1. `AppContext.jsx` — 新增 state 字段
2. `Onboarding.jsx` — 改 2 步，更新文案

### 阶段二：核心 API（依赖阶段一）

**任务 C（后端，需 A 完成）**：
1. `server/prompts/generate-brainstorm.js` — 实现两个 prompt 函数
2. `server/routes/brainstorm.js` — 实现 3 个新端点
3. `server/routes/meeting.js` — 接入 brainstorm prompt 分支
4. `server/index.js` — 注册路由

### 阶段三：前端页面（依赖阶段二）

**任务 D（前端，可与 C 并行开发 UI，联调依赖 C）**：
1. `BrainstormEntry.jsx` — 入口页（纯展示，无 API 依赖）
2. `WorkInfoStep.jsx` — 补充信息页（依赖 update-work-info API）
3. `Home.jsx` — 首页改造（依赖 WorkInfoStep）

**任务 E（前端，依赖 C 中的 brainstorm API）**：
1. `CharacterSearch.jsx` + `CharacterSelect.jsx` — 点将局搜索/选择
2. `RandomDraw.jsx` — 乱炖局翻牌
3. `ThemePreview.jsx` — 主题预览

### 阶段四：集成联调

1. 打通点将局完整链路：Search → Select → ThemePreview → Loading → Meeting
2. 打通乱炖局完整链路：RandomDraw → ThemePreview → Loading → Meeting
3. 验证 Meeting/Review 页在 brainstorm 模式下的表现（narrator 不渲染、私信风格）
4. 验证 History 页 scene_type 字段写入正确

---

## 五、风险点

### 风险 1：sessions 表迁移（高风险）

**描述**：SQLite 不支持 `ALTER COLUMN`，要去掉 `job_title/industry NOT NULL` 约束必须重建表。

**可能影响**：如果迁移脚本有 bug，生产数据库数据丢失。

**缓解措施**：
- 迁移前自动备份 `.db` 文件（在 `initSchema()` 中加备份逻辑）
- 迁移操作放在事务中：`BEGIN TRANSACTION → 建新表 → 迁移数据 → 删旧表 → 重命名 → COMMIT`
- 失败时 `ROLLBACK`，服务不启动

**实施建议**：先在本地用当前生产 `.db` 文件测试迁移脚本，确认零数据丢失再部署。

---

### 风险 2：AI 生成主题与世界观不贴合（中风险）

**描述**：`generateBrainstormThemePrompt` 需要让 AI 生成符合特定世界观的会议主题，AI 可能生成现代企业用语（CTO/OKR/Sprint 等）。

**缓解措施**：
- Prompt 中明确列出禁止词列表
- 后端收到 AI 返回后，做简单的关键词污染检测（检测 `["CTO", "OKR", "Sprint", "KPI", "总部"]`），触发时自动重试一次（最多重试 1 次，避免无限循环）
- ThemePreview 给用户 3 次换主题机会，实际上是对 AI 生成质量的兜底

---

### 风险 3：冷门 IP 角色搜索质量（中风险）

**描述**：用户搜索冷门 IP（如"星际穿越""永夜星河"），AI 可能返回角色名错误或虚构角色。

**缓解措施**：
- PRD 已有"不足 4 个返回'换一个试试'"的设计，作为兜底
- 在 AI prompt 中要求"只返回真实存在于该作品中的角色，不确定的不返回"
- 不足 4 个时前端提示，不影响主流程

---

### 风险 4：乱炖局角色世界适配效果（中风险）

**描述**：让 AI 给非主场景角色生成适配头衔，效果高度依赖 AI 理解。如果适配头衔生成得很奇怪（如"孙悟空担任乔布斯公司首席猴力官"），用户体验差。

**缓解措施**：
- Prompt 中给出 3-4 个适配示例（few-shot），如：
  - "贾府场景 + 乔布斯 → 贾府西洋奇器师"
  - "西游记场景 + 赫敏 → 天庭西方符咒使"
- 角色池设计上，`contemporary`（当代名人）世界不应作为乱炖局主场景的第一优先级。可在前端随机 `mainWorld` 时，给文学/古典/神话世界更高权重（`contemporary` 权重降低 50%）

---

### 风险 5：Meeting 页 narrator 气泡处理（低风险）

**描述**：PRD 要求脑洞模式不显示 narrator，但现有 Meeting 页是通用渲染逻辑。

**缓解措施**：
- 前端只需一行判断：`if (msg.speaker === 'narrator' && sceneType?.startsWith('brainstorm')) return null`
- 后端 Prompt 层面同时要求"不生成 narrator 消息"，双重保障
- Meeting 页本身不需要大改

---

## 附：关键数据结构速查

### character-pool.js 热门 IP 映射结构

```javascript
// 热门 IP 关键词 → 预设角色列表的映射
// 前端传来的 query 命中这里则跳过 AI
const HOT_IP_MAP = {
  '西游记': ['sun-wukong', 'zhu-bajie', 'tang-seng', 'sha-wujing'],
  '哈利波特': ['hermione', 'harry-potter', 'ron-weasley', 'dumbledore'],
  // ... 约 20 个热门 IP
};
```

### AppContext 新增字段

```javascript
{
  sceneType: null,              // 'formal' | 'brainstorm-pick' | 'brainstorm-random'
  brainstormCharacters: [],     // 已选角色对象数组（含完整角色信息，不只是 ID）
  brainstormMainWorld: null,    // 确定的主场景世界 ID（ThemePreview 传给 generate）
  themeRefreshCount: 0,         // 当前会话已换主题次数（0-3，不持久化）
}
```

注意：PRD 中 `brainstormCharacters` 设计为 ID 数组，但传入 API 时需要完整角色对象（含 persona），建议 **state 中直接存对象数组**，API 调用时按需取字段。

### generateBrainstormMeetingPrompt 函数签名

```javascript
// server/prompts/generate-brainstorm.js
function generateBrainstormMeetingPrompt({
  englishLevel,    // 'A1' | 'A2' | 'B1' | 'B2'
  userName,        // 用户花名
  sceneType,       // 'brainstorm-pick' | 'brainstorm-random'
  characters,      // 角色对象数组 [{ id, name, world, worldLabel, persona }]
  mainWorld,       // 主场景世界 ID（点将局 = characters[0].world，乱炖局 = 前端随机选）
}) { ... }

// ThemePreview 专用轻量 prompt（只生成主题，不生成完整会议）
function generateBrainstormThemePrompt({
  sceneType,
  characters,
  mainWorld,
  userName,
}) { ... }
```

---

*本文档由 architect agent 输出，基于 PRD v1.0 和现有代码库分析生成。*
