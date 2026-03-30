/**
 * Onboarding 路由
 * 处理用户初始化信息，创建 session
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
 */
router.post('/', (req, res) => {
  try {
    // userName 为可选字段，不影响现有逻辑
    const { englishLevel, jobTitle, industry, userName } = req.body;

    // 校验英语等级
    if (!englishLevel || !VALID_LEVELS.includes(englishLevel)) {
      return res.status(400).json({
        error: '无效的英语等级，必须为 A1、A2、B1 或 B2',
        field: 'englishLevel',
      });
    }

    // 校验职位
    if (!isValidText(jobTitle)) {
      return res.status(400).json({
        error: '职位不能为空，至少 2 个字符，不能为纯数字或纯符号',
        field: 'jobTitle',
      });
    }

    // 校验行业
    if (!isValidText(industry)) {
      return res.status(400).json({
        error: '行业不能为空，至少 2 个字符，不能为纯数字或纯符号',
        field: 'industry',
      });
    }

    // 生成唯一 session ID
    const sessionId = crypto.randomUUID();

    // 写入数据库
    const stmt = db.prepare(
      'INSERT INTO sessions (id, english_level, job_title, industry) VALUES (?, ?, ?, ?)'
    );
    stmt.run(sessionId, englishLevel, jobTitle.trim(), industry.trim());

    console.log(`[Onboarding] 新建会话 sessionId=${sessionId}, level=${englishLevel}, jobTitle=${jobTitle}, userName=${userName || '（未提供）'}`);

    return res.status(201).json({ sessionId });
  } catch (err) {
    console.error('[Onboarding] 错误：', err.message);
    return res.status(500).json({ error: '服务器内部错误，请稍后重试' });
  }
});

module.exports = router;
