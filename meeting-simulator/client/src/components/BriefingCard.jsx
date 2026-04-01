import React from 'react';
import styles from './BriefingCard.module.css';

/**
 * Briefing 卡片组件（视觉优化版）
 * 展示会议关键信息：Topic / Key Facts（最多2条）/ Decision Today
 * Props:
 *   briefing        - briefing 数据对象
 *   showTranslation - 是否显示中文翻译
 */
function BriefingCard({ briefing, showTranslation }) {
  if (!briefing) return null;

  // Key Facts 只取前 2 条
  const displayFacts = briefing.keyFacts ? briefing.keyFacts.slice(0, 2) : [];
  const displayFactsZh = briefing.keyFactsZh ? briefing.keyFactsZh.slice(0, 2) : [];

  return (
    <div className={styles.card}>
      {/* ── Topic 区块 ── */}
      <div className={styles.topicSection}>
        <span className={styles.fieldLabel}>Topic</span>
        <h2 className={styles.topic}>{briefing.topic}</h2>
        {/* 中文翻译：14px，比 muted 深，紧跟英文 */}
        {showTranslation && briefing.topicZh && (
          <p className={styles.topicTranslation}>{briefing.topicZh}</p>
        )}
      </div>

      {/* ── Key Facts ── */}
      {displayFacts.length > 0 && (
        <>
          <div className={styles.divider}></div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Key Facts</span>
            <ul className={styles.factsList}>
              {displayFacts.map((fact, idx) => (
                <li key={idx} className={styles.factItem}>
                  {/* dot 通过 margin-top 对齐首行文字中心 */}
                  <span className={styles.factDot}></span>
                  <div className={styles.factContent}>
                    <span className={styles.factText}>{fact}</span>
                    {/* 中文翻译：12px，与英文间距 2px */}
                    {showTranslation && displayFactsZh[idx] && (
                      <span className={styles.factTranslation}>{displayFactsZh[idx]}</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      {/* Decision Today 区块已移除，由会前准备页的"你的角色"卡片替代 */}

    </div>
  );
}

export default BriefingCard;
