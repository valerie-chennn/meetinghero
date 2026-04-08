/**
 * Express 服务入口文件
 * 初始化应用、配置中间件、挂载路由
 */

// 加载环境变量（必须在其他模块之前）
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const express = require('express');
const cors = require('cors');
const path = require('path');

// 初始化数据库（触发 schema 创建）
require('./db');

// 导入路由
const speechRouter = require('./routes/speech');

const app = express();
const PORT = process.env.PORT || 3001;

// ==================== 中间件配置 ====================

// CORS 配置：允许前端开发服务器（Vite 默认 5173 端口）访问
app.use(cors({
  origin: [
    'http://localhost:5173',  // Vite 默认开发端口
    'http://localhost:3000',  // 备用端口
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3000',
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// 解析 JSON 请求体，限制 50mb（支持大内容上传）
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 请求日志中间件
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ==================== 路由挂载 ====================

app.use('/api/speech', speechRouter);

// ==================== v2 推流版路由 ====================
const v2UsersRouter = require('./routes/v2-users');
const v2FeedRouter = require('./routes/v2-feed');
const v2ChatRouter = require('./routes/v2-chat');
const v2ExpressionsRouter = require('./routes/v2-expressions');

app.use('/api/v2/users', v2UsersRouter);
app.use('/api/v2/feed', v2FeedRouter);
app.use('/api/v2/chat', v2ChatRouter);
app.use('/api/v2/expressions', v2ExpressionsRouter);

// ==================== 生产环境静态文件 ====================

// 生产环境下 serve 前端构建产物（client/dist）
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '../client/dist');
  app.use(express.static(distPath));
}

// ==================== 健康检查 ====================

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: {
      azureOpenAI: !!(process.env.AZURE_OPENAI_ENDPOINT && process.env.AZURE_OPENAI_API_KEY),
      azureSpeech: !!(process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION),
    },
  });
});

// ==================== 错误处理 ====================

// 404 处理：生产环境下非 API 路由返回 index.html（SPA fallback）
app.use((req, res) => {
  if (process.env.NODE_ENV === 'production' && !req.path.startsWith('/api') && !req.path.startsWith('/health')) {
    return res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  }
  res.status(404).json({ error: `路由 ${req.method} ${req.path} 不存在` });
});

// 全局错误处理中间件
app.use((err, req, res, next) => {
  console.error('[全局错误]', err.message, err.stack);
  res.status(500).json({ error: '服务器内部错误，请稍后重试' });
});

// ==================== 启动服务 ====================

app.listen(PORT, () => {
  console.log(`\n职场英文会议模拟器后端服务已启动`);
  console.log(`监听端口：${PORT}`);
  console.log(`健康检查：http://localhost:${PORT}/health`);
  console.log(`Azure OpenAI：${process.env.AZURE_OPENAI_ENDPOINT ? '已配置' : '未配置'}`);
  console.log(`Azure Speech：${process.env.AZURE_SPEECH_KEY ? '已配置' : '未配置'}\n`);
});

module.exports = app;
