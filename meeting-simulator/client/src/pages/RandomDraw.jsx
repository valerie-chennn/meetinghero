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
 */
function RandomDraw() {
  const navigate = useNavigate();
  const { state, updateState } = useApp();
  const { showError } = useToast();

  // 当前随机到的 3 个角色
  const [characters, setCharacters] = useState([]);
  // 每张牌是否已翻开
  const [flippedCards, setFlippedCards] = useState([false, false, false]);
  // 当前该翻的牌索引（0/1/2），null 表示全部翻完
  const [nextToFlip, setNextToFlip] = useState(0);
  // 翻牌后是否触发缩小动画（大卡 → 小卡过渡状态）
  const [shrinkingCards, setShrinkingCards] = useState([false, false, false]);
  // 大卡唯一 key：每次切换 nextToFlip 时递增，强制 React 销毁旧 DOM 重建，保证新卡从背面初始状态渲染
  const [cardKey, setCardKey] = useState(0);
  // 大卡是否正在淡出（翻完后先淡出再切换，避免闪现消失）
  const [bigCardFading, setBigCardFading] = useState(false);
  // 三张卡全部完成翻牌+缩小动画后才置 true，用于控制成就区和按钮区的出现时机
  const [allAnimationDone, setAllAnimationDone] = useState(false);
  // 是否正在加载随机角色
  const [isLoadingChars, setIsLoadingChars] = useState(true);
  // 是否正在生成主题（"就这三位"按钮）
  const [isGenerating, setIsGenerating] = useState(false);
  // 防止重复请求
  const hasLoadedRef = useRef(false);
  // 收集所有 timer ID，用于组件卸载时清理
  const timersRef = useRef([]);

  // 全部翻完：三张都是 true（翻牌动画已触发，但缩小动画可能还没完成）
  const allFlipped = flippedCards.every(Boolean);

  // 组件卸载时清理所有进行中的 timer，防止内存泄漏
  useEffect(() => {
    return () => timersRef.current.forEach(clearTimeout);
  }, []);

  // 初次加载时拉取随机角色
  useEffect(() => {
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    loadRandomCharacters();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 拉取随机角色
  const loadRandomCharacters = async () => {
    setIsLoadingChars(true);
    setFlippedCards([false, false, false]);
    setShrinkingCards([false, false, false]);
    setNextToFlip(0);
    setCardKey(0);
    setBigCardFading(false);
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

  // 点击大卡：只有当前该翻的那张才响应，且尚未翻开
  const handleCardClick = (idx) => {
    if (isLoadingChars || idx !== nextToFlip || flippedCards[idx]) return;

    // 1. 翻开这张牌（触发 3D 翻转动画 600ms）
    setFlippedCards(prev => {
      const next = [...prev];
      next[idx] = true;
      return next;
    });

    // 2. 翻牌动画接近完成时触发大卡淡出 + 小卡弹入
    //    翻转动画现为 500ms（spring 曲线），在 460ms 时开始交叠过渡：
    //    大卡淡出 150ms（ease-in 加速离开）与小卡弹入 450ms 形成交叠，视觉更连续
    const t1 = setTimeout(() => {
      // 开始淡出大卡
      setBigCardFading(true);
      // 同时显示本张小卡（小卡 springIn 450ms，与大卡淡出交叠）
      setShrinkingCards(prev => {
        const next = [...prev];
        next[idx] = true;
        return next;
      });

      // 3. 大卡淡出完成后（150ms）：移除大卡 DOM，重置淡出状态
      const t2 = setTimeout(() => {
        setBigCardFading(false);
        setNextToFlip(null);

        if (idx < 2) {
          // 4. 短暂间隔后显示下一张大卡（背面），留 120ms 让前一张小卡稳定
          const t3 = setTimeout(() => {
            setCardKey(prev => prev + 1);
            setNextToFlip(idx + 1);
          }, 120);
          timersRef.current.push(t3);
        } else {
          // idx === 2：三张全部缩小，等小卡 springIn 动画完成后显示成就区
          // springIn 总时长 450ms，从 t1 触发时开始计算，此处已过约 150ms，还需约 320ms
          const t3 = setTimeout(() => {
            setAllAnimationDone(true);
          }, 350);
          timersRef.current.push(t3);
        }
      }, 150);
      timersRef.current.push(t2);
    }, 460);
    timersRef.current.push(t1);
  };

  // 换一批：重置所有状态，重新拉取角色
  const handleRefresh = () => {
    if (isGenerating) return;
    // 清除所有进行中的翻牌动画 timer
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
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
    if (nextToFlip === 0) return '点击第一张牌，揭晓命运的安排';
    if (nextToFlip === 1) return '继续，点击第二张牌';
    if (nextToFlip === 2) return '最后一张，点开它';
    return '';
  };

  // 当前大卡的尺寸（随翻牌进度递减）
  const getBigCardSize = () => {
    if (nextToFlip === 0) return { width: 260, height: 340 };
    if (nextToFlip === 1) return { width: 240, height: 300 };
    return { width: 220, height: 280 };
  };

  // 已翻完且已缩小的牌
  const isSmallCard = (idx) => flippedCards[idx] && shrinkingCards[idx];

  const bigCardSize = getBigCardSize();

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

        {/* ===== 全部翻完后的成就区域（等所有卡片动画完成后再显示）===== */}
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

        {/* ===== 小卡区域：已翻完且已缩小的牌并排展示 ===== */}
        {shrinkingCards.some(Boolean) && (
          <div className={styles.smallCardsRow}>
            {[0, 1, 2].map((idx) => {
              // 只渲染已缩小的小卡
              if (!isSmallCard(idx)) return null;
              const char = characters[idx];
              return (
                <div
                  key={idx}
                  className={styles.smallCard}
                  style={{ animationDelay: `${idx * 80}ms` }}
                >
                  {char ? (
                    <>
                      {/* 头像 */}
                      <div className={styles.smallCardAvatar}>
                        {char.name.charAt(0)}
                      </div>
                      {/* 中文名 */}
                      <span className={styles.smallCardName}>{char.name}</span>
                      {/* 英文名：有则展示，无则不渲染 */}
                      {char.nameEn && (
                        <span className={styles.smallCardNameEn}>{char.nameEn}</span>
                      )}
                      {/* 来源标签 */}
                      {char.source && (
                        <span className={styles.smallCardSource}>{char.source}</span>
                      )}
                    </>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}

        {/* ===== 大卡区域：当前该翻的那张，key={cardKey} 确保每次切换都是全新 DOM，不闪现上一张内容 ===== */}
        {nextToFlip !== null && (
          <div
            key={cardKey}
            className={[
              styles.bigCardScene,
              // 等待翻开时的金色脉冲（区分是否需要滑入动画）
              !isLoadingChars && !flippedCards[nextToFlip]
                ? nextToFlip > 0
                  ? styles.bigCardSlideInActive  // 第 2、3 张：滑入 + 金色脉冲合并
                  : styles.bigCardActive          // 第 1 张：仅金色脉冲
                : nextToFlip > 0
                  ? styles.bigCardSlideIn         // 已翻开：仅滑入
                  : '',
              // 已翻开：展示翻转状态
              flippedCards[nextToFlip] ? styles.bigCardFlipped : '',
              // 翻牌完成后：淡出大卡，与小卡弹入形成交叠过渡
              bigCardFading ? styles.bigCardFadeOut : '',
            ].join(' ')}
            style={{ width: bigCardSize.width, height: bigCardSize.height }}
            onClick={() => handleCardClick(nextToFlip)}
          >
            {/* CSS 3D 翻转容器（perspective 在父容器 bigCardScene 上设置）*/}
            <div className={styles.bigCardInner}>
              {/* 背面：问号 */}
              <div className={styles.bigCardBack}>
                <span className={styles.bigCardBackIcon}>？</span>
              </div>

              {/* 正面：角色信息 */}
              <div className={styles.bigCardFront}>
                {(() => {
                  const char = characters[nextToFlip];
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
                      {/* 英文名：有则展示，无则不渲染不留空白 */}
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
