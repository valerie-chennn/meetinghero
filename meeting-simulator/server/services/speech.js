/**
 * Azure Speech 服务封装
 * 提供文字转语音（TTS）和语音转文字（STT）功能
 */

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
 * 语音转文字（STT）
 * 调用 Azure Speech REST API 识别音频内容
 * @param {Buffer} audioBuffer - 音频数据
 * @param {string} language - 识别语言，如 "en-US" 或 "zh-CN"
 * @returns {Promise<{text: string, language: string}>}
 */
async function speechToText(audioBuffer, language = 'en-US') {
  if (!isSpeechConfigured()) {
    const err = new Error('Azure Speech 服务未配置');
    err.code = 'SPEECH_NOT_CONFIGURED';
    throw err;
  }

  const https = require('https');

  const speechKey = process.env.AZURE_SPEECH_KEY;
  const speechRegion = process.env.AZURE_SPEECH_REGION;

  return new Promise((resolve, reject) => {
    const options = {
      hostname: `${speechRegion}.stt.speech.microsoft.com`,
      port: 443,
      path: `/speech/recognition/conversation/cognitiveservices/v1?language=${language}&format=detailed`,
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': speechKey,
        'Content-Type': 'audio/wav; codecs=audio/pcm; samplerate=16000',
        'Accept': 'application/json',
        'Content-Length': audioBuffer.length,
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
            reject(new Error(`Azure STT 错误 (${res.statusCode}): ${data}`));
            return;
          }

          const parsed = JSON.parse(data);
          const recognizedText = parsed.DisplayText || parsed.NBest?.[0]?.Display || '';

          // 根据请求的语言推断结果语言标识
          const langCode = language.startsWith('zh') ? 'zh' : 'en';

          resolve({
            text: recognizedText,
            language: langCode,
          });
        } catch (err) {
          reject(new Error(`解析 Azure STT 响应失败: ${err.message}`));
        }
      });
    });

    req.on('error', (err) => {
      reject(new Error(`Azure STT 请求失败: ${err.message}`));
    });

    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Azure STT 请求超时'));
    });

    req.write(audioBuffer);
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
  isSpeechConfigured,
  textToSpeech,
  speechToText,
};
