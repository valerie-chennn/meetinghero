import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { generateReview } from '../api/index.js';
import styles from './Review.module.css';

// 加载中 Tips 内容
const REVIEW_TIPS = [
  '复盘基于你刚才的真实发言',
  '每个关键节点都会有针对性的建议',
  '新场景练习帮你巩固刚学到的句型',
];

// 角色颜色映射（与 App.css 中的角色变量对应）
const ROLE_COLORS = {
  leader: 'var(--role-leader)',
  collaborator: 'var(--role-collaborator)',
  challenger: 'var(--role-challenger)',
  supporter: 'var(--role-supporter)',
};

/**
 * 计算用户在各节点 userSaid.english 的总词数
 * @param {Array} nodes - reviewData.nodes 数组
 * @returns {number} 总词数
 */
function calcTotalWords(nodes) {
  if (!nodes || !Array.isArray(nodes)) return 0;
  return nodes.reduce((sum, node) => {
    const english = node?.userSaid?.english || '';
    if (!english.trim()) return sum;
    return sum + english.trim().split(/\s+/).length;
  }, 0);
}

/**
 * 兼容旧数据：将 roleFeedback（单条）或 roleFeedbacks（数组）统一返回数组
 * @param {object} reviewData
 * @returns {Array}
 */
function getRoleFeedbacksArray(reviewData) {
  if (reviewData.roleFeedbacks && Array.isArray(reviewData.roleFeedbacks) && reviewData.roleFeedbacks.length > 0) {
    return reviewData.roleFeedbacks;
  }
  // 兼容旧数据：单条 roleFeedback wrap 成数组
  if (reviewData.roleFeedback) {
    return [reviewData.roleFeedback];
  }
  return [];
}

/**
 * 会议结束后总结页（复盘第一屏）
 * 展示：称号区 + 会议统计条 + 策略亮点/可改进对比卡 + 角色私信 + CTA
 */
function Review() {
  const navigate = useNavigate();
  const { state, updateState } = useApp();
  const { showError } = useToast();

  const { meetingId, reviewData: savedReviewData } = state;

  const [reviewData, setReviewData] = useState(savedReviewData || null);
  const [isLoading, setIsLoading] = useState(!savedReviewData);
  // 加载进度（0~90 平滑增长，API 完成后跳到 100）
  const [loadingProgress, setLoadingProgress] = useState(0);
  // Tips 轮播
  const [currentTip, setCurrentTip] = useState(0);
  const [tipVisible, setTipVisible] = useState(true);
  const apiDoneRef = useRef(false);

  // 私信动效阶段管理：[{ phase: 'hidden'|'typing'|'revealed' }]
  // 两条私信错开出现，phase0 先触发，phase1 稍后
  const [dm0Phase, setDm0Phase] = useState('hidden');
  const [dm1Phase, setDm1Phase] = useState('hidden');

  // 加载复盘数据
  useEffect(() => {
    if (savedReviewData) {
      setReviewData(savedReviewData);
      setIsLoading(false);
      return;
    }

    if (!meetingId) {
      navigate('/');
      return;
    }

    const load = async () => {
      try {
        const data = await generateReview(meetingId);
        // 标记 API 完成，进度跳到 100
        apiDoneRef.current = true;
        setLoadingProgress(100);
        setReviewData(data);
        updateState({ reviewData: data });
      } catch (err) {
        console.error('生成复盘数据失败:', err);
        showError('复盘数据加载失败，请重试');
      } finally {
        setIsLoading(false);
      }
    };

    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 模拟加载进度条
  useEffect(() => {
    if (!isLoading) return;
    const interval = setInterval(() => {
      setLoadingProgress(prev => {
        if (apiDoneRef.current) return 100;
        const remaining = 90 - prev;
        const increment = Math.max(0.3, remaining * 0.035);
        return Math.min(90, prev + increment);
      });
    }, 300);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading]);

  // Tips 轮播：每 4 秒切换，带淡入淡出
  useEffect(() => {
    if (!isLoading) return;
    const interval = setInterval(() => {
      setTipVisible(false);
      setTimeout(() => {
        setCurrentTip(prev => (prev + 1) % REVIEW_TIPS.length);
        setTipVisible(true);
      }, 400);
    }, 4000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading]);

  // 加载完成后错开触发两条私信的动效
  useEffect(() => {
    if (!isLoading && reviewData) {
      // 第一条：800ms 后显示 typing，1500ms 后 reveal
      const t1 = setTimeout(() => setDm0Phase('typing'), 800);
      const t2 = setTimeout(() => setDm0Phase('revealed'), 2300);
      // 第二条：比第一条晚 1200ms 开始
      const t3 = setTimeout(() => setDm1Phase('typing'), 2000);
      const t4 = setTimeout(() => setDm1Phase('revealed'), 3500);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
        clearTimeout(t4);
      };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, reviewData]);

  // 加载中状态
  if (isLoading) {
    const displayProgress = Math.round(loadingProgress);
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingTitleGroup}>
          <div className={styles.loadingCircle}></div>
          <p className={styles.loadingText}>正在生成复盘...</p>
        </div>

        <div className={styles.loadingProgressSection}>
          <div className={styles.loadingProgressTrack}>
            <div
              className={styles.loadingProgressFill}
              style={{ width: `${displayProgress}%` }}
            ></div>
          </div>
          <span className={styles.loadingProgressLabel}>{displayProgress}%</span>
          <p className={styles.loadingTimeHint}>预计需要 10-20 秒</p>
        </div>

        <div className={styles.loadingTipContainer}>
          <p className={`${styles.loadingTip} ${tipVisible ? styles.loadingTipVisible : styles.loadingTipHidden}`}>
            {REVIEW_TIPS[currentTip]}
          </p>
        </div>
      </div>
    );
  }

  // 数据加载失败
  if (!reviewData) {
    return (
      <div className={styles.errorContainer}>
        <p className={styles.errorText}>复盘数据加载失败</p>
        <button className={styles.retryButton} onClick={() => navigate('/meeting')}>
          返回
        </button>
      </div>
    );
  }

  // 获取称号信息
  const titleEmoji = reviewData.titleEmoji || '🎖️';
  const titleText = reviewData.title || '会议英雄';
  const titleSubtext = reviewData.titleSubtext || '这场会，你撑过来了';

  // ── 会议统计数据 ──
  const nodes = reviewData.nodes || [];
  const speakCount = nodes.length;
  const totalWords = calcTotalWords(nodes);
  // 用时：节点数 × 2 分钟估算
  const durationMin = speakCount * 2;

  // ── 策略亮点 / 可改进 ──
  const highlight = reviewData.highlight || null;
  const lowlight = reviewData.lowlight || null;
  // 判断是否所有节点都有效（lowlight 为 null 时显示"全部有效"提示）
  const allEffective = !lowlight;

  // ── 角色私信（兼容新旧数据格式）──
  const roleFeedbacksArr = getRoleFeedbacksArray(reviewData);
  const feedback0 = roleFeedbacksArr[0] || null;
  const feedback1 = roleFeedbacksArr[1] || null;

  // 获取节点数量（用于 CTA 文字）
  const nodeCount = nodes.length;

  return (
    <div className={styles.container}>
      <div className={styles.scrollArea}>

        {/* ===== 称号区 ===== */}
        <section className={styles.titleSection}>
          <div className={styles.titleBadge}>
            <span className={styles.titleEmoji}>{titleEmoji}</span>
            <h1 className={styles.titleText}>{titleText}</h1>
          </div>
          <p className={styles.titleSubtext}>{titleSubtext}</p>
        </section>

        {/* ===== 会议统计条 ===== */}
        <div className={styles.statsBar}>
          <div className={styles.statItem}>
            <span className={styles.statNumber}>{speakCount}</span>
            <span className={styles.statLabel}>发言次数</span>
          </div>
          <div className={styles.statDivider}></div>
          <div className={styles.statItem}>
            <span className={styles.statNumber}>{totalWords}</span>
            <span className={styles.statLabel}>共 N 词</span>
          </div>
          <div className={styles.statDivider}></div>
          <div className={styles.statItem}>
            <span className={styles.statNumber}>{durationMin}</span>
            <span className={styles.statLabel}>分钟</span>
          </div>
        </div>

        {/* ===== 策略亮点 / 可改进对比卡 ===== */}
        {(highlight || allEffective) && (
          <div className={styles.strategySection}>

            {/* 亮点卡（绿色左边框） */}
            {highlight && (
              <div className={styles.highlightCard}>
                <p className={styles.strategyCardLabel}>
                  🟢 亮点 · {highlight.label}
                </p>
                <p className={styles.strategyCardWhat}>{highlight.whatYouDid}</p>
                <p className={styles.strategyCardTakeaway}>{highlight.strategyTakeaway}</p>
              </div>
            )}

            {/* 可改进卡（橙色左边框）或"全部有效"提示 */}
            {lowlight ? (
              <div className={styles.lowlightCard}>
                <p className={styles.strategyCardLabel}>
                  🟡 可以更好 · {lowlight.label}
                </p>
                <p className={styles.strategyCardWhat}>{lowlight.whatYouDid}</p>
                <p className={styles.strategyCardTakeaway}>{lowlight.strategyTakeaway}</p>
              </div>
            ) : (
              <div className={styles.allEffectiveCard}>
                <p className={styles.allEffectiveText}>全部有效应对，继续保持！</p>
              </div>
            )}
          </div>
        )}

        {/* ===== 角色私信（两条错开出现）===== */}
        {feedback0 && dm0Phase !== 'hidden' && (
          <DmBubble feedback={feedback0} phase={dm0Phase} />
        )}
        {feedback1 && dm1Phase !== 'hidden' && (
          <DmBubble feedback={feedback1} phase={dm1Phase} />
        )}

        {/* 底部占位，防止内容被 fixed footer 遮挡 */}
        <div style={{ height: 80 }}></div>
      </div>

      {/* 固定底部 CTA */}
      <div className={styles.footer}>
        <button
          className={styles.ctaButton}
          onClick={() => navigate('/review/nodes')}
        >
          来复盘你的 {nodeCount > 0 ? nodeCount : 3} 次发言
        </button>
      </div>
    </div>
  );
}

/**
 * 角色私信气泡组件（复用 typing → revealed 动效）
 * @param {object} feedback - 私信数据
 * @param {string} phase - 'typing' | 'revealed'
 */
function DmBubble({ feedback, phase }) {
  const roleColor = ROLE_COLORS[feedback?.role?.toLowerCase()] || ROLE_COLORS.challenger;
  const initial = (feedback?.name || 'A').charAt(0).toUpperCase();

  return (
    <div className={styles.dmSection}>
      {/* 标题：角色颜色小圆点 + [角色名] 会后私信你 */}
      <p className={styles.dmLabel}>
        <span className={styles.dmRoleDot} style={{ background: roleColor }}></span>
        {feedback.name} 会后私信你：
      </p>

      {/* typing 阶段：三点跳动指示器 */}
      {phase === 'typing' && (
        <div className={styles.typingIndicator}>
          <span className={styles.typingDot}></span>
          <span className={styles.typingDot}></span>
          <span className={styles.typingDot}></span>
        </div>
      )}

      {/* revealed 阶段：气泡弹入 */}
      {phase === 'revealed' && (
        <div className={styles.dmBubble}>
          {/* 角色头像 */}
          <div className={styles.dmAvatar} style={{ background: roleColor }}>
            {initial}
          </div>
          {/* 气泡内容 */}
          <div className={styles.dmContent}>
            <p className={styles.dmEnglish}>
              &ldquo;{feedback.text}&rdquo;
            </p>
            {feedback.textZh && (
              <p className={styles.dmChinese}>{feedback.textZh}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default Review;
