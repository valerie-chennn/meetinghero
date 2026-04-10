import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';

export function SplashOverlay() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 3500);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <View style={styles.container}>
      <View style={styles.ruleBlock}>
        <View style={styles.ruleThick} />
        <View style={styles.ruleThin} />
      </View>
      <View style={styles.center}>
        <Text style={styles.en}>The Daily</Text>
        <Text style={styles.en}>Nonsense</Text>
        <View style={styles.separator} />
        <Text style={styles.zh}>每日胡说</Text>
        <Text style={styles.slogan}>一起来胡说八道。</Text>
      </View>
      <View style={styles.ruleBlock}>
        <View style={styles.ruleThin} />
        <View style={styles.ruleThick} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    backgroundColor: colors.background,
    justifyContent: 'space-between',
    paddingVertical: 44,
    paddingHorizontal: 28,
  },
  ruleBlock: {
    gap: 6,
  },
  ruleThick: {
    height: 3,
    backgroundColor: colors.ink,
  },
  ruleThin: {
    height: 1,
    backgroundColor: colors.ink,
  },
  center: {
    alignItems: 'center',
    gap: 10,
  },
  en: {
    fontSize: 42,
    lineHeight: 46,
    fontWeight: '800',
    color: colors.ink,
  },
  separator: {
    marginVertical: 10,
    width: 90,
    height: 2,
    backgroundColor: colors.line,
  },
  zh: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.ink,
  },
  slogan: {
    fontSize: 15,
    color: colors.inkSoft,
  },
});
