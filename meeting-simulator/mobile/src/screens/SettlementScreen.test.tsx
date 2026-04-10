import React from 'react';
import { fireEvent, waitFor } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';

import { getSettlement } from '../api';
import { renderWithAppState } from '../test/renderWithAppState';
import { SettlementScreen } from './SettlementScreen';

jest.mock('../api', () => ({
  getSettlement: jest.fn(),
}));

describe('SettlementScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useLocalSearchParams as jest.Mock).mockReturnValue({ sessionId: 'chat-1' });
  });

  it('surfaces settlement data and promotes featured expression first', async () => {
    (getSettlement as jest.Mock).mockResolvedValue({
      newsletter: {
        publisher: '东海商报',
        ipName: '西游记',
        headline: '群聊现场突然升温',
        epilogue: ['第一条后续', '第二条后续'],
        title: '气氛定调人',
      },
      stats: {
        duration: '0:45',
        wordCount: 32,
      },
      expressionCards: [
        { id: 1, betterVersion: 'Card A', userSaid: 'A', feedbackType: '更好的说法', isFeatured: false, highlights: [] },
        { id: 2, betterVersion: 'Card B', userSaid: 'B', feedbackType: '更地道的说法', isFeatured: true, highlights: [] },
      ],
    });

    const screen = renderWithAppState(<SettlementScreen />, { currentRoomId: 'room-2', completedRoomIds: [] });

    await waitFor(() => {
      expect(screen.getByText('群聊现场突然升温')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('看看更地道的说法'));

    await waitFor(() => {
      expect(screen.getByText('Card B')).toBeTruthy();
    });
  });
});
