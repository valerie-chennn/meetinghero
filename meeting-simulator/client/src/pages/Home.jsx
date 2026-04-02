import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { updateEnglishLevel } from '../api/index.js';
import styles from './Home.module.css';

/**
 * 首页组件 — 重设计版
 * 布局：品牌区（光晕背景）→ 两张全宽大卡片（上下排列）→ 老用户区
 */
// 有效的英语等级列表
const ENGLISH_LEVELS = ['A1', 'A2', 'B1', 'B2'];

function Home() {
  const navigate = useNavigate();
  const { state, updateState } = useApp();

  // 英语等级切换面板是否展开
  const [levelPanelOpen, setLevelPanelOpen] = useState(false);
  // 等级更新请求中
  const [levelUpdating, setLevelUpdating] = useState(false);

  // 检测老用户：localStorage 持久化的 sessionId 有值
  const hasSession = Boolean(state.sessionId);

  // 点击"正经开会"
  const handleFormalMeeting = () => {
    // 新用户尚未完成 onboarding，先记录意图，跳到 onboarding
    if (!state.sessionId || !state.englishLevel) {
      updateState({ pendingMode: 'formal' });
      navigate('/onboarding');
      return;
    }
    updateState({ sceneType: 'formal' });
    if (state.jobTitle && state.industry) {
      // 已有职位/行业信息，直接进入会议来源选择
      navigate('/source');
    } else {
      // 需要补充职位/行业信息
      navigate('/work-info');
    }
  };

  // 点击"脑洞模式"
  const handleBrainstorm = () => {
    // 新用户尚未完成 onboarding，先记录意图，跳到 onboarding
    if (!state.sessionId || !state.englishLevel) {
      updateState({ pendingMode: 'brainstorm' });
      navigate('/onboarding');
      return;
    }
    navigate('/brainstorm');
  };

  // 切换英语等级：更新本地 state 和后端数据库
  const handleLevelChange = async (level) => {
    if (level === state.englishLevel || levelUpdating) return;
    // 保存旧值，用于请求失败时回滚
    const prevLevel = state.englishLevel;
    setLevelUpdating(true);
    try {
      // 乐观更新本地 state，让 UI 立即响应
      updateState({ englishLevel: level });
      // 同步到后端（有 sessionId 才调用）
      if (state.sessionId) {
        await updateEnglishLevel({ sessionId: state.sessionId, englishLevel: level });
      }
    } catch (err) {
      console.error('[Home] 更新英语等级失败:', err.message);
      // 失败时回滚本地 state 到旧值
      updateState({ englishLevel: prevLevel });
    } finally {
      setLevelUpdating(false);
      setLevelPanelOpen(false);
    }
  };

  return (
    <div className={styles.container}>

      {/* ===== 品牌区（带光晕背景）===== */}
      <div className={styles.header}>
        {/* 背景光斑装饰（CSS 伪元素无法直接操作，用 div 替代）*/}
        <div className={styles.glowOrb1} aria-hidden="true" />
        <div className={styles.glowOrb2} aria-hidden="true" />

        {/* 品牌 Logo 区 */}
        <div className={styles.brandLockup}>
          {/* 小图标：会议/讲台感的 SVG */}
          <div className={styles.brandIcon} aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
              <path d="M2 17l10 5 10-5" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
              <path d="M2 12l10 5 10-5" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1 className={styles.brandName}>MeetingHero</h1>
        </div>

        <p className={styles.slogan}>i 人会议生存指南</p>

        {/* 英语等级切换入口（有 englishLevel 时显示）*/}
        {state.englishLevel && (
          <div className={styles.levelBadgeWrap}>
            {/* 当前等级 badge，点击展开切换面板 */}
            <button
              className={styles.levelBadge}
              onClick={() => setLevelPanelOpen(prev => !prev)}
              aria-label="切换英语等级"
              aria-expanded={levelPanelOpen}
            >
              <span className={styles.levelBadgeLabel}>英语等级</span>
              <span className={styles.levelBadgeValue}>{state.englishLevel}</span>
              {/* 小箭头，展开时翻转 */}
              <svg
                className={`${styles.levelBadgeChevron} ${levelPanelOpen ? styles.levelBadgeChevronOpen : ''}`}
                width="10" height="10" viewBox="0 0 24 24" fill="none"
              >
                <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            {/* 下拉切换面板 */}
            {levelPanelOpen && (
              <div className={styles.levelPanel}>
                {ENGLISH_LEVELS.map(level => (
                  <button
                    key={level}
                    className={`${styles.levelOption} ${level === state.englishLevel ? styles.levelOptionActive : ''}`}
                    onClick={() => handleLevelChange(level)}
                    disabled={levelUpdating}
                  >
                    {level}
                    {level === state.englishLevel && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ marginLeft: 4, flexShrink: 0 }}>
                        <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ===== 模式入口区：上下两张全宽大卡片 ===== */}
      <div className={styles.modeCards}>

        {/* 正经开会卡片 */}
        <button className={styles.formalCard} onClick={handleFormalMeeting}>
          {/* 卡片主体内容 */}
          <div className={styles.cardContent}>
            {/* 图标容器 */}
            <div className={styles.cardIconWrap}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="2" y="7" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="2"/>
                <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <line x1="12" y1="12" x2="12" y2="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <line x1="10" y1="14" x2="14" y2="14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>

            {/* 文字区 */}
            <div className={styles.cardText}>
              <span className={styles.cardTitle}>正经开会</span>
              <span className={styles.cardSubtitle}>职场真实场景，练出高情商发言</span>
            </div>

            {/* 右侧箭头 */}
            <div className={styles.cardArrow}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>

          {/* 右侧装饰插图：淡淡的公文包 */}
          <div className={styles.formalDeco} aria-hidden="true">
            <svg width="72" height="72" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="2" y="7" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              <line x1="12" y1="11" x2="12" y2="16" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              <line x1="9" y1="13.5" x2="15" y2="13.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
          </div>
        </button>

        {/* 脑洞模式卡片 */}
        <button className={styles.brainstormCard} onClick={handleBrainstorm}>
          {/* 卡片主体内容 */}
          <div className={styles.cardContent}>
            {/* 图标容器 */}
            <div className={styles.brainstormIconWrap}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
              </svg>
            </div>

            {/* 文字区 */}
            <div className={styles.cardText}>
              <span className={styles.cardTitle}>脑洞模式</span>
              <span className={styles.brainstormSubtitle}>IP 角色跨界开会，越荒诞越好玩</span>
            </div>

            {/* 右侧箭头 */}
            <div className={styles.cardArrowPurple}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>

          {/* 右侧装饰插图：淡淡的星星/闪电 */}
          <div className={styles.brainstormDeco} aria-hidden="true">
            <svg width="72" height="72" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round"/>
            </svg>
          </div>

          {/* 脑洞卡片内部光晕 */}
          <div className={styles.brainstormGlow} aria-hidden="true" />
        </button>
      </div>

      {/* ===== 老用户区（紧跟卡片下方，不贴底）===== */}
      {hasSession && (
        <div className={styles.userSection}>
          <button
            className={styles.historyLink}
            onClick={() => navigate('/history')}
          >
            {/* 时钟图标 */}
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
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
        </div>
      )}
    </div>
  );
}

export default Home;
