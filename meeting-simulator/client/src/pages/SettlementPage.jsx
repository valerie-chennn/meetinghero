import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { getSettlement } from '../api/index.js';
import styles from './SettlementPage.module.css';

// localStorage 键名：首次引导是否已看过
const SWIPE_HINT_KEY = 'settlement_swipe_hint_seen';

/**
 * 高亮函数：在文本中找到 highlights 数组里的每个短语，用紫色加粗 span 包裹
 * @param {string} text - 原文
 * @param {string[]} highlights - 需要高亮的短语列表
 * @returns {React.ReactNode[]} - React elements 数组
 */
function highlightText(text, highlights) {
  if (!text) return null;
  if (!highlights || highlights.length === 0) return text;

  // 按短语长度降序排（避免短词先匹配掉长词的一部分）
  const sorted = [...highlights].sort((a, b) => b.length - a.length);
  const escaped = sorted.map(h => h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const regex = new RegExp(`(${escaped.join('|')})`, 'gi');

  const parts = text.split(regex);
  return parts.map((part, i) => {
    const isHighlight = sorted.some(h => h.toLowerCase() === part.toLowerCase());
    if (isHighlight) {
      return <span key={i} className={styles.highlight}>{part}</span>;
    }
    return part;
  });
}

/**
 * 单张表达卡片内容（v8 风格）
 */
function ExpressionCard({ card }) {
  const highlights = card.highlights || [];
  const { learningType, pattern, collocations } = card;

  return (
    <div className={styles.expressionCard}>
      {/* 用户原句 */}
      <div className={styles.labelSm}>你说的</div>
      <div className={styles.userSaidText}>
        {card.userSaid || '（未发言）'}
      </div>

      {/* feedbackType 紫色小标签 */}
      <div className={styles.feedbackLabel}>
        {card.feedbackType || '更好的说法'}
      </div>

      {/* 改进版本，带高亮 */}
      <div className={styles.betterText}>
        {highlightText(card.betterVersion, highlights)}
      </div>

      {/* 核心句型（仅 learningType === 'pattern' 时显示）*/}
      {learningType === 'pattern' && pattern && (
        <div className={styles.patternBlock}>
          <div className={styles.patternLabel}>核心句型</div>
          <div className={styles.patternText}>{pattern}</div>
        </div>
      )}

      {/* 可迁移的搭配（仅 learningType === 'collocations' 时显示）*/}
      {learningType === 'collocations' && Array.isArray(collocations) && collocations.length > 0 && (
        <div className={styles.collocationsBlock}>
          {collocations.map((item, i) => (
            <div key={i} className={styles.pillCollocation}>
              <span className={styles.pillEn}>{item.phrase}</span>
              <span className={styles.pillZh}>{item.meaning}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SettlementPage() {
  const navigate = useNavigate();
  const { sessionId } = useParams();
  const location = useLocation();
  const { state, updateState } = useApp();

  // 从 navigate state 读取 roomId（ChatPage 跳转时传入）
  const roomId = location.state?.roomId ?? null;

  // 数据状态
  const [settlement, setSettlement] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // 两 view 切换：'settlement' | 'expression'
  const [view, setView] = useState('settlement');

  // 表达卡片当前索引
  const [idx, setIdx] = useState(0);

  // 首次引导提示是否显示（从 localStorage 读取初始值）
  const [hintVisible, setHintVisible] = useState(() => {
    try {
      return !localStorage.getItem(SWIPE_HINT_KEY);
    } catch {
      return true;
    }
  });

  // 拖拽相关 refs（v8 风格，使用 ref 避免 stale closure）
  const trackRef = useRef(null);
  const dragRef = useRef({ startX: 0, dx: 0, active: false });

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

  // 回首页：记录已完成的 roomId，并清空卡片计数
  const handleBackToFeed = () => {
    if (roomId) {
      const ids = state.completedRoomIds || [];
      if (!ids.includes(roomId)) {
        updateState({ completedRoomIds: [...ids, roomId] });
      }
    }
    updateState({ cardsSinceLastChat: 0 });
    navigate('/feed', { replace: true });
  };

  // 解析数据
  const newsletter = settlement?.newsletter ?? null;
  const expressionCards = settlement?.expressionCards ?? [];
  const stats = settlement?.stats ?? null;

  // 解析 epilogue：兼容数组（新）和字符串（旧数据降级）
  const rawEpilogue = newsletter?.epilogue;
  let epilogueItems = [];
  if (Array.isArray(rawEpilogue)) {
    epilogueItems = rawEpilogue.filter(Boolean);
  } else if (typeof rawEpilogue === 'string' && rawEpilogue.trim()) {
    // 老数据按中文句末符号拆分
    epilogueItems = rawEpilogue.split(/。|！|？/).map(s => s.trim()).filter(Boolean);
  }

  // featured 卡片放第一张
  const featuredCard = expressionCards.find(c => c.isFeatured) ?? expressionCards[0] ?? null;
  const orderedCards = featuredCard
    ? [featuredCard, ...expressionCards.filter(c => c !== featuredCard)]
    : [];
  const total = orderedCards.length;

  // 切换到 expression view
  const handleGoToExpression = () => {
    setIdx(0);
    // 根据 localStorage 决定 hint 是否显示
    try {
      setHintVisible(!localStorage.getItem(SWIPE_HINT_KEY));
    } catch {
      setHintVisible(true);
    }
    setView('expression');
  };

  // 切换到指定卡片索引（带 localStorage 引导逻辑）
  const goTo = (i) => {
    // total 为 0 时直接 return，避免 setIdx(-1)
    if (total === 0) return;
    const next = Math.max(0, Math.min(total - 1, i));
    setIdx(next);
    // 用户首次手动切换（非第 0 张）时隐藏引导并写 localStorage
    if (next !== 0 && hintVisible) {
      setHintVisible(false);
      try {
        localStorage.setItem(SWIPE_HINT_KEY, '1');
      } catch {
        // 忽略 localStorage 不可用的情况
      }
    }
    // 同步滑动轨道位置
    if (trackRef.current) {
      trackRef.current.style.transition = 'transform 0.3s ease';
      trackRef.current.style.transform = `translateX(-${next * 100}%)`;
    }
  };

  // 拖拽事件处理（touch + mouse）
  const onDown = (e) => {
    const x = e.touches ? e.touches[0].clientX : e.clientX;
    dragRef.current = { startX: x, dx: 0, active: true };
    if (trackRef.current) trackRef.current.style.transition = 'none';
  };

  const onMove = (e) => {
    if (!dragRef.current.active) return;
    const x = e.touches ? e.touches[0].clientX : e.clientX;
    dragRef.current.dx = x - dragRef.current.startX;
    if (trackRef.current) {
      trackRef.current.style.transform = `translateX(calc(-${idx * 100}% + ${dragRef.current.dx}px))`;
    }
  };

  const onUp = () => {
    if (!dragRef.current.active) return;
    dragRef.current.active = false;
    const dx = dragRef.current.dx;
    if (dx < -40) goTo(idx + 1);
    else if (dx > 40) goTo(idx - 1);
    else goTo(idx);
  };

  // 数据降级：stats 整体缺失时显示默认值
  const duration = stats?.duration ?? '—:—';
  const wordCount = stats?.wordCount ?? 0;

  return (
    <div className={styles.container}>

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

      {/* ===== 正常内容：两 view 切换 ===== */}
      {!isLoading && !error && settlement && (
        <>
          {/* ========== View 1：剧情结算 ========== */}
          {view === 'settlement' && (
            <div className={styles.settlementView}>
              {/* 报头双线 */}
              <div className={styles.headerRuleFat} />
              <div className={styles.headerRuleThin} />

              {/* 报头行：publisher + IP pill */}
              <div className={styles.publisherRow}>
                <span className={styles.publisherText}>
                  {newsletter?.publisher || '东海商报'}
                </span>
                {newsletter?.ipName && (
                  <span className={styles.ipPill}>{newsletter.ipName}</span>
                )}
              </div>

              {/* 大标题 */}
              <h1 className={styles.headline}>
                {newsletter?.headline || ''}
              </h1>

              {/* 数据栏 */}
              <div className={styles.statsBar}>
                <div className={styles.statsBarTop} />
                <div className={styles.statsBarInner}>
                  {/* 左栏：对话时长 */}
                  <div className={styles.statBox}>
                    <div className={styles.statNumber}>{duration}</div>
                    <div className={styles.statTag}>对话时长</div>
                  </div>
                  {/* 右栏：输出词数（左侧 20px padding 与竖线错开）*/}
                  <div className={styles.statBoxRight}>
                    <div className={styles.statNumber}>
                      {wordCount}
                      <span className={styles.statWords}> words</span>
                    </div>
                    <div className={styles.statTag}>输出词数</div>
                  </div>
                </div>
              </div>

              {/* 结局卡片 */}
              <div className={styles.epilogueCard}>
                {/* 后续报道 */}
                <div className={styles.epilogueLabel}>后续报道</div>
                {epilogueItems.length > 0 && (
                  <ul className={styles.epilogueList}>
                    {epilogueItems.map((item, i) => (
                      <li key={i} className={styles.epilogueItem}>
                        <span className={styles.epilogueDot} />
                        <span className={styles.epilogueText}>{item}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {/* 分隔线 */}
                <div className={styles.epilogueDivider} />

                {/* 称号 */}
                <div className={styles.titleLabel}>你获得了称号</div>
                {newsletter?.title && (
                  <div className={styles.titleBox}>{newsletter.title}</div>
                )}
              </div>

              {/* 双按钮区：flex:1 垂直居中 */}
              <div className={styles.buttonArea}>
                <button
                  className={styles.primaryButton}
                  onClick={handleGoToExpression}
                >
                  看看更地道的说法
                </button>
                <button
                  className={styles.secondaryButton}
                  onClick={handleBackToFeed}
                >
                  回到首页
                </button>
              </div>
            </div>
          )}

          {/* ========== View 2：表达提升 ========== */}
          {view === 'expression' && (
            <div className={styles.expressionView}>
              {/* 顶栏：返回 + 已存入表达本 */}
              <div className={styles.expressionTopBar}>
                <div
                  className={styles.backLink}
                  onClick={() => setView('settlement')}
                >
                  ‹ 返回
                </div>
                <div className={styles.savedRight}>已存入表达本</div>
              </div>

              {/* 报头双线 */}
              <div className={styles.expressionHeaderWrap}>
                <div className={styles.headerRuleFat} />
                <div className={styles.headerRuleThin} />
              </div>

              {/* 标题行：表达提升 + (idx+1/total) */}
              <div className={styles.expressionTitleRow}>
                <span className={styles.expressionTitle}>表达提升</span>
                {total > 0 && (
                  <span className={styles.expressionCount}>
                    ({idx + 1}/{total})
                  </span>
                )}
              </div>

              {/* 标题下方灰线 */}
              <div className={styles.expressionTitleRule} />

              {/* 横滑卡片区域 */}
              <div className={styles.sliderArea}>
                {total > 0 ? (
                  <div className={styles.sliderOuter}>
                    {/* 卡片轨道容器（overflow hidden）*/}
                    <div
                      className={styles.sliderContainer}
                      onTouchStart={onDown}
                      onTouchMove={onMove}
                      onTouchEnd={onUp}
                      onMouseDown={onDown}
                      onMouseMove={onMove}
                      onMouseUp={onUp}
                      onMouseLeave={onUp}
                    >
                      {/*
                        sliderTrack 的 transform 完全由 trackRef 直接操作，
                        避免 React 重渲染期间覆盖拖拽中间帧。
                        切换 idx 时由 goTo 通过 ref 写入；
                        view 重新进入时 div 重新挂载，transform 默认为 0，
                        与 handleGoToExpression 中 setIdx(0) 对齐。
                      */}
                      <div
                        ref={trackRef}
                        className={styles.sliderTrack}
                      >
                        {orderedCards.map((card, i) => (
                          <div key={card.id ?? i} className={styles.sliderCardItem}>
                            <ExpressionCard card={card} />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className={styles.loadingText}>暂无表达数据</div>
                )}

                {/* 进度指示器：胶囊式 */}
                {total > 1 && (
                  <div className={styles.progressBar}>
                    {orderedCards.map((_, i) => (
                      <div
                        key={i}
                        className={i === idx ? styles.progressDotActive : styles.progressDot}
                        onClick={() => goTo(i)}
                      />
                    ))}
                  </div>
                )}

                {/* 首次引导提示 */}
                {hintVisible && total > 1 && (
                  <div className={styles.swipeHint}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#CCC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="15 18 9 12 15 6" />
                    </svg>
                    左滑查看更多表达
                  </div>
                )}
              </div>

              {/* 底部按钮区：flex:1 居中，加左右 padding */}
              <div className={`${styles.buttonArea} ${styles.buttonAreaPadded}`}>
                <button
                  className={styles.primaryButton}
                  onClick={handleBackToFeed}
                >
                  回到首页
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default SettlementPage;
