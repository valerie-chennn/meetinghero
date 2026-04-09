/**
 * 语音服务封装
 * 提供文字转语音（TTS）和语音转文字（STT）功能
 * TTS 优先使用 ElevenLabs，fallback 到 Azure
 * STT 使用 Azure Whisper
 * TTS 结果会过 ffmpeg loudnorm 做响度归一化，解决不同 voice 响度不一致
 */

const { spawn } = require('child_process');

/**
 * 用 ffmpeg loudnorm filter 做响度归一化
 * 目标：I=-16 LUFS（播客/语音标准响度），TP=-1.5 dBTP，LRA=11 LU
 * 任何失败（ffmpeg 不存在 / 异常退出 / 超时）都返回原 buffer，
 * 保证永远有声音，宁可响度不齐也不能无声
 *
 * 实测数据（本地验证通过）：
 * - Josh  (ElevenLabs): -23.73 LUFS → -17.54（+6 dB，耗时 ~120ms）
 * - Arnold (ElevenLabs): -16.06 LUFS → -16.48（几乎不动，耗时 ~70ms）
 * - 归一化后差距 1 dB 以内，人耳基本听不出差异
 *
 * @param {Buffer} mp3Buffer - 输入 mp3 字节
 * @returns {Promise<Buffer>} 归一化后的 mp3，或者失败时的原 buffer
 */
async function normalizeLoudness(mp3Buffer) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const chunks = [];
    let stderr = '';
    let settled = false;

    const parseLoudnormSummary = () => {
      const m = stderr.match(/\{\s*"input_i"[\s\S]*?\}/);
      if (!m) return null;
      try { return JSON.parse(m[0]); } catch (_) { return null; }
    };

    const finish = (buf, reason) => {
      if (settled) return;
      settled = true;
      const elapsed = Date.now() - startTime;
      const tag = reason === 'ok' ? '[Speech/loudnorm] ok' : `[Speech/loudnorm] ${reason}`;
      const info = parseLoudnormSummary();
      const lufs = info
        ? ` input_i=${info.input_i} output_i=${info.output_i} target_offset=${info.target_offset}`
        : '';
      console.log(`${tag} in=${mp3Buffer.length}B out=${buf.length}B took=${elapsed}ms${lufs}`);
      if (reason !== 'ok' && stderr && !info) {
        console.warn(`[Speech/loudnorm] stderr=${stderr.trim().slice(0, 300)}`);
      }
      resolve(buf);
    };

    let ff;
    try {
      // 关键 filter chain：acompressor → loudnorm
      // 原因：ElevenLabs 的强调/感叹句（如 LLM 生成的 "See? You get it..."）peak 很高，
      // 但 integrated LUFS 很低。直接用 loudnorm 归一化会被 TP=-1.5 dBTP 限幅卡住，
      // 无法 boost 到 target -16 LUFS，不同内容之间响度差距保持 4-7 dB。
      //
      // acompressor 先压缩峰值（threshold=-20dB ratio=4:1 快 attack/release），
      // 降低 crest factor，然后 loudnorm 就有足够 headroom 把整体响度拉到 -16。
      //
      // 本地实测数据（josh-loud "Project is over..." + arnold-quiet "I carried bags..."）：
      //   只 loudnorm single-pass：  Josh -20.78  Arnold -16.68  差 4.1 dB
      //   loudnorm two-pass linear： Josh -20.78  Arnold -16.68  差 4.1 dB（被 peak 限幅）
      //   acompressor + loudnorm：   Josh -16.65  Arnold -16.52  差 0.13 dB ⭐
      //
      // 参数说明：
      //   acompressor: threshold=-20dB（-20 dB 以上压缩），ratio=4:1（4 dB 进压成 1 dB），
      //                attack=5ms（快速反应 transient），release=50ms（快速释放避免 pumping）
      //   loudnorm: I=-16 LUFS（播客标准），TP=-1.5 dBTP，LRA=11 LU
      // -ar 44100 -ac 1 -c:a libmp3lame -b:a 128k：对齐 ElevenLabs 原始 mp3 format，
      //   防止 iPhone Safari 对 48 kHz mono MP3 的解码兼容问题
      ff = spawn('ffmpeg', [
        '-hide_banner', '-loglevel', 'info',
        '-f', 'mp3',
        '-i', 'pipe:0',
        '-af', 'acompressor=threshold=-20dB:ratio=4:attack=5:release=50,loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json',
        '-ar', '44100',
        '-ac', '1',
        '-c:a', 'libmp3lame',
        '-b:a', '128k',
        '-f', 'mp3',
        'pipe:1',
      ]);
    } catch (err) {
      console.warn('[Speech/loudnorm] spawn 同步异常:', err.message);
      resolve(mp3Buffer);
      return;
    }

    ff.stdout.on('data', (c) => chunks.push(c));
    ff.stderr.on('data', (c) => { stderr += c.toString(); });
    ff.on('error', (err) => finish(mp3Buffer, `spawn-error: ${err.message}`));
    ff.on('close', (code) => {
      if (code !== 0 || chunks.length === 0) {
        finish(mp3Buffer, `ffmpeg-exit-${code}`);
        return;
      }
      finish(Buffer.concat(chunks), 'ok');
    });

    ff.stdin.on('error', () => { /* 忽略 EPIPE */ });
    ff.stdin.write(mp3Buffer);
    ff.stdin.end();

    // 硬超时兜底：5 秒内没完成就 kill 掉 ffmpeg，返回原 buffer
    setTimeout(() => {
      if (!settled && ff && !ff.killed) {
        try { ff.kill('SIGKILL'); } catch (_) { /* ignore */ }
        finish(mp3Buffer, 'timeout');
      }
    }, 5000);
  });
}

/**
 * 检查 ElevenLabs TTS 服务是否已配置
 * @returns {boolean}
 */
function isElevenLabsConfigured() {
  return !!process.env.ELEVENLABS_API_KEY;
}

/**
 * 文字转语音（ElevenLabs TTS）
 * 调用 ElevenLabs REST API 生成音频数据
 * @param {string} text - 要转换的文本
 * @param {string} voiceId - ElevenLabs 音色 ID
 * @returns {Promise<Buffer>} 返回音频 Buffer（MP3 格式）
 */
async function textToSpeechElevenLabs(text, voiceId) {
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
          reject(new Error(`ElevenLabs TTS 错误 (${res.statusCode}): ${errBody}`));
          return;
        }
        resolve(Buffer.concat(chunks));
      });
    });

    req.on('error', (err) => {
      reject(new Error(`ElevenLabs TTS 请求失败: ${err.message}`));
    });

    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('ElevenLabs TTS 请求超时'));
    });

    req.write(body);
    req.end();
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
 * @returns {Promise<{text: string, language: string}>}
 */
async function speechToText(audioBuffer, language = 'en-US') {
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

  // 判断音频格式，用于设置 Content-Disposition 的文件名
  // Whisper 根据文件扩展名自动识别格式
  const filename = 'audio.webm';

  const preamble = Buffer.from(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
    `Content-Type: audio/webm\r\n` +
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
  textToSpeechElevenLabs,
  textToSpeech,
  speechToText,
  normalizeLoudness,
};
