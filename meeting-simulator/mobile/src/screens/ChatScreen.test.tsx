import React from 'react';
import { waitFor } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';

import { joinChat } from '../api';
import { renderWithAppState } from '../test/renderWithAppState';
import { ChatScreen } from './ChatScreen';

jest.mock('../api', () => ({
  joinChat: jest.fn(),
  respondChat: jest.fn(),
  generateHint: jest.fn(),
  completeChat: jest.fn(),
}));

jest.mock('../utils/audio', () => ({
  prefetchTts: jest.fn(),
  playTts: jest.fn(() => Promise.resolve()),
}));

jest.mock('../hooks/useVoiceRecorder', () => ({
  useVoiceRecorder: jest.fn(() => ({
    isRecording: false,
    duration: 0,
    toggleRecording: jest.fn(),
  })),
}));

describe('ChatScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useLocalSearchParams as jest.Mock).mockReturnValue({ roomId: 'room-1' });
  });

  it('shows a loading state while joining the chat', () => {
    (joinChat as jest.Mock).mockImplementation(() => new Promise(() => undefined));

    const screen = renderWithAppState(<ChatScreen />, {
      userId: 'user-1',
      userName: 'Alex',
    });

    expect(screen.getByText('加入群聊中...')).toBeTruthy();
  });

  it('shows an error state when joining the chat fails', async () => {
    (joinChat as jest.Mock).mockRejectedValue(new Error('加入群聊失败'));

    const screen = renderWithAppState(<ChatScreen />, {
      userId: 'user-1',
      userName: 'Alex',
    });

    await waitFor(() => {
      expect(screen.getByText('加入群聊失败')).toBeTruthy();
      expect(screen.getByText('返回首页')).toBeTruthy();
    });
  });
});
