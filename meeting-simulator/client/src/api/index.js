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
 * 创建用户会话
 * @param {Object} data - { englishLevel, jobTitle, industry }
 * @returns {Object} { sessionId }
 */
export async function createSession(data) {
  return request('/onboarding', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * 生成会议
 * @param {string} sessionId - 会话 ID
 * @param {string} source - 来源类型：'generate' | 'upload'
 * @param {string} [uploadContent] - 上传的会议资料内容（source 为 upload 时使用）
 * @returns {Object} 完整的会议数据
 */
export async function generateMeeting(sessionId, source, uploadContent) {
  return request('/meeting/generate', {
    method: 'POST',
    body: JSON.stringify({ sessionId, source, uploadContent }),
  });
}

/**
 * 用户在关键节点发言
 * @param {string} meetingId - 会议 ID
 * @param {number} nodeIndex - 节点索引
 * @param {string} userInput - 用户输入的文字
 * @param {string} inputLanguage - 输入语言：'en' | 'zh'
 * @returns {Object} { followUp: [...], nextNodeIndex }
 */
export async function respondToNode(meetingId, nodeIndex, userInput, inputLanguage) {
  return request('/meeting/respond', {
    method: 'POST',
    body: JSON.stringify({ meetingId, nodeIndex, userInput, inputLanguage }),
  });
}

/**
 * 完成会议
 * @param {string} meetingId - 会议 ID
 * @returns {Object} { success }
 */
export async function completeMeeting(meetingId) {
  return request('/meeting/complete', {
    method: 'POST',
    body: JSON.stringify({ meetingId }),
  });
}

/**
 * 生成复盘数据
 * @param {string} meetingId - 会议 ID
 * @returns {Object} 复盘数据
 */
export async function generateReview(meetingId) {
  return request('/review/generate', {
    method: 'POST',
    body: JSON.stringify({ meetingId }),
  });
}

/**
 * 提交复盘练习
 * @param {string} meetingId - 会议 ID
 * @param {number} nodeIndex - 节点索引
 * @param {string} userInput - 用户练习的文字
 * @returns {Object} { feedback }
 */
export async function submitPractice(meetingId, nodeIndex, userInput) {
  return request('/review/practice', {
    method: 'POST',
    body: JSON.stringify({ meetingId, nodeIndex, userInput }),
  });
}

/**
 * 文字转语音
 * @param {string} text - 要转换的文字
 * @param {string} language - 语言：'en' | 'zh'
 * @returns {Blob} 音频 Blob
 */
export async function textToSpeech(text, language = 'en') {
  const response = await fetch(`${API_BASE}/speech/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, language }),
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
