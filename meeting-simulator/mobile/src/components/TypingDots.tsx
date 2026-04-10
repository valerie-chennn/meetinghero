import React from 'react';
import { StyleSheet, View } from 'react-native';

import { colors } from '../theme/colors';

export function TypingDots() {
  return (
    <View style={styles.wrapper}>
      <View style={styles.dot} />
      <View style={styles.dot} />
      <View style={styles.dot} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.inkSoft,
  },
});
