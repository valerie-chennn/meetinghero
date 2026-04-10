import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import { Text } from 'react-native';
import { render, waitFor } from '@testing-library/react-native';

import { AppStateProvider, useAppState } from './AppStateContext';

function ContextProbe() {
  const { state, isReady } = useAppState();
  return (
    <>
      <Text>{isReady ? 'ready' : 'loading'}</Text>
      <Text>{state.userId || 'no-user'}</Text>
      <Text>{state.userName || 'no-name'}</Text>
      <Text>{state.completedRoomIds.join(',') || 'no-rooms'}</Text>
    </>
  );
}

describe('AppStateContext', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('hydrates persisted app keys', async () => {
    await AsyncStorage.multiSet([
      ['app_userId', 'persisted-user'],
      ['app_userName', 'Morgan'],
      ['app_completedRoomIds', JSON.stringify(['room-1', 'room-2'])],
    ]);

    const screen = render(
      <AppStateProvider>
        <ContextProbe />
      </AppStateProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('ready')).toBeTruthy();
    });

    expect(screen.getByText('persisted-user')).toBeTruthy();
    expect(screen.getByText('Morgan')).toBeTruthy();
    expect(screen.getByText('room-1,room-2')).toBeTruthy();
  });

  it('generates a userId when storage is empty', async () => {
    const screen = render(
      <AppStateProvider>
        <ContextProbe />
      </AppStateProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('ready')).toBeTruthy();
    });

    expect(screen.queryByText('no-user')).toBeNull();
  });
});
