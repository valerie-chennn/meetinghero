/**
 * 语音服务封装
 * 提供文字转语音（TTS）和语音转文字（STT）功能
 * TTS 在传入 voiceId 时优先使用 ElevenLabs，否则使用 Azure
 * STT 使用 Azure Whisper
 */

/**
 * 检查 ElevenLabs TTS 服务是否已配置
 * @returns {boolean}
 */
function isElevenLabsConfigured() {
  return !!process.env.ELEVENLABS_API_KEY;
}

const ELEVENLABS_MAX_ATTEMPTS = 2;
const ELEVENLABS_RETRY_DELAY_MS = 400;

function createSpeechError(message, extra = {}) {
  const error = new Error(message);
  Object.assign(error, extra);
  return error;
}

function waitMs(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function normalizeAudioMeta({ mimeType, originalName } = {}) {
  const defaultExtension = 'webm';
  const hasNamedExtension = typeof originalName === 'string' && originalName.includes('.');
  const rawExtension = hasNamedExtension ? originalName.split('.').pop()?.toLowerCase() : null;
  const extensionFromMime = mimeType?.split('/').pop()?.toLowerCase();

  let extension = rawExtension || extensionFromMime || defaultExtension;
  if (extension === 'mpeg') extension = 'mp3';
  if (extension === 'x-m4a') extension = 'm4a';

  const normalizedMime = mimeType || `audio/${extension}`;
  return {
    filename: `audio.${extension}`,
    mimeType: normalizedMime,
  };
}

/**
 * 调用 ElevenLabs REST API 生成音频数据
 * @param {string} text - 要转换的文本
 * @param {string} voiceId - ElevenLabs 音色 ID
 * @returns {Promise<Buffer>} 返回音频 Buffer（MP3 格式）
 */
async function requestElevenLabsTts(text, voiceId) {
  const https = require('https');

  const apiKey = process.env.ELEVENLABS_API_KEY;
  const body = JSON.stringify({
    text,
    model_id: 'eleven_multilingual_v2',
    voice_settings: {
      stability: 0.5,
      similarity_boost: 0.75,
    },
  });

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.elevenlabs.io',
      port: 443,
      path: `/v1/text-to-speech/${voiceId}`,
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      const chunks = [];

      res.on('data', (chunk) => {
        chunks.push(chunk);
      });

      res.on('end', () => {
        if (res.statusCode >= 400) {
          const errBody = Buffer.concat(chunks).toString();
          reject(createSpeechError(`ElevenLabs TTS 错误 (${res.statusCode}): ${errBody}`, {
            provider: 'elevenlabs',
            code: 'ELEVENLABS_HTTP_ERROR',
            statusCode: res.statusCode,
            responseBody: errBody,
            retriable: res.statusCode >= 500 || res.statusCode === 429,
          }));
          return;
        }
        resolve(Buffer.concat(chunks));
      });
    });

    req.on('error', (err) => {
      reject(createSpeechError(`ElevenLabs TTS 请求失败: ${err.message}`, {
        provider: 'elevenlabs',
        code: 'ELEVENLABS_REQUEST_ERROR',
        causeCode: err.code || null,
        errorName: err.name || 'Error',
        retriable: true,
      }));
    });

    req.setTimeout(30000, () => {
      req.destroy();
      reject(createSpeechError('ElevenLabs TTS 请求超时', {
        provider: 'elevenlabs',
        code: 'ELEVENLABS_TIMEOUT',
        retriable: true,
      }));
    });

    req.write(body);
    req.end();
  });
}

/**
 * 文字转语音（ElevenLabs TTS）
 * ElevenLabs 失败时自动重试一次，并返回尝试明细
 * @param {string} text - 要转换的文本
 * @param {string} voiceId - ElevenLabs 音色 ID
 * @param {{ maxAttempts?: number, retryDelayMs?: number }} options
 * @returns {Promise<{ audioBuffer: Buffer, attempts: Array<object>, provider: string }>}
 */
async function textToSpeechElevenLabs(text, voiceId, options = {}) {
  const maxAttempts = Math.max(1, options.maxAttempts || ELEVENLABS_MAX_ATTEMPTS);
  const retryDelayMs = Math.max(0, options.retryDelayMs || ELEVENLABS_RETRY_DELAY_MS);
  const attempts = [];
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const startedAt = Date.now();

    try {
      const audioBuffer = await requestElevenLabsTts(text, voiceId);
      attempts.push({
        attempt,
        ok: true,
        durationMs: Date.now() - startedAt,
      });

      return {
        audioBuffer,
        attempts,
        provider: 'elevenlabs',
      };
    } catch (error) {
      const normalizedError = error instanceof Error ? error : new Error(String(error));
      lastError = normalizedError;

      attempts.push({
        attempt,
        ok: false,
        durationMs: Date.now() - startedAt,
        code: normalizedError.code || 'UNKNOWN_ERROR',
        statusCode: normalizedError.statusCode ?? null,
        retriable: normalizedError.retriable !== false,
        errorName: normalizedError.errorName || normalizedError.name || 'Error',
        message: normalizedError.message,
        causeCode: normalizedError.causeCode || null,
        responseSnippet: typeof normalizedError.responseBody === 'string'
          ? normalizedError.responseBody.slice(0, 200)
          : null,
      });

      if (attempt < maxAttempts) {
        await waitMs(retryDelayMs);
      }
    }
  }

  if (lastError) {
    lastError.attempts = attempts;
    lastError.provider = 'elevenlabs';
    throw lastError;
  }

  throw createSpeechError('ElevenLabs TTS 未产生有效结果', {
    provider: 'elevenlabs',
    code: 'ELEVENLABS_UNKNOWN_ERROR',
    attempts,
  });
}

/**
 * 检查 Azure Speech 服务是否已配置
 * @returns {boolean}
 */
function isSpeechConfigured() {
  return !!(process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION);
}

/**
 * 文字转语音（TTS）
 * 调用 Azure Speech REST API 生成音频数据
 * @param {string} text - 要转换的文本
 * @param {string} language - 语言代码，如 "en-US" 或 "zh-CN"
 * @param {string} voice - 声音名称，可选
 * @returns {Promise<Buffer>} 返回音频 Buffer（MP3 格式）
 */
async function textToSpeech(text, language = 'en-US', voice) {
  if (!isSpeechConfigured()) {
    const err = new Error('Azure Speech 服务未配置');
    err.code = 'SPEECH_NOT_CONFIGURED';
    throw err;
  }

  const https = require('https');

  const speechKey = process.env.AZURE_SPEECH_KEY;
  const speechRegion = process.env.AZURE_SPEECH_REGION;

  // 根据语言选择默认声音
  const defaultVoices = {
    'en-US': 'en-US-JennyNeural',
    'zh-CN': 'zh-CN-XiaoxiaoNeural',
  };
  const selectedVoice = voice || defaultVoices[language] || 'en-US-JennyNeural';

  // 构造 SSML 文本（Speech Synthesis Markup Language）
  const ssml = `
    <speak version='1.0' xml:lang='${language}'>
      <voice xml:lang='${language}' name='${selectedVoice}'>
        ${escapeXml(text)}
      </voice>
    </speak>
  `.trim();

  return new Promise((resolve, reject) => {
    const postData = ssml;
    const options = {
      hostname: `${speechRegion}.tts.speech.microsoft.com`,
      port: 443,
      path: '/cognitiveservices/v1',
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': speechKey,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3',
        'User-Agent': 'meeting-simulator',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const req = https.request(options, (res) => {
      const chunks = [];

      res.on('data', (chunk) => {
        chunks.push(chunk);
      });

      res.on('end', () => {
        if (res.statusCode >= 400) {
          const body = Buffer.concat(chunks).toString();
          reject(new Error(`Azure TTS 错误 (${res.statusCode}): ${body}`));
          return;
        }
        resolve(Buffer.concat(chunks));
      });
    });

    req.on('error', (err) => {
      reject(new Error(`Azure TTS 请求失败: ${err.message}`));
    });

    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Azure TTS 请求超时'));
    });

    req.write(postData);
    req.end();
  });
}

/**
 * 检查 Azure Whisper 服务是否已配置
 * @returns {boolean}
 */
function isWhisperConfigured() {
  return !!(
    process.env.AZURE_WHISPER_API_KEY &&
    process.env.AZURE_WHISPER_ENDPOINT &&
    process.env.AZURE_WHISPER_DEPLOYMENT &&
    process.env.AZURE_WHISPER_API_VERSION
  );
}

/**
 * 语音转文字（STT）
 * 调用 Azure Whisper API（OpenAI 兼容接口）识别音频内容
 * 支持 webm / mp4 / wav 等多种格式，无需转换
 * @param {Buffer} audioBuffer - 音频数据
 * @param {string} language - 识别语言，如 "en-US" 或 "zh-CN"
 * @param {{ mimeType?: string, originalName?: string }} audioMeta - 上传文件元信息
 * @returns {Promise<{text: string, language: string}>}
 */
async function speechToText(audioBuffer, language = 'en-US', audioMeta = {}) {
  if (!isWhisperConfigured()) {
    const err = new Error('Azure Whisper 服务未配置，请检查 AZURE_WHISPER_* 环境变量');
    err.code = 'WHISPER_NOT_CONFIGURED';
    throw err;
  }

  const https = require('https');

  const apiKey = process.env.AZURE_WHISPER_API_KEY;
  const endpoint = process.env.AZURE_WHISPER_ENDPOINT;
  const deployment = process.env.AZURE_WHISPER_DEPLOYMENT;
  const apiVersion = process.env.AZURE_WHISPER_API_VERSION;

  // 解析 endpoint，提取 hostname 和 basePath
  const endpointUrl = new URL(endpoint);
  const hostname = endpointUrl.hostname;
  const basePath = endpointUrl.pathname.replace(/\/$/, ''); // 去掉末尾斜杠

  // 构造请求路径
  const path = `${basePath}/openai/deployments/${deployment}/audio/transcriptions?api-version=${apiVersion}`;

  // Whisper 只需要 language 的主语言部分（如 "en"，而非 "en-US"）
  const whisperLang = language.split('-')[0];

  // 手动构建 multipart/form-data body
  // 包含 file（音频 buffer）和 language 字段
  const boundary = `----FormBoundary${Date.now().toString(16)}`;

  // Whisper 根据文件扩展名自动识别格式，这里透传客户端真实类型。
  const { filename, mimeType } = normalizeAudioMeta(audioMeta);

  const preamble = Buffer.from(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
    `Content-Type: ${mimeType}\r\n` +
    `\r\n`
  );

  const langPart = Buffer.from(
    `\r\n--${boundary}\r\n` +
    `Content-Disposition: form-data; name="language"\r\n` +
    `\r\n` +
    `${whisperLang}\r\n` +
    `--${boundary}--\r\n`
  );

  // 拼接完整 body：前导部分 + 音频 buffer + 语言字段 + 结尾
  const bodyBuffer = Buffer.concat([preamble, audioBuffer, langPart]);

  return new Promise((resolve, reject) => {
    const options = {
      hostname,
      port: 443,
      path,
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': bodyBuffer.length,
      },
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          if (res.statusCode >= 400) {
            reject(new Error(`Azure Whisper STT 错误 (${res.statusCode}): ${data}`));
            return;
          }

          const parsed = JSON.parse(data);
          // Whisper API 返回 { text: "..." }
          const recognizedText = parsed.text || '';

          // 根据请求语言推断结果语言标识
          const langCode = language.startsWith('zh') ? 'zh' : 'en';

          resolve({
            text: recognizedText,
            language: langCode,
          });
        } catch (err) {
          reject(new Error(`解析 Azure Whisper 响应失败: ${err.message}，原始响应: ${data}`));
        }
      });
    });

    req.on('error', (err) => {
      reject(new Error(`Azure Whisper STT 请求失败: ${err.message}`));
    });

    req.setTimeout(60000, () => {
      // Whisper 处理较慢，超时设为 60 秒
      req.destroy();
      reject(new Error('Azure Whisper STT 请求超时'));
    });

    req.write(bodyBuffer);
    req.end();
  });
}

/**
 * 转义 XML 特殊字符，防止 SSML 注入
 * @param {string} text
 * @returns {string}
 */
function escapeXml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

module.exports = {
  isElevenLabsConfigured,
  isSpeechConfigured,
  isWhisperConfigured,
  normalizeAudioMeta,
  textToSpeechElevenLabs,
  textToSpeech,
  speechToText,
};
