import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { getExpressions, deleteExpression } from '../api/index.js';
import styles from './ExpressionsPage.module.css';

function ExpressionsPage() {
  const { state } = useApp();
  const [cards, setCards] = useState([]);
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // 页面加载时拉取已收藏的表达卡片及统计数据
  useEffect(() => {
    if (!state.userId) {
      setIsLoading(false);
      return;
    }

    const fetchExpressions = async () => {
      setIsLoading(true);
      setError('');
      try {
        const data = await getExpressions(state.userId);
        setCards(data.cards || []);
        // 后端返回 stats 时存入状态，没有则忽略
        if (data.stats) {
          setStats(data.stats);
        }
      } catch (err) {
        console.error('加载表达本失败:', err);
        setError('加载失败，请重试');
      } finally {
        setIsLoading(false);
      }
    };

    fetchExpressions();
  }, [state.userId]);

  // 取消收藏：调用 API 后从列表移除，同步更新统计数
  const handleDelete = async (cardId) => {
    try {
      await deleteExpression(cardId, state.userId);
      // 从本地列表中移除，无需重新请求
      setCards(prev => prev.filter(c => c.id !== cardId));
      // 同步减少统计中的 total 和 savedCount
      setStats(prev => prev ? {
        ...prev,
        total: Math.max(0, prev.total - 1),
        savedCount: Math.max(0, prev.savedCount - 1),
      } : prev);
    } catch (err) {
      console.error('取消收藏失败:', err);
    }
  };

  return (
    <div className={styles.container}>
      {/* 顶部标题 */}
      <header className={styles.header}>
        <h1 className={styles.title}>表达本</h1>
        <p className={styles.desc}>收藏你学到的地道英语表达</p>
      </header>

      {/* 统计栏：有数据且不在加载/错误状态时显示 */}
      {!isLoading && !error && stats && (
        <div className={styles.statsBar}>
          <div className={styles.statBlock}>
            <span className={styles.statNumber}>{stats.total}</span>
            <span className={styles.statLabel}>积累表达</span>
          </div>
          <div className={styles.statDivider} />
          <div className={styles.statBlock}>
            <span className={styles.statNumber}>{stats.practicedCount}</span>
            <span className={styles.statLabel}>已练习</span>
          </div>
          <div className={styles.statDivider} />
          <div className={styles.statBlock}>
            <span className={styles.statNumber}>
              {stats.total > 0 ? Math.round((stats.practicedCount / stats.total) * 100) : 0}%
            </span>
            <span className={styles.statLabel}>练习率</span>
          </div>
        </div>
      )}

      <div className={styles.content}>
        {/* 加载状态 */}
        {isLoading && (
          <div className={styles.loadingState}>
            <div className={styles.loadingSpinner} />
            <p className={styles.loadingText}>加载中…</p>
          </div>
        )}

        {/* 错误状态 */}
        {!isLoading && error && (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>😕</div>
            <h2 className={styles.emptyTitle}>{error}</h2>
          </div>
        )}

        {/* 正常内容 */}
        {!isLoading && !error && (
          cards.length === 0 ? (
            /* 空态 */
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>📖</div>
              <h2 className={styles.emptyTitle}>暂无收藏的表达</h2>
              <p className={styles.emptyDesc}>
                参加群聊后，把学到的好表达收藏到这里。
              </p>
            </div>
          ) : (
            /* 表达卡片列表 */
            <div className={styles.cardList}>
              {cards.map(card => (
                <div key={card.id} className={styles.card}>
                  {/* 卡片头部：语境标签 + 练习状态 + 取消收藏按钮 */}
                  <div className={styles.cardTopRow}>
                    <div className={styles.cardLabel}>你说的</div>
                    <div className={styles.cardActions}>
                      {/* 练习状态标记 */}
                      <span className={`${styles.practiceTag} ${card.isPracticed ? styles.practiceTagDone : styles.practiceTagPending}`}>
                        {card.isPracticed ? '已练习' : '未练习'}
                      </span>
                      <button
                        className={styles.unsaveButton}
                        onClick={() => handleDelete(card.id)}
                        aria-label="取消收藏"
                      >
                        已收藏 ★
                      </button>
                    </div>
                  </div>
                  <p className={styles.userSaid}>{card.userSaid}</p>
                  <div className={`${styles.cardLabel} ${styles.cardLabelGreen}`}>更好的说法</div>
                  <p className={styles.betterVersion}>{card.betterVersion}</p>
                  {card.contextNote && (
                    <p className={styles.contextNote}>{card.contextNote}</p>
                  )}
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* 底部 Tab 占位 */}
      <div className={styles.bottomPadding} />
    </div>
  );
}

export default ExpressionsPage;
