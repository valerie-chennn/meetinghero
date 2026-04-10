import React from 'react';
import { waitFor } from '@testing-library/react-native';

import { getExpressions } from '../api';
import { renderWithAppState } from '../test/renderWithAppState';
import { ExpressionsScreen } from './ExpressionsScreen';

jest.mock('../api', () => ({
  getExpressions: jest.fn(),
  deleteExpression: jest.fn(),
}));

describe('ExpressionsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders cards and stats from the API', async () => {
    (getExpressions as jest.Mock).mockResolvedValue({
      cards: [
        { id: 1, userSaid: 'We should wait.', betterVersion: 'We should hold off for a moment.', isPracticed: true },
      ],
      stats: { total: 1, practicedCount: 1 },
    });

    const screen = renderWithAppState(<ExpressionsScreen />, { userId: 'user-1' });

    await waitFor(() => {
      expect(screen.getByText('We should hold off for a moment.')).toBeTruthy();
    });

    expect(screen.getAllByText('1').length).toBeGreaterThan(0);
    expect(screen.getAllByText('已练习').length).toBeGreaterThan(0);
  });

  it('shows an error state when loading fails', async () => {
    (getExpressions as jest.Mock).mockRejectedValue(new Error('加载失败'));

    const screen = renderWithAppState(<ExpressionsScreen />, { userId: 'user-1' });

    await waitFor(() => {
      expect(screen.getByText('加载失败')).toBeTruthy();
    });
  });
});
