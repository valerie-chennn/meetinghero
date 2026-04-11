/**
 * Express 服务入口文件
 * 初始化应用、配置中间件、挂载路由
 */

// 加载环境变量（必须在其他模块之前）
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const express = require('express');
const cors = require('cors');
const path = require('path');

const db = require('./db');

// 导入路由
const speechRouter = require('./routes/speech');

const PORT = process.env.PORT || 3001;

function getAllowedOrigins() {
  const configuredOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);

  if (configuredOrigins.length > 0) {
    return configuredOrigins;
  }

  return [
    'http://localhost:8081',
    'http://127.0.0.1:8081',
    'http://localhost:3001',
    'http://127.0.0.1:3001',
  ];
}

function createApp() {
  const app = express();

  // ==================== 中间件配置 ====================

  // 原生 App 不依赖 CORS，这里只为浏览器调试和局域网开发保留白名单。
  const allowedOrigins = getAllowedOrigins();
  app.use(cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`CORS 不允许的来源：${origin}`));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  }));

  // 解析 JSON 请求体，限制 50mb（支持大内容上传）
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  const coversDir = process.env.COVERS_DIR || path.join(__dirname, '../client/public/images/covers');
  app.use('/images/covers', express.static(coversDir));

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
  const v2AdminRouter = require('./routes/v2-admin');

  app.use('/api/v2/users', v2UsersRouter);
  app.use('/api/v2/feed', v2FeedRouter);
  app.use('/api/v2/chat', v2ChatRouter);
  app.use('/api/v2/expressions', v2ExpressionsRouter);
  app.use('/api/v2/admin', v2AdminRouter);

  // ==================== 健康检查 ====================

  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      env: {
        mysql: !!(process.env.MYSQL_HOST && process.env.MYSQL_USER && process.env.MYSQL_DATABASE),
        azureOpenAI: !!(process.env.AZURE_OPENAI_ENDPOINT && process.env.AZURE_OPENAI_API_KEY),
        azureSpeech: !!(process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION),
      },
    });
  });

  // ==================== 错误处理 ====================

  app.use((req, res) => {
    res.status(404).json({ error: `路由 ${req.method} ${req.path} 不存在` });
  });

  // 全局错误处理中间件
  app.use((err, req, res, next) => {
    console.error('[全局错误]', err.message, err.stack);
    if (err.message?.startsWith('CORS 不允许')) {
      return res.status(403).json({ error: err.message });
    }
    return res.status(500).json({ error: '服务器内部错误，请稍后重试' });
  });

  return app;
}

async function startServer(port = PORT) {
  await db.init();
  const app = createApp();

  return app.listen(port, () => {
    console.log('\nMeetingHero API 服务已启动');
    console.log(`监听端口：${port}`);
    console.log(`健康检查：http://localhost:${port}/health`);
    console.log(`MySQL：${db.config.user}@${db.config.host}:${db.config.port}/${db.config.database}`);
    console.log(`Azure OpenAI：${process.env.AZURE_OPENAI_ENDPOINT ? '已配置' : '未配置'}`);
    console.log(`Azure Speech：${process.env.AZURE_SPEECH_KEY ? '已配置' : '未配置'}`);
    console.log(`CORS 白名单：${getAllowedOrigins().join(', ') || '未配置'}\n`);
  });
}

if (require.main === module) {
  startServer().catch((error) => {
    console.error('[启动失败]', error.message);
    process.exit(1);
  });
}

module.exports = {
  createApp,
  startServer,
};
