/**
 * MySQL 数据库初始化模块
 * 负责连接池、建库建表、增量补列，以及统一查询辅助方法
 */

const mysql = require('mysql2/promise');
const { seedRooms } = require('./data/seed-rooms');

const MYSQL_HOST = process.env.MYSQL_HOST || '127.0.0.1';
const MYSQL_PORT = parseInt(process.env.MYSQL_PORT || '3306', 10);
const MYSQL_USER = process.env.MYSQL_USER || 'root';
const MYSQL_PASSWORD = process.env.MYSQL_PASSWORD || '';
const MYSQL_DATABASE = process.env.MYSQL_DATABASE || 'meetinghero';
const MYSQL_CONNECTION_LIMIT = parseInt(process.env.MYSQL_CONNECTION_LIMIT || '10', 10);

let pool = null;
let initPromise = null;

function quoteIdentifier(identifier) {
  return `\`${String(identifier).replace(/`/g, '``')}\``;
}

function getBaseConnectionConfig() {
  return {
    host: MYSQL_HOST,
    port: MYSQL_PORT,
    user: MYSQL_USER,
    password: MYSQL_PASSWORD,
    charset: 'utf8mb4',
  };
}

async function createDatabaseIfNeeded() {
  const connection = await mysql.createConnection(getBaseConnectionConfig());

  try {
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS ${quoteIdentifier(MYSQL_DATABASE)} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
  } finally {
    await connection.end();
  }
}

function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      ...getBaseConnectionConfig(),
      database: MYSQL_DATABASE,
      waitForConnections: true,
      connectionLimit: MYSQL_CONNECTION_LIMIT,
      queueLimit: 0,
      timezone: 'Z',
    });
  }

  return pool;
}

async function rawQueryAll(sql, params = [], connection = null) {
  const executor = connection || getPool();
  const [rows] = await executor.query(sql, params);
  return rows;
}

async function rawQueryOne(sql, params = [], connection = null) {
  const rows = await rawQueryAll(sql, params, connection);
  return rows[0] || null;
}

async function rawExecute(sql, params = [], connection = null) {
  const executor = connection || getPool();
  const [result] = await executor.execute(sql, params);

  return {
    insertId: result.insertId,
    affectedRows: result.affectedRows,
    changedRows: result.changedRows,
    warningStatus: result.warningStatus,
  };
}

async function queryAll(sql, params = [], connection = null) {
  await init();
  return rawQueryAll(sql, params, connection);
}

async function queryOne(sql, params = [], connection = null) {
  await init();
  return rawQueryOne(sql, params, connection);
}

async function execute(sql, params = [], connection = null) {
  await init();
  return rawExecute(sql, params, connection);
}

async function transaction(work) {
  await init();
  const connection = await getPool().getConnection();

  const tx = {
    queryAll(sql, params = []) {
      return rawQueryAll(sql, params, connection);
    },
    queryOne(sql, params = []) {
      return rawQueryOne(sql, params, connection);
    },
    execute(sql, params = []) {
      return rawExecute(sql, params, connection);
    },
  };

  try {
    await connection.beginTransaction();
    const result = await work(tx);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function ensureColumnExists(tableName, columnName, definitionSql) {
  const existing = await rawQueryOne(
    `
      SELECT COLUMN_NAME
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?
    `,
    [MYSQL_DATABASE, tableName, columnName]
  );

  if (!existing) {
    await rawQueryAll(`ALTER TABLE ${quoteIdentifier(tableName)} ADD COLUMN ${definitionSql}`);
  }
}

async function ensureIndexExists(tableName, indexName, createSql) {
  const existing = await rawQueryOne(
    `
      SELECT INDEX_NAME
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = ?
    `,
    [MYSQL_DATABASE, tableName, indexName]
  );

  if (!existing) {
    await rawQueryAll(createSql);
  }
}

async function ensureSchema() {
  await rawQueryAll(`
    CREATE TABLE IF NOT EXISTS sessions (
      id VARCHAR(191) PRIMARY KEY,
      english_level VARCHAR(64) NOT NULL,
      job_title VARCHAR(255) DEFAULT NULL,
      industry VARCHAR(255) DEFAULT NULL,
      user_name VARCHAR(255) DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await rawQueryAll(`
    CREATE TABLE IF NOT EXISTS meetings (
      id VARCHAR(191) PRIMARY KEY,
      session_id VARCHAR(191) NOT NULL,
      source VARCHAR(64) DEFAULT 'system',
      briefing LONGTEXT,
      memo LONGTEXT,
      roles LONGTEXT,
      dialogue LONGTEXT,
      key_nodes LONGTEXT,
      ref_phrases LONGTEXT,
      status VARCHAR(64) DEFAULT 'created',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_meetings_session FOREIGN KEY (session_id) REFERENCES sessions(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await ensureColumnExists('meetings', 'user_role', 'user_role TEXT');
  await ensureColumnExists('meetings', 'scene_type', "scene_type VARCHAR(64) DEFAULT 'formal'");
  await ensureColumnExists('meetings', 'brainstorm_world', 'brainstorm_world LONGTEXT');
  await ensureColumnExists('meetings', 'brainstorm_characters', 'brainstorm_characters LONGTEXT');

  await rawQueryAll(`
    CREATE TABLE IF NOT EXISTS conversations (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      meeting_id VARCHAR(191) NOT NULL,
      node_index INT,
      user_input LONGTEXT,
      input_language VARCHAR(64),
      system_english LONGTEXT,
      system_response LONGTEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_conversations_meeting FOREIGN KEY (meeting_id) REFERENCES meetings(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await rawQueryAll(`
    CREATE TABLE IF NOT EXISTS reviews (
      id VARCHAR(191) PRIMARY KEY,
      meeting_id VARCHAR(191) NOT NULL,
      achievement LONGTEXT,
      improvement LONGTEXT,
      nodes LONGTEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_reviews_meeting FOREIGN KEY (meeting_id) REFERENCES meetings(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await rawQueryAll(`
    CREATE TABLE IF NOT EXISTS v2_users (
      id VARCHAR(191) PRIMARY KEY,
      nickname VARCHAR(255) DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await rawQueryAll(`
    CREATE TABLE IF NOT EXISTS v2_rooms (
      id VARCHAR(191) PRIMARY KEY,
      news_title TEXT NOT NULL,
      npc_a_name VARCHAR(255) NOT NULL,
      npc_a_reaction TEXT NOT NULL,
      npc_b_name VARCHAR(255) NOT NULL,
      npc_b_reaction TEXT NOT NULL,
      news_title_en TEXT,
      npc_a_reaction_en TEXT,
      npc_b_reaction_en TEXT,
      group_name VARCHAR(255) NOT NULL,
      group_notice TEXT,
      user_role_name VARCHAR(255) NOT NULL,
      user_role_desc TEXT,
      npc_profiles LONGTEXT NOT NULL,
      dialogue_script LONGTEXT NOT NULL,
      settlement_template LONGTEXT NOT NULL,
      tags LONGTEXT,
      difficulty VARCHAR(32) DEFAULT 'A2',
      is_active TINYINT(1) DEFAULT 1,
      sort_order INT DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await ensureColumnExists('v2_rooms', 'bg_color', "bg_color VARCHAR(32) DEFAULT '#1a1028'");
  await ensureColumnExists('v2_rooms', 'header_bg', 'header_bg VARCHAR(32)');
  await ensureColumnExists('v2_rooms', 'header_text', 'header_text VARCHAR(32)');
  await ensureColumnExists('v2_rooms', 'accent_color', 'accent_color VARCHAR(32)');
  await ensureColumnExists('v2_rooms', 'accent_dark', 'accent_dark VARCHAR(32)');
  await ensureColumnExists('v2_rooms', 'cover_image', 'cover_image TEXT');
  await ensureColumnExists('v2_rooms', 'likes', 'likes INT DEFAULT 0');
  await ensureColumnExists('v2_rooms', 'comment_count', 'comment_count INT DEFAULT 0');
  await ensureColumnExists('v2_rooms', 'user_role_name_en', 'user_role_name_en VARCHAR(255)');

  await rawQueryAll(`
    CREATE TABLE IF NOT EXISTS v2_feed_items (
      id VARCHAR(191) PRIMARY KEY,
      room_id VARCHAR(191) NOT NULL,
      sort_order INT DEFAULT 0,
      is_visible TINYINT(1) DEFAULT 1,
      UNIQUE KEY uk_v2_feed_items_room_id (room_id),
      CONSTRAINT fk_v2_feed_items_room FOREIGN KEY (room_id) REFERENCES v2_rooms(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await rawQueryAll(`
    CREATE TABLE IF NOT EXISTS v2_chat_sessions (
      id VARCHAR(191) PRIMARY KEY,
      user_id VARCHAR(191) NOT NULL,
      room_id VARCHAR(191) NOT NULL,
      status VARCHAR(64) DEFAULT 'active',
      user_turn_count INT DEFAULT 0,
      npc_turn_count INT DEFAULT 0,
      dm_sent_count INT DEFAULT 0,
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME DEFAULT NULL,
      CONSTRAINT fk_v2_chat_sessions_user FOREIGN KEY (user_id) REFERENCES v2_users(id),
      CONSTRAINT fk_v2_chat_sessions_room FOREIGN KEY (room_id) REFERENCES v2_rooms(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await ensureColumnExists('v2_chat_sessions', 'absurd_attributes', 'absurd_attributes LONGTEXT');
  await ensureColumnExists('v2_chat_sessions', 'settlement_newsletter', 'settlement_newsletter LONGTEXT');

  await rawQueryAll(`
    CREATE TABLE IF NOT EXISTS v2_user_messages (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      chat_session_id VARCHAR(191) NOT NULL,
      turn_index INT NOT NULL,
      user_input LONGTEXT NOT NULL,
      better_version LONGTEXT,
      context_note LONGTEXT,
      npc_reply LONGTEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_v2_user_messages_session FOREIGN KEY (chat_session_id) REFERENCES v2_chat_sessions(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await rawQueryAll(`
    CREATE TABLE IF NOT EXISTS v2_expression_cards (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      user_id VARCHAR(191) NOT NULL,
      chat_session_id VARCHAR(191) NOT NULL,
      turn_index INT NOT NULL,
      user_said LONGTEXT NOT NULL,
      better_version LONGTEXT NOT NULL,
      context_note LONGTEXT,
      is_saved TINYINT(1) DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_v2_expression_cards_user FOREIGN KEY (user_id) REFERENCES v2_users(id),
      CONSTRAINT fk_v2_expression_cards_session FOREIGN KEY (chat_session_id) REFERENCES v2_chat_sessions(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await ensureColumnExists('v2_expression_cards', 'is_practiced', 'is_practiced TINYINT(1) DEFAULT 0');
  await ensureColumnExists('v2_expression_cards', 'feedback_type', 'feedback_type VARCHAR(255)');
  await ensureColumnExists('v2_expression_cards', 'highlighted_phrases', 'highlighted_phrases LONGTEXT');
  await ensureColumnExists('v2_expression_cards', 'explanation', 'explanation LONGTEXT');
  await ensureColumnExists('v2_expression_cards', 'is_featured', 'is_featured TINYINT(1) DEFAULT 0');
  await ensureColumnExists('v2_expression_cards', 'intent_analysis', 'intent_analysis LONGTEXT');
  await ensureColumnExists('v2_expression_cards', 'learning_type', 'learning_type VARCHAR(64)');
  await ensureColumnExists('v2_expression_cards', 'pattern', 'pattern LONGTEXT');
  await ensureColumnExists('v2_expression_cards', 'collocations_json', 'collocations_json LONGTEXT');

  await ensureIndexExists(
    'v2_chat_sessions',
    'idx_v2_chat_sessions_user',
    'CREATE INDEX idx_v2_chat_sessions_user ON v2_chat_sessions(user_id)'
  );
  await ensureIndexExists(
    'v2_chat_sessions',
    'idx_v2_chat_sessions_room',
    'CREATE INDEX idx_v2_chat_sessions_room ON v2_chat_sessions(room_id)'
  );
  await ensureIndexExists(
    'v2_expression_cards',
    'idx_v2_expression_cards_user',
    'CREATE INDEX idx_v2_expression_cards_user ON v2_expression_cards(user_id, is_saved)'
  );

  await seedRooms({
    execute: rawExecute,
  });
}

async function init() {
  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    await createDatabaseIfNeeded();
    getPool();
    await ensureSchema();

    console.log(
      `MySQL 数据库初始化完成：${MYSQL_USER}@${MYSQL_HOST}:${MYSQL_PORT}/${MYSQL_DATABASE}`
    );
  })().catch((error) => {
    initPromise = null;
    if (pool) {
      pool.end().catch(() => {});
      pool = null;
    }
    throw error;
  });

  return initPromise;
}

async function close() {
  if (pool) {
    const closingPool = pool;
    pool = null;
    initPromise = null;
    await closingPool.end();
  }
}

module.exports = {
  init,
  close,
  queryAll,
  queryOne,
  execute,
  transaction,
  config: {
    host: MYSQL_HOST,
    port: MYSQL_PORT,
    user: MYSQL_USER,
    database: MYSQL_DATABASE,
    connectionLimit: MYSQL_CONNECTION_LIMIT,
  },
};
