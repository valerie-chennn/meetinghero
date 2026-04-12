/**
 * 语音相关路由
 * 处理文字转语音（TTS）和语音转文字（STT）
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const {
  textToSpeech,
  textToSpeechElevenLabs,
  speechToText,
  isElevenLabsConfigured,
  isSpeechConfigured,
  isWhisperConfigured,
} = require('../services/speech');

// 配置 multer 使用内存存储，限制文件大小 10MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = new Set([
      'audio/aac',
      'audio/m4a',
      'audio/mp4',
      'audio/mpeg',
      'audio/webm',
      'audio/x-m4a',
      'video/mp4',
    ]);

    if (file.mimetype.startsWith('audio/') || allowedMimeTypes.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('只接受音频文件'), false);
    }
  },
});

function createTtsRequestId() {
  return `tts-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function stringifyLogPayload(payload) {
  return JSON.stringify(payload);
}

/**
 * POST /api/speech/tts
 * 文字转语音，返回 MP3 音频流
 * 传入 voiceId 时优先使用 ElevenLabs，否则使用 Azure
 * Body: { text, language?, voice?, voiceId? }
 *   voiceId - ElevenLabs 音色 ID（前端根据角色 gender+type 分配）
 */
router.post('/tts', async (req, res) => {
  const requestId = createTtsRequestId();
  const requestedLanguage = req.body?.language || 'en-US';
  const requestedVoiceId = req.body?.voiceId || null;
  const requestedVoice = req.body?.voice || null;
  const requestedTextLength = typeof req.body?.text === 'string' ? req.body.text.trim().length : null;

  try {
    const { text, language = 'en-US', voice, voiceId } = req.body;

    // 参数校验
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'text 不能为空' });
    }

    // 限制文本长度，避免过长请求
    const trimmedText = text.trim();
    if (trimmedText.length > 2000) {
      return res.status(400).json({ error: '文本过长，最多 2000 个字符' });
    }

    const shouldUseElevenLabs = isElevenLabsConfigured() && !!voiceId;
    console.log(`[Speech/TTS] 请求开始 ${stringifyLogPayload({
      requestId,
      provider: shouldUseElevenLabs ? 'elevenlabs' : 'azure',
      language,
      voiceId: voiceId || null,
      voice: voice || null,
      textLength: trimmedText.length,
    })}`);

    let audioBuffer;
    let attempts = [];
    let provider = shouldUseElevenLabs ? 'elevenlabs' : 'azure';

    // 优先使用 ElevenLabs（需要传入 voiceId）
    if (shouldUseElevenLabs) {
      const result = await textToSpeechElevenLabs(trimmedText, voiceId, {
        maxAttempts: 2,
      });
      audioBuffer = result.audioBuffer;
      attempts = result.attempts || [];
      provider = result.provider || provider;
    } else {
      // Fallback：使用 Azure TTS
      if (!isSpeechConfigured()) {
        console.error(`[Speech/TTS] 配置缺失 ${stringifyLogPayload({
          requestId,
          provider,
          language,
          voiceId: voiceId || null,
          textLength: trimmedText.length,
        })}`);
        return res.status(501).json({
          error: 'TTS 服务未配置：ElevenLabs 未配置 voiceId，Azure Speech 也未配置',
        });
      }

      // Azure 需要校验语言代码
      const validLanguages = ['en-US', 'zh-CN'];
      if (!validLanguages.includes(language)) {
        return res.status(400).json({ error: 'language 必须为 en-US 或 zh-CN' });
      }

      audioBuffer = await textToSpeech(trimmedText, language, voice);
      attempts = [{
        attempt: 1,
        ok: true,
        durationMs: null,
      }];
    }

    console.log(`[Speech/TTS] 请求成功 ${stringifyLogPayload({
      requestId,
      provider,
      language,
      voiceId: voiceId || null,
      voice: voice || null,
      textLength: trimmedText.length,
      audioBytes: audioBuffer.length,
      attempts,
    })}`);

    // 返回音频流
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', audioBuffer.length);
    res.setHeader('Cache-Control', 'no-cache');
    return res.send(audioBuffer);
  } catch (err) {
    if (err.code === 'SPEECH_NOT_CONFIGURED') {
      return res.status(501).json({ error: 'Azure Speech 服务未配置' });
    }
    console.error(`[Speech/TTS] 请求失败 ${stringifyLogPayload({
      requestId,
      provider: err.provider || (requestedVoiceId ? 'elevenlabs' : 'azure'),
      voiceId: requestedVoiceId,
      voice: requestedVoice,
      language: requestedLanguage,
      textLength: requestedTextLength,
      errorCode: err.code || 'UNKNOWN_ERROR',
      errorName: err.errorName || err.name || 'Error',
      statusCode: err.statusCode ?? null,
      causeCode: err.causeCode || null,
      attempts: err.attempts || [],
      message: err.message,
    })}`);
    return res.status(500).json({ error: `语音合成失败: ${err.message}` });
  }
});

/**
 * POST /api/speech/stt
 * 语音转文字，接收 multipart/form-data 音频文件
 * 使用 Azure Whisper API
 */
router.post('/stt', (req, res) => {
  // 检查 Azure Whisper 是否配置
  if (!isWhisperConfigured()) {
    return res.status(501).json({
      error: 'Azure Whisper 服务未配置，请设置 AZURE_WHISPER_* 环境变量',
    });
  }

  // 使用 multer 处理文件上传
  upload.single('audio')(req, res, async (uploadErr) => {
    if (uploadErr) {
      if (uploadErr.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: '音频文件过大，最多 10MB' });
      }
      return res.status(400).json({ error: `文件上传错误: ${uploadErr.message}` });
    }

    try {
      if (!req.file) {
        return res.status(400).json({ error: '请上传音频文件（字段名：audio）' });
      }

      // 获取语言参数，默认英文
      const language = req.body.language || 'en-US';

      console.log(`[Speech/STT] 使用 Whisper 识别语音，language=${language}, fileSize=${req.file.size}`);

      // 调用 Azure Whisper STT
      const result = await speechToText(req.file.buffer, language, {
        mimeType: req.file.mimetype,
        originalName: req.file.originalname,
      });

      return res.status(200).json({
        text: result.text,
        language: result.language,
      });
    } catch (err) {
      if (err.code === 'WHISPER_NOT_CONFIGURED') {
        return res.status(501).json({ error: 'Azure Whisper 服务未配置' });
      }
      console.error('[Speech/STT] 错误：', err.message);
      return res.status(500).json({ error: `语音识别失败: ${err.message}` });
    }
  });
});

module.exports = router;
