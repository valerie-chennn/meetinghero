import { router } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';

export function FeedEndCard({
  height,
  expressionCount = 0,
}: {
  height: number;
  expressionCount?: number;
}) {
  const pulse = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.35, duration: 900, useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [pulse]);

  return (
    <View style={[styles.card, { minHeight: height }]}>
      <View style={styles.content}>
        <View style={styles.printAnim}>
          <View style={styles.paper}>
            {[0, 1, 2, 3, 4].map((index) => (
              <Animated.View
                key={index}
                style={[
                  styles.inkLine,
                  {
                    opacity: pulse,
                    width: `${78 - index * 9}%`,
                  },
                ]}
              />
            ))}
          </View>
        </View>

        <Text style={styles.title}>Next edition printing</Text>
        <Text style={styles.subtitle}>A new story is on the press.</Text>
        <View style={styles.divider} />

        <Pressable onPress={() => router.push('/expressions')} style={styles.expressionCard}>
          <View style={styles.expressionIcon}>
            <Text style={styles.expressionIconText}>📖</Text>
            {expressionCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{expressionCount}</Text>
              </View>
            )}
          </View>
          <View style={styles.expressionMeta}>
            <Text style={styles.expressionTitle}>Expression book</Text>
            <Text style={styles.expressionSubtitle}>{expressionCount} expressions to review</Text>
          </View>
          <Text style={styles.expressionArrow}>›</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#F5F3EE',
    paddingHorizontal: 24,
    paddingVertical: 32,
    justifyContent: 'center',
  },
  content: {
    borderRadius: 30,
    padding: 24,
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderWidth: 1,
    borderColor: '#E3D8C8',
    gap: 16,
    shadowColor: colors.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  printAnim: {
    alignItems: 'center',
    marginBottom: 4,
  },
  paper: {
    width: 150,
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 20,
    backgroundColor: '#FFFDF9',
    borderWidth: 1,
    borderColor: '#E3D8C8',
    gap: 10,
  },
  inkLine: {
    height: 6,
    borderRadius: 999,
    backgroundColor: '#BBAA92',
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    color: '#2E241A',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#6F655C',
    textAlign: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: '#E3D8C8',
    marginVertical: 4,
  },
  expressionCard: {
    minHeight: 88,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E3D8C8',
    paddingHorizontal: 18,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  expressionIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expressionIconText: {
    fontSize: 22,
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.coral,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  expressionMeta: {
    flex: 1,
    gap: 4,
  },
  expressionTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '700',
  },
  expressionSubtitle: {
    color: colors.inkSoft,
    fontSize: 13,
  },
  expressionArrow: {
    color: '#999181',
    fontSize: 26,
    fontWeight: '400',
  },
});
