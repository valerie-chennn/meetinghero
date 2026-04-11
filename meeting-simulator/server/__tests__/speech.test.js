const request = require('supertest');

describe('speech routes', () => {
  let app;
  let speechToTextMock;
  let isWhisperConfiguredMock;
  let normalizeAudioMeta;

  beforeEach(() => {
    jest.resetModules();

    speechToTextMock = jest.fn();
    isWhisperConfiguredMock = jest.fn(() => true);

    jest.doMock('../services/speech', () => {
      const actual = jest.requireActual('../services/speech');
      normalizeAudioMeta = actual.normalizeAudioMeta;
      return {
        ...actual,
        speechToText: speechToTextMock,
        isWhisperConfigured: isWhisperConfiguredMock,
        isSpeechConfigured: jest.fn(() => false),
        isElevenLabsConfigured: jest.fn(() => false),
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
