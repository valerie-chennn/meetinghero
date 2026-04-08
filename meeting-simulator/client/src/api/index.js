// API 调用封装
// 由于 Vite 配置了代理，直接使用 /api 路径
const API_BASE = '/api';

// 通用请求函数，统一错误处理
async function request(url, options = {}) {
  const response = await fetch(`${API_BASE}${url}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: '请求失败' }));
    const error = new Error(errorData.message || `HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }

  return response.json();
}

/**
 * 文字转语音
 * @param {string} text - 要转换的文字
 * @param {string} language - 语言：'en' | 'zh'
 * @param {string} [voiceId] - ElevenLabs 音色 ID（传入时优先使用 ElevenLabs）
 * @returns {Blob} 音频 Blob
 */
export async function textToSpeech(text, language = 'en', voiceId) {
  const response = await fetch(`${API_BASE}/speech/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, language, ...(voiceId ? { voiceId } : {}) }),
  });

  if (response.status === 501) {
    // 后端未配置 TTS，返回 null 表示使用 fallback
    return null;
  }

  if (!response.ok) {
    throw new Error('TTS 请求失败');
  }

  return response.blob();
}

// ===== 推流版 v2 接口 =====

/**
 * 初始化用户（首次访问或更新花名）
 * @param {string} userId - 前端生成的 uuid
 * @param {string} nickname - 用户花名
 */
export const initUser = (userId, nickname) =>
  request('/v2/users/init', { method: 'POST', body: JSON.stringify({ userId, nickname }) });

/**
 * 获取 Feed 列表
 * @param {number} page - 页码（默认 1）
 * @param {number} pageSize - 每页数量（默认 10）
 */
export const getFeedList = (page = 1, pageSize = 10) =>
  request(`/v2/feed?page=${page}&pageSize=${pageSize}`);

/**
 * 加入群聊，创建新 chat session
 * @param {string} userId - 用户 ID
 * @param {string} roomId - 房间 ID
 */
export const joinChat = (userId, roomId) =>
  request('/v2/chat/join', { method: 'POST', body: JSON.stringify({ userId, roomId }) });

/**
 * 用户发言，获取 NPC 回复
 * @param {string} chatSessionId - 群聊会话 ID
 * @param {number} turnIndex - 第几次发言（1/2/3）
 * @param {string} userInput - 用户原文
 */
export const respondChat = (chatSessionId, turnIndex, userInput) =>
  request('/v2/chat/respond', { method: 'POST', body: JSON.stringify({ chatSessionId, turnIndex, userInput }) });

/**
 * 完成群聊，触发结算
 * @param {string} chatSessionId - 群聊会话 ID
 * @param {boolean} force - 是否强制完成（发言不足 3 次时可用）
 */
export const completeChat = (chatSessionId, force = false) =>
  request('/v2/chat/complete', { method: 'POST', body: JSON.stringify({ chatSessionId, force }) });

/**
 * 获取结算数据
 * @param {string} chatSessionId - 群聊会话 ID
 */
export const getSettlement = (chatSessionId) =>
  request(`/v2/chat/${chatSessionId}/settlement`);

/**
 * 动态生成💡参考说法
 * 读 NPC 最近一条 @用户消息，AI 生成一句符合用户水平的英文回应
 * @param {string} chatSessionId
 * @returns {Promise<{ hint: string }>}
 */
export const generateHint = (chatSessionId) =>
  request(`/v2/chat/${chatSessionId}/generate-hint`, { method: 'POST', body: JSON.stringify({}) });

/**
 * 获取已收藏的表达本列表
 * @param {string} userId - 用户 ID
 */
export const getExpressions = (userId) =>
  request(`/v2/expressions?userId=${userId}`);

/**
 * 收藏表达卡片
 * @param {number} id - 表达卡片 ID
 * @param {string} userId - 用户 ID
 */
export const saveExpression = (id, userId) =>
  request(`/v2/expressions/${id}/save`, { method: 'POST', body: JSON.stringify({ userId }) });

/**
 * 取消收藏表达卡片
 * @param {number} id - 表达卡片 ID
 * @param {string} userId - 用户 ID
 */
export const deleteExpression = (id, userId) =>
  request(`/v2/expressions/${id}`, { method: 'DELETE', body: JSON.stringify({ userId }) });

/**
 * 获取 NPC 私信 Banner
 * @param {string} chatSessionId - 群聊会话 ID
 */
export const getDmBanner = (chatSessionId) =>
  request(`/v2/chat/${chatSessionId}/dm-banner`);

/**
 * 获取用户统计数据
 * @param {string} userId
 * @returns {Object} { chatCount, messageCount, savedCount }
 */
export const getUserStats = (userId) =>
  request(`/v2/users/${userId}/stats`);

/**
 * 标记表达卡片为已练习
 * @param {number} id - 卡片 ID
 * @param {string} userId
 */
export const practiceExpression = (id, userId) =>
  request(`/v2/expressions/${id}/practice`, { method: 'POST', body: JSON.stringify({ userId }) });

/**
 * 语音转文字
 * @param {Blob} audioBlob - 录音 Blob
 * @returns {Object} { text, language }
 */
export async function speechToText(audioBlob) {
  const formData = new FormData();
  formData.append('audio', audioBlob, 'recording.webm');

  const response = await fetch(`${API_BASE}/speech/stt`, {
    method: 'POST',
    body: formData,
  });

  if (response.status === 501) {
    // 后端未配置 STT，返回 null 表示使用 fallback
    return null;
  }

  if (!response.ok) {
    throw new Error('STT 请求失败');
  }

  return response.json();
}
