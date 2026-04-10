import Constants from 'expo-constants';
import { File, Paths } from 'expo-file-system';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:3001';

export function getApiBaseUrl() {
  return API_BASE.replace(/\/$/, '');
}

export function getBuildInfo() {
  return {
    apiBaseUrl: getApiBaseUrl(),
    expoVersion: Constants.expoVersion ?? 'unknown',
  };
}

export async function request<T>(path: string, options: RequestInit = {}) {
  const response = await fetch(`${getApiBaseUrl()}/api${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: '请求失败' }));
    const error = new Error(errorData.error || `HTTP ${response.status}`);
    (error as Error & { status?: number }).status = response.status;
    throw error;
  }

  return response.json() as Promise<T>;
}

export async function requestAudioFile(path: string, body: object) {
  const response = await fetch(`${getApiBaseUrl()}/api${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (response.status === 501) {
    return null;
  }

  if (!response.ok) {
    throw new Error('TTS 请求失败');
  }

  const arrayBuffer = await response.arrayBuffer();
  const file = new File(Paths.cache, `tts-${Date.now()}-${Math.random().toString(36).slice(2)}.mp3`);
  file.create({ intermediates: true, overwrite: true });
  file.write(new Uint8Array(arrayBuffer));
  return file.uri;
}
