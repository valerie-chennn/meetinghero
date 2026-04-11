import { createAudioPlayer } from 'expo-audio';

import { textToSpeech } from '../api';
import { renderMentionText } from './text';

const ttsCache = new Map<string, Promise<string | null>>();
const PLAYBACK_POLL_MS = 120;
const PLAYBACK_START_TIMEOUT_MS = 1200;
const PLAYBACK_HARD_TIMEOUT_MS = 10000;

function getTtsKey(text: string, voiceId?: string | null) {
  return `${text}|${voiceId || ''}`;
}

function getCachedTts(text: string, voiceId?: string | null, userName?: string | null) {
  const key = getTtsKey(text, voiceId);
  if (!ttsCache.has(key)) {
    ttsCache.set(
      key,
      textToSpeech(cleanTextForTts(text, userName), 'en-US', voiceId || undefined).catch(() => null)
    );
  }
  return ttsCache.get(key)!;
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
  getCachedTts(text, voiceId, userName);
}

export async function prepareTts(text: string, voiceId?: string | null, userName?: string | null) {
  if (!text) return null;
  return getCachedTts(text, voiceId, userName);
}

export async function playPreparedTts(
  uri: string | null,
  options?: {
    onStart?: () => void;
  }
) {
  if (!uri) return;

  const player = createAudioPlayer({ uri }, { keepAudioSessionActive: true });

  return new Promise<void>((resolve) => {
    let hasStarted = false;
    let settled = false;
    let startNotified = false;

    const cleanup = () => {
      if (settled) return;
      settled = true;
      clearInterval(timer);
      clearTimeout(startTimeout);
      clearTimeout(hardTimeout);
      player.remove();
      resolve();
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
        cleanup();
      }
    }, PLAYBACK_POLL_MS);

    const startTimeout = setTimeout(() => {
      // 音频长时间没有开始播放时，不阻塞对话继续。
      if (!hasStarted) {
        cleanup();
      }
    }, PLAYBACK_START_TIMEOUT_MS);

    const hardTimeout = setTimeout(() => {
      cleanup();
    }, PLAYBACK_HARD_TIMEOUT_MS);

    try {
      player.play();
    } catch {
      cleanup();
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
  if (!text) return;
  const uri = await prepareTts(text, voiceId, userName);
  return playPreparedTts(uri, options);
}
