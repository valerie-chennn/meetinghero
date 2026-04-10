import { createAudioPlayer } from 'expo-audio';

import { textToSpeech } from '../api';
import { renderMentionText } from './text';

const ttsCache = new Map<string, Promise<string | null>>();

export function cleanTextForTts(text: string, userName?: string | null) {
  return renderMentionText(text, userName).replace(/@/g, '').replace(/\s+/g, ' ').trim();
}

export function prefetchTts(text: string, voiceId?: string | null, userName?: string | null) {
  if (!text) return;
  const key = `${text}|${voiceId || ''}`;
  if (!ttsCache.has(key)) {
    ttsCache.set(
      key,
      textToSpeech(cleanTextForTts(text, userName), 'en-US', voiceId || undefined).catch(() => null)
    );
  }
}

export async function playTts(text: string, voiceId?: string | null, userName?: string | null) {
  if (!text) return;
  const key = `${text}|${voiceId || ''}`;
  const uri = await (ttsCache.get(key) || textToSpeech(cleanTextForTts(text, userName), 'en-US', voiceId || undefined));
  ttsCache.delete(key);

  if (!uri) return;

  const player = createAudioPlayer({ uri }, { keepAudioSessionActive: true });

  return new Promise<void>((resolve) => {
    const timer = setInterval(() => {
      const status = player.currentStatus;
      if (status.didJustFinish || (!status.playing && status.currentTime > 0 && status.duration > 0)) {
        clearInterval(timer);
        player.remove();
        resolve();
      }
    }, 150);

    try {
      player.play();
    } catch {
      clearInterval(timer);
      player.remove();
      resolve();
    }
  });
}
