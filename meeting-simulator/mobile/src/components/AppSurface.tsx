import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '../theme/colors';
import { useResponsiveLayout } from '../utils/responsive';

export function AppSurface({
  children,
  backgroundColor = colors.background,
}: {
  children: React.ReactNode;
  backgroundColor?: string;
}) {
  const { contentWidth } = useResponsiveLayout();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor }]}>
      <View style={styles.shell}>
        <View style={[styles.content, { maxWidth: contentWidth }]}>{children}</View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  shell: {
    flex: 1,
    alignItems: 'center',
  },
  content: {
    flex: 1,
    width: '100%',
  },
});
