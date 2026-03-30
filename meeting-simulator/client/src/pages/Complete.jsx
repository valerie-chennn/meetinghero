import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './Complete.module.css';

// 难度反馈选项
const DIFFICULTY_OPTIONS = [
  { value: 'easy', label: '太简单' },
  { value: 'just_right', label: '刚好' },
  { value: 'hard', label: '有点难' },
];

/**
 * 完成页
 * 展示完成图标、难度反馈收集，以及再来一场/回到首页 CTA
 */
function Complete() {
  const navigate = useNavigate();

  // 用户选择的难度反馈
  const [difficulty, setDifficulty] = useState(null);

  return (
    <div className={styles.container}>
      {/* 完成图标区 */}
      <div className={styles.iconSection}>
        <div className={styles.iconWrapper}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" fill="rgba(13, 148, 136, 0.12)" stroke="var(--accent-teal)" strokeWidth="2" />
            <path d="M8 12L11 15L16 9" stroke="var(--accent-teal)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h1 className={styles.doneTitle}>干得好！</h1>
        <p className={styles.doneDesc}>你完成了这场模拟会议的全部复盘</p>
      </div>

      {/* 难度反馈收集区 */}
      <div className={styles.feedbackSection}>
        <p className={styles.feedbackQuestion}>这场会对你来说：</p>
        <div className={styles.difficultyRow}>
          {DIFFICULTY_OPTIONS.map(opt => (
            <button
              key={opt.value}
              className={`${styles.difficultyButton} ${difficulty === opt.value ? styles.difficultyButtonActive : ''}`}
              onClick={() => setDifficulty(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 底部 CTA 区 */}
      <div className={styles.ctaSection}>
        {/* 主按钮：再来一场 */}
        <button
          className={styles.primaryButton}
          onClick={() => navigate('/source')}
        >
          再来一场
        </button>

        {/* 次要链接：回到首页 */}
        <button
          className={styles.secondaryLink}
          onClick={() => navigate('/')}
        >
          回到首页
        </button>
      </div>
    </div>
  );
}

export default Complete;
