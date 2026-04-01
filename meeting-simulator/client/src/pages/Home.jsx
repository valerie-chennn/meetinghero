import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import styles from './Home.module.css';

/**
 * 首页组件
 * 设计策略：Linear/Notion 风格，高端简洁，重视留白
 * 手机壳预览 + 价值点微卡片 + 翡翠绿 CTA
 */
function Home() {
  const navigate = useNavigate();
  const { state } = useApp();

  // 检测老用户：localStorage 持久化的 sessionId 有值
  const hasSession = Boolean(state.sessionId);

  return (
    <div className={styles.container}>
      {/* ===== 品牌区：Plus Jakarta Sans 700，靛蓝色 ===== */}
      <div className={styles.header}>
        <h1 className={styles.brandName}>MeetingHero</h1>
        <p className={styles.slogan}>i人会议生存指南</p>
      </div>

      {/* ===== 核心视觉区：深靛蓝渐变手机壳 ===== */}
      <div className={styles.phoneFrame}>
        {/* 顶部 notch 装饰条，模拟手机状态栏 */}
        <div className={styles.phoneNotch}></div>

        {/* 手机内部内容 */}
        <div className={styles.phoneContent}>
          {/* Daniel 发言气泡 */}
          <div className={styles.phoneBubbleRow}>
            <div className={styles.phoneAvatar}>D</div>
            <div className={styles.phoneBubbleBlock}>
              <div className={styles.phoneSpeaker}>Daniel · PM</div>
              <div className={styles.phoneBubble}>
                "We're behind schedule. Who can explain?"
              </div>
            </div>
          </div>

          {/* 内心小人独白 */}
          <div className={styles.phoneNarrator}>
            💭 完了，话题转到我这了…
          </div>

          {/* 模拟输入框（不可交互，纯展示） */}
          <div className={styles.phoneInput}>
            <span className={styles.phoneInputPlaceholder}>输入你的发言…</span>
            {/* 麦克风图标 SVG */}
            <svg className={styles.phoneInputMic} width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="9" y="2" width="6" height="12" rx="3" fill="currentColor"/>
              <path d="M5 10a7 7 0 0 0 14 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <line x1="12" y1="17" x2="12" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
        </div>
      </div>

      {/* ===== 价值传递区：微卡片，stagger 入场 ===== */}
      <div className={styles.valueSection}>
        {/* 价值点 1 */}
        <div className={`${styles.valueItem} ${styles.valueItem1}`}>
          <div className={styles.valueIcon}>
            {/* 靶心图标 */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="2"/>
              <circle cx="12" cy="12" r="6" stroke="white" strokeWidth="2"/>
              <circle cx="12" cy="12" r="2" fill="white"/>
            </svg>
          </div>
          <div className={styles.valueBody}>
            <span className={styles.valueTitle}>真实场景，开口练习</span>
            <span className={styles.valueDesc}>模拟真实英文会议，在关键节点练开口</span>
          </div>
        </div>

        {/* 价值点 2 */}
        <div className={`${styles.valueItem} ${styles.valueItem2}`}>
          <div className={styles.valueIcon}>
            {/* 对话气泡图标 */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className={styles.valueBody}>
            <span className={styles.valueTitle}>中文也能说</span>
            <span className={styles.valueDesc}>说不出口？中文也行，系统帮你转英文</span>
          </div>
        </div>

        {/* 价值点 3 */}
        <div className={`${styles.valueItem} ${styles.valueItem3}`}>
          <div className={styles.valueIcon}>
            {/* 笔记本图标 */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <polyline points="14,2 14,8 20,8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <line x1="16" y1="13" x2="8" y2="13" stroke="white" strokeWidth="2" strokeLinecap="round"/>
              <line x1="16" y1="17" x2="8" y2="17" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <div className={styles.valueBody}>
            <span className={styles.valueTitle}>会后逐句复盘</span>
            <span className={styles.valueDesc}>学到下次能用的表达，真正积累英语能力</span>
          </div>
        </div>
      </div>

      {/* ===== CTA 区：翡翠绿主按钮，贴底 ===== */}
      <div className={styles.ctaSection}>
        <button
          className={styles.ctaButton}
          onClick={() => navigate(hasSession ? '/source' : '/onboarding')}
        >
          {hasSession ? '再开一场' : '开始第一场'}
        </button>
        <p className={styles.ctaHint}>免费 · 3分钟一场</p>
        {hasSession && (
          <>
            <button
              className={styles.historyLink}
              onClick={() => navigate('/history')}
            >
              {/* 时钟/历史图标 */}
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/>
                <path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              查看练习记录
            </button>
            <button
              className={styles.editLink}
              onClick={() => navigate('/onboarding')}
            >
              修改我的信息
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default Home;
