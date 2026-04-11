import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewToken,
} from 'react-native';

import { getApiBaseUrl } from '../api/client';
import { getDmBanner, getFeedList } from '../api';
import type { FeedItem } from '../api/types';
import { AppSurface } from '../components/AppSurface';
import { DmBanner } from '../components/DmBanner';
import { FeedEndCard } from '../components/FeedEndCard';
import { useAppState } from '../context/AppStateContext';
import { colors } from '../theme/colors';
import { formatCount, parseNewsTitle } from '../utils/text';
import { useResponsiveLayout } from '../utils/responsive';

type FeedListEntry =
  | (FeedItem & { kind?: 'room' })
  | { kind: 'end'; id: 'feed-end-card' };

function withAlpha(color?: string | null, alpha = '1A') {
  if (!color || !/^#[0-9a-fA-F]{6}$/.test(color)) {
    return `#C41E1E${alpha}`;
  }
  return `${color}${alpha}`;
}

function getHeadlineFontSize(headline: string) {
  const longestLine = headline
    .split('\n')
    .reduce((max, line) => Math.max(max, line.trim().length), 0);

  if (longestLine >= 15) return 26;
  if (longestLine >= 12) return 29;
  return 33;
}

function getCoverUrl(coverImage?: string | null) {
  if (!coverImage) return null;
  if (/^https?:\/\//i.test(coverImage)) return coverImage;
  return `${getApiBaseUrl()}${coverImage.startsWith('/') ? coverImage : `/${coverImage}`}`;
}

export function FeedScreen() {
  const { state, updateState } = useAppState();
  const { height } = useResponsiveLayout();

  const [feeds, setFeeds] = useState<FeedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [bannerData, setBannerData] = useState<null | { npcName: string; message: string; messageZh?: string }>(null);
  const [cardIndex, setCardIndex] = useState(0);
  const [listHeight, setListHeight] = useState(0);

  const countedCardsRef = useRef(new Set<string>());
  const fetchingBannerRef = useRef(false);
  const listRef = useRef<FlatList<FeedListEntry>>(null);
  const cardsSinceLastChatRef = useRef(state.cardsSinceLastChat);

  useEffect(() => {
    cardsSinceLastChatRef.current = state.cardsSinceLastChat;
  }, [state.cardsSinceLastChat]);

  const filteredFeed = useMemo(() => {
    // 与 main 保持一致：当前版本不在 Feed 中隐藏已完成房间。
    return feeds;
  }, [feeds]);

  const feedEntries = useMemo<FeedListEntry[]>(() => {
    return [...filteredFeed, { kind: 'end', id: 'feed-end-card' }];
  }, [filteredFeed]);

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

  const checkDmBanner = useCallback(async () => {
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
  }, [state.cardsSinceLastChat, state.currentChatSessionId, state.dmBannerShown, updateState]);

  useEffect(() => {
    checkDmBanner();
  }, [checkDmBanner]);

  useEffect(() => {
    if (filteredFeed.length === 0) return;
    const currentCard = filteredFeed[cardIndex];
    if (!currentCard || countedCardsRef.current.has(currentCard.roomId)) return;

    countedCardsRef.current.add(currentCard.roomId);
    updateState({
      cardsSinceLastChat: cardsSinceLastChatRef.current + 1,
      feedScrollIndex: cardIndex,
    });
  }, [cardIndex, filteredFeed, updateState]);

  useEffect(() => {
    if (filteredFeed.length === 0) return;
    const nextIndex = Math.min(state.feedScrollIndex || 0, feedEntries.length - 1);
    requestAnimationFrame(() => {
      listRef.current?.scrollToIndex({ animated: false, index: nextIndex });
      setCardIndex(nextIndex);
    });
  }, [feedEntries.length, filteredFeed.length, state.feedScrollIndex]);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken<FeedListEntry>[] }) => {
      const nextIndex = viewableItems[0]?.index ?? 0;
      setCardIndex(nextIndex);
    }
  );
  const fallbackCardHeight = Math.max(520, height - 170);
  const cardHeight = listHeight > 0 ? listHeight : fallbackCardHeight;

  const handleListWrapLayout = useCallback((event: LayoutChangeEvent) => {
    const nextHeight = Math.round(event.nativeEvent.layout.height);
    if (nextHeight > 0 && nextHeight !== listHeight) {
      setListHeight(nextHeight);
    }
  }, [listHeight]);

  const currentCard = cardIndex < filteredFeed.length ? filteredFeed[cardIndex] : null;
  const headerBg = currentCard?.headerBg || '#F0EBE4';
  const headerText = currentCard?.headerText || '#3A2E22';

  if (isLoading) {
    return (
      <AppSurface backgroundColor={headerBg}>
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingText}>正在加载 Feed...</Text>
        </View>
      </AppSurface>
    );
  }

  if (error) {
    return (
      <AppSurface backgroundColor={headerBg}>
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
    <AppSurface backgroundColor={headerBg}>
      <View style={styles.container}>
        <View style={[styles.header, { backgroundColor: headerBg }]}>
          <Text style={[styles.headerTitle, { color: headerText }]}>每日胡说</Text>
          <Pressable onPress={() => router.push('/profile')} style={styles.headerAvatar}>
            <Text style={styles.headerAvatarText}>{state.userName?.[0] || '?'}</Text>
          </Pressable>
        </View>

        {!!bannerData && (
          <DmBanner
            npcName={bannerData.npcName}
            message={bannerData.message}
            messageZh={bannerData.messageZh}
            onClose={() => setBannerData(null)}
          />
        )}

        <View style={styles.listWrap} onLayout={handleListWrapLayout}>
          <FlatList
            ref={listRef}
            data={feedEntries}
            pagingEnabled
            showsVerticalScrollIndicator={false}
            keyExtractor={(item) => (item.kind === 'end' ? item.id : item.roomId)}
            renderItem={({ item }) =>
              item.kind === 'end' ? (
                <FeedEndCard height={cardHeight} expressionCount={0} />
              ) : (
                <FeedCard
                  item={item}
                  cardHeight={cardHeight}
                  onJoin={() => {
                    updateState({ currentRoomId: item.roomId });
                    router.push(`/chat/${item.roomId}`);
                  }}
                />
              )
            }
            getItemLayout={(_, index) => ({ index, length: cardHeight, offset: cardHeight * index })}
            onViewableItemsChanged={onViewableItemsChanged.current}
            viewabilityConfig={{ itemVisiblePercentThreshold: 70 }}
          />

          {feedEntries.length > 0 && (
            <View style={styles.pagination}>
              {feedEntries.map((item, index) => (
                <View
                  key={item.kind === 'end' ? item.id : item.roomId}
                  style={[styles.dot, index === cardIndex ? styles.dotActive : null]}
                />
              ))}
            </View>
          )}
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
  const [coverFailed, setCoverFailed] = useState(false);
  const { source, headline } = parseNewsTitle(item.newsTitle);
  const headlineFontSize = getHeadlineFontSize(headline);
  const coverUrl = getCoverUrl(item.coverImage);
  const showCoverImage = !!coverUrl && !coverFailed;

  useEffect(() => {
    setCoverFailed(false);
  }, [item.coverImage]);

  return (
    <View style={[styles.card, { backgroundColor: item.bgColor || colors.paper, height: cardHeight }]}>
      <View style={styles.topRule} />
      <View style={styles.topRuleThin} />

      <View style={styles.cardBody}>
        {!!item.tags?.[0] && (
          <View style={[styles.pill, { backgroundColor: withAlpha(item.accentColor) }]}>
            <Text style={[styles.pillText, { color: item.accentColor || '#C41E1E' }]}>{item.tags[0]}</Text>
          </View>
        )}

        {!!source && <Text style={[styles.source, { color: item.accentColor || '#C41E1E' }]}>{source}</Text>}
        <View style={styles.headlineRule} />

        <View style={styles.headlineWrap}>
          {headline.split('\n').map((line, index) => (
            <Text key={`${line}-${index}`} style={[styles.headline, { fontSize: headlineFontSize }]}>
              {line}
            </Text>
          ))}
        </View>

        {(showCoverImage || item.coverImage) && (
          showCoverImage ? (
            <Image
              source={{ uri: coverUrl }}
              style={styles.coverImage}
              resizeMode="cover"
              onError={() => setCoverFailed(true)}
            />
          ) : (
            <View
              style={[
                styles.coverPlaceholder,
                { backgroundColor: withAlpha(item.accentColor, '22') },
              ]}
            >
              <Text style={[styles.coverPlaceholderKicker, { color: item.accentColor || colors.accent }]}>
                {source || item.tags?.[0] || 'Breaking'}
              </Text>
              <Text style={styles.coverPlaceholderTitle} numberOfLines={2}>
                {headline.replace(/\n/g, ' ')}
              </Text>
              <Text style={styles.coverPlaceholderMeta}>
                {item.npcAName} × {item.npcBName}
              </Text>
            </View>
          )
        )}

        <View style={styles.statementsSection}>
          <View style={styles.statementsHeader}>
            <Text style={styles.statementsLabel}>Statements</Text>
            <View style={styles.statementsLine} />
          </View>

          <QuoteBlock
            name={item.npcAName}
            english={item.npcAReactionEn || item.npcAReaction}
            chinese={item.npcAReaction}
            color={item.accentColor || '#C41E1E'}
          />

          <View style={styles.quoteSeparator} />

          <QuoteBlock
            name={item.npcBName}
            english={item.npcBReactionEn || item.npcBReaction}
            chinese={item.npcBReaction}
            color={item.accentDark || '#1A1A1A'}
          />

          <View style={styles.metaRow}>
            <Text style={styles.metaText}>{formatCount(item.likes || 0)}人围观</Text>
            <View style={styles.metaDot} />
            <Text style={styles.metaText}>{formatCount(item.commentCount || 0)}条评论</Text>
          </View>
        </View>

        <Pressable
          onPress={onJoin}
          style={[styles.joinButton, { backgroundColor: item.accentDark || '#1A1A1A' }]}
        >
          <Text style={styles.joinLabel}>Join Chat</Text>
        </Pressable>

        <View style={styles.swipeHint}>
          <Text style={styles.swipeHintText}>˄ 上划看下一条</Text>
        </View>
      </View>
    </View>
  );
}

function QuoteBlock({
  name,
  english,
  chinese,
  color,
}: {
  name: string;
  english: string;
  chinese: string;
  color: string;
}) {
  return (
    <View style={[styles.quoteBlock, { borderLeftColor: color }]}>
      <Text style={[styles.quoteName, { color }]}>{name}</Text>
      <Text style={styles.quoteEn}>{english}</Text>
      <Text style={styles.quoteZh}>{chinese}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    minHeight: 68,
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(58,46,34,0.08)',
  },
  headerAvatarText: {
    color: colors.ink,
    fontWeight: '800',
  },
  listWrap: {
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
    minWidth: 120,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: colors.ink,
  },
  retryLabel: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  pagination: {
    position: 'absolute',
    right: 12,
    top: '42%',
    gap: 8,
    alignItems: 'center',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(28,27,26,0.18)',
  },
  dotActive: {
    width: 9,
    height: 18,
    borderRadius: 999,
    backgroundColor: colors.ink,
  },
  card: {
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  topRule: {
    height: 3,
    backgroundColor: colors.ink,
    marginBottom: 4,
  },
  topRuleThin: {
    height: 1,
    backgroundColor: colors.ink,
  },
  cardBody: {
    flex: 1,
    paddingTop: 18,
    paddingBottom: 12,
    gap: 14,
  },
  pill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  source: {
    fontSize: 15,
    fontWeight: '700',
  },
  headlineRule: {
    height: 2,
    backgroundColor: 'rgba(28,27,26,0.12)',
  },
  headlineWrap: {
    gap: 2,
  },
  headline: {
    lineHeight: 39,
    fontWeight: '900',
    color: colors.ink,
    letterSpacing: -0.4,
  },
  coverImage: {
    width: '100%',
    height: 118,
    borderRadius: 18,
    backgroundColor: '#E9DED0',
  },
  coverPlaceholder: {
    width: '100%',
    minHeight: 118,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(28,27,26,0.08)',
  },
  coverPlaceholderKicker: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  coverPlaceholderTitle: {
    color: colors.ink,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '800',
  },
  coverPlaceholderMeta: {
    color: colors.inkSoft,
    fontSize: 12,
    fontWeight: '600',
  },
  statementsSection: {
    flex: 1,
    borderRadius: 22,
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.54)',
    borderWidth: 1,
    borderColor: 'rgba(28,27,26,0.08)',
    gap: 14,
  },
  statementsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statementsLabel: {
    color: colors.inkSoft,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  statementsLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(28,27,26,0.12)',
  },
  quoteBlock: {
    borderLeftWidth: 3,
    paddingLeft: 12,
    gap: 4,
  },
  quoteName: {
    fontSize: 13,
    fontWeight: '800',
  },
  quoteEn: {
    color: colors.ink,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
  },
  quoteZh: {
    color: colors.inkSoft,
    fontSize: 13,
    lineHeight: 18,
  },
  quoteSeparator: {
    height: 1,
    backgroundColor: 'rgba(28,27,26,0.08)',
  },
  metaRow: {
    marginTop: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 4,
  },
  metaText: {
    color: colors.inkSoft,
    fontSize: 12,
  },
  metaDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.inkSoft,
  },
  joinButton: {
    minHeight: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  joinLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  swipeHint: {
    alignItems: 'center',
    paddingTop: 2,
  },
  swipeHintText: {
    color: colors.inkSoft,
    fontSize: 12,
  },
});
