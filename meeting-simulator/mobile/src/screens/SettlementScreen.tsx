import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { getSettlement } from '../api';
import { AppSurface } from '../components/AppSurface';
import { PrimaryButton } from '../components/PrimaryButton';
import { useAppState } from '../context/AppStateContext';
import { colors } from '../theme/colors';
import { highlightSegments } from '../utils/text';

const SWIPE_HINT_KEY = 'settlement_swipe_hint_seen';

export function SettlementScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const { state, updateState } = useAppState();
  const roomId = state.currentRoomId;

  const [settlement, setSettlement] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState<'settlement' | 'expression'>('settlement');
  const [hintVisible, setHintVisible] = useState(false);
  const [cardIndex, setCardIndex] = useState(0);

  useEffect(() => {
    if (!sessionId) return;

    async function fetchData() {
      setIsLoading(true);
      setError('');
      try {
        const data = await getSettlement(sessionId);
        setSettlement(data);
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : '加载失败，请重试');
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [sessionId]);

  const expressionCards = useMemo(() => {
    const cards = settlement?.expressionCards || [];
    const featured = cards.find((card: any) => card.isFeatured);
    return featured ? [featured, ...cards.filter((card: any) => card.id !== featured.id)] : cards;
  }, [settlement?.expressionCards]);

  async function handleBackToFeed() {
    if (roomId && !state.completedRoomIds.includes(roomId)) {
      updateState({
        completedRoomIds: [...state.completedRoomIds, roomId],
      });
    }

    updateState({ cardsSinceLastChat: 0 });
    router.replace('/feed');
  }

  async function handleGoToExpression() {
    const seen = await AsyncStorage.getItem(SWIPE_HINT_KEY);
    setHintVisible(!seen);
    setCardIndex(0);
    setView('expression');
  }

  async function handleSwipeOnce(index: number) {
    setCardIndex(index);
    if (index > 0 && hintVisible) {
      setHintVisible(false);
      await AsyncStorage.setItem(SWIPE_HINT_KEY, '1');
    }
  }

  if (isLoading) {
    return (
      <AppSurface>
        <View style={styles.stateBox}>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.stateText}>正在加载结算数据…</Text>
        </View>
      </AppSurface>
    );
  }

  if (error || !settlement) {
    return (
      <AppSurface>
        <View style={styles.stateBox}>
          <Text style={styles.error}>{error || '结算数据不存在'}</Text>
        </View>
      </AppSurface>
    );
  }

  const newsletter = settlement.newsletter;
  const epilogue = Array.isArray(newsletter?.epilogue)
    ? newsletter.epilogue
    : String(newsletter?.epilogue || '')
        .split(/。|！|？/)
        .map((item) => item.trim())
        .filter(Boolean);

  if (view === 'expression') {
    return (
      <AppSurface>
        <View style={styles.container}>
          <Text style={styles.sectionTitle}>更地道的说法</Text>
          {hintVisible && <Text style={styles.swipeHint}>左右滑动查看更多表达卡片</Text>}
          <FlatList
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            data={expressionCards}
            keyExtractor={(item) => String(item.id)}
            onMomentumScrollEnd={(event) => {
              const nextIndex = Math.round(event.nativeEvent.contentOffset.x / event.nativeEvent.layoutMeasurement.width);
              handleSwipeOnce(nextIndex);
            }}
            renderItem={({ item }) => <ExpressionCard card={item} />}
          />
          <View style={styles.pagination}>
            {expressionCards.map((item: any, index: number) => (
              <View key={item.id} style={[styles.dot, cardIndex === index ? styles.dotActive : null]} />
            ))}
          </View>
          <PrimaryButton label="回到首页" onPress={handleBackToFeed} />
        </View>
      </AppSurface>
    );
  }

  return (
    <AppSurface>
      <View style={styles.container}>
        <View style={styles.headerRuleFat} />
        <View style={styles.headerRuleThin} />
        <View style={styles.publisherRow}>
          <Text style={styles.publisher}>{newsletter?.publisher || '东海商报'}</Text>
          {!!newsletter?.ipName && <Text style={styles.ipPill}>{newsletter.ipName}</Text>}
        </View>
        <Text style={styles.headline}>{newsletter?.headline}</Text>
        <View style={styles.statsBar}>
          <StatCard label="对话时长" value={settlement.stats?.duration || '—:—'} />
          <StatCard label="输出词数" value={`${settlement.stats?.wordCount || 0} words`} />
        </View>
        <View style={styles.epilogueCard}>
          <Text style={styles.smallLabel}>后续报道</Text>
          {epilogue.map((item: string, index: number) => (
            <View key={`${item}-${index}`} style={styles.epilogueItem}>
              <View style={styles.epilogueDot} />
              <Text style={styles.epilogueText}>{item}</Text>
            </View>
          ))}
          <View style={styles.divider} />
          <Text style={styles.smallLabel}>你获得了称号</Text>
          <View style={styles.titleBox}>
            <Text style={styles.titleBoxText}>{newsletter?.title}</Text>
          </View>
        </View>
        <View style={styles.buttonArea}>
          <PrimaryButton label="看看更地道的说法" onPress={handleGoToExpression} />
          <PrimaryButton label="回到首页" variant="secondary" onPress={handleBackToFeed} />
        </View>
      </View>
    </AppSurface>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ExpressionCard({ card }: { card: any }) {
  return (
    <View style={styles.expressionCard}>
      <Text style={styles.smallLabel}>你说的</Text>
      <Text style={styles.userSaid}>{card.userSaid || '（未发言）'}</Text>
      <View style={styles.feedbackPill}>
        <Text style={styles.feedbackPillText}>{card.feedbackType || '更好的说法'}</Text>
      </View>
      <Text style={styles.betterVersion}>
        {highlightSegments(card.betterVersion, card.highlights || []).map((part, index) => (
          <Text
            key={`${part.text}-${index}`}
            style={part.highlighted ? styles.highlight : undefined}
          >
            {part.text}
          </Text>
        ))}
      </Text>
      {card.learningType === 'pattern' && !!card.pattern && (
        <View style={styles.patternBlock}>
          <Text style={styles.smallLabel}>核心句型</Text>
          <Text style={styles.patternText}>{card.pattern}</Text>
        </View>
      )}
      {card.learningType === 'collocations' && Array.isArray(card.collocations) && (
        <View style={styles.collocations}>
          {card.collocations.map((item: any) => (
            <View key={item.phrase} style={styles.collocationPill}>
              <Text style={styles.collocationEn}>{item.phrase}</Text>
              <Text style={styles.collocationZh}>{item.meaning}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    gap: 16,
  },
  stateBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  stateText: {
    color: colors.inkSoft,
  },
  error: {
    color: colors.danger,
    textAlign: 'center',
  },
  headerRuleFat: {
    height: 3,
    backgroundColor: colors.ink,
  },
  headerRuleThin: {
    height: 1,
    backgroundColor: colors.ink,
  },
  publisherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 6,
  },
  publisher: {
    color: colors.ink,
    fontWeight: '700',
  },
  ipPill: {
    backgroundColor: colors.paperStrong,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    color: colors.inkSoft,
    overflow: 'hidden',
    fontSize: 12,
  },
  headline: {
    fontSize: 34,
    lineHeight: 42,
    fontWeight: '800',
    color: colors.ink,
  },
  statsBar: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.paperStrong,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 20,
    padding: 16,
    gap: 6,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.ink,
  },
  statLabel: {
    color: colors.inkSoft,
    fontSize: 12,
  },
  epilogueCard: {
    backgroundColor: colors.paperStrong,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 18,
    gap: 12,
  },
  smallLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.inkSoft,
  },
  epilogueItem: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  epilogueDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
    backgroundColor: colors.accent,
  },
  epilogueText: {
    flex: 1,
    color: colors.ink,
    lineHeight: 22,
  },
  divider: {
    height: 1,
    backgroundColor: colors.line,
  },
  titleBox: {
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 18,
    backgroundColor: colors.accentSoft,
  },
  titleBoxText: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.accent,
  },
  buttonArea: {
    marginTop: 'auto',
    gap: 12,
  },
  sectionTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: colors.ink,
  },
  swipeHint: {
    color: colors.accent,
    fontWeight: '600',
  },
  expressionCard: {
    width: 340,
    marginRight: 16,
    backgroundColor: colors.paperStrong,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 22,
    padding: 18,
    gap: 12,
  },
  userSaid: {
    fontSize: 15,
    color: colors.ink,
    lineHeight: 22,
  },
  feedbackPill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accentSoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  feedbackPillText: {
    color: colors.accent,
    fontWeight: '700',
    fontSize: 12,
  },
  betterVersion: {
    fontSize: 20,
    lineHeight: 28,
    color: colors.ink,
    fontWeight: '700',
  },
  highlight: {
    color: colors.accent,
    fontWeight: '800',
  },
  patternBlock: {
    gap: 8,
    backgroundColor: colors.paper,
    borderRadius: 18,
    padding: 14,
  },
  patternText: {
    color: colors.ink,
    fontWeight: '700',
    fontSize: 16,
  },
  collocations: {
    gap: 10,
  },
  collocationPill: {
    backgroundColor: colors.greenSoft,
    borderRadius: 16,
    padding: 12,
    gap: 4,
  },
  collocationEn: {
    color: colors.green,
    fontWeight: '700',
  },
  collocationZh: {
    color: colors.inkSoft,
    fontSize: 12,
  },
  pagination: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.line,
  },
  dotActive: {
    backgroundColor: colors.accent,
    width: 18,
  },
});
