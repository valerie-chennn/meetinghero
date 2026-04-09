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
  normalizeLoudness,
} = require('../services/speech');

// 配置 multer 使用内存存储，限制文件大小 10MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    // 只接受音频文件
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('只接受音频文件'), false);
    }
  },
});

/**
 * POST /api/speech/tts
 * 文字转语音，返回 MP3 音频流
 * 优先使用 ElevenLabs，fallback 到 Azure
 * Body: { text, language?, voice?, voiceId? }
 *   voiceId - ElevenLabs 音色 ID（前端根据角色 gender+type 分配）
 */
router.post('/tts', async (req, res) => {
  try {
    const { text, language = 'en-US', voice, voiceId } = req.body;

    // 参数校验
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'text 不能为空' });
    }

    // 限制文本长度，避免过长请求
    if (text.trim().length > 2000) {
      return res.status(400).json({ error: '文本过长，最多 2000 个字符' });
    }

    let audioBuffer;
    let ttsSource;

    // 优先使用 ElevenLabs（需要传入 voiceId）
    if (isElevenLabsConfigured() && voiceId) {
      console.log(`[Speech/TTS] 使用 ElevenLabs，voiceId=${voiceId}, textLength=${text.trim().length}`);
      audioBuffer = await textToSpeechElevenLabs(text.trim(), voiceId);
      ttsSource = 'elevenlabs';
    } else {
      // Fallback：使用 Azure TTS
      if (!isSpeechConfigured()) {
        return res.status(501).json({
          error: 'TTS 服务未配置：ElevenLabs 未配置 voiceId，Azure Speech 也未配置',
        });
      }

      // Azure 需要校验语言代码
      const validLanguages = ['en-US', 'zh-CN'];
      if (!validLanguages.includes(language)) {
        return res.status(400).json({ error: 'language 必须为 en-US 或 zh-CN' });
      }

      console.log(`[Speech/TTS] 使用 Azure TTS，language=${language}, textLength=${text.trim().length}`);
      audioBuffer = await textToSpeech(text.trim(), language, voice);
      ttsSource = 'azure';
    }

    // ElevenLabs 结果过 ffmpeg loudnorm 归一化（解决不同 voice 响度不一致）
    // 注意：normalizeLoudness 成功时输出 WAV（acompressor + loudnorm 压缩后的 PCM），
    // 失败时返回原 MP3（兜底）。Content-Type 要根据实际返回内容决定
    let contentType = 'audio/mpeg';
    if (ttsSource === 'elevenlabs') {
      const normalized = await normalizeLoudness(audioBuffer);
      // 检查输出是不是 WAV（前 4 字节 "RIFF"）还是原 MP3（兜底路径）
      // WAV 文件前 4 字节是 'RIFF'，用这个做简单判断
      if (normalized.length >= 4 && normalized.slice(0, 4).toString() === 'RIFF') {
        audioBuffer = normalized;
        contentType = 'audio/wav';
      } else {
        // 兜底路径返回原 mp3，保持 audio/mpeg
        audioBuffer = normalized;
      }
    }

    // 返回音频流
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', audioBuffer.length);
    res.setHeader('Cache-Control', 'no-cache');
    return res.send(audioBuffer);
  } catch (err) {
    if (err.code === 'SPEECH_NOT_CONFIGURED') {
      return res.status(501).json({ error: 'Azure Speech 服务未配置' });
    }
    console.error('[Speech/TTS] 错误：', err.message);
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
      const result = await speechToText(req.file.buffer, language);

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
