const request = require('supertest');

describe('speech routes', () => {
  let app;
  let speechToTextMock;
  let textToSpeechElevenLabsMock;
  let textToSpeechMock;
  let isWhisperConfiguredMock;
  let isSpeechConfiguredMock;
  let isElevenLabsConfiguredMock;
  let normalizeAudioMeta;

  beforeEach(() => {
    jest.resetModules();

    speechToTextMock = jest.fn();
    textToSpeechElevenLabsMock = jest.fn();
    textToSpeechMock = jest.fn();
    isWhisperConfiguredMock = jest.fn(() => true);
    isSpeechConfiguredMock = jest.fn(() => false);
    isElevenLabsConfiguredMock = jest.fn(() => false);

    jest.doMock('../services/speech', () => {
      const actual = jest.requireActual('../services/speech');
      normalizeAudioMeta = actual.normalizeAudioMeta;
      return {
        ...actual,
        speechToText: speechToTextMock,
        textToSpeechElevenLabs: textToSpeechElevenLabsMock,
        textToSpeech: textToSpeechMock,
        isWhisperConfigured: isWhisperConfiguredMock,
        isSpeechConfigured: isSpeechConfiguredMock,
        isElevenLabsConfigured: isElevenLabsConfiguredMock,
      };
    });

    ({ createApp: app } = require('../index'));
    app = app();
  });

  afterEach(async () => {
    const db = require('../db');
    await db.close();
    jest.dontMock('../services/speech');
  });

  it('returns mp3 audio for ElevenLabs TTS', async () => {
    isElevenLabsConfiguredMock.mockReturnValue(true);
    textToSpeechElevenLabsMock.mockResolvedValueOnce({
      audioBuffer: Buffer.from('mock-mp3'),
      attempts: [{ attempt: 1, ok: true, durationMs: 12 }],
      provider: 'elevenlabs',
    });

    const res = await request(app)
      .post('/api/speech/tts')
      .send({ text: 'Hello team', voiceId: 'voice-123' });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('audio/mpeg');
    expect(Number(res.headers['content-length'])).toBe(Buffer.byteLength('mock-mp3'));
    expect(textToSpeechElevenLabsMock).toHaveBeenCalledWith('Hello team', 'voice-123', {
      maxAttempts: 2,
    });
  });

  it('returns 500 when ElevenLabs TTS fails after retrying', async () => {
    isElevenLabsConfiguredMock.mockReturnValue(true);
    const error = new Error('ElevenLabs TTS 请求超时');
    error.code = 'ELEVENLABS_TIMEOUT';
    error.provider = 'elevenlabs';
    error.attempts = [
      { attempt: 1, ok: false, code: 'ELEVENLABS_TIMEOUT' },
      { attempt: 2, ok: false, code: 'ELEVENLABS_TIMEOUT' },
    ];
    textToSpeechElevenLabsMock.mockRejectedValueOnce(error);

    const res = await request(app)
      .post('/api/speech/tts')
      .send({ text: 'Need a retry', voiceId: 'voice-456' });

    expect(res.status).toBe(500);
    expect(res.body.error).toContain('请求超时');
  });

  it.each([
    ['audio/m4a', 'sample.m4a'],
    ['audio/aac', 'sample.aac'],
    ['video/mp4', 'sample.mp4'],
    ['audio/webm', 'sample.webm'],
  ])('accepts native upload format %s', async (mimeType, filename) => {
    speechToTextMock.mockResolvedValueOnce({ text: 'hello', language: 'en' });

    const res = await request(app)
      .post('/api/speech/stt')
      .field('language', 'en-US')
      .attach('audio', Buffer.from('voice-data'), { filename, contentType: mimeType });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ text: 'hello', language: 'en' });
    expect(speechToTextMock).toHaveBeenCalledWith(expect.any(Buffer), 'en-US', {
      mimeType,
      originalName: filename,
    });
  });

  it('returns 501 when whisper is not configured', async () => {
    isWhisperConfiguredMock.mockReturnValue(false);

    const res = await request(app)
      .post('/api/speech/stt')
      .attach('audio', Buffer.from('voice-data'), { filename: 'sample.m4a', contentType: 'audio/m4a' });

    expect(res.status).toBe(501);
    expect(res.body.error).toContain('Azure Whisper');
  });

  it('keeps timeout errors on the failure branch', async () => {
    speechToTextMock.mockRejectedValueOnce(new Error('Azure Whisper STT 请求超时'));

    const res = await request(app)
      .post('/api/speech/stt')
      .attach('audio', Buffer.from('voice-data'), { filename: 'sample.m4a', contentType: 'audio/m4a' });

    expect(res.status).toBe(500);
    expect(res.body.error).toContain('请求超时');
  });

  it('normalizes m4a metadata for whisper multipart uploads', () => {
    expect(normalizeAudioMeta({ mimeType: 'audio/x-m4a', originalName: 'voice-track' })).toEqual({
      filename: 'audio.m4a',
      mimeType: 'audio/x-m4a',
    });
  });
});
