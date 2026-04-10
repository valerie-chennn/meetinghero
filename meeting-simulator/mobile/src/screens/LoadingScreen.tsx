import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';

export function LoadingScreen({ label }: { label: string }) {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.accent} />
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  label: {
    color: colors.inkSoft,
    fontSize: 15,
  },
});
