import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { getFeedList, getDmBanner } from '../api/index.js';
import DmBanner from '../components/DmBanner.jsx';
import FeedEndCard from '../components/FeedEndCard.jsx';
import styles from './FeedPage.module.css';

// 格式化互动数据：超过万显示 x.xw，超过千显示 x.xk
function formatCount(n) {
  if (n >= 10000) return (n / 10000).toFixed(1) + 'w';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(n);
}

// 从 "【东海商报】东海三太子..." 解析出报纸来源和标题
function parseNewsTitle(title) {
  const match = title.match(/【(.+?)】([\s\S]+)/);
  if (match) return { source: match[1], headline: match[2] };
  return { source: '', headline: title };
}


function FeedPage() {
  const navigate = useNavigate();
  const { state, updateState } = useApp();

  const [feeds, setFeeds] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // 当前卡片索引（驱动 transform + 圆点指示器）
  const [cardIndex, setCardIndex] = useState(0);
  // 拖拽偏移量（px）
  const [dragY, setDragY] = useState(0);
  // 是否正在拖拽
  const [dragging, setDragging] = useState(false);
  // 是否正在动画中（防止连续触发）
  const [animating, setAnimating] = useState(false);

  // DmBanner 相关状态
  const [bannerData, setBannerData] = useState(null); // { npcName, message, messageZh } | null

  // 标题 DOM ref 池：用于字号自适应
  const headlineRefs = useRef({});

  // 拖拽起始 Y 坐标
  const startYRef = useRef(0);
  // 滑动容器 ref（用于挂载 wheel 事件）
  const containerRef = useRef(null);
  // 记录已经计数过的卡片（避免重复计数同一张卡片）
  const countedCardsRef = useRef(new Set());
  // 防止 DmBanner 并发请求
  const fetchingBannerRef = useRef(false);
  // 用 ref 同步最新的 cardsSinceLastChat，供闭包使用（避免捕获旧值）
  const cardsSinceLastChatRef = useRef(state.cardsSinceLastChat);

  // 卡片高度 = feedContainer 实际 clientHeight（随 resize 动态更新）
  // 不能用 window.innerHeight - 60，因为 .phone-content 已经 flex:1 扣过 Tab 高度，
  // 且 dvh/innerHeight/safe-area 三种口径在 iOS Safari 会偏差几十 px，导致卡片超出可视区。
  const [cardHeight, setCardHeight] = useState(0);

  // 加载 Feed 列表
  const fetchFeeds = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await getFeedList(1, 10);
      setFeeds(data.items || []);
    } catch (err) {
      console.error('加载 Feed 失败:', err);
      setError('加载失败，点击重试');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFeeds();
  }, [fetchFeeds]);

  // 过滤已完成的房间，让用户在 Feed 看到"新"卡片
  const completedIds = state.completedRoomIds || [];
  const rawFeed = feeds;
  const filteredFeed = rawFeed.filter(item => !completedIds.includes(item.roomId));

  // 标题字号自适应：找最长行，缩放到刚好填满容器宽度
  useEffect(() => {
    filteredFeed.forEach(item => {
      const { headline } = parseNewsTitle(item.newsTitle);
      if (!headline.includes('\n')) return; // 无分行则不处理
      const el = headlineRefs.current[item.roomId];
      if (!el) return;
      const lines = el.querySelectorAll('.' + styles.headlineLine);
      const containerW = el.offsetWidth;
      if (containerW <= 0 || lines.length === 0) return;

      const maxFs = 32;
      const minFs = 16;

      // 先用最大字号量出每行自然宽度
      lines.forEach(l => { l.style.fontSize = maxFs + 'px'; });

      // 找到最长行
      let longest = 0;
      lines.forEach(l => { if (l.scrollWidth > longest) longest = l.scrollWidth; });

      // 统一缩放到最长行刚好 = 容器宽度
      let fs = maxFs;
      if (longest > containerW) {
        fs = Math.max(minFs, Math.floor(maxFs * (containerW / longest)));
      }
      lines.forEach(l => { l.style.fontSize = fs + 'px'; });
    });
  }, [filteredFeed]);

  // 兜底：如果全部做完（过滤后为空但原始列表非空），清空已完成列表让所有房间重新出现
  useEffect(() => {
    if (rawFeed.length > 0 && filteredFeed.length === 0) {
      updateState({ completedRoomIds: [] });
    }
  }, [rawFeed.length, filteredFeed.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // filteredFeed 长度变化时，确保 cardIndex 不越界（例如过滤后列表变短）
  useEffect(() => {
    if (filteredFeed.length > 0 && cardIndex >= filteredFeed.length + 1) {
      setCardIndex(0);
    }
  }, [filteredFeed.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // 检查是否应该显示 DmBanner，并请求接口
  const checkDmBanner = useCallback(async () => {
    // 条件：卡片计数 >= 2，banner 展示次数 < 2，有已完成的 chatSessionId，未在请求中
    if (
      state.cardsSinceLastChat >= 2 &&
      state.dmBannerShown < 2 &&
      state.currentChatSessionId &&
      !fetchingBannerRef.current
    ) {
      fetchingBannerRef.current = true;
      try {
        const data = await getDmBanner(state.currentChatSessionId);
        if (data.hasBanner && data.banner) {
          setBannerData(data.banner);
          // 更新计数：dmBannerShown +1，cardsSinceLastChat 归零
          updateState({
            dmBannerShown: state.dmBannerShown + 1,
            cardsSinceLastChat: 0,
          });
        }
      } catch (err) {
        console.error('获取 DmBanner 失败:', err);
      } finally {
        fetchingBannerRef.current = false;
      }
    }
  }, [state.cardsSinceLastChat, state.dmBannerShown, state.currentChatSessionId, updateState]);

  // 每次 cardsSinceLastChat 变化时同步 ref，并检查是否触发 banner
  useEffect(() => {
    cardsSinceLastChatRef.current = state.cardsSinceLastChat;
    checkDmBanner();
  }, [state.cardsSinceLastChat, checkDmBanner]);

  // cardIndex 变化时触发卡片计数（替代 IntersectionObserver）
  useEffect(() => {
    if (filteredFeed.length === 0) return;
    const currentCard = filteredFeed[cardIndex];
    if (currentCard && !countedCardsRef.current.has(currentCard.roomId)) {
      countedCardsRef.current.add(currentCard.roomId);
      const current = cardsSinceLastChatRef.current;
      updateState({ cardsSinceLastChat: current + 1 });
    }
  }, [cardIndex, filteredFeed]); // eslint-disable-line react-hooks/exhaustive-deps

  // 切换到指定方向的卡片（dir: +1 下一张，-1 上一张）
  const goToCard = useCallback((dir) => {
    if (animating) return;
    const next = cardIndex + dir;
    if (next < 0 || next >= filteredFeed.length + 1) return;
    setAnimating(true);
    setDragY(-dir * cardHeight);
    setTimeout(() => {
      setCardIndex(next);
      setDragY(0);
      setAnimating(false);
    }, 300);
  }, [animating, cardIndex, filteredFeed.length, cardHeight]);

  // 拖拽/触摸事件处理
  const onStart = (y) => {
    if (!animating) {
      setDragging(true);
      startYRef.current = y;
    }
  };

  const onMove = (y) => {
    if (dragging) setDragY(y - startYRef.current);
  };

  const onEnd = () => {
    if (!dragging) return;
    setDragging(false);
    const threshold = cardHeight * 0.15;
    if (dragY < -threshold) {
      goToCard(1);
    } else if (dragY > threshold) {
      goToCard(-1);
    } else {
      // 未达到阈值，弹回原位
      setAnimating(true);
      setDragY(0);
      setTimeout(() => setAnimating(false), 300);
    }
  };

  // 测量 feedContainer 实际高度作为 cardHeight，ResizeObserver 监听尺寸变化
  // （真机地址栏收展、桌面缩放、切换横竖屏都能自动跟上）
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const h = el.clientHeight;
      if (h > 0) setCardHeight(h);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isLoading, error]); // 加载/错误态切回内容态时 containerRef 才挂上，需重测

  // 挂载 wheel 事件（passive: false 以便 preventDefault）
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e) => {
      e.preventDefault();
      if (e.deltaY > 30) goToCard(1);
      else if (e.deltaY < -30) goToCard(-1);
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }); // 每次渲染重新绑定，确保 goToCard 始终是最新闭包

  // 点击"加入讨论"进入群聊
  const handleJoinChat = (roomId) => {
    updateState({ currentRoomId: roomId });
    navigate(`/chat/${roomId}`);
  };

  // 关闭 DmBanner
  const handleCloseBanner = () => {
    setBannerData(null);
  };

  // 当前卡片（用于 header 跟随色系，颜色直接读 API 字段）
  const currentCard = (filteredFeed.length > 0 && cardIndex < filteredFeed.length) ? filteredFeed[cardIndex] : null;

  return (
    <div className={styles.container}>
      {/* 顶部 Header：背景和文字色直接读当前卡片 API 字段 */}
      <header
        className={styles.feedHeader}
        style={{
          backgroundColor: currentCard?.headerBg || '#F0EBE4',
          color: currentCard?.headerText || '#3A2E22',
        }}
      >
        <span className={styles.feedHeaderTitle} style={{ color: currentCard?.headerText || '#3A2E22' }}>每日胡说</span>
        <div
          className={styles.feedHeaderAvatar}
          onClick={() => navigate('/profile')}
        >
          {state.userName ? state.userName[0] : '?'}
        </div>
      </header>

      {/* DmBanner 浮层（position: fixed，z-index 高于圆点指示器）*/}
      {bannerData && (
        <DmBanner
          npcName={bannerData.npcName}
          message={bannerData.message}
          messageZh={bannerData.messageZh}
          onClose={handleCloseBanner}
        />
      )}

      {/* 加载状态：全屏骨架屏（暖色版）*/}
      {isLoading && (
        <div className={styles.skeletonFullScreen}>
          <div className={styles.skeletonInner}>
            <div className={styles.skeletonTags} />
            <div className={styles.skeletonTitleBlock}>
              <div className={styles.skeletonTitle} />
              <div className={styles.skeletonTitleShort} />
            </div>
            <div className={styles.skeletonReactionsBox}>
              <div className={styles.skeletonReaction}>
                <div className={styles.skeletonAvatar} />
                <div className={styles.skeletonLines}>
                  <div className={styles.skeletonLine} />
                  <div className={styles.skeletonLineShort} />
                </div>
              </div>
              <div className={styles.skeletonReaction}>
                <div className={styles.skeletonAvatar} />
                <div className={styles.skeletonLines}>
                  <div className={styles.skeletonLine} />
                  <div className={styles.skeletonLineShort} />
                </div>
              </div>
            </div>
            <div className={styles.skeletonButton} />
          </div>
        </div>
      )}

      {/* 错误状态 */}
      {!isLoading && error && (
        <div className={styles.errorState}>
          <p className={styles.errorText}>{error}</p>
          <button className={styles.retryButton} onClick={fetchFeeds}>
            点击重试
          </button>
        </div>
      )}

      {/* 全屏拖拽卡片区 */}
      {!isLoading && !error && (
        <>
          {/* 滑动容器：监听触摸、鼠标、wheel 事件 */}
          <div
            className={styles.feedContainer}
            ref={containerRef}
            onTouchStart={(e) => onStart(e.touches[0].clientY)}
            onTouchMove={(e) => onMove(e.touches[0].clientY)}
            onTouchEnd={onEnd}
            onMouseDown={(e) => onStart(e.clientY)}
            onMouseMove={(e) => { if (dragging) onMove(e.clientY); }}
            onMouseUp={onEnd}
            onMouseLeave={onEnd}
          >
            {/* 卡片轨道：通过 translateY 实现滑动 */}
            <div
              className={styles.feedTrack}
              style={{
                transform: `translateY(${-cardIndex * cardHeight + dragY}px)`,
                transition: dragging ? 'none' : 'transform 0.3s cubic-bezier(0.25,0.46,0.45,0.94)',
              }}
            >
              {filteredFeed.map((item) => {
                const { source, headline } = parseNewsTitle(item.newsTitle);
                return (
                  <article
                    key={item.roomId}
                    className={styles.card}
                    data-card-id={item.roomId}
                    style={{ backgroundColor: item.bgColor || '#F7F2EC', height: cardHeight }}
                  >
                    {/* 报纸顶部双线装饰 */}
                    <div className={styles.topRule} />
                    <div className={styles.topRuleThin} />

                    <div className={styles.cardBody}>
                      {/* pill 标签 */}
                      {item.tags && item.tags.length > 0 && (
                        <span
                          className={styles.pill}
                          style={item.accentColor ? { background: item.accentColor + '1a', color: item.accentColor } : undefined}
                        >
                          {item.tags[0]}
                        </span>
                      )}

                      {/* 报纸来源 */}
                      {source && (
                        <div className={styles.source} style={{ color: item.accentColor || '#C41E1E' }}>
                          {source}
                        </div>
                      )}

                      {/* 标题上方粗线 */}
                      <div className={styles.headlineRule} />

                      {/* 大标题：分行渲染，字号由 useEffect 自适应 */}
                      <h1
                        className={styles.headline}
                        ref={el => { headlineRefs.current[item.roomId] = el; }}
                      >
                        {headline.split('\n').map((line, i) => (
                          <span key={i} className={styles.headlineLine}>{line}</span>
                        ))}
                      </h1>

                      {/* 评论区：flex:1 自适应填满标题和按钮之间的空间 */}
                      <div className={styles.statementsSection}>
                        <div className={styles.statementsHeader}>
                          <span className={styles.statementsLabel}>Statements</span>
                          <span className={styles.statementsLine} />
                        </div>

                        {/* NPC A 引用 */}
                        <div className={styles.quoteBlock} style={{ '--quote-color': item.accentColor || '#C41E1E' }}>
                          <div className={styles.quoteName} style={{ color: item.accentColor || '#C41E1E' }}>
                            {item.npcAName}
                          </div>
                          <div className={styles.quoteEn}>{item.npcAReactionEn || item.npcAReaction}</div>
                          <div className={styles.quoteZh}>{item.npcAReaction}</div>
                        </div>

                        {/* 引用分隔线 */}
                        <div className={styles.quoteSeparator} />

                        {/* NPC B 引用 */}
                        <div className={styles.quoteBlock} style={{ '--quote-color': item.accentDark || '#1A1A1A' }}>
                          <div className={styles.quoteName} style={{ color: item.accentDark || '#1A1A1A' }}>
                            {item.npcBName}
                          </div>
                          <div className={styles.quoteEn}>{item.npcBReactionEn || item.npcBReaction}</div>
                          <div className={styles.quoteZh}>{item.npcBReaction}</div>
                        </div>

                        {/* 时间和围观数 */}
                        <div className={styles.meta}>
                          <span>{formatCount(item.likes || 0)}人围观</span>
                          <span className={styles.metaDot} />
                          <span>{formatCount(item.commentCount || 0)}条评论</span>
                        </div>
                      </div>

                      {/* 加入讨论按钮：背景色用 accentDark */}
                      <button
                        className={styles.joinButton}
                        style={{ backgroundColor: item.accentDark || '#1A1A1A' }}
                        onClick={() => handleJoinChat(item.roomId)}
                      >
                        Join Chat
                      </button>

                      {/* 上划提示 */}
                      <div className={styles.swipeHint}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <polyline points="18 15 12 9 6 15" />
                        </svg>
                        上划看下一条
                      </div>
                    </div>
                  </article>
                );
              })}
              {/* 末尾"生成中"卡片 */}
              <FeedEndCard height={cardHeight} expressionCount={0} />
            </div>
          </div>

          {/* 右侧圆点指示器 */}
          {filteredFeed.length > 0 && (
            <div className={styles.dotIndicator}>
              {Array.from({ length: filteredFeed.length + 1 }, (_, i) => (
                <span
                  key={i}
                  className={`${styles.dot} ${cardIndex === i ? styles.dotActive : ''}`}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default FeedPage;
