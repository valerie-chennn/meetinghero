module.exports = {
  preset: 'react-native',
  setupFilesAfterEnv: ['<rootDir>/src/test/setup.ts'],
  transformIgnorePatterns: [
    'node_modules/(?!(?:react-native|@react-native|@react-native-async-storage|expo(?:nent)?|expo-.*|@expo(?:nent)?/.*|@expo/.*|@react-navigation/.*|react-native-safe-area-context|react-native-screens|react-native-gesture-handler|react-native-reanimated)/)',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
};
