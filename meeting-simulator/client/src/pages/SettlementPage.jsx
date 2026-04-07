import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { getSettlement, saveExpression, deleteExpression } from '../api/index.js';
import styles from './SettlementPage.module.css';

function SettlementPage() {
  const navigate = useNavigate();
  const { sessionId } = useParams();
  const { state, updateState } = useApp();

  const [settlement, setSettlement] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

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

  // 点击"回首页"
  const handleBackToFeed = () => {
    // 重置 Feed 相关计数
    updateState({ cardsSinceLastChat: 0 });
    navigate('/feed', { replace: true });
  };

  // 重试加载
  const handleRetry = () => {
    setError('');
    setIsLoading(true);
    getSettlement(sessionId)
      .then(data => setSettlement(data))
      .catch(err => {
        console.error('重试加载结算数据失败:', err);
        setError('加载失败，请重试');
      })
      .finally(() => setIsLoading(false));
  };

  return (
    <div className={styles.container}>
      {/* 顶部标题 */}
      <header className={styles.header}>
        <div className={styles.headerBadge}>本轮结算</div>
        <h1 className={styles.headerTitle}>讨论收官</h1>
      </header>

      <div className={styles.scrollArea}>
        {/* 加载状态 */}
        {isLoading && (
          <div className={styles.loadingState}>
            <div className={styles.loadingSpinner} />
            <p className={styles.loadingText}>正在加载结算数据…</p>
          </div>
        )}

        {/* 错误状态 */}
        {!isLoading && error && (
          <div className={styles.errorState}>
            <p className={styles.errorText}>{error}</p>
            <button className={styles.retryButton} onClick={handleRetry}>
              重试
            </button>
          </div>
        )}

        {/* 正常内容 */}
        {!isLoading && !error && settlement && (
          <>
            {/* 事件结果区块 */}
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>
                <span className={styles.sectionIcon}>💬</span>
                事件结果
              </h2>

              {/* 根据结算类型渲染不同形式，structuredResult 为 null 时降级显示纯文本 */}
              {settlement.structuredResult ? (
                <>
                  {/* 新闻后续 */}
                  {settlement.settlementType === 'news' && (
                    <div className={styles.newsResult}>
                      <div className={styles.newsMedia}>
                        {settlement.structuredResult.mediaName}
                      </div>
                      <h3 className={styles.newsHeadline}>{settlement.structuredResult.headline}</h3>
                      <ul className={styles.newsBullets}>
                        {settlement.structuredResult.bullets?.map((b, i) => (
                          <li key={i} className={styles.newsBullet}>· {b}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* 朋友圈 */}
                  {settlement.settlementType === 'moments' && (
                    <div className={styles.momentsResult}>
                      <div className={styles.momentsHeader}>
                        <div className={styles.momentsAvatar}>
                          {settlement.structuredResult.character?.[0]}
                        </div>
                        <span className={styles.momentsName}>{settlement.structuredResult.character}</span>
                      </div>
                      <p className={styles.momentsPost}>{settlement.structuredResult.post}</p>
                      <div className={styles.momentsLikers}>
                        ❤️ {settlement.structuredResult.likers?.join('、')} 等{settlement.structuredResult.likeCount}人觉得很赞
                      </div>
                    </div>
                  )}

                  {/* 群公告 */}
                  {settlement.settlementType === 'announcement' && (
                    <div className={styles.announcementResult}>
                      <div className={styles.announcementBadge}>群公告</div>
                      <h3 className={styles.announcementTitle}>{settlement.structuredResult.title}</h3>
                      <p className={styles.announcementContent}>{settlement.structuredResult.content}</p>
                    </div>
                  )}
                </>
              ) : (
                /* 降级：显示纯文本 eventResult */
                <div className={styles.eventResultCard}>
                  <p className={styles.eventResultText}>{settlement.eventResult}</p>
                </div>
              )}

              {/* 荒诞属性变化 */}
              {settlement.absurdAttributes && settlement.absurdAttributes.length > 0 && (
                <div className={styles.absurdSection}>
                  {settlement.absurdAttributes.map((attr, i) => (
                    <div key={i} className={styles.absurdItem}>
                      <span className={styles.absurdName}>{attr.name}</span>
                      <span className={attr.delta > 0 ? styles.absurdPlus : styles.absurdMinus}>
                        {attr.delta > 0 ? '+' : ''}{attr.delta}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* 表达卡片区块 */}
            {settlement.expressionCards && settlement.expressionCards.length > 0 && (
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>
                  <span className={styles.sectionIcon}>✨</span>
                  你的表达
                </h2>
                <div className={styles.expressionCards}>
                  {settlement.expressionCards.map((card, index) => (
                    <ExpressionCard
                      key={card.id}
                      card={card}
                      index={index}
                      userId={state.userId}
                    />
                  ))}
                </div>
                {/* 已收藏提示 */}
                <p className={styles.savedHint}>点击「收藏」可将表达存入表达本</p>
              </section>
            )}
          </>
        )}

        {/* 回首页按钮（始终显示，不依赖数据加载结果） */}
        <div className={styles.actions}>
          <button
            className={styles.backToFeedButton}
            onClick={handleBackToFeed}
          >
            回首页继续刷 →
          </button>
        </div>

        {/* 底部安全区域占位 */}
        <div className={styles.bottomPadding} />
      </div>
    </div>
  );
}

// 单张表达卡片
function ExpressionCard({ card, index, userId }) {
  const [saved, setSaved] = React.useState(card.isSaved);
  const [isSaving, setIsSaving] = React.useState(false);

  // 收藏 / 取消收藏
  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      if (saved) {
        await deleteExpression(card.id, userId);
        setSaved(false);
      } else {
        await saveExpression(card.id, userId);
        setSaved(true);
      }
    } catch (err) {
      console.error('收藏操作失败:', err);
      // 操作失败不更新 UI，让用户可以重试
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className={styles.expressionCard}
      style={{ animationDelay: `${index * 100}ms` }}
    >
      {/* 发言轮次标签 */}
      <div className={styles.cardHeader}>
        <span className={styles.turnBadge}>第 {card.turnIndex} 次发言</span>
        <button
          className={`${styles.saveButton} ${saved ? styles.saveButtonActive : ''}`}
          onClick={handleSave}
          disabled={isSaving}
          aria-label={saved ? '取消收藏' : '收藏到表达本'}
        >
          {isSaving ? '…' : saved ? '已收藏 ★' : '收藏 ☆'}
        </button>
      </div>

      {/* 对比：你说的 vs 更好的说法 */}
      <div className={styles.comparison}>
        <div className={styles.comparisonItem}>
          <span className={styles.comparisonLabel}>你说的</span>
          <p className={`${styles.comparisonText} ${styles.userSaid}`}>{card.userSaid}</p>
        </div>
        <div className={styles.comparisonDivider}>→</div>
        <div className={styles.comparisonItem}>
          <span className={styles.comparisonLabel}>更好的说法</span>
          <p className={`${styles.comparisonText} ${styles.betterVersion}`}>{card.betterVersion}</p>
        </div>
      </div>

      {/* 语境说明 */}
      {card.contextNote && (
        <p className={styles.contextNote}>{card.contextNote}</p>
      )}
    </div>
  );
}

export default SettlementPage;
