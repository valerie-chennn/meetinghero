/**
 * Onboarding 路由
 * 处理用户初始化信息，创建 session
 * 脑洞模式支持：job_title 和 industry 改为可选字段
 */

const express = require('express');
const router = express.Router();
const db = require('../db');

// 有效的英语等级
const VALID_LEVELS = ['A1', 'A2', 'B1', 'B2'];

/**
 * 校验字符串是否为有效的文本内容（非纯数字、非纯符号）
 * @param {string} str
 * @returns {boolean}
 */
function isValidText(str) {
  if (!str || typeof str !== 'string') return false;
  const trimmed = str.trim();
  if (trimmed.length < 2) return false;
  // 不允许纯数字
  if (/^\d+$/.test(trimmed)) return false;
  // 不允许纯符号（只包含非字母数字汉字的字符）
  if (/^[^\w\u4e00-\u9fa5]+$/.test(trimmed)) return false;
  return true;
}

/**
 * POST /api/onboarding
 * 接收用户 onboarding 信息，创建会话
 * 脑洞模式下 jobTitle 和 industry 可为空（2 步 onboarding）
 * 正经开会用户也可以先不填，后续通过 update-work-info 补充
 */
router.post('/', (req, res) => {
  try {
    // userName 为必填，jobTitle/industry 改为可选
    const { englishLevel, jobTitle, industry, userName } = req.body;

    // 校验英语等级（必填）
    if (!englishLevel || !VALID_LEVELS.includes(englishLevel)) {
      return res.status(400).json({
        error: '无效的英语等级，必须为 A1、A2、B1 或 B2',
        field: 'englishLevel',
      });
    }

    // 职位和行业改为可选：传入时才校验格式
    if (jobTitle !== undefined && jobTitle !== null && jobTitle !== '') {
      if (!isValidText(jobTitle)) {
        return res.status(400).json({
          error: '职位格式无效，至少 2 个字符，不能为纯数字或纯符号',
          field: 'jobTitle',
        });
      }
    }

    if (industry !== undefined && industry !== null && industry !== '') {
      if (!isValidText(industry)) {
        return res.status(400).json({
          error: '行业格式无效，至少 2 个字符，不能为纯数字或纯符号',
          field: 'industry',
        });
      }
    }

    // 生成唯一 session ID
    const sessionId = crypto.randomUUID();

    // 写入数据库（job_title 和 industry 可为 null）
    const stmt = db.prepare(
      'INSERT INTO sessions (id, english_level, job_title, industry, user_name) VALUES (?, ?, ?, ?, ?)'
    );
    stmt.run(
      sessionId,
      englishLevel,
      jobTitle ? jobTitle.trim() : null,
      industry ? industry.trim() : null,
      userName ? userName.trim() : null
    );

    console.log(`[Onboarding] 新建会话 sessionId=${sessionId}, level=${englishLevel}, jobTitle=${jobTitle || '（未提供）'}, userName=${userName || '（未提供）'}`);

    return res.status(201).json({ sessionId });
  } catch (err) {
    console.error('[Onboarding] 错误：', err.message);
    return res.status(500).json({ error: '服务器内部错误，请稍后重试' });
  }
});

/**
 * POST /api/onboarding/update-work-info
 * 正经开会补充信息：已有 sessionId 的用户补填职位和行业
 * 用于首页选择"正经开会"后发现 job_title/industry 为空的场景
 */
router.post('/update-work-info', (req, res) => {
  try {
    const { sessionId, jobTitle, industry } = req.body;

    // 参数校验
    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId 不能为空' });
    }

    if (!isValidText(jobTitle)) {
      return res.status(400).json({
        error: '职位不能为空，至少 2 个字符，不能为纯数字或纯符号',
        field: 'jobTitle',
      });
    }

    if (!isValidText(industry)) {
      return res.status(400).json({
        error: '行业不能为空，至少 2 个字符，不能为纯数字或纯符号',
        field: 'industry',
      });
    }

    // 校验 session 是否存在
    const session = db.prepare('SELECT id FROM sessions WHERE id = ?').get(sessionId);
    if (!session) {
      return res.status(404).json({ error: '会话不存在，请重新完成 onboarding' });
    }

    // 更新职位和行业
    db.prepare('UPDATE sessions SET job_title = ?, industry = ? WHERE id = ?').run(
      jobTitle.trim(),
      industry.trim(),
      sessionId
    );

    console.log(`[Onboarding/UpdateWorkInfo] sessionId=${sessionId}, jobTitle=${jobTitle}, industry=${industry}`);

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[Onboarding/UpdateWorkInfo] 错误：', err.message);
    return res.status(500).json({ error: '服务器内部错误，请稍后重试' });
  }
});

/**
 * POST /api/onboarding/update-english-level
 * 更新已有用户的英语等级
 * 用于首页等级切换入口
 */
router.post('/update-english-level', (req, res) => {
  try {
    const { sessionId, englishLevel } = req.body;

    // 参数校验
    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId 不能为空' });
    }

    if (!englishLevel || !VALID_LEVELS.includes(englishLevel)) {
      return res.status(400).json({
        error: '无效的英语等级，必须为 A1、A2、B1 或 B2',
        field: 'englishLevel',
      });
    }

    // 校验 session 是否存在
    const session = db.prepare('SELECT id FROM sessions WHERE id = ?').get(sessionId);
    if (!session) {
      return res.status(404).json({ error: '会话不存在，请重新完成 onboarding' });
    }

    // 更新英语等级
    db.prepare('UPDATE sessions SET english_level = ? WHERE id = ?').run(
      englishLevel,
      sessionId
    );

    console.log(`[Onboarding/UpdateEnglishLevel] sessionId=${sessionId}, englishLevel=${englishLevel}`);

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[Onboarding/UpdateEnglishLevel] 错误：', err.message);
    return res.status(500).json({ error: '服务器内部错误，请稍后重试' });
  }
});

module.exports = router;
