/**
 * Express 服务入口文件
 * 初始化应用、配置中间件、挂载路由
 */

// 加载环境变量（必须在其他模块之前）
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const express = require('express');
const cors = require('cors');

// 初始化数据库（触发 schema 创建）
require('./db');

// 导入路由
const onboardingRouter = require('./routes/onboarding');
const meetingRouter = require('./routes/meeting');
const reviewRouter = require('./routes/review');
const speechRouter = require('./routes/speech');
const uploadRouter = require('./routes/upload');
const historyRouter = require('./routes/history');
const brainstormRouter = require('./routes/brainstorm');

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

app.use('/api/onboarding', onboardingRouter);
app.use('/api/meeting', meetingRouter);
app.use('/api/review', reviewRouter);
app.use('/api/speech', speechRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/history', historyRouter);
app.use('/api/brainstorm', brainstormRouter);

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

// 404 处理
app.use((req, res) => {
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
