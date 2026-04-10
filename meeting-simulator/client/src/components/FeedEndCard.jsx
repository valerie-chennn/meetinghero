import React from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './FeedEndCard.module.css';

function FeedEndCard({ height, expressionCount = 0 }) {
  const navigate = useNavigate();

  return (
    <div className={styles.endCard} style={{ height, backgroundColor: '#F5F3EE' }}>
      <div className={styles.content}>
        {/* 报纸印刷动画 */}
        <div className={styles.printAnim}>
          <div className={styles.paper}>
            <div className={styles.paperFold} />
            <div className={styles.inkLines}>
              <span className={styles.inkLine} style={{ animationDelay: '0s' }} />
              <span className={styles.inkLine} style={{ animationDelay: '0.3s' }} />
              <span className={styles.inkLine} style={{ animationDelay: '0.6s' }} />
              <span className={styles.inkLine} style={{ animationDelay: '0.9s' }} />
              <span className={styles.inkLine} style={{ animationDelay: '1.2s' }} />
            </div>
            <div className={styles.inkWash} />
          </div>
        </div>

        {/* 标题 */}
        <h2 className={styles.title}>Next edition printing</h2>
        <p className={styles.subtitle}>A new story is on the press.</p>

        {/* 分隔线 */}
        <div className={styles.divider} />

        {/* 表达本入口 */}
        <div className={styles.exprCard} onClick={() => navigate('/expressions')}>
          <div className={styles.exprIcon}>
            {/* 书本图标轮廓 */}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
            {expressionCount > 0 && (
              <span className={styles.badge}>{expressionCount}</span>
            )}
          </div>
          <div className={styles.exprText}>
            <span className={styles.exprTitle}>Expression book</span>
            <span className={styles.exprSub}>{expressionCount} expressions to review</span>
          </div>
          <svg className={styles.exprArrow} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </div>
      </div>
    </div>
  );
}

export default FeedEndCard;
