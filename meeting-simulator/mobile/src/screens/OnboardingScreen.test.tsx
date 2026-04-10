import React from 'react';
import { fireEvent, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { initUser } from '../api';
import { renderWithAppState } from '../test/renderWithAppState';
import { OnboardingScreen } from './OnboardingScreen';

jest.mock('../api', () => ({
  initUser: jest.fn(),
}));

describe('OnboardingScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('submits nickname and routes to feed', async () => {
    (initUser as jest.Mock).mockResolvedValue({ userId: 'user-1', nickname: 'Taylor', isNew: true });

    const screen = renderWithAppState(<OnboardingScreen />, { userId: 'user-1' });
    fireEvent.changeText(screen.getByPlaceholderText(/./), 'Taylor');
    fireEvent.press(screen.getByText('开始胡说'));

    await waitFor(() => {
      expect(initUser).toHaveBeenCalledWith('user-1', 'Taylor');
      expect(router.replace).toHaveBeenCalledWith('/feed');
    });
  });
});
