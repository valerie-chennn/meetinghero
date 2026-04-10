# MeetingHero P0 技术实现方案

**版本**: v1.0
**日期**: 2026-03-31
**作者**: 架构师

---

## 概述

本文档针对 MeetingHero 四个 P0 需求给出详细技术实现方案，覆盖技术选型、文件变更清单、数据流、核心代码结构及风险评估。

技术栈基线：
- 前端：React 18 + Vite + CSS Modules，路由 React Router v6
- 后端：Express + better-sqlite3，AI 调用封装在 `server/services/openai.js`
- 全局状态：AppContext（内存态） + localStorage（持久化 sessionId / userName / englishLevel / jobTitle / industry）

---

## P0-1：PDF 真实解析（UX-04）

### 1.1 现状分析

`SourceSelect.jsx` 第 49-51 行：PDF 上传目前是伪处理——只读取文件名和大小构造占位字符串，AI 无法基于真实内容生成会议。TXT 文件走 `FileReader.readAsText`，能正常工作。

后端 `/api/meeting/generate` 接收 `uploadContent` 字段（字符串），直接注入 prompt。因此前端需要先将 PDF 解析为文本字符串，再传递给后端，**无需后端新增路由**。

### 1.2 技术选型：pdf-parse vs pdfjs-dist

| 维度 | pdf-parse | pdfjs-dist |
|------|-----------|------------|
| 运行环境 | Node.js（服务端） | 浏览器 / Node（两用） |
| 包体积 | ~1MB | ~8MB+ |
| API 复杂度 | 极简（`pdfParse(buffer)` 一行） | 复杂，需处理 Worker / Promise 链 |
| 维护状态 | 稳定，无需 Canvas 依赖 | 持续更新但 Node 使用需额外配置 |
| 文本提取质量 | 适合普通办公文档 | 适合复杂排版（表格、多列） |
| 错误处理 | 抛出可捕获的 Error | 同上 |

**选型结论：使用 pdf-parse 在服务端解析。**

理由：
1. 用户上传的是"会议资料"（Word 导出的 PDF、PPT 截图除外），排版通常简单，pdf-parse 提取质量足够
2. 服务端解析比浏览器解析更安全（文件内容不在客户端暴露于 JS 内存）
3. 需要新增一个 `POST /api/upload/parse` 端点，专门处理文件上传，和生成端点职责分离

### 1.3 架构决策：新建上传路由

不在 `/api/meeting/generate` 上直接接收 multipart，原因：
1. `generate` 接收 JSON body，混入 multipart 会破坏现有接口
2. 上传和生成是两个不同阶段：先解析文件 → 取得文本 → 调用生成。职责分离让每步可独立重试
3. 前端流程：`SourceSelect` 上传文件 → 取到 `extractedText` → 存入 `uploadContent` → navigate `/loading` → Loading 页调用 `generate`

### 1.4 文件大小与类型限制

- 文件类型：仅接受 `application/pdf` 和 `text/plain`（后端二次校验 MIME）
- 文件大小：**5MB 上限**（pdf-parse 处理大 PDF 会阻塞事件循环；5MB 已足够容纳几十页的会议资料）
- 提取文本长度：截取前 **8000 字符**注入 prompt（避免超出 token 限制，GPT-4o 上下文 128K 但 prompt 工程上控制成本）

### 1.5 文件变更清单

**新增**

```
server/routes/upload.js          # 上传解析路由
```

**修改**

```
server/index.js                  # 挂载 upload 路由
server/package.json              # 新增依赖 pdf-parse、multer
client/src/pages/SourceSelect.jsx  # 改为调用上传 API
client/src/api/index.js          # 新增 parseFile() 函数
```

### 1.6 数据流

```
用户选择 PDF 文件
  → SourceSelect.handleFileChange()
      → 调用 api.parseFile(file)  [FormData POST /api/upload/parse]
          → server/routes/upload.js
              → multer 接收文件（内存存储，不落盘）
              → 校验 MIME 和大小
              → 若 PDF：pdf-parse(buffer) 提取文本
              → 若 TXT：buffer.toString('utf-8')
              → 截取前 8000 字符
              → 返回 { extractedText }
      → 前端收到 extractedText
  → updateState({ meetingSource: 'upload', uploadContent: extractedText })
  → navigate('/loading')

Loading 页已有逻辑：
  → 调用 /api/meeting/generate，传入 source='upload', uploadContent=extractedText
  → 后端 generateMeetingPrompt 注入 uploadContent（现有逻辑已支持）
```

### 1.7 关键代码结构

**server/routes/upload.js**

```javascript
const express = require('express');
const router = express.Router();
const multer = require('multer');
const pdfParse = require('pdf-parse');

// 内存存储：不落盘，直接处理 buffer
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter(req, file, cb) {
    const allowed = ['application/pdf', 'text/plain'];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('只支持 PDF 和 TXT 文件'));
    }
    cb(null, true);
  },
});

// POST /api/upload/parse
router.post('/parse', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '未收到文件' });
  }

  try {
    let text = '';
    if (req.file.mimetype === 'application/pdf') {
      const data = await pdfParse(req.file.buffer);
      // data.text 为提取的纯文本
      if (!data.text || data.text.trim().length === 0) {
        return res.status(422).json({ error: 'PDF 内容为空或为扫描件，无法提取文本' });
      }
      text = data.text;
    } else {
      // TXT 文件
      text = req.file.buffer.toString('utf-8');
      if (!text.trim()) {
        return res.status(422).json({ error: '文件内容为空' });
      }
    }

    // 截取前 8000 字符，避免 prompt 过长
    const extractedText = text.trim().slice(0, 8000);

    return res.status(200).json({ extractedText, charCount: extractedText.length });
  } catch (err) {
    console.error('[Upload/Parse] 解析失败:', err.message);
    // pdf-parse 对损坏文件会抛出异常
    return res.status(422).json({ error: 'PDF 解析失败，文件可能已损坏' });
  }
});

module.exports = router;
```

**client/src/api/index.js（新增函数）**

```javascript
// 上传并解析文件（PDF / TXT）
export async function parseFile(file) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch('/api/upload/parse', {
    method: 'POST',
    body: formData,
    // 不设置 Content-Type，让浏览器自动设置 multipart boundary
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '文件解析失败');
  }
  return res.json(); // { extractedText, charCount }
}
```

**client/src/pages/SourceSelect.jsx（替换 handleFileChange 中的 PDF 分支）**

```javascript
// 旧逻辑（删除）：
// content = `[用户上传了 PDF 文件: ${file.name}，...]`

// 新逻辑：
if (file.type === 'text/plain' || ext === '.txt') {
  content = await readFileAsText(file);
} else if (ext === '.pdf' || file.type === 'application/pdf') {
  // 显示加载状态
  setIsUploading(true);
  try {
    const { extractedText } = await parseFile(file);
    content = extractedText;
  } finally {
    setIsUploading(false);
  }
}
```

### 1.8 错误处理矩阵

| 场景 | 检测位置 | 用户提示 |
|------|----------|----------|
| 文件超过 5MB | multer fileSize limit | "文件过大，请上传 5MB 以内的文件" |
| 非 PDF/TXT 类型 | multer fileFilter | "只支持 .txt 和 .pdf 文件" |
| PDF 空文件 / 全图片扫描件 | pdf-parse 返回空 text | "PDF 内容为空或为扫描件，无法提取文本" |
| PDF 文件损坏 | pdf-parse 抛出异常 | "PDF 解析失败，文件可能已损坏" |
| 网络超时 | fetch 异常 | "文件上传失败，请检查网络后重试" |
| 文本内容为空 | text.trim() === '' | "文件内容为空，请换一份文件" |

### 1.9 风险与注意事项

1. **扫描件 PDF**：pdf-parse 只能提取文字层，扫描件（图片 PDF）提取结果为空。当前方案检测到空文本后报错，**不做 OCR**（OCR 依赖 Tesseract 等重型库，超出 P0 范围）。
2. **编码问题**：部分老旧 PDF 使用非标准编码，可能提取乱码。可在返回前做简单验证（乱码率 > 50% 则提示）。
3. **事件循环阻塞**：pdf-parse 是同步密集计算，大文件（>3MB）可能短暂阻塞。当前单用户场景可接受；未来高并发时考虑 `worker_threads`。
4. **multer 文件大小限制与 Express JSON 大小限制独立**：不影响现有 `express.json({ limit: '50mb' })`。

---

## P0-2：会议进度条（UX-01）

### 2.1 现状分析

`Meeting.jsx` 中已有关键状态：
- `activeNodeIndex`：当前等待用户输入的节点索引（null 表示非节点时刻）
- `completedNodes`：已完成节点的 Set
- `meetingData.keyNodes`：所有关键节点数组（包含 `index`、`prompt`、`type` 等字段）

`Meeting.module.css` topBar 目前是 `justify-content: space-between`，左侧（状态点 + 标题）和右侧（"中" 按钮 + Briefing 按钮）之间有空白，进度条可放入**中间区域**。

### 2.2 进度条位置与视觉形式

**位置**：topBar 左右区域之间，绝对居中（使用 `position: absolute; left: 50%; transform: translateX(-50%)`）

**视觉形式**：圆点连线（步骤导航器），而非数字或百分比。

理由：
- 会议通常 2-4 个关键节点，圆点连线能直观表示"一共几步、现在到哪了"
- 数字（"2/4"）在 topBar 中文字信息密度已高，容易造成视觉噪声
- 百分比进度条（线段）在节点数少时粒度感差，且 topBar 高度只有 52px，线段不易感知

**三态样式**：
- 待到达（future）：空心圆，边框色 `var(--border)`
- 当前激活（active）：实心圆，橙色 `var(--accent-orange)` + 轻微脉冲动效
- 已完成（completed）：实心圆，翡翠绿 `var(--accent-teal)` + 对勾内嵌

圆点大小：8px（与 topBar 高度 52px 匹配，不显眼但可感知）
连线：1px 横线，`var(--border-subtle)` 色，宽度均分于圆点之间

**不支持点击跳转**：需求明确不需要，且跳转到历史节点逻辑复杂，留给后续版本。

### 2.3 文件变更清单

**修改**

```
client/src/pages/Meeting.jsx        # 在 topBar 中间插入 MeetingProgress 组件
client/src/pages/Meeting.module.css # 新增 progressBar、progressDot 等样式
```

无需新增文件（进度条组件足够简单，直接内嵌在 Meeting.jsx 底部）。

### 2.4 数据流

```
Meeting state:
  meetingData.keyNodes  → 节点总数（用于渲染圆点数量）
  activeNodeIndex       → 当前节点（用于标记 active 圆点）
  completedNodes (Set)  → 已完成节点（用于标记 completed 圆点）

↓ 传入 MeetingProgress 组件 props
  keyNodes: meetingData.keyNodes       // 数组，长度 = 圆点数
  activeNodeIndex: activeNodeIndex     // 当前激活索引（null / 数字）
  completedNodes: completedNodes       // Set

↓ MeetingProgress 组件渲染
  遍历 keyNodes，每个节点渲染一个圆点 + 连线
  节点状态 = completedNodes.has(node.index) ? 'completed'
           : activeNodeIndex === node.index ? 'active'
           : 'future'
```

### 2.5 关键代码结构

**Meeting.jsx 内新增组件（文件底部，Export 前）**

```jsx
/**
 * 会议进度指示器
 * 在 topBar 中间显示关键节点的圆点进度
 */
function MeetingProgress({ keyNodes, activeNodeIndex, completedNodes }) {
  if (!keyNodes || keyNodes.length === 0) return null;

  return (
    <div className={styles.progressBar}>
      {keyNodes.map((node, i) => {
        const isCompleted = completedNodes.has(node.index);
        const isActive = activeNodeIndex === node.index;
        const dotClass = isCompleted
          ? styles.progressDotCompleted
          : isActive
          ? styles.progressDotActive
          : styles.progressDotFuture;

        return (
          <React.Fragment key={node.index}>
            {/* 圆点 */}
            <div className={`${styles.progressDot} ${dotClass}`}>
              {isCompleted && (
                <svg width="6" height="6" viewBox="0 0 10 8" fill="none">
                  <path d="M1 4L3.5 7L9 1" stroke="white" strokeWidth="1.8"
                        strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
            {/* 连线（最后一个节点后不加） */}
            {i < keyNodes.length - 1 && (
              <div className={styles.progressLine} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
```

**Meeting.jsx topBar 区域插入组件**

```jsx
<div className={styles.topBar}>
  <div className={styles.topBarLeft}>
    {/* 现有内容：状态点 + 标题 */}
  </div>

  {/* 新增：居中进度条 */}
  <MeetingProgress
    keyNodes={meetingData?.keyNodes}
    activeNodeIndex={activeNodeIndex}
    completedNodes={completedNodes}
  />

  <div className={styles.topBarRight}>
    {/* 现有内容："中"按钮 + Briefing 按钮 */}
  </div>
</div>
```

**Meeting.module.css 新增样式**

```css
/* ===== 会议进度条（topBar 中间居中） ===== */
.progressBar {
  /* 绝对居中，不影响左右内容布局 */
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 0;
  /* 防止被左右内容遮挡（topBar z-index 已为 10） */
  pointer-events: none;
}

/* 单个进度圆点基础样式 */
.progressDot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.3s var(--ease-standard),
              transform 0.3s var(--ease-spring);
  flex-shrink: 0;
}

/* 未到达：空心圆 */
.progressDotFuture {
  background: transparent;
  border: 1.5px solid var(--border);
}

/* 当前激活：橙色实心 + 脉冲 */
.progressDotActive {
  background: var(--accent-orange);
  border: none;
  transform: scale(1.25);
  animation: progressPulse 2s ease-in-out infinite;
}

/* 已完成：翡翠绿实心 */
.progressDotCompleted {
  background: var(--accent-teal);
  border: none;
}

/* 节点间连线 */
.progressLine {
  width: 16px;
  height: 1.5px;
  background: var(--border-subtle);
  flex-shrink: 0;
}

@keyframes progressPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(249, 115, 22, 0.4); }
  50% { box-shadow: 0 0 0 4px rgba(249, 115, 22, 0); }
}
```

### 2.6 风险与注意事项

1. **topBar 宽度压缩**：topBar 左右区域合计约 230px（左：状态点 + 标题；右：两个按钮），中间进度条绝对定位不影响布局，但节点数过多（>6）时圆点会与左右区域重叠。当前需求限制为 2-4 节点，安全。
2. **keyNodes 结构一致性**：`keyNodes` 数组中的 `index` 字段需与 `activeNodeIndex` 和 `completedNodes` 中的值类型一致（均为数字）。已在现有代码中确认 `node.nodeIndex` 和 `msg.nodeIndex` 使用一致，但需注意：`keyNodes` 数组元素的字段名是 `node.index`（来自 AI 生成），`completedNodes` 存储的是 `nodeIndex`。**需要在 MeetingProgress 中统一使用 `node.index` 还是 `node.nodeIndex`**，要以实际数据结构为准，开发时需先 `console.log(meetingData.keyNodes)` 确认字段名。

---

## P0-3：历史记录页（FN-01）

### 3.1 现状分析

数据库中已有完整的历史数据：
- `sessions` 表：用户 onboarding 信息
- `meetings` 表：每场会议的完整数据（含 `status` 字段，`completed` 表示已完成）
- `reviews` 表：每场会议的复盘报告（通过 `meeting_id` 关联）

`AppContext` 只在会话内保存数据，刷新后不可恢复。历史记录必须从数据库获取。

当前 `sessionId` 持久化在 localStorage，可用于查询该用户的历史记录。

### 3.2 功能范围（P0 最小集）

- 列表页：按时间倒序展示该 session 下已完成的会议（标题 + 日期 + 是否有复盘）
- 详情页：展示已有的复盘报告（复用 `Review` / `ReviewNodes` 页面的数据，而非重新生成）
- 首页入口：在首页 CTA 区域下方加"历史记录"链接（仅老用户可见）

**不在 P0 范围**：跨设备同步、分页、搜索、删除记录

### 3.3 文件变更清单

**新增**

```
client/src/pages/History.jsx             # 历史列表页
client/src/pages/History.module.css      # 历史列表样式
server/routes/history.js                 # 历史记录 API
```

**修改**

```
client/src/App.jsx                       # 注册 /history 路由
server/index.js                          # 挂载 history 路由
client/src/pages/Home.jsx                # 添加历史记录入口
client/src/api/index.js                  # 新增 fetchHistory()、fetchHistoryDetail()
```

**不需修改**

`Review.jsx` 和 `ReviewNodes.jsx` 已能根据 `state.reviewData` 渲染，历史详情可通过注入 reviewData 到 AppContext 后跳转到这些页面，**复用现有页面**，无需单独开发详情页。

### 3.4 API 设计

**GET /api/history/:sessionId**

返回该 session 下已完成的会议列表（不含完整数据，只含摘要）

```json
{
  "meetings": [
    {
      "id": "uuid",
      "topic": "Q3 Product Review",
      "createdAt": "2026-03-28T14:00:00Z",
      "hasReview": true,
      "reviewId": "uuid"
    }
  ]
}
```

**GET /api/history/:sessionId/meeting/:meetingId**

返回某场会议的复盘详情（已存储在 reviews 表中）

```json
{
  "meetingId": "uuid",
  "briefing": { "topic": "..." },
  "reviewId": "uuid",
  "title": "会议英雄",
  "titleEmoji": "🎖️",
  "nodes": [...],
  "achievement": "...",
  "improvement": "..."
}
```

### 3.5 数据库查询设计

**列表查询**

```sql
-- 查询该 session 下已完成的会议（按时间倒序），JOIN reviews 判断是否有复盘
SELECT
  m.id,
  m.briefing,
  m.created_at,
  r.id AS review_id
FROM meetings m
LEFT JOIN reviews r ON r.meeting_id = m.id
WHERE m.session_id = ?
  AND m.status = 'completed'
ORDER BY m.created_at DESC
LIMIT 20;
```

**详情查询**

```sql
-- 查询会议基础信息 + 最新复盘
SELECT
  m.briefing,
  r.id AS review_id,
  r.achievement,
  r.improvement,
  r.nodes
FROM meetings m
LEFT JOIN reviews r ON r.meeting_id = m.id
WHERE m.id = ? AND m.session_id = ?
ORDER BY r.created_at DESC
LIMIT 1;
```

### 3.6 前端页面结构

**History.jsx 结构**

```
容器
  ├── 顶部导航栏（← 返回首页 + "练习记录" 标题）
  ├── 会议列表（按月分组可选）
  │   └── 每条 HistoryCard（
  │         会议主题 topic
  │         日期（格式化显示）
  │         状态标签："有复盘" / "无复盘"
  │         点击进入详情
  │       ）
  └── 空状态（首次使用，暂无记录）
```

**点击历史记录后的跳转逻辑**

```
用户点击某条历史记录
  → 调用 api.fetchHistoryDetail(sessionId, meetingId)
  → 取得 { briefing, reviewData }
  → updateState({
      meetingId,
      meetingData: { briefing, ... },
      reviewData: reviewData,     // 注入现有 reviewData
      isHistoryMode: true         // 标记历史模式（可选，防止重新生成复盘）
    })
  → navigate('/review')
    （Review 页和 ReviewNodes 页会读 state.reviewData，无需修改）
```

### 3.7 数据流

```
首页（Home）
  → 用户点击"历史记录"链接（hasSession 且 state.sessionId 有值时显示）
  → navigate('/history')

历史页（History）
  → 页面挂载时读取 state.sessionId
  → GET /api/history/:sessionId
  → 渲染会议列表

用户点击某条记录
  → GET /api/history/:sessionId/meeting/:meetingId
  → 将 reviewData 注入 AppContext
  → navigate('/review')
  → Review 页直接读取 state.reviewData 渲染（无需重新 AI 生成）
```

### 3.8 关键代码结构

**server/routes/history.js**

```javascript
const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/history/:sessionId — 获取历史会议列表
router.get('/:sessionId', (req, res) => {
  const { sessionId } = req.params;

  // 校验 session 是否存在
  const session = db.prepare('SELECT id FROM sessions WHERE id = ?').get(sessionId);
  if (!session) {
    return res.status(404).json({ error: '会话不存在' });
  }

  const rows = db.prepare(`
    SELECT
      m.id,
      m.briefing,
      m.created_at,
      r.id AS review_id
    FROM meetings m
    LEFT JOIN reviews r ON r.meeting_id = m.id
    WHERE m.session_id = ?
      AND m.status = 'completed'
    ORDER BY m.created_at DESC
    LIMIT 20
  `).all(sessionId);

  const meetings = rows.map(row => {
    const briefing = JSON.parse(row.briefing || '{}');
    return {
      id: row.id,
      topic: briefing.topic || '模拟周会',
      createdAt: row.created_at,
      hasReview: !!row.review_id,
      reviewId: row.review_id || null,
    };
  });

  return res.json({ meetings });
});

// GET /api/history/:sessionId/meeting/:meetingId — 获取历史详情
router.get('/:sessionId/meeting/:meetingId', (req, res) => {
  const { sessionId, meetingId } = req.params;

  const row = db.prepare(`
    SELECT
      m.briefing,
      m.roles,
      m.key_nodes,
      m.ref_phrases,
      r.id AS review_id,
      r.title,
      r.title_emoji,
      r.title_subtext,
      r.role_feedback,
      r.achievement,
      r.improvement,
      r.nodes AS review_nodes
    FROM meetings m
    LEFT JOIN reviews r ON r.meeting_id = m.id
    WHERE m.id = ? AND m.session_id = ?
    ORDER BY r.created_at DESC
    LIMIT 1
  `).get(meetingId, sessionId);

  if (!row) {
    return res.status(404).json({ error: '记录不存在' });
  }

  return res.json({
    meetingId,
    briefing: JSON.parse(row.briefing || '{}'),
    roles: JSON.parse(row.roles || '[]'),
    keyNodes: JSON.parse(row.key_nodes || '[]'),
    references: JSON.parse(row.ref_phrases || '[]'),
    reviewId: row.review_id,
    title: row.title,
    titleEmoji: row.title_emoji,
    titleSubtext: row.title_subtext,
    roleFeedback: JSON.parse(row.role_feedback || 'null'),
    achievement: row.achievement,
    improvement: row.improvement,
    nodes: JSON.parse(row.review_nodes || '[]'),
  });
});

module.exports = router;
```

**注意**：reviews 表当前没有 `title_emoji`、`title_subtext`、`role_feedback` 字段（查看 db.js 第 79-83 行，只有 `achievement`、`improvement`、`nodes`）。需要 db migration 补充这三个字段，**或**将 title 等信息序列化进 achievement 字段（不推荐）。

**推荐方案：补充 schema migration**

```javascript
// db.js initSchema 中新增（ALTER TABLE 方案，IF NOT EXISTS 不直接支持列，需判断）
try {
  db.exec(`ALTER TABLE reviews ADD COLUMN title TEXT`);
  db.exec(`ALTER TABLE reviews ADD COLUMN title_emoji TEXT`);
  db.exec(`ALTER TABLE reviews ADD COLUMN title_subtext TEXT`);
  db.exec(`ALTER TABLE reviews ADD COLUMN role_feedback TEXT`);
} catch (e) {
  // 列已存在则忽略（better-sqlite3 对重复 ALTER 会抛出异常）
}
```

同时 review 路由的 INSERT 语句需补充这四个字段的写入。

### 3.9 首页入口设计

在 `Home.jsx` 的 ctaSection 中，老用户（`hasSession === true`）时额外显示：

```jsx
{hasSession && (
  <button
    className={styles.historyLink}
    onClick={() => navigate('/history')}
  >
    查看历史记录
  </button>
)}
```

样式：纯文字链接，`var(--text-muted)` 色，12px，与"修改我的信息"链接并排，不抢 CTA 按钮的视觉重心。

### 3.10 风险与注意事项

1. **reviews 表 schema 缺失字段**：现有 reviews INSERT 只写了 4 个字段，title/roleFeedback 存储在 review 路由的 JSON response 但没持久化入数据库。历史详情页需要这些字段，**必须同步修复 db schema 和 review 路由的 INSERT**，否则历史页展示的复盘内容不完整。这是已存在的数据丢失 bug，P0-3 推进时必须处理。
2. **单用户本地化**：当前 sessionId 存 localStorage，意味着换浏览器 / 清缓存后无法找回历史。P0 阶段可接受，后续版本再考虑账号体系。
3. **没有复盘的历史记录**：用户可能中途退出，导致 meeting 状态为 completed 但 reviews 表无数据。列表页需展示"暂无复盘"状态，详情页对应显示 review 为空的提示。

---

## P0-4：每日一练（NEW-01）

### 4.1 需求分析

目标：5 分钟内完成的轻量练习。与完整会议相比：
- 时长更短（完整会议约 10-15 分钟）
- 内容结构更简单（1-2 条 NPC 开场 + 1 个关键节点）
- 每天内容更新（避免重复练同一场）
- 有连续打卡激励

### 4.2 关键设计决策

**A. 后端：新建 `/api/daily` 路由，而非复用 `/api/meeting/generate`**

理由：
1. 每日一练需要特定 prompt（简短、1个节点、5分钟内结束）；直接复用 generate 需要在现有 prompt 里加分支，不够清晰
2. 每日内容要"每天更新但同一天内相同"，需要日期锁定逻辑，这个逻辑不属于普通的 generate 路由
3. 数据隔离：每日练习的数据不混入历史会议列表

**B. 前端：新建 `DailyPractice.jsx` 页面，不复用 `Meeting.jsx`**

理由：Meeting.jsx 已有较复杂的状态机（dialogue 播放、滚动、keyNode 处理等），复用需要通过 props/context 传入大量配置参数来"裁剪"行为。更简单的做法是：DailyPractice 只实现最核心的子集：1-2条NPC消息直接显示（无需逐条播放动效延迟）→ 显示关键节点提示 → 用户输入 → 显示简短反馈 → 结束。

**C. 打卡计数：localStorage + 服务端双写**

- localStorage 存储：`daily_streak`（连续天数）、`daily_last_date`（最后完成日期，格式 YYYY-MM-DD）
- 服务端记录：在 `daily_practice` 表中写入完成记录（用于未来数据分析 / 排行榜）
- 今日是否已完成：检查 `daily_last_date === today`，是则显示"今日已完成"

优先 localStorage 判断（无需请求 + 即时），服务端数据用于未来功能扩展。

**D. 每日内容更新：实时生成 + 日期种子缓存**

- 不做定时预生成（会占用后端资源，且 cron 部署复杂）
- 采用"日期种子"策略：同一 sessionId + 同一日期（YYYY-MM-DD），服务端优先查 `daily_practice` 表中当天是否已有生成记录；有则返回缓存，无则实时生成并缓存
- 好处：用户今天打开多次也是同一道题，且只消耗一次 AI token

### 4.3 数据库新增表

```sql
-- 每日练习表
CREATE TABLE IF NOT EXISTS daily_practice (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  date TEXT NOT NULL,           -- YYYY-MM-DD 格式，用于按天查缓存
  scenario TEXT,                -- 场景描述
  npc_dialogue TEXT,            -- NPC 开场消息（JSON 数组）
  key_node TEXT,                -- 单个关键节点（JSON）
  reference TEXT,               -- 参考说法（JSON）
  user_input TEXT,              -- 用户的发言（完成后写入）
  system_english TEXT,          -- 系统转换的英文（完成后写入）
  feedback TEXT,                -- AI 点评（完成后写入）
  status TEXT DEFAULT 'pending',-- pending / completed
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(session_id, date)      -- 每个用户每天只有一条记录
);
```

### 4.4 文件变更清单

**新增**

```
client/src/pages/DailyPractice.jsx      # 每日一练页面
client/src/pages/DailyPractice.module.css
server/routes/daily.js                  # 每日一练 API
server/prompts/generate-daily.js        # 每日练习 prompt
```

**修改**

```
client/src/App.jsx                      # 注册 /daily 路由
server/index.js                         # 挂载 daily 路由
server/db.js                            # 新增 daily_practice 表 schema
client/src/pages/Home.jsx               # 首页新增"每日一练"入口卡片
client/src/api/index.js                 # 新增 fetchDailyPractice()、submitDaily()
```

### 4.5 API 设计

**GET /api/daily/:sessionId**

获取今天的练习内容（无则实时生成并缓存）

```json
{
  "dailyId": "uuid",
  "date": "2026-03-31",
  "scenario": "Tech Team Standup",
  "npcDialogue": [
    { "speaker": "Alex", "text": "...", "textZh": "..." }
  ],
  "keyNode": {
    "index": 0,
    "prompt": "The PM is asking about your task status...",
    "type": "status_update"
  },
  "reference": { "nodeIndex": 0, "phrases": [...] },
  "alreadyCompleted": false
}
```

**POST /api/daily/:dailyId/submit**

提交用户发言，返回 AI 点评

请求体：`{ userInput, inputLanguage }`

```json
{
  "systemEnglish": "The feature is 80% complete...",
  "feedback": "Good job using 'on track'! Next time try...",
  "feedbackType": "good"  // good / ok / improve
}
```

### 4.6 数据流

```
首页（Home）
  → 用户点击"每日一练"卡片
  → navigate('/daily')

每日一练页面（DailyPractice）挂载
  → 检查 localStorage daily_last_date 是否 === 今日
    → 是（今日已完成）：显示"今日已打卡，明天见"状态 + 当前连续天数
    → 否：GET /api/daily/:sessionId
        → 服务端检查 daily_practice 表中 session_id + date 是否有缓存
          → 有：返回已生成内容
          → 无：调用 AI 生成轻量版会议 → 写入 daily_practice 表 → 返回

前端渲染流程（简化版 Meeting）：
  1. 直接展示 npcDialogue（无逐条动效，一次性渲染）
  2. 显示关键节点提示卡片（样式复用 NodePromptCard 逻辑）
  3. 用户输入（复用 UserInput 组件）
  4. 提交：POST /api/daily/:dailyId/submit
  5. 显示 AI 点评 + systemEnglish
  6. 显示"完成"按钮

用户点击"完成"：
  → 写入 localStorage: daily_last_date = 今日, daily_streak++
  → navigate('/') 或显示打卡庆祝动效
```

### 4.7 关键代码结构

**server/routes/daily.js**

```javascript
const express = require('express');
const router = express.Router();
const db = require('../db');
const { callOpenAIJson } = require('../services/openai');
const { generateDailyPrompt } = require('../prompts/generate-daily');

// GET /api/daily/:sessionId — 获取今日练习内容
router.get('/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);
  if (!session) {
    return res.status(404).json({ error: '会话不存在' });
  }

  // 查询今天是否已有缓存
  const existing = db.prepare(
    'SELECT * FROM daily_practice WHERE session_id = ? AND date = ?'
  ).get(sessionId, today);

  if (existing) {
    return res.json({
      dailyId: existing.id,
      date: today,
      scenario: existing.scenario,
      npcDialogue: JSON.parse(existing.npc_dialogue || '[]'),
      keyNode: JSON.parse(existing.key_node || '{}'),
      reference: JSON.parse(existing.reference || 'null'),
      alreadyCompleted: existing.status === 'completed',
    });
  }

  // 实时生成
  const { systemPrompt, userPrompt } = generateDailyPrompt({
    englishLevel: session.english_level,
    jobTitle: session.job_title,
    industry: session.industry,
    date: today, // 作为随机种子影响主题多样性
  });

  let dailyData;
  try {
    dailyData = await callOpenAIJson(
      [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
      { temperature: 0.9, maxTokens: 1500 }
    );
  } catch (err) {
    return res.status(502).json({ error: 'AI 生成失败，请稍后重试' });
  }

  const dailyId = crypto.randomUUID();
  db.prepare(`
    INSERT INTO daily_practice (id, session_id, date, scenario, npc_dialogue, key_node, reference, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
  `).run(
    dailyId, sessionId, today,
    dailyData.scenario,
    JSON.stringify(dailyData.npcDialogue || []),
    JSON.stringify(dailyData.keyNode || {}),
    JSON.stringify(dailyData.reference || null),
  );

  return res.status(201).json({
    dailyId,
    date: today,
    scenario: dailyData.scenario,
    npcDialogue: dailyData.npcDialogue,
    keyNode: dailyData.keyNode,
    reference: dailyData.reference,
    alreadyCompleted: false,
  });
});

// POST /api/daily/:dailyId/submit — 提交发言
router.post('/:dailyId/submit', async (req, res) => {
  const { dailyId } = req.params;
  const { userInput, inputLanguage } = req.body;

  const daily = db.prepare('SELECT * FROM daily_practice WHERE id = ?').get(dailyId);
  if (!daily) {
    return res.status(404).json({ error: '每日练习不存在' });
  }

  // 调用 AI 生成点评（prompt 简化，只关注单条发言质量）
  // ... (调用 AI, 省略细节)

  const systemEnglish = '...'; // AI 转换/优化后的英文
  const feedback = '...';
  const feedbackType = 'good'; // good / ok / improve

  // 写入完成记录
  db.prepare(`
    UPDATE daily_practice
    SET user_input = ?, system_english = ?, feedback = ?, status = 'completed'
    WHERE id = ?
  `).run(userInput, systemEnglish, feedback, dailyId);

  return res.json({ systemEnglish, feedback, feedbackType });
});

module.exports = router;
```

**server/prompts/generate-daily.js（prompt 结构）**

```javascript
function generateDailyPrompt({ englishLevel, jobTitle, industry, date }) {
  return {
    systemPrompt: `你是职场英文会议教练，生成一个 5 分钟内可完成的轻量级练习。
返回严格的 JSON 格式：
{
  "scenario": "场景标题（英文，如 Team Standup）",
  "npcDialogue": [
    { "speaker": "Name · Title", "text": "英文", "textZh": "中文翻译" },
    // 最多 2 条
  ],
  "keyNode": {
    "index": 0,
    "prompt": "情境化任务提示（中文）",
    "type": "status_update | opinion | clarification",
    "keyData": [{ "label": "...", "value": "..." }]  // 可选，最多 2 条
  },
  "reference": {
    "nodeIndex": 0,
    "phrases": [
      { "en": "...", "zh": "..." }  // 2-3 个参考说法
    ]
  }
}`,
    userPrompt: `用户英语等级：${englishLevel}，职位：${jobTitle}，行业：${industry}。
今日日期：${date}（用于生成多样化主题，每天不同）。
请生成一个适合该用户的轻量练习场景。`,
  };
}
```

**client/src/pages/DailyPractice.jsx 页面结构（简化）**

```
容器
  ├── 顶部导航（← 返回 + "每日一练" + 打卡连续天数徽章）
  ├── 场景卡片（scenario 标题 + 日期）
  ├── NPC 消息列表（一次性全部渲染，不逐条播放）
  ├── 关键节点卡片（复用 NodePromptCard 样式）
  ├── [用户输入区] 或 [点评区（提交后显示）]
  └── [完成按钮（点评后显示）]
```

**client/src/pages/Home.jsx 新增每日一练入口**

在 `phoneFrame` 和 `valueSection` 之间（或 ctaSection 上方），新增一张醒目的"每日一练"卡片：

```jsx
{hasSession && (
  <div
    className={`${styles.dailyCard} ${todayCompleted ? styles.dailyCardDone : ''}`}
    onClick={() => navigate('/daily')}
  >
    <span className={styles.dailyIcon}>{todayCompleted ? '✅' : '🔥'}</span>
    <div>
      <span className={styles.dailyTitle}>
        {todayCompleted ? '今日已打卡' : '今日一练'}
      </span>
      <span className={styles.dailyStreak}>
        连续 {streak} 天
      </span>
    </div>
    <span className={styles.dailyArrow}>→</span>
  </div>
)}
```

其中 `todayCompleted` 和 `streak` 从 localStorage 读取：

```javascript
const today = new Date().toISOString().slice(0, 10);
const lastDate = localStorage.getItem('daily_last_date');
const todayCompleted = lastDate === today;
const streak = parseInt(localStorage.getItem('daily_streak') || '0');
```

### 4.8 连续打卡计数逻辑

```javascript
// 完成每日一练后调用
function markDailyComplete() {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const lastDate = localStorage.getItem('daily_last_date');
  const currentStreak = parseInt(localStorage.getItem('daily_streak') || '0');

  let newStreak;
  if (lastDate === yesterday) {
    // 昨天完成了，连续天数 +1
    newStreak = currentStreak + 1;
  } else if (lastDate === today) {
    // 今天已经完成过，不重复计数
    newStreak = currentStreak;
  } else {
    // 断掉了，重新从 1 开始
    newStreak = 1;
  }

  localStorage.setItem('daily_last_date', today);
  localStorage.setItem('daily_streak', String(newStreak));
  return newStreak;
}
```

### 4.9 风险与注意事项

1. **AI 生成时间**：每日一练 GET 接口首次调用需等待 AI 生成（约 3-5 秒），需要加 loading 状态，避免用户感知空白。
2. **每日内容多样性**：使用日期作为 prompt 的一部分影响主题多样性（"用不同日期生成不同场景"），但不能保证严格不重复；可在 prompt 中加入"请避免以下已用过的场景类型"（读取 daily_practice 表近 7 天的 scenario）。
3. **打卡数据的可靠性**：localStorage 可被用户清除，打卡天数会丢失。P0 阶段可接受，告知用户"记录存储在本设备"。
4. **每日一练与完整会议的复盘**：每日一练完成后只有简短 AI 点评，没有完整的 ReviewNodes 复盘，不要引导用户去 `/review/nodes` 页面（那里依赖完整 meetingData）。
5. **UNIQUE(session_id, date) 约束**：确保同一用户同一天只生成一次内容，INSERT 冲突时服务端已先 SELECT 查缓存，不会触发约束错误。

---

## 总结：实施优先级与依赖关系

### 并行开发分组

**分组 A（无外部依赖，可立即开始）**

- P0-2 进度条：纯前端，改 Meeting.jsx + CSS，1 天内可完成

**分组 B（后端先行，前端跟进）**

- P0-1 PDF 解析：后端新增 upload 路由 → 前端改 SourceSelect。依赖 `pdf-parse` 和 `multer` 安装

**分组 C（依赖 schema migration，需谨慎）**

- P0-3 历史记录：需先修复 reviews 表 schema（补充 title/titleEmoji/titleSubtext/roleFeedback 字段），同步修改 review 路由的 INSERT，再开发历史路由和前端页面

**分组 D（独立新功能）**

- P0-4 每日一练：新增 daily 路由 + DailyPractice 页面，和现有流程无交叉，可并行开发

### 关键风险项（需在开发前确认）

1. **reviews 表字段缺失**（P0-3 前置条件）：`title`、`title_emoji`、`title_subtext`、`role_feedback` 四个字段在现有 review 路由中有返回但未持久化数据库，必须在 P0-3 开发前修复
2. **keyNodes 字段名一致性**（P0-2 实施风险）：开发前需通过 `console.log` 确认 `meetingData.keyNodes` 中节点用 `node.index` 还是 `node.nodeIndex`，确保进度条圆点与 `completedNodes` Set 中的值能正确匹配
3. **multer 与现有 express.json 的兼容**（P0-1）：multer 处理 multipart 请求，与现有 JSON 中间件互不干扰，但需确认路由挂载顺序正确

### 预估工作量

| 需求 | 后端 | 前端 | 合计 |
|------|------|------|------|
| P0-1 PDF 解析 | 1 天 | 0.5 天 | 1.5 天 |
| P0-2 进度条 | 0 | 0.5 天 | 0.5 天 |
| P0-3 历史记录 | 1.5 天（含 schema migration） | 1.5 天 | 3 天 |
| P0-4 每日一练 | 1.5 天 | 1.5 天 | 3 天 |
| **合计** | **4 天** | **4 天** | **8 天（并行约 4-5 天）** |

---

*文档路径：`meeting-simulator/docs/tech-spec/p0-tech-spec.md`*
