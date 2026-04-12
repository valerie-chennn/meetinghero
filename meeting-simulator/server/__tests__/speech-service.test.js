describe('speech service', () => {
  function createHttpsRequestMock(outcomes) {
    return jest.fn((_options, responseHandler) => {
      const outcome = outcomes.shift();
      const requestListeners = {};

      const req = {
        on(event, handler) {
          requestListeners[event] = handler;
          return req;
        },
        setTimeout(_timeoutMs, handler) {
          req.timeoutHandler = handler;
          return req;
        },
        write() {},
        destroy() {},
        end() {
          if (!outcome) {
            throw new Error('缺少 mock outcome');
          }

          if (outcome.type === 'response') {
            const responseListeners = {};
            const res = {
              statusCode: outcome.statusCode,
              on(event, handler) {
                responseListeners[event] = handler;
              },
            };

            responseHandler(res);
            (outcome.chunks || []).forEach((chunk) => {
              responseListeners.data?.(Buffer.from(chunk));
            });
            responseListeners.end?.();
            return;
          }

          if (outcome.type === 'error') {
            const error = Object.assign(new Error(outcome.message), outcome.errorProps || {});
            requestListeners.error?.(error);
            return;
          }

          if (outcome.type === 'timeout') {
            req.timeoutHandler?.();
          }
        },
      };

      return req;
    });
  }

  afterEach(() => {
    jest.resetModules();
    jest.dontMock('https');
  });

  it('retries once and succeeds for ElevenLabs TTS', async () => {
    const requestMock = createHttpsRequestMock([
      { type: 'timeout' },
      { type: 'response', statusCode: 200, chunks: ['mock-audio'] },
    ]);

    jest.doMock('https', () => ({
      request: requestMock,
    }));

    const { textToSpeechElevenLabs } = require('../services/speech');

    const result = await textToSpeechElevenLabs('hello world', 'voice-123', {
      maxAttempts: 2,
      retryDelayMs: 0,
    });

    expect(requestMock).toHaveBeenCalledTimes(2);
    expect(result.provider).toBe('elevenlabs');
    expect(result.audioBuffer.equals(Buffer.from('mock-audio'))).toBe(true);
    expect(result.attempts).toHaveLength(2);
    expect(result.attempts[0]).toMatchObject({
      attempt: 1,
      ok: false,
      code: 'ELEVENLABS_TIMEOUT',
    });
    expect(result.attempts[1]).toMatchObject({
      attempt: 2,
      ok: true,
    });
  });

  it('throws attempt details after retrying ElevenLabs TTS once', async () => {
    const requestMock = createHttpsRequestMock([
      { type: 'error', message: 'socket hang up', errorProps: { code: 'ECONNRESET' } },
      { type: 'timeout' },
    ]);

    jest.doMock('https', () => ({
      request: requestMock,
    }));

    const { textToSpeechElevenLabs } = require('../services/speech');

    await expect(textToSpeechElevenLabs('hello world', 'voice-456', {
      maxAttempts: 2,
      retryDelayMs: 0,
    })).rejects.toMatchObject({
      provider: 'elevenlabs',
      attempts: [
        expect.objectContaining({
          attempt: 1,
          ok: false,
          code: 'ELEVENLABS_REQUEST_ERROR',
          causeCode: 'ECONNRESET',
        }),
        expect.objectContaining({
          attempt: 2,
          ok: false,
          code: 'ELEVENLABS_TIMEOUT',
        }),
      ],
    });

    expect(requestMock).toHaveBeenCalledTimes(2);
  });
});
