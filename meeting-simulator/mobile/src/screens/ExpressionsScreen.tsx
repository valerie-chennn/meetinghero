import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { deleteExpression, getExpressions } from '../api';
import { AppSurface } from '../components/AppSurface';
import { useAppState } from '../context/AppStateContext';
import { colors } from '../theme/colors';

export function ExpressionsScreen() {
  const { state } = useAppState();
  const [cards, setCards] = useState<Array<{
    id: number;
    userSaid: string;
    betterVersion: string;
    isPracticed: boolean;
  }>>([]);
  const [stats, setStats] = useState<{ total: number; practicedCount: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!state.userId) return;

    async function fetchData() {
      setIsLoading(true);
      setError('');
      try {
        const data = await getExpressions(state.userId!);
        setCards(data.cards || []);
        if (data.stats) {
          setStats({ total: data.stats.total, practicedCount: data.stats.practicedCount });
        }
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : '加载失败，请重试');
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [state.userId]);

  async function handleDelete(cardId: number) {
    if (!state.userId) return;

    await deleteExpression(cardId, state.userId);
    setCards((prev) => prev.filter((card) => card.id !== cardId));
    setStats((prev) => (prev ? { ...prev, total: Math.max(0, prev.total - 1) } : prev));
  }

  return (
    <AppSurface>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => {
              if (typeof router.canGoBack === 'function' && router.canGoBack()) {
                router.back();
                return;
              }
              router.replace('/feed');
            }}
            style={styles.backButton}
          >
            <Text style={styles.backButtonText}>‹</Text>
          </Pressable>
          <Text style={styles.title}>表达本</Text>
        </View>
        <Text style={styles.desc}>收藏你学到的地道英语表达</Text>

        {stats && !isLoading && !error && (
          <View style={styles.statsBar}>
            <Stat label="积累表达" value={stats.total} />
            <Stat label="已练习" value={stats.practicedCount} />
            <Stat label="练习率" value={stats.total > 0 ? `${Math.round((stats.practicedCount / stats.total) * 100)}%` : '0%'} />
          </View>
        )}

        {isLoading ? (
          <View style={styles.stateBox}>
            <ActivityIndicator color={colors.accent} />
            <Text style={styles.stateText}>加载中…</Text>
          </View>
        ) : error ? (
          <View style={styles.stateBox}>
            <Text style={styles.error}>{error}</Text>
          </View>
        ) : cards.length === 0 ? (
          <View style={styles.stateBox}>
            <Text style={styles.emptyIcon}>📖</Text>
            <Text style={styles.stateTitle}>暂无收藏的表达</Text>
            <Text style={styles.stateText}>参加群聊后，把学到的好表达收藏到这里。</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {cards.map((card) => (
              <View key={card.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardLabel}>你说的</Text>
                  <Pressable onPress={() => handleDelete(card.id)}>
                    <Text style={styles.unsave}>已收藏 ★</Text>
                  </Pressable>
                </View>
                <Text style={styles.userSaid}>{card.userSaid}</Text>
                <Text style={[styles.cardLabel, styles.cardLabelGreen]}>更好的说法</Text>
                <Text style={styles.better}>{card.betterVersion}</Text>
                <Text style={styles.practice}>{card.isPracticed ? '已练习' : '未练习'}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </AppSurface>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.statItem}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    gap: 18,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.paperStrong,
    borderWidth: 1,
    borderColor: colors.line,
  },
  backButtonText: {
    color: colors.ink,
    fontSize: 24,
    lineHeight: 24,
    fontWeight: '500',
  },
  title: {
    fontSize: 34,
    fontWeight: '800',
    color: colors.ink,
  },
  desc: {
    fontSize: 15,
    color: colors.inkSoft,
  },
  statsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.paperStrong,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 18,
  },
  statItem: {
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.ink,
  },
  statLabel: {
    fontSize: 12,
    color: colors.inkSoft,
  },
  stateBox: {
    minHeight: 260,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.paperStrong,
    borderRadius: 22,
    padding: 24,
    borderColor: colors.line,
    borderWidth: 1,
  },
  stateText: {
    color: colors.inkSoft,
    textAlign: 'center',
  },
  stateTitle: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: '700',
  },
  emptyIcon: {
    fontSize: 28,
  },
  error: {
    color: colors.danger,
    textAlign: 'center',
  },
  list: {
    gap: 14,
  },
  card: {
    backgroundColor: colors.paperStrong,
    borderRadius: 22,
    padding: 18,
    gap: 10,
    borderColor: colors.line,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardLabel: {
    color: colors.inkSoft,
    fontSize: 12,
    fontWeight: '700',
  },
  cardLabelGreen: {
    color: colors.green,
  },
  unsave: {
    color: colors.gold,
    fontWeight: '700',
  },
  userSaid: {
    color: colors.ink,
    fontSize: 15,
  },
  better: {
    color: colors.ink,
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '700',
  },
  practice: {
    color: colors.inkSoft,
    fontSize: 12,
  },
});
