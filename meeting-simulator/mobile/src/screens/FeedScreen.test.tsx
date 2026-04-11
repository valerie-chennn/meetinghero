import React from 'react';
import { fireEvent, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { getDmBanner, getFeedList } from '../api';
import { renderWithAppState } from '../test/renderWithAppState';
import { FeedScreen } from './FeedScreen';

jest.mock('../api', () => ({
  getFeedList: jest.fn(),
  getDmBanner: jest.fn(),
}));

describe('FeedScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getDmBanner as jest.Mock).mockResolvedValue({ hasBanner: false, banner: null });
  });

  it('renders feed cards and enters chat', async () => {
    (getFeedList as jest.Mock).mockResolvedValue({
      items: [
        {
          roomId: 'room-a',
          newsTitle: '【西游日报】唐僧在群里发起公开投票',
          npcAName: '唐僧',
          npcAReaction: '先别急。',
          npcBName: '悟空',
          npcBReaction: '我有意见。',
          tags: ['西游记'],
          difficulty: 'A2',
        },
        {
          roomId: 'room-b',
          newsTitle: '【漫威日报】钢铁侠要求今天内收敛方案',
          npcAName: 'Tony',
          npcAReaction: 'We need focus.',
          npcBName: 'Peter',
          npcBReaction: 'I can help.',
          tags: ['漫威'],
          difficulty: 'A2',
        },
      ],
    });

    const screen = renderWithAppState(<FeedScreen />, {
      completedRoomIds: ['room-a'],
      currentChatSessionId: 'chat-1',
      cardsSinceLastChat: 0,
    });

    await waitFor(() => {
      expect(screen.getByText(/唐僧在群里发起公开投票/)).toBeTruthy();
    });

    expect(screen.getByText('每日胡说')).toBeTruthy();
    fireEvent.press(screen.getAllByText('Join Chat')[0]);
    expect(router.push).toHaveBeenCalledWith('/chat/room-a');
  });
});
