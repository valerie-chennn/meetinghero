import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import styles from './BrainstormEntry.module.css';

/**
 * 脑洞模式入口页
 * 路由：/brainstorm
 * 展示两个子模式：点将局（选角色）/ 乱炖局（随机翻牌）
 */
function BrainstormEntry() {
  const navigate = useNavigate();
  const { updateState } = useApp();

  // 进入点将局
  const handlePickMode = () => {
    updateState({ sceneType: 'brainstorm-pick', brainstormCharacters: [], brainstormTheme: null });
    navigate('/brainstorm/search');
  };

  // 进入乱炖局
  const handleRandomMode = () => {
    updateState({ sceneType: 'brainstorm-random', brainstormCharacters: [], brainstormTheme: null });
    navigate('/brainstorm/random');
  };

  return (
    <div className={styles.container}>
      {/* ===== 顶部导航区 ===== */}
      <div className={styles.topNav}>
        <button className={styles.backBtn} onClick={() => navigate('/')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M19 12H5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <path d="M12 19L5 12L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <span className={styles.navTitle}>脑洞模式</span>
      </div>

      {/* ===== 内容区 ===== */}
      <div className={styles.content}>
        {/* 点将局卡片 */}
        <button className={styles.modeCard} onClick={handlePickMode}>
          {/* 图标 + 标题行 */}
          <div className={styles.cardHeader}>
            <div className={styles.iconWrap}>
              <span className={styles.iconEmoji}>🎯</span>
            </div>
            <span className={styles.cardTitle}>点将局</span>
          </div>

          {/* 标语 */}
          <p className={styles.cardTagline}>重生之开局就是一场会</p>

          {/* 分割线 */}
          <div className={styles.cardDivider} />

          {/* 描述 */}
          <p className={styles.cardDesc}>我选角色，我定局</p>

          {/* 箭头 */}
          <div className={styles.cardChevron}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </button>

        {/* 乱炖局卡片 */}
        <button className={`${styles.modeCard} ${styles.randomCard}`} onClick={handleRandomMode}>
          {/* 图标 + 标题行 */}
          <div className={styles.cardHeader}>
            <div className={`${styles.iconWrap} ${styles.iconWrapPurple}`}>
              <span className={styles.iconEmoji}>🎲</span>
            </div>
            <span className={styles.cardTitle}>乱炖局</span>
          </div>

          {/* 标语 */}
          <p className={`${styles.cardTagline} ${styles.cardTaglinePurple}`}>随机召唤，可能是神也可能是猪</p>

          {/* 分割线 */}
          <div className={styles.cardDivider} />

          {/* 描述 */}
          <p className={styles.cardDesc}>命运自行决定</p>

          {/* 箭头 */}
          <div className={styles.cardChevron}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </button>
      </div>
    </div>
  );
}

export default BrainstormEntry;
