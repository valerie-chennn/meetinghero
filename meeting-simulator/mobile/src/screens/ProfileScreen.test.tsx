import React from 'react';
import { waitFor } from '@testing-library/react-native';

import { getUserStats } from '../api';
import { renderWithAppState } from '../test/renderWithAppState';
import { ProfileScreen } from './ProfileScreen';

jest.mock('../api', () => ({
  getUserStats: jest.fn(),
}));

describe('ProfileScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders user stats and profile info', async () => {
    (getUserStats as jest.Mock).mockResolvedValue({
      chatCount: 3,
      messageCount: 9,
      savedCount: 4,
    });

    const screen = renderWithAppState(<ProfileScreen />, {
      userId: 'user-12345678',
      userName: 'Jules',
    });

    await waitFor(() => {
      expect(screen.getAllByText('Jules').length).toBeGreaterThan(0);
    });

    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText('9')).toBeTruthy();
    expect(screen.getByText('4')).toBeTruthy();
  });
});
