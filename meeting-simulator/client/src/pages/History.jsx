import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { getHistory, getHistoryMeeting } from '../api/index.js';
import styles from './History.module.css';

/**
 * 历史记录页面
 * 展示用户过去的所有练习记录，点击可跳转到对应复盘页
 */
function History() {
  const navigate = useNavigate();
  const { state, updateState } = useApp();
  const { showError } = useToast();

  const { sessionId } = state;

  // 历史记录列表
  const [history, setHistory] = useState([]);
  // 是否正在加载列表
  const [isLoading, setIsLoading] = useState(true);
  // 正在跳转的记录 ID（防止重复点击）
  const [jumpingId, setJumpingId] = useState(null);

  // 没有 sessionId 则重定向到首页
  useEffect(() => {
    if (!sessionId) {
      navigate('/');
      return;
    }
    loadHistory();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 加载历史记录列表
  async function loadHistory() {
    try {
      setIsLoading(true);
      const data = await getHistory(sessionId);
      setHistory(data.history || []);
    } catch (err) {
      console.error('加载历史记录失败:', err);
      showError('加载练习记录失败，请重试');
    } finally {
      setIsLoading(false);
    }
  }

  /**
   * 点击历史记录卡片：加载完整数据并跳转到复盘页
   * @param {string} meetingId - 要恢复的会议 ID
   * @param {boolean} hasReview - 是否有复盘数据
   */
  async function handleCardClick(meetingId, hasReview) {
    if (jumpingId) return; // 已在跳转中，防止重复触发
    if (!hasReview) {
      showError('这场会议还没有复盘数据');
      return;
    }

    try {
      setJumpingId(meetingId);
      // 从服务器加载完整的会议和复盘数据
      const { meetingData, reviewData } = await getHistoryMeeting(meetingId);

      if (!reviewData) {
        showError('复盘数据不存在');
        return;
      }

      // 将数据注入全局状态，再跳转到复盘页
      // 注意：历史记录的 reviewData 不含 title/roleFeedback（数据库未保存），
      // 直接跳到 /review/nodes（逐节点复盘页），跳过称号展示页
      updateState({
        meetingId,
        meetingData,
        reviewData,
      });

      navigate('/review/nodes');
    } catch (err) {
      console.error('加载历史会议失败:', err);
      showError('加载失败，请重试');
    } finally {
      setJumpingId(null);
    }
  }

  /**
   * 格式化时间：将 ISO 时间字符串格式化为中文友好的相对时间或日期
   * @param {string} createdAt - ISO 时间字符串
   * @returns {string} 格式化后的时间文字
   */
  function formatTime(createdAt) {
    if (!createdAt) return '';
    const date = new Date(createdAt);
    const now = new Date();
    const diffMs = now - date;
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMinutes < 1) return '刚刚';
    if (diffMinutes < 60) return `${diffMinutes} 分钟前`;
    if (diffHours < 24) return `${diffHours} 小时前`;
    if (diffDays === 1) return '昨天';
    if (diffDays < 7) return `${diffDays} 天前`;

    // 超过 7 天显示具体日期
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  }

  return (
    <div className={styles.container}>
      {/* ===== 顶部导航栏 ===== */}
      <div className={styles.header}>
        <button
          className={styles.backButton}
          onClick={() => navigate('/')}
          aria-label="返回首页"
        >
          {/* 左箭头图标 */}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M19 12H5M5 12L12 19M5 12L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <h1 className={styles.title}>练习记录</h1>
        {/* 占位元素，保持标题居中 */}
        <div className={styles.headerRight}></div>
      </div>

      {/* ===== 内容区 ===== */}
      <div className={styles.content}>

        {/* 加载中状态 */}
        {isLoading && (
          <div className={styles.loadingState}>
            {/* 骨架屏：模拟卡片形状 */}
            {[1, 2, 3].map(i => (
              <div key={i} className={styles.skeletonCard}>
                <div className={styles.skeletonTitle}></div>
                <div className={styles.skeletonMeta}></div>
              </div>
            ))}
          </div>
        )}

        {/* 空状态：没有练习记录 */}
        {!isLoading && history.length === 0 && (
          <div className={styles.emptyState}>
            {/* 空状态图标 */}
            <div className={styles.emptyIcon}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <rect x="9" y="3" width="6" height="4" rx="1" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M9 12h6M9 16h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <p className={styles.emptyTitle}>还没有练习记录</p>
            <p className={styles.emptyDesc}>去开始第一场会议吧</p>
            <button
              className={styles.startButton}
              onClick={() => navigate('/source')}
            >
              开始练习
            </button>
          </div>
        )}

        {/* 历史记录列表 */}
        {!isLoading && history.length > 0 && (
          <ul className={styles.list}>
            {history.map((item, index) => (
              <li
                key={item.meetingId}
                className={`${styles.card} ${!item.hasReview ? styles.cardNoReview : ''} ${jumpingId === item.meetingId ? styles.cardLoading : ''}`}
                style={{ animationDelay: `${index * 0.06}s` }}
                onClick={() => handleCardClick(item.meetingId, item.hasReview)}
                role="button"
                tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && handleCardClick(item.meetingId, item.hasReview)}
                aria-label={`查看 ${item.topic} 的复盘`}
              >
                {/* 左侧：会议主题 + 元信息 */}
                <div className={styles.cardMain}>
                  <span className={styles.cardTopic}>{item.topic}</span>

                  {/* 称号 badge：只有有复盘才显示 */}
                  {item.hasReview && item.achievement && (
                    <span className={styles.cardAchievement}>{item.achievement}</span>
                  )}

                  <span className={styles.cardTime}>{formatTime(item.createdAt)}</span>
                </div>

                {/* 右侧：状态指示 */}
                <div className={styles.cardRight}>
                  {jumpingId === item.meetingId ? (
                    // 跳转中旋转指示器
                    <div className={styles.spinner}></div>
                  ) : item.hasReview ? (
                    // 有复盘：右箭头，可点击
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  ) : (
                    // 无复盘：显示"未复盘"标签
                    <span className={styles.noReviewTag}>未复盘</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default History;
