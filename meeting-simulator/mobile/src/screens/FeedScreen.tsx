import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View, ViewToken } from 'react-native';

import { getDmBanner, getFeedList } from '../api';
import { DmBanner } from '../components/DmBanner';
import { AppSurface } from '../components/AppSurface';
import { useAppState } from '../context/AppStateContext';
import type { FeedItem } from '../api/types';
import { colors } from '../theme/colors';
import { parseNewsTitle, formatCount } from '../utils/text';
import { useResponsiveLayout } from '../utils/responsive';

const SOURCE_COLORS: Record<string, string> = {
  '西游记': '#C41E1E',
  '漫威': '#1A56DB',
  '迪士尼': '#7C5CBF',
  '哈利波特': '#B45309',
  '指环王': '#1A56DB',
  '三国': '#C41E1E',
  '宫斗': '#9B2C5E',
  '综艺': '#B45309',
};

function getSourceColor(tags: string[]) {
  return tags.find((tag) => SOURCE_COLORS[tag]) ? SOURCE_COLORS[tags.find((tag) => SOURCE_COLORS[tag])!] : '#C41E1E';
}

export function FeedScreen() {
  const { state, updateState } = useAppState();
  const { height } = useResponsiveLayout();
  const cardHeight = Math.max(560, height - 92);

  const [feeds, setFeeds] = useState<FeedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [bannerData, setBannerData] = useState<null | { npcName: string; message: string; messageZh?: string }>(null);
  const [cardIndex, setCardIndex] = useState(0);

  const countedCardsRef = useRef(new Set<string>());
  const fetchingBannerRef = useRef(false);
  const listRef = useRef<FlatList<FeedItem>>(null);

  const filteredFeed = useMemo(() => {
    return feeds.filter((item) => !(state.completedRoomIds || []).includes(item.roomId));
  }, [feeds, state.completedRoomIds]);

  const fetchFeeds = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      const data = await getFeedList(1, 10);
      setFeeds(data.items || []);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : '加载失败，请重试');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFeeds();
  }, [fetchFeeds]);

  useEffect(() => {
    if (feeds.length > 0 && filteredFeed.length === 0) {
      updateState({ completedRoomIds: [] });
    }
  }, [feeds.length, filteredFeed.length, updateState]);

  useEffect(() => {
    if (filteredFeed.length === 0) return;
    const currentCard = filteredFeed[cardIndex];
    if (!currentCard || countedCardsRef.current.has(currentCard.roomId)) return;

    countedCardsRef.current.add(currentCard.roomId);
    updateState({ cardsSinceLastChat: state.cardsSinceLastChat + 1, feedScrollIndex: cardIndex });
  }, [cardIndex, filteredFeed, state.cardsSinceLastChat, updateState]);

  useEffect(() => {
    async function maybeLoadBanner() {
      if (
        state.cardsSinceLastChat < 2 ||
        state.dmBannerShown >= 2 ||
        !state.currentChatSessionId ||
        fetchingBannerRef.current
      ) {
        return;
      }

      fetchingBannerRef.current = true;

      try {
        const data = await getDmBanner(state.currentChatSessionId);
        if (data.hasBanner && data.banner) {
          setBannerData(data.banner);
          updateState({
            dmBannerShown: state.dmBannerShown + 1,
            cardsSinceLastChat: 0,
          });
        }
      } catch {
        // 忽略 banner 拉取失败
      } finally {
        fetchingBannerRef.current = false;
      }
    }

    maybeLoadBanner();
  }, [state.cardsSinceLastChat, state.currentChatSessionId, state.dmBannerShown, updateState]);

  useEffect(() => {
    if (!filteredFeed.length || !state.feedScrollIndex) return;
    const nextIndex = Math.min(state.feedScrollIndex, filteredFeed.length - 1);
    requestAnimationFrame(() => {
      listRef.current?.scrollToIndex({ animated: false, index: nextIndex });
      setCardIndex(nextIndex);
    });
  }, [filteredFeed.length, state.feedScrollIndex]);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken<FeedItem>[] }) => {
      const item = viewableItems[0]?.index ?? 0;
      setCardIndex(item);
    }
  );

  if (isLoading) {
    return <LoadingState />;
  }

  if (error) {
    return (
      <AppSurface>
        <View style={styles.centerState}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={fetchFeeds} style={styles.retryButton}>
            <Text style={styles.retryLabel}>点击重试</Text>
          </Pressable>
        </View>
      </AppSurface>
    );
  }

  return (
    <AppSurface>
      <View style={styles.container}>
        {!!bannerData && (
          <DmBanner
            npcName={bannerData.npcName}
            message={bannerData.message}
            messageZh={bannerData.messageZh}
            onClose={() => setBannerData(null)}
          />
        )}
        <FlatList
          ref={listRef}
          data={filteredFeed}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          onViewableItemsChanged={onViewableItemsChanged.current}
          viewabilityConfig={{ itemVisiblePercentThreshold: 70 }}
          keyExtractor={(item) => item.roomId}
          getItemLayout={(_, index) => ({ index, length: cardHeight, offset: cardHeight * index })}
          renderItem={({ item }) => (
            <FeedCard
              item={item}
              cardHeight={cardHeight}
              onJoin={() => {
                updateState({ currentRoomId: item.roomId });
                router.push(`/chat/${item.roomId}`);
              }}
            />
          )}
        />
        <View style={styles.pagination}>
          {filteredFeed.map((item, index) => (
            <View key={item.roomId} style={[styles.dot, index === cardIndex ? styles.dotActive : null]} />
          ))}
        </View>
      </View>
    </AppSurface>
  );
}

function FeedCard({
  item,
  onJoin,
  cardHeight,
}: {
  item: FeedItem;
  onJoin: () => void;
  cardHeight: number;
}) {
  const { source, headline } = parseNewsTitle(item.newsTitle);
  const sourceColor = getSourceColor(item.tags || []);

  return (
    <View style={[styles.card, { backgroundColor: item.bgColor || colors.paper, minHeight: cardHeight }]}>
      <View style={styles.topRule} />
      <View style={styles.topRuleThin} />
      <View style={styles.cardBody}>
        {!!item.tags?.[0] && <Text style={styles.pill}>{item.tags[0]}</Text>}
        {!!source && <Text style={[styles.source, { color: sourceColor }]}>{source}</Text>}
        <View style={styles.headlineRule} />
        <Text style={styles.headline}>{headline}</Text>
        {!!item.newsTitleEn && <Text style={styles.headlineEn}>{item.newsTitleEn}</Text>}
        <View style={styles.contentRule} />
        <View style={styles.commentsCard}>
          <Text style={styles.commentsLabel}>当事人回应 / Statements</Text>
          <View style={styles.commentItem}>
            <Text style={styles.commentName}>{item.npcAName}</Text>
            <Text style={styles.commentText}>{item.npcAReaction}</Text>
            {!!item.npcAReactionEn && <Text style={styles.commentTextEn}>{item.npcAReactionEn}</Text>}
          </View>
          <View style={styles.commentItem}>
            <Text style={styles.commentName}>{item.npcBName}</Text>
            <Text style={styles.commentText}>{item.npcBReaction}</Text>
            {!!item.npcBReactionEn && <Text style={styles.commentTextEn}>{item.npcBReactionEn}</Text>}
          </View>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>❤️ {formatCount(item.likes || 0)}</Text>
          <Text style={styles.metaText}>💬 {formatCount(item.commentCount || 0)}</Text>
          <Text style={styles.metaText}>{item.difficulty}</Text>
        </View>
        <Pressable onPress={onJoin} style={styles.joinButton}>
          <Text style={styles.joinLabel}>加入讨论</Text>
        </Pressable>
      </View>
    </View>
  );
}

function LoadingState() {
  return (
    <AppSurface>
      <View style={styles.centerState}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingText}>正在加载 Feed...</Text>
      </View>
    </AppSurface>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
  },
  loadingText: {
    color: colors.inkSoft,
  },
  errorText: {
    color: colors.danger,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: colors.paperStrong,
    borderColor: colors.line,
    borderWidth: 1,
  },
  retryLabel: {
    color: colors.ink,
    fontWeight: '700',
  },
  card: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
  },
  topRule: {
    height: 3,
    backgroundColor: colors.ink,
    marginBottom: 6,
  },
  topRuleThin: {
    height: 1,
    backgroundColor: colors.ink,
  },
  cardBody: {
    flex: 1,
    paddingTop: 18,
  },
  pill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.paperStrong,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontSize: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: 12,
  },
  source: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
  },
  headlineRule: {
    height: 4,
    backgroundColor: colors.ink,
    marginBottom: 14,
  },
  headline: {
    fontSize: 30,
    lineHeight: 38,
    color: colors.ink,
    fontWeight: '800',
  },
  headlineEn: {
    marginTop: 10,
    fontSize: 14,
    color: colors.inkSoft,
    lineHeight: 20,
  },
  contentRule: {
    marginTop: 18,
    marginBottom: 18,
    height: 1,
    backgroundColor: colors.line,
  },
  commentsCard: {
    gap: 14,
    backgroundColor: colors.paperStrong,
    borderRadius: 20,
    padding: 16,
    borderColor: colors.line,
    borderWidth: 1,
  },
  commentsLabel: {
    fontSize: 12,
    color: colors.inkSoft,
    fontWeight: '700',
  },
  commentItem: {
    gap: 4,
  },
  commentName: {
    color: colors.ink,
    fontWeight: '700',
    fontSize: 14,
  },
  commentText: {
    color: colors.ink,
    fontSize: 15,
  },
  commentTextEn: {
    color: colors.inkSoft,
    fontSize: 13,
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 'auto',
    marginBottom: 16,
    paddingTop: 18,
  },
  metaText: {
    fontSize: 13,
    color: colors.inkSoft,
  },
  joinButton: {
    minHeight: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.ink,
  },
  joinLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  pagination: {
    position: 'absolute',
    right: 12,
    top: 120,
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(28, 27, 26, 0.18)',
  },
  dotActive: {
    backgroundColor: colors.ink,
    height: 18,
  },
});
