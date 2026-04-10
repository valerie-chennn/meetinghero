import { Stack } from 'expo-router';
import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { SplashOverlay } from '../src/components/SplashOverlay';
import { AppStateProvider } from '../src/context/AppStateContext';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppStateProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="chat/[roomId]" />
          <Stack.Screen name="settlement/[sessionId]" />
          <Stack.Screen name="(tabs)" />
        </Stack>
        <SplashOverlay />
      </AppStateProvider>
    </GestureHandlerRootView>
  );
}
