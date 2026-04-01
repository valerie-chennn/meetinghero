/**
 * 数据库初始化模块
 * 使用 better-sqlite3 初始化 SQLite 数据库并创建所需表结构
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// 确保 data 目录存在
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const DB_PATH = path.join(dataDir, 'meeting-simulator.db');

// 初始化数据库连接
const db = new Database(DB_PATH);

// 开启 WAL 模式提升并发性能
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

/**
 * 检查 sessions 表中 job_title 列是否有 NOT NULL 约束
 * 通过 PRAGMA table_info 查询列定义
 * @returns {boolean} true 表示需要迁移
 */
function needsMigration() {
  try {
    const columns = db.pragma('table_info(sessions)');
    const jobTitleCol = columns.find(col => col.name === 'job_title');
    // notnull=1 说明有 NOT NULL 约束，需要迁移
    return jobTitleCol && jobTitleCol.notnull === 1;
  } catch (e) {
    // 表不存在时不需要迁移
    return false;
  }
}

/**
 * 迁移 sessions 表：将 job_title 和 industry 从 NOT NULL 改为可空
 * SQLite 不支持 ALTER COLUMN，采用建新表→迁移数据→重命名的方式
 * 整个迁移包裹在事务中，失败时自动回滚
 */
function migrateSessionsTable() {
  console.log('[DB] 检测到 sessions 表需要迁移（job_title/industry NOT NULL → 可空）...');

  // 迁移前备份数据库文件
  const backupPath = DB_PATH + '.backup.' + Date.now();
  try {
    fs.copyFileSync(DB_PATH, backupPath);
    console.log(`[DB] 已备份数据库到：${backupPath}`);
  } catch (e) {
    console.warn('[DB] 备份失败（可能是新数据库），继续迁移：', e.message);
  }

  // SQLite PRAGMA 必须在事务外执行，先关闭外键约束
  db.pragma('foreign_keys = OFF');

  // 使用事务确保迁移操作的原子性
  const migrate = db.transaction(() => {
    // 1. 创建新表（job_title 和 industry 改为可空）
    db.exec(`
      CREATE TABLE sessions_new (
        id TEXT PRIMARY KEY,
        english_level TEXT NOT NULL,
        job_title TEXT DEFAULT NULL,
        industry TEXT DEFAULT NULL,
        user_name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 2. 迁移旧数据
    db.exec(`
      INSERT INTO sessions_new (id, english_level, job_title, industry, user_name, created_at)
      SELECT id, english_level, job_title, industry, user_name, created_at
      FROM sessions
    `);

    // 3. 删除旧表
    db.exec('DROP TABLE sessions');

    // 4. 重命名新表
    db.exec('ALTER TABLE sessions_new RENAME TO sessions');

    console.log('[DB] sessions 表迁移成功');
  });

  try {
    migrate();
  } catch (e) {
    console.error('[DB] sessions 表迁移失败，已回滚：', e.message);
    throw e;
  } finally {
    // 迁移完成后恢复外键约束
    db.pragma('foreign_keys = ON');
  }
}

/**
 * 初始化数据库表结构
 * 如果表已存在则跳过（IF NOT EXISTS）
 */
function initSchema() {
  // 如果 sessions 表已存在且有 NOT NULL 约束，先迁移
  if (needsMigration()) {
    migrateSessionsTable();
  }

  // 用户会话表：存储 onboarding 信息（job_title 和 industry 为可选）
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      english_level TEXT NOT NULL,
      job_title TEXT DEFAULT NULL,
      industry TEXT DEFAULT NULL,
      user_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 会议表：存储完整会议数据（JSON 序列化存储）
  db.exec(`
    CREATE TABLE IF NOT EXISTS meetings (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      source TEXT DEFAULT 'system',
      briefing TEXT,
      memo TEXT,
      roles TEXT,
      dialogue TEXT,
      key_nodes TEXT,
      ref_phrases TEXT,
      status TEXT DEFAULT 'created',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES sessions(id)
    )
  `);

  // 为 meetings 表添加 user_role 列（如果不存在）
  try {
    db.exec(`ALTER TABLE meetings ADD COLUMN user_role TEXT`);
  } catch (e) {
    // 列已存在则忽略
  }

  // 为 meetings 表添加脑洞模式相关列（如果不存在）
  const meetingNewCols = [
    `ALTER TABLE meetings ADD COLUMN scene_type TEXT DEFAULT 'formal'`,
    `ALTER TABLE meetings ADD COLUMN brainstorm_world TEXT`,
    `ALTER TABLE meetings ADD COLUMN brainstorm_characters TEXT`,
  ];
  meetingNewCols.forEach(sql => {
    try {
      db.exec(sql);
    } catch (e) {
      // 列已存在则忽略
    }
  });

  // 会话对话记录表：存储用户在关键节点的发言记录
  db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      meeting_id TEXT NOT NULL,
      node_index INTEGER,
      user_input TEXT,
      input_language TEXT,
      system_english TEXT,
      system_response TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (meeting_id) REFERENCES meetings(id)
    )
  `);

  // 复盘表：存储会后复盘内容
  db.exec(`
    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      meeting_id TEXT NOT NULL,
      achievement TEXT,
      improvement TEXT,
      nodes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (meeting_id) REFERENCES meetings(id)
    )
  `);

  console.log('数据库初始化完成，路径：', DB_PATH);
}

// 执行 schema 初始化
initSchema();

module.exports = db;
