/**
 * 诊断路由 —— 给前端用来远程上报 debug 日志
 * 核心用途：当 iPhone 真机出现问题但又没法远程调试 console 时，
 * 前端 fire-and-forget POST 到这里，后端 console.log 写出，
 * 开发者通过 `docker logs new-app-1 | grep DEBUG-CLIENT` 远程拿到数据。
 *
 * 这是一个临时诊断端点，线上跑的时候不会有性能问题
 * （远程日志是低频事件），但不要用来持续打大量 log
 */

const express = require('express');
const router = express.Router();

/**
 * POST /api/debug/log
 * Body: { event: string, data?: object, ua?: string, ts?: number }
 *
 * 响应：204 no content（快速返回，不阻塞前端）
 */
router.post('/log', (req, res) => {
  try {
    const { event, data, ua, ts } = req.body || {};
    // 截断太长的 UA 和 data，避免日志爆炸
    const safeUa = (ua || req.get('user-agent') || '?').slice(0, 120);
    const safeData = data ? JSON.stringify(data).slice(0, 500) : '';
    const clientTs = ts || '-';
    console.log(`[DEBUG-CLIENT] event=${event} ts=${clientTs} ua=${safeUa} data=${safeData}`);
  } catch (err) {
    console.warn('[DEBUG-CLIENT] 解析上报失败:', err.message);
  }
  // 永远快速返回，不影响前端主流程
  res.status(204).end();
});

module.exports = router;
