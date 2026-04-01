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
 * 初始化数据库表结构
 * 如果表已存在则跳过（IF NOT EXISTS）
 */
function initSchema() {
  // 用户会话表：存储 onboarding 信息
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      english_level TEXT NOT NULL,
      job_title TEXT NOT NULL,
      industry TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 为 sessions 表添加 user_name 列（如果不存在）
  try {
    db.exec(`ALTER TABLE sessions ADD COLUMN user_name TEXT`);
  } catch (e) {
    // 列已存在则忽略
  }

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
