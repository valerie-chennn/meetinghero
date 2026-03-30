import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import styles from './Home.module.css';

/**
 * 首页组件
 * 高质感落地页：品牌区 + 聊天预览区 + CTA 按钮区
 * 老用户（有 sessionId）显示"再开一场"，新用户显示"闯进去看看"
 */
function Home() {
  const navigate = useNavigate();
  const { state } = useApp();

  // 检测老用户：localStorage 持久化的 sessionId 有值
  const hasSession = Boolean(state.sessionId);

  return (
    <div className={styles.container}>
      {/* ===== 顶部品牌区 ===== */}
      <div className={styles.brandSection}>
        <h1 className={styles.brandName}>MeetingHero</h1>
        <p className={styles.slogan}>英文会议生存指南</p>
      </div>

      {/* ===== 核心视觉区：聊天气泡预览 ===== */}
      <div className={styles.previewSection}>
        {/* Daniel 气泡 */}
        <div className={styles.bubbleRow}>
          <div className={`${styles.avatar} ${styles.avatarD}`}>D</div>
          <div className={styles.bubbleWrapper}>
            <div className={styles.speakerLine}>
              <span className={styles.speakerName}>Daniel</span>
              <span className={styles.speakerDot}>·</span>
              <span className={styles.speakerRole}>PM</span>
            </div>
            <div className={styles.previewBubble}>
              "We're 2 weeks behind. Who can explain?"
            </div>
          </div>
        </div>

        {/* Sarah 气泡 */}
        <div className={styles.bubbleRow}>
          <div className={`${styles.avatar} ${styles.avatarS}`}>S</div>
          <div className={styles.bubbleWrapper}>
            <div className={styles.speakerLine}>
              <span className={styles.speakerName}>Sarah</span>
              <span className={styles.speakerDot}>·</span>
              <span className={styles.speakerRole}>Tech Lead</span>
            </div>
            <div className={styles.previewBubble}>
              "There were some blockers we didn't—"
            </div>
          </div>
        </div>

        {/* 内心小人独白 */}
        <div className={styles.narratorBox}>
          <span className={styles.narratorIcon}>💭</span>
          <span className={styles.narratorText}>完了，话题转到我这了…</span>
        </div>

        {/* Your Turn 分隔线 */}
        <div className={styles.yourTurnLine}>
          <span>YOUR TURN</span>
        </div>
      </div>

      {/* ===== 底部 CTA 区 ===== */}
      <div className={styles.ctaSection}>
        <button
          className={styles.ctaButton}
          onClick={() => navigate(hasSession ? '/source' : '/onboarding')}
        >
          {hasSession ? '再开一场' : '闯进去看看'}
        </button>
        <p className={styles.ctaHint}>3 分钟一场，随时退出</p>
        {hasSession && (
          <button
            className={styles.editLink}
            onClick={() => navigate('/onboarding')}
          >
            修改我的信息
          </button>
        )}
      </div>
    </div>
  );
}

export default Home;
