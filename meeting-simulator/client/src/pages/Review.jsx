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
 * 会议结束后总结页（第一个复盘页）
 * 展示：称号区 + 角色私信卡片
 * 底部 CTA：进入复盘学习页
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

  // 私信动效阶段：hidden → typing → revealed
  const [dmPhase, setDmPhase] = useState('hidden');

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

  // 加载完成后延迟触发私信动效
  useEffect(() => {
    if (!isLoading && reviewData) {
      // 800ms 后显示标题 + typing 指示器
      const t1 = setTimeout(() => setDmPhase('typing'), 800);
      // 再过 1500ms 切换到气泡显示
      const t2 = setTimeout(() => setDmPhase('revealed'), 2300);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
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

  // 获取称号信息（后端返回或使用默认值）
  const titleEmoji = reviewData.titleEmoji || '🎖️';
  const titleText = reviewData.title || '会议英雄';
  const titleSubtext = reviewData.titleSubtext || '这场会，你撑过来了';

  // 获取角色私信数据
  const roleFeedback = reviewData.roleFeedback;
  // 角色颜色：根据角色名映射，兜底用 challenger 颜色
  const roleColor = ROLE_COLORS[roleFeedback?.role?.toLowerCase()] || ROLE_COLORS.challenger;
  // 头像首字母
  const initial = (roleFeedback?.name || 'A').charAt(0).toUpperCase();

  // 获取节点数量（用于 CTA 文字）
  const nodeCount = (reviewData.nodes || []).length;

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

        {/* ===== 角色私信（聊天气泡型动效） ===== */}
        {dmPhase !== 'hidden' && roleFeedback && (
          <div className={styles.dmSection}>
            {/* 标题：[角色名] 会后私信你 */}
            <p className={styles.dmLabel}>
              {roleFeedback.name} 会后私信你：
            </p>

            {/* typing 阶段：三点跳动指示器 */}
            {dmPhase === 'typing' && (
              <div className={styles.typingIndicator}>
                <span className={styles.typingDot}></span>
                <span className={styles.typingDot}></span>
                <span className={styles.typingDot}></span>
              </div>
            )}

            {/* revealed 阶段：气泡弹入 */}
            {dmPhase === 'revealed' && (
              <div className={styles.dmBubble}>
                {/* 角色头像 */}
                <div
                  className={styles.dmAvatar}
                  style={{ background: roleColor }}
                >
                  {initial}
                </div>
                {/* 气泡内容 */}
                <div className={styles.dmContent}>
                  <p className={styles.dmEnglish}>
                    &ldquo;{roleFeedback.text}&rdquo;
                  </p>
                  {roleFeedback.textZh && (
                    <p className={styles.dmChinese}>
                      {roleFeedback.textZh}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 底部占位，防止内容被 fixed footer 遮挡（footer 高度约 80px） */}
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

export default Review;
