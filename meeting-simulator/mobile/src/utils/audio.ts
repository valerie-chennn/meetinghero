import { createAudioPlayer, setAudioModeAsync, setIsAudioActiveAsync } from 'expo-audio';

import { textToSpeech } from '../api';
import { renderMentionText } from './text';

const ttsCache = new Map<string, Promise<string | null>>();
const PLAYER_STATUS_UPDATE_MS = 100;
const PLAYBACK_POLL_MS = 120;
const PLAYBACK_START_TIMEOUT_MS = 6000;
const PLAYBACK_HARD_TIMEOUT_MS = 20000;
const TTS_PLAYBACK_RETRY_COUNT = 3;
const TTS_PLAYBACK_RETRY_DELAY_MS = 250;

export type TtsPlaybackResult = {
  started: boolean;
  finished: boolean;
  reason: 'completed' | 'no_uri' | 'start_timeout' | 'hard_timeout' | 'play_error';
};

function getTtsKey(text: string, voiceId?: string | null) {
  return `${text}|${voiceId || ''}`;
}

function clearCachedTts(text: string, voiceId?: string | null) {
  ttsCache.delete(getTtsKey(text, voiceId));
}

function getCachedTts(text: string, voiceId?: string | null, userName?: string | null) {
  const key = getTtsKey(text, voiceId);
  if (!ttsCache.has(key)) {
    ttsCache.set(
      key,
      textToSpeech(cleanTextForTts(text, userName), 'en-US', voiceId || undefined)
        .then((uri) => {
          if (!uri) {
            ttsCache.delete(key);
            return null;
          }
          return uri;
        })
        .catch((error) => {
          ttsCache.delete(key);
          console.warn('[audio] TTS prepare failed:', error);
          return null;
        })
    );
  }
  return ttsCache.get(key)!;
}

async function ensurePlaybackAudioMode(options?: { reactivate?: boolean }) {
  await setAudioModeAsync({
    playsInSilentMode: true,
    allowsRecording: false,
    interruptionMode: 'doNotMix',
    shouldPlayInBackground: false,
  });

  if (options?.reactivate) {
    await setIsAudioActiveAsync(false).catch(() => undefined);
  }

  await setIsAudioActiveAsync(true).catch(() => undefined);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function cleanTextForTts(text: string, userName?: string | null) {
  return renderMentionText(text, userName).replace(/@/g, '').replace(/\s+/g, ' ').trim();
}

export function estimateSpeechDurationMs(text: string, userName?: string | null) {
  const cleaned = cleanTextForTts(text, userName);
  const wordCount = cleaned.split(/\s+/).filter(Boolean).length;
  const byWords = wordCount * 360;
  const byChars = cleaned.length * 42;
  return Math.max(1100, Math.min(5200, Math.max(byWords, byChars)));
}

export function prefetchTts(text: string, voiceId?: string | null, userName?: string | null) {
  if (!text) return;
  void ensurePlaybackAudioMode().catch(() => undefined);
  getCachedTts(text, voiceId, userName);
}

export async function warmupTtsPlaybackSession() {
  await ensurePlaybackAudioMode().catch(() => undefined);
}

export async function prepareTts(text: string, voiceId?: string | null, userName?: string | null) {
  if (!text) return null;
  await ensurePlaybackAudioMode().catch(() => undefined);
  return getCachedTts(text, voiceId, userName);
}

export async function playPreparedTts(
  uri: string | null,
  options?: {
    onStart?: () => void;
  }
): Promise<TtsPlaybackResult> {
  if (!uri) {
    return {
      started: false,
      finished: false,
      reason: 'no_uri',
    };
  }

  await ensurePlaybackAudioMode({ reactivate: true }).catch(() => undefined);

  const player = createAudioPlayer({ uri }, { keepAudioSessionActive: true, updateInterval: PLAYER_STATUS_UPDATE_MS });

  return new Promise<TtsPlaybackResult>((resolve) => {
    let hasStarted = false;
    let settled = false;
    let startNotified = false;

    const cleanup = (result: TtsPlaybackResult) => {
      if (settled) return;
      settled = true;
      clearInterval(timer);
      clearTimeout(startTimeout);
      clearTimeout(hardTimeout);
      player.remove();
      resolve(result);
    };

    const timer = setInterval(() => {
      const status = player.currentStatus;
      if (status.playing || status.currentTime > 0) {
        hasStarted = true;
        if (!startNotified) {
          startNotified = true;
          options?.onStart?.();
        }
      }
      if (status.didJustFinish || (hasStarted && !status.playing && status.currentTime > 0 && status.duration > 0)) {
        cleanup({
          started: hasStarted,
          finished: true,
          reason: 'completed',
        });
      }
    }, PLAYBACK_POLL_MS);

    const startTimeout = setTimeout(() => {
      if (!hasStarted) {
        console.warn('[audio] TTS did not start before timeout');
        cleanup({
          started: false,
          finished: false,
          reason: 'start_timeout',
        });
      }
    }, PLAYBACK_START_TIMEOUT_MS);

    const hardTimeout = setTimeout(() => {
      console.warn('[audio] TTS playback exceeded hard timeout');
      cleanup({
        started: hasStarted,
        finished: hasStarted,
        reason: 'hard_timeout',
      });
    }, PLAYBACK_HARD_TIMEOUT_MS);

    try {
      player.play();
    } catch (error) {
      console.warn('[audio] TTS play failed:', error);
      cleanup({
        started: false,
        finished: false,
        reason: 'play_error',
      });
    }
  });
}

export async function playTts(
  text: string,
  voiceId?: string | null,
  userName?: string | null,
  options?: {
    onStart?: () => void;
  }
) {
  if (!text) {
    return {
      started: false,
      finished: false,
      reason: 'no_uri',
    } satisfies TtsPlaybackResult;
  }

  let lastResult: TtsPlaybackResult = {
    started: false,
    finished: false,
    reason: 'no_uri',
  };

  for (let attempt = 0; attempt < TTS_PLAYBACK_RETRY_COUNT; attempt += 1) {
    const shouldRefreshSource = attempt > 0;
    if (shouldRefreshSource) {
      clearCachedTts(text, voiceId);
      await sleep(TTS_PLAYBACK_RETRY_DELAY_MS);
    }

    const uri = await prepareTts(text, voiceId, userName);
    lastResult = await playPreparedTts(uri, options);
    if (lastResult.reason === 'completed') {
      return lastResult;
    }

    console.warn(`[audio] TTS attempt ${attempt + 1} failed: ${lastResult.reason}`);
  }

  return lastResult;
}
