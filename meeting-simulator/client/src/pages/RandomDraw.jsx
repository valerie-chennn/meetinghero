import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { getRandomCharacters } from '../api/index.js';
import { useToast } from '../context/ToastContext.jsx';
import styles from './RandomDraw.module.css';

/**
 * 随机抽签页（乱炖局专用）
 * 路由：/brainstorm/random
 * 核心交互：每次展示一张大卡，翻完缩为小卡，下一张大卡出现
 * 3 张全部翻完后展示成就区域和操作按钮
 *
 * 动效架构：两段式翻转（无 backface-visibility）
 * - 背面 z-index:2 初始可见；正面 z-index:1 初始 rotateY(-90deg)
 * - 翻牌用 animation 驱动，淡出用 transition 驱动，全程事件监听
 */
function RandomDraw() {
  const navigate = useNavigate();
  const { state, updateState } = useApp();
  const { showError } = useToast();

  // 当前随机到的 3 个角色
  const [characters, setCharacters] = useState([]);
  // 每张牌是否已翻开（小卡是否显示）
  const [flippedCards, setFlippedCards] = useState([false, false, false]);
  // 当前大卡显示的角色索引（0/1/2），null 表示不显示大卡
  const [currentCard, setCurrentCard] = useState(0);
  // 背面是否正在翻转动画（rotateY 0→90deg）
  const [backFlipping, setBackFlipping] = useState(false);
  // 正面是否正在翻转动画（rotateY -90→0deg）
  const [frontFlipping, setFrontFlipping] = useState(false);
  // 大卡是否正在淡出（opacity+scale transition）
  const [cardFading, setCardFading] = useState(false);
  // 大卡是否处于进入状态（opacity:0 translateY:16px，下一帧切换为 visible 触发 transition）
  const [cardEntering, setCardEntering] = useState(false);
  // 三张卡全部翻完且动画结束后置 true，控制成就区和按钮区
  const [allAnimationDone, setAllAnimationDone] = useState(false);
  // 是否正在加载随机角色
  const [isLoadingChars, setIsLoadingChars] = useState(true);
  // 是否正在生成主题（"就这三位"按钮）
  const [isGenerating, setIsGenerating] = useState(false);
  // 防止重复请求
  const hasLoadedRef = useRef(false);
  // 收集翻牌相关 setTimeout 的 ID，用于组件卸载/刷新时清理
  const timerRefs = useRef([]);

  // 全部翻完：三张都是 true
  const allFlipped = flippedCards.every(Boolean);

  // 初次加载时拉取随机角色；组件卸载时清理所有翻牌定时器
  useEffect(() => {
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    loadRandomCharacters();
    return () => {
      timerRefs.current.forEach(id => clearTimeout(id));
      timerRefs.current = [];
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // cardEntering 变为 true 时，用双层 rAF 确保下一帧再切换为 visible，让 transition 能播放
  useEffect(() => {
    if (!cardEntering) return;
    let rafId;
    const outer = requestAnimationFrame(() => {
      rafId = requestAnimationFrame(() => {
        setCardEntering(false); // 切换到 bigCardVisible，触发 translateY + opacity transition
      });
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(rafId);
    };
  }, [cardEntering, currentCard]);

  // 拉取随机角色，同时重置所有翻牌状态
  const loadRandomCharacters = async () => {
    setIsLoadingChars(true);
    setFlippedCards([false, false, false]);
    setCurrentCard(0);
    setBackFlipping(false);
    setFrontFlipping(false);
    setCardFading(false);
    setCardEntering(false);
    setAllAnimationDone(false);
    try {
      const result = await getRandomCharacters();
      setCharacters(result.characters || []);
    } catch (err) {
      console.error('获取随机角色失败:', err);
      showError('获取角色失败，请重试');
    } finally {
      setIsLoadingChars(false);
    }
  };

  // 点击大卡：翻牌中、淡出中、加载中均不响应
  const handleCardClick = () => {
    if (isLoadingChars || backFlipping || frontFlipping || cardFading) return;

    // 触发背面翻转（rotateY 0→90deg，0.4s）
    setBackFlipping(true);

    // 背面动画进行到 350ms 时启动正面翻入（350+400=750ms，有 50ms 重叠，视觉更连贯）
    const t1 = setTimeout(() => {
      setFrontFlipping(true);
    }, 350);
    timerRefs.current.push(t1);
  };

  // 正面翻入动画结束 → 停留 350ms → 触发大卡淡出
  const handleFrontAnimationEnd = () => {
    const t2 = setTimeout(() => {
      setCardFading(true); // 触发 transition: opacity+scale
    }, 350);
    timerRefs.current.push(t2);
  };

  // 大卡淡出 transition 结束 → 显示小卡 → 准备下一张或结束
  const handleCardTransitionEnd = (e) => {
    // 只响应 opacity 的 transition 结束，且必须处于淡出状态
    if (e.propertyName !== 'opacity' || !cardFading) return;

    const idx = currentCard;

    // 标记当前卡已翻开，小卡出现
    setFlippedCards(prev => {
      const next = [...prev];
      next[idx] = true;
      return next;
    });

    if (idx < 2) {
      // 重置翻转和淡出状态，准备下一张
      setBackFlipping(false);
      setFrontFlipping(false);
      setCardFading(false);
      // 先进入 entering 状态（opacity:0 translateY:16px），再由 useEffect 触发 transition 进入 visible
      setCardEntering(true);
      setCurrentCard(idx + 1);
    } else {
      // 三张全部翻完，等小卡 CSS transition（500ms）完成后再显示成就区
      const t3 = setTimeout(() => {
        setAllAnimationDone(true);
      }, 500);
      timerRefs.current.push(t3);
    }
  };

  // 换一批：先清理未触发的定时器，再重置所有状态，重新拉取角色
  const handleRefresh = () => {
    if (isGenerating) return;
    timerRefs.current.forEach(id => clearTimeout(id));
    timerRefs.current = [];
    hasLoadedRef.current = false;
    loadRandomCharacters();
  };

  // 确认选择，直接跳 Loading 页生成完整会议（含主题生成）
  const handleConfirm = () => {
    if (!allAnimationDone || isGenerating || characters.length < 3) return;

    // 乱炖局：从 3 个世界中随机选主场景（给当代名人世界更低权重）
    const mainWorld = pickMainWorld(characters);

    // 清除旧主题，确保 Loading 页会重新生成主题
    updateState({
      brainstormCharacters: characters,
      brainstormMainWorld: mainWorld,
      brainstormTheme: null,
      themeRefreshCount: 0,
      sceneType: 'brainstorm-random',
      meetingSource: 'generate',
    });
    navigate('/loading');
  };

  // 副标题文案（根据当前阶段动态变化）
  const getSubtitle = () => {
    if (isLoadingChars) return '正在召唤角色…';
    if (allFlipped) return '命运的相遇，从此刻开始';
    if (currentCard === 0) return '点击第一张牌，揭晓命运的安排';
    if (currentCard === 1) return '继续，点击第二张牌';
    if (currentCard === 2) return '最后一张，点开它';
    return '';
  };

  // 当前大卡的尺寸（随翻牌进度递减）
  const getBigCardSize = () => {
    if (currentCard === 0) return { width: 260, height: 340 };
    if (currentCard === 1) return { width: 240, height: 300 };
    return { width: 220, height: 280 };
  };

  const bigCardSize = getBigCardSize();

  // 大卡容器的 class：淡出/进入/正常显示 三态互斥
  const bigCardSceneClass = [
    styles.bigCardScene,
    cardFading
      ? styles.bigCardFadingOut
      : cardEntering
        ? styles.bigCardEntering
        : styles.bigCardVisible,
  ].join(' ');

  return (
    <div className={styles.container}>
      {/* ===== 顶部导航区 ===== */}
      <div className={styles.topNav}>
        <button className={styles.backBtn} onClick={() => navigate('/brainstorm')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M19 12H5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <path d="M12 19L5 12L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <span className={styles.navTitle}>乱炖局</span>
      </div>

      {/* ===== 主内容区 ===== */}
      <div className={`${styles.content} ${allAnimationDone ? styles.contentAllFlipped : ''}`}>

        {/* ===== 页面标题区 ===== */}
        <div className={styles.titleArea}>
          <h1 className={styles.pageTitle}>命运已出牌</h1>
          <p className={styles.pageSubtitle}>{getSubtitle()}</p>
        </div>

        {/* ===== 全部翻完后的成就区域 ===== */}
        {allAnimationDone && (
          <div className={styles.achievementArea}>
            {/* 三颗金色星星，依次 fadeIn */}
            <div className={styles.starsRow}>
              <span className={`${styles.star} ${styles.starDelay0}`}>✦</span>
              <span className={`${styles.star} ${styles.starDelay1}`}>✦</span>
              <span className={`${styles.star} ${styles.starDelay2}`}>✦</span>
            </div>
            <p className={styles.achievementText}>就这阵容，开会吧</p>
          </div>
        )}

        {/* ===== 小卡区域：3 个 DOM 始终存在，通过 class 控制显隐 ===== */}
        <div className={styles.smallCardsRow}>
          {[0, 1, 2].map(idx => (
            <div
              key={idx}
              className={`${styles.smallCard} ${flippedCards[idx] ? styles.smallCardVisible : ''}`}
            >
              {characters[idx] ? (
                <>
                  {/* 头像 */}
                  <div className={styles.smallCardAvatar}>
                    {characters[idx].name.charAt(0)}
                  </div>
                  {/* 中文名 */}
                  <span className={styles.smallCardName}>{characters[idx].name}</span>
                  {/* 英文名：有则展示 */}
                  {characters[idx].nameEn && (
                    <span className={styles.smallCardNameEn}>{characters[idx].nameEn}</span>
                  )}
                  {/* 来源标签 */}
                  {characters[idx].source && (
                    <span className={styles.smallCardSource}>{characters[idx].source}</span>
                  )}
                </>
              ) : null}
            </div>
          ))}
        </div>

        {/* ===== 大卡区域：全部翻完后隐藏 ===== */}
        {!allAnimationDone && (
          <div
            className={bigCardSceneClass}
            style={{ width: bigCardSize.width, height: bigCardSize.height }}
            onClick={handleCardClick}
            onTransitionEnd={handleCardTransitionEnd}
          >
            {/* 背面：z-index:2，初始可见，点击后旋转 0→90deg 离开 */}
            <div className={`${styles.bigCardBack} ${backFlipping ? styles.bigCardBackFlipping : ''}`}>
              <span className={styles.bigCardBackIcon}>？</span>
            </div>

            {/* 正面：z-index:1，初始 rotateY(-90deg) 不可见，背面离开后旋转 -90→0deg 进入 */}
            <div
              className={`${styles.bigCardFront} ${frontFlipping ? styles.bigCardFrontFlipping : ''}`}
              onAnimationEnd={handleFrontAnimationEnd}
            >
              {(() => {
                const char = characters[currentCard];
                if (isLoadingChars || !char) {
                  return <div className={styles.bigCardSkeleton} />;
                }
                return (
                  <>
                    {/* 头像 */}
                    <div className={styles.bigCardAvatar}>
                      {char.name.charAt(0)}
                    </div>
                    {/* 中文名 */}
                    <span className={styles.bigCardName}>{char.name}</span>
                    {/* 英文名：有则展示 */}
                    {char.nameEn && (
                      <span className={styles.bigCardNameEn}>{char.nameEn}</span>
                    )}
                    {/* 来源标签 */}
                    {char.source && (
                      <span className={styles.bigCardSource}>{char.source}</span>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        )}

        {/* ===== 操作按钮区：所有动画完成后从底部滑入 ===== */}
        {allAnimationDone && (
          <div className={styles.actionArea}>
            <div className={styles.confirmRow}>
              <button
                className={styles.refreshBtn}
                onClick={handleRefresh}
                disabled={isGenerating}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M1 4v6h6M23 20v-6h-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 0 1 3.51 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                换一批
              </button>
              <button
                className={`${styles.confirmBtn} ${!isGenerating ? styles.confirmBtnActive : ''}`}
                onClick={handleConfirm}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <span className={styles.loadingDots}>
                    <span></span><span></span><span></span>
                  </span>
                ) : '就这三位'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * 从 3 个角色的世界中选主场景世界
 * 当代名人（contemporary）权重降低 50%，避免适配效果奇怪
 * @param {Array} chars - 3 个角色对象
 * @returns {string} 主场景世界 ID
 */
function pickMainWorld(chars) {
  const worlds = chars.map(c => c.world);
  // 构建带权重的候选池
  const pool = [];
  worlds.forEach(w => {
    if (w === 'contemporary') {
      // 当代名人权重减半
      pool.push(w);
    } else {
      // 其他世界双倍权重
      pool.push(w, w);
    }
  });
  return pool[Math.floor(Math.random() * pool.length)];
}

export default RandomDraw;
