import type {
  ExpressionListResponse,
  FeedItem,
  JoinChatResponse,
  RespondChatResponse,
  SettlementResponse,
  UserStats,
} from './types';
import { getApiBaseUrl, request, requestAudioFile } from './client';

export { getApiBaseUrl } from './client';

export const initUser = (userId: string, nickname: string) =>
  request<{ userId: string; nickname: string; isNew: boolean }>('/v2/users/init', {
    method: 'POST',
    body: JSON.stringify({ userId, nickname }),
  });

export const getFeedList = (page = 1, pageSize = 10) =>
  request<{ items: FeedItem[]; total: number; hasMore: boolean }>(`/v2/feed?page=${page}&pageSize=${pageSize}`);

export const joinChat = (userId: string, roomId: string) =>
  request<JoinChatResponse>('/v2/chat/join', {
    method: 'POST',
    body: JSON.stringify({ userId, roomId }),
  });

export const respondChat = (chatSessionId: string, turnIndex: number, userInput: string) =>
  request<RespondChatResponse>('/v2/chat/respond', {
    method: 'POST',
    body: JSON.stringify({ chatSessionId, turnIndex, userInput }),
  });

export const completeChat = (chatSessionId: string, force = false) =>
  request<{ success: boolean }>('/v2/chat/complete', {
    method: 'POST',
    body: JSON.stringify({ chatSessionId, force }),
  });

export const getSettlement = (chatSessionId: string) =>
  request<SettlementResponse>(`/v2/chat/${chatSessionId}/settlement`);

export const generateHint = (chatSessionId: string) =>
  request<{ hint: string }>(`/v2/chat/${chatSessionId}/generate-hint`, {
    method: 'POST',
    body: JSON.stringify({}),
  });

export const getExpressions = (userId: string) =>
  request<ExpressionListResponse>(`/v2/expressions?userId=${userId}`);

export const saveExpression = (id: number, userId: string) =>
  request<{ id: number; isSaved: boolean }>(`/v2/expressions/${id}/save`, {
    method: 'POST',
    body: JSON.stringify({ userId }),
  });

export const deleteExpression = (id: number, userId: string) =>
  request<{ id: number; isSaved: boolean }>(`/v2/expressions/${id}`, {
    method: 'DELETE',
    body: JSON.stringify({ userId }),
  });

export const practiceExpression = (id: number, userId: string) =>
  request<{ id: number; isPracticed: boolean }>(`/v2/expressions/${id}/practice`, {
    method: 'POST',
    body: JSON.stringify({ userId }),
  });

export const getDmBanner = (chatSessionId: string) =>
  request<{ hasBanner: boolean; banner: { npcName: string; npcAvatar?: string | null; message: string; messageZh?: string } | null }>(
    `/v2/chat/${chatSessionId}/dm-banner`
  );

export const getUserStats = (userId: string) =>
  request<UserStats>(`/v2/users/${userId}/stats`);

export async function textToSpeech(text: string, language = 'en-US', voiceId?: string) {
  return requestAudioFile('/speech/tts', { text, language, ...(voiceId ? { voiceId } : {}) });
}

export async function speechToText(audioUri: string, mimeType = 'audio/m4a') {
  const formData = new FormData();
  formData.append('audio', {
    uri: audioUri,
    name: `recording.${mimeType.split('/')[1] || 'm4a'}`,
    type: mimeType,
  } as any);

  const response = await fetch(`${getApiBaseUrl()}/api/speech/stt`, {
    method: 'POST',
    body: formData,
  });

  if (response.status === 501) {
    return null;
  }

  if (!response.ok) {
    throw new Error('STT 请求失败');
  }

  return response.json() as Promise<{ text: string; language: string }>;
}
