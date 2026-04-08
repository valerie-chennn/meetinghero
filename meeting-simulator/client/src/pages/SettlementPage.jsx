import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { getSettlement } from '../api/index.js';
import styles from './SettlementPage.module.css';

/**
 * 高亮函数：在文本中找到 highlights 数组里的每个短语，用紫色加粗 span 包裹
 * @param {string} text - 原文
 * @param {string[]} highlights - 需要高亮的短语列表
 * @returns {React.ReactNode[]} - React elements 数组
 */
function highlightText(text, highlights) {
  // highlights 为空或 text 为空时直接返回原文
  if (!text) return null;
  if (!highlights || highlights.length === 0) return text;

  // 用 highlights 构建正则，转义特殊字符，按短语长度降序（避免短词先匹配掉长词的一部分）
  const sorted = [...highlights].sort((a, b) => b.length - a.length);
  const escaped = sorted.map(h => h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const regex = new RegExp(`(${escaped.join('|')})`, 'gi');

  const parts = text.split(regex);
  return parts.map((part, i) => {
    // 判断是否属于高亮词（大小写不敏感对比）
    const isHighlight = sorted.some(h => h.toLowerCase() === part.toLowerCase());
    if (isHighlight) {
      return (
        <span key={i} className={styles.highlight}>
          {part}
        </span>
      );
    }
    return part;
  });
}

// 单张表达卡片（纯展示，无收藏按钮）
function ExpressionCard({ card }) {
  const highlights = card.highlights || [];

  return (
    <div className={styles.expressionCard}>
      {/* 用户原句 */}
      <div className={styles.userSaidBlock}>
        <div className={styles.labelSm}>你说的</div>
        <div className={styles.userSaidText}>{card.userSaid}</div>
      </div>

      {/* 向下箭头 */}
      <div className={styles.arrow}>↓</div>

      {/* 改进版本 */}
      <div className={styles.betterBlock}>
        {/* feedbackType 标签 */}
        <div className={styles.feedbackLabel}>
          {card.feedbackType || '更好的说法'}
        </div>
        <div className={styles.betterText}>
          {highlightText(card.betterVersion, highlights)}
        </div>
      </div>

      {/* 底部解释 */}
      {card.explanation && (
        <div className={styles.explanation}>
          {highlightText(card.explanation, highlights)}
        </div>
      )}
    </div>
  );
}

// 左右滑动卡片组（查看全部模式）
function ExpressionCardSlider({ cards }) {
  // 当前显示的卡片索引
  const [activeIndex, setActiveIndex] = useState(0);
  // 拖拽偏移量（px）
  const [dragX, setDragX] = useState(0);
  // 是否正在拖拽（拖拽中不加 transition）
  const [dragging, setDragging] = useState(false);

  // 用 ref 同步存储拖拽状态，避免 stale closure 导致 touchmove 首帧 bailout
  const draggingRef = useRef(false);
  const dragXRef = useRef(0);
  const startXRef = useRef(0);
  const containerRef = useRef(null);
  // 卡片宽度（动态读取容器宽度）
  const [cardWidth, setCardWidth] = useState(0);

  // 读取容器宽度
  useEffect(() => {
    if (containerRef.current) {
      setCardWidth(containerRef.current.offsetWidth);
    }
    const onResize = () => {
      if (containerRef.current) setCardWidth(containerRef.current.offsetWidth);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const onStart = (x) => {
    startXRef.current = x;
    draggingRef.current = true;
    setDragging(true);
  };

  const onMove = (x) => {
    if (!draggingRef.current) return;
    const dx = x - startXRef.current;
    dragXRef.current = dx;
    setDragX(dx);
  };

  const onEnd = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setDragging(false);

    const cardW = cardWidth || 300;
    const threshold = cardW * 0.15;
    const dx = dragXRef.current;

    if (dx < -threshold && activeIndex < cards.length - 1) {
      // 左滑，切到下一张
      setActiveIndex(i => i + 1);
    } else if (dx > threshold && activeIndex > 0) {
      // 右滑，切到上一张
      setActiveIndex(i => i - 1);
    }
    dragXRef.current = 0;
    setDragX(0);
  };

  const translateX = -activeIndex * (cardWidth || 300) + dragX;

  return (
    <div className={styles.sliderWrapper}>
      {/* 滑动轨道 */}
      <div
        ref={containerRef}
        className={styles.sliderContainer}
        onTouchStart={(e) => onStart(e.touches[0].clientX)}
        onTouchMove={(e) => onMove(e.touches[0].clientX)}
        onTouchEnd={onEnd}
        onMouseDown={(e) => onStart(e.clientX)}
        onMouseMove={(e) => { if (draggingRef.current) onMove(e.clientX); }}
        onMouseUp={onEnd}
        onMouseLeave={onEnd}
      >
        <div
          className={styles.sliderTrack}
          style={{
            transform: `translateX(${translateX}px)`,
            transition: dragging ? 'none' : 'transform 0.3s ease',
          }}
        >
          {cards.map((card, i) => (
            <div key={card.id ?? i} className={styles.sliderCardItem}>
              <ExpressionCard card={card} />
            </div>
          ))}
        </div>
      </div>

      {/* 底部圆点指示器 */}
      {cards.length > 1 && (
        <div className={styles.dotIndicator}>
          {cards.map((_, i) => (
            <span
              key={i}
              className={`${styles.dot} ${activeIndex === i ? styles.dotActive : ''}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SettlementPage() {
  const navigate = useNavigate();
  const { sessionId } = useParams();
  const { state, updateState } = useApp();

  const [settlement, setSettlement] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  // 是否展开"查看全部表达"模式
  const [showAll, setShowAll] = useState(false);

  // 页面加载时拉取结算数据
  useEffect(() => {
    if (!sessionId) {
      setError('会话 ID 缺失，无法加载结算数据');
      setIsLoading(false);
      return;
    }

    const fetchSettlement = async () => {
      setIsLoading(true);
      setError('');
      try {
        const data = await getSettlement(sessionId);
        setSettlement(data);
      } catch (err) {
        console.error('加载结算数据失败:', err);
        setError('加载失败，请重试');
      } finally {
        setIsLoading(false);
      }
    };

    fetchSettlement();
  }, [sessionId]);

  // 重试加载
  const handleRetry = async () => {
    setError('');
    setIsLoading(true);
    try {
      const data = await getSettlement(sessionId);
      setSettlement(data);
    } catch (err) {
      console.error('重试加载结算数据失败:', err);
      setError('加载失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  // 点击"回首页"
  const handleBackToFeed = () => {
    updateState({ cardsSinceLastChat: 0 });
    navigate('/feed', { replace: true });
  };

  // 解析 newsletter / expressionCards
  const newsletter = settlement?.newsletter ?? null;
  const absurdAttributes = settlement?.absurdAttributes ?? [];
  const expressionCards = settlement?.expressionCards ?? [];

  // 找出 featured 卡片，fallback 到第一张
  const featuredCard = expressionCards.find(c => c.isFeatured) ?? expressionCards[0] ?? null;
  const hasMultipleCards = expressionCards.length > 1;

  return (
    <div className={styles.container}>
      <div className={styles.scrollArea}>

        {/* ===== 加载状态 ===== */}
        {isLoading && (
          <div className={styles.loadingState}>
            <div className={styles.loadingSpinner} />
            <p className={styles.loadingText}>正在加载结算数据…</p>
          </div>
        )}

        {/* ===== 错误状态 ===== */}
        {!isLoading && error && (
          <div className={styles.errorState}>
            <p className={styles.errorText}>{error}</p>
            <button className={styles.retryButton} onClick={handleRetry}>
              重试
            </button>
          </div>
        )}

        {/* ===== 正常内容 ===== */}
        {!isLoading && !error && settlement && (
          <>
            {/* ===== 块 1：事件结果卡片（报纸风）===== */}
            <div className={styles.newsCard}>
              {newsletter ? (
                <>
                  {/* 报头 */}
                  <div className={styles.newsPublisher}>{newsletter.publisher}</div>
                  {/* 黑色横线 */}
                  <div className={styles.newsRule} />
                  {/* 大标题 */}
                  <h1 className={styles.newsHeadline}>{newsletter.headline}</h1>
                  {/* 故事点 bullets */}
                  <div className={styles.newsBullets}>
                    {(newsletter.bullets || []).map((b, i) => (
                      <div key={i} className={styles.newsBulletItem}>
                        <span className={styles.bulletDot} />
                        <span className={styles.bulletText}>{b}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                /* newsletter 为 null 时的降级提示 */
                <div className={styles.loadingText}>事件结果加载中…</div>
              )}

              {/* 分隔线 */}
              <div className={styles.divider} />

              {/* 你的能力值 */}
              <div className={styles.statsLabel}>你的能力值</div>
              <div className={styles.statsRow}>
                {absurdAttributes.map((attr, i) => {
                  // 正向属性按索引轮换 3 种颜色；负向统一红色
                  const positivePalette = ['green', 'purple', 'gold'];
                  const variant = attr.delta >= 0
                    ? positivePalette[i % positivePalette.length]
                    : 'red';
                  return (
                    <div key={i} className={`${styles.statPill} ${styles['statPill_' + variant]}`}>
                      <span className={styles.statPillName}>{attr.name}</span>
                      <span className={styles.statPillValue}>
                        {attr.delta > 0 ? '+' : ''}{attr.delta}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ===== 块 2：表达卡片区 ===== */}
            {featuredCard && (
              <>
                {/* 卡片容器 */}
                <div className={styles.expressionSection}>
                  {/* 标题行 */}
                  <div className={styles.expressionTitle}>
                    <span className={styles.sparkle}>✨</span>
                    <span>你的表达</span>
                  </div>

                  {/* 默认模式：只展示 featured 卡片 */}
                  {!showAll && (
                    <ExpressionCard card={featuredCard} />
                  )}

                  {/* 展开模式：左右滑动卡片组 */}
                  {showAll && (
                    <ExpressionCardSlider cards={expressionCards} />
                  )}
                </div>

                {/* 切换按钮（有多张卡片才显示）*/}
                {hasMultipleCards && (
                  <button
                    className={styles.toggleAllButton}
                    onClick={() => setShowAll(v => !v)}
                  >
                    {showAll ? '收起' : '查看全部表达 >'}
                  </button>
                )}
              </>
            )}

            {/* 已存入表达本提示 */}
            <p className={styles.savedHint}>已存入表达本</p>
          </>
        )}

        {/* 回首页按钮（始终显示）*/}
        <button className={styles.backButton} onClick={handleBackToFeed}>
          回到首页
        </button>

        {/* 底部安全区域占位 */}
        <div className={styles.bottomPad} />
      </div>
    </div>
  );
}

export default SettlementPage;
