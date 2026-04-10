import '@testing-library/jest-native/extend-expect';
import React from 'react';

jest.mock('expo-router', () => ({
  Redirect: () => null,
  Stack: Object.assign(() => null, { Screen: () => null }),
  Tabs: Object.assign(() => null, { Screen: () => null }),
  router: {
    replace: jest.fn(),
    push: jest.fn(),
    back: jest.fn(),
  },
  useLocalSearchParams: jest.fn(() => ({})),
  usePathname: jest.fn(() => '/'),
}));

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

jest.mock('react-native-gesture-handler', () => ({
  GestureHandlerRootView: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('expo-status-bar', () => ({
  StatusBar: () => null,
}));

jest.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoVersion: '54.0.0',
  },
}));

jest.mock('expo-file-system', () => ({
  File: class MockFile {
    uri: string;

    constructor(..._args: unknown[]) {
      this.uri = 'file://mock-file';
    }

    create() {}

    write() {}
  },
  Paths: {
    cache: '/tmp',
  },
}));

jest.mock('expo-audio', () => ({
  createAudioPlayer: jest.fn(() => ({
    play: jest.fn(),
    remove: jest.fn(),
    currentStatus: {
      didJustFinish: true,
    },
  })),
  RecordingPresets: {
    HIGH_QUALITY: {},
  },
  requestRecordingPermissionsAsync: jest.fn(async () => ({ granted: true })),
  setAudioModeAsync: jest.fn(async () => undefined),
  useAudioRecorder: jest.fn(() => ({
    prepareToRecordAsync: jest.fn(async () => undefined),
    record: jest.fn(),
    stop: jest.fn(),
    getStatus: jest.fn(() => ({ url: 'file://mock-recording.m4a' })),
  })),
  useAudioRecorderState: jest.fn(() => ({ isRecording: false, durationMillis: 0 })),
}));

global.requestAnimationFrame = (callback: FrameRequestCallback) => setTimeout(callback, 0);
