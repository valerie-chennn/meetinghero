import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import styles from './PreMeeting.module.css';

// 最多换主题次数
const MAX_REFRESH = 3;

/**
 * 会前准备页面——全息任务卡版本
 * 将所有信息合并到一张毛玻璃卡片中：
 * 难度 badge → 会议主题 → 前情提要 → 身份行 → 目标/难点/盟友
 */
function PreMeeting() {
  const navigate = useNavigate();
  const { state, updateState } = useApp();

  const { meetingData, userName, sceneType } = state;

  // 脑洞模式标识
  // 双重判断：state.sceneType 或 meetingData.sceneType（兼容旧 localStorage 缺少 sceneType 的情况）
  const isBrainstorm =
    (sceneType && (sceneType === 'brainstorm-pick' || sceneType === 'brainstorm-random')) ||
    (meetingData?.sceneType && meetingData.sceneType.startsWith('brainstorm'));

  // 从 localStorage 读取难度星级，默认 3 星
  const difficulty = parseInt(localStorage.getItem('meetingDifficulty') || '3', 10);

  // 从 localStorage 读取职位
  const jobTitle = localStorage.getItem('jobTitle') || '';

  // 没有会议数据时跳回首页（用 useEffect 避免渲染期直接调用 navigate）
  useEffect(() => {
    if (!meetingData) {
      navigate('/');
    }
  }, [meetingData, navigate]);

  if (!meetingData) return null;

  // userRole 包含剧本杀风格字段：backstory / goal / challenge / ally
  const { briefing, userRole } = meetingData;

  // 渲染难度星级：使用实心/空心星符号
  const renderStars = (count) => {
    const total = 5;
    const filled = Math.min(Math.max(count, 1), total);
    return Array.from({ length: total }, (_, i) => (
      <span key={i} className={i < filled ? styles.starFilled : styles.starEmpty}>
        ★
      </span>
    ));
  };

  /**
   * 前情提要内容：
   * 优先取 userRole.backstory（新数据格式）
   * 如果不存在，降级取 briefing.keyFacts 数组，每条前加 "· " 展示
   */
  const renderBackstory = () => {
    if (userRole?.backstory) {
      // 按换行符分段，每段一行，方便扫读
      const lines = userRole.backstory.split('\n').filter(Boolean);
      return (
        <div className={styles.backstoryLines}>
          {lines.map((line, idx) => (
            <p key={idx} className={styles.backstoryLine}>{line}</p>
          ))}
        </div>
      );
    }
    // 旧数据兼容：取 keyFacts 显示
    if (briefing?.keyFacts?.length > 0) {
      return (
        <div className={styles.backstoryFacts}>
          {briefing.keyFacts.map((fact, idx) => (
            <p key={idx} className={styles.backstoryFactItem}>· {fact}</p>
          ))}
        </div>
      );
    }
    return null;
  };

  // 当前会话已换主题次数（从 state 读取）
  const refreshCount = state.themeRefreshCount || 0;
  const canRefresh = isBrainstorm && refreshCount < MAX_REFRESH;

  // 换主题：轮转 mainWorld → 清除旧主题和会议数据 → 跳回 Loading 重新生成
  const handleRefreshTheme = () => {
    if (!canRefresh) return;

    const characters = state.brainstormCharacters || [];
    let nextMainWorld = state.brainstormMainWorld;

    // 轮转 mainWorld：同 ThemePreview 的逻辑
    if (characters.length >= 3) {
      const rotationIndex = (refreshCount + 1) % characters.length;
      nextMainWorld = characters[rotationIndex].world || nextMainWorld;
    }

    // 清除旧主题和旧会议数据，Loading 页会用新 mainWorld 重新生成主题和会议
    updateState({
      brainstormMainWorld: nextMainWorld,
      brainstormTheme: null,
      meetingData: null,
      meetingId: null,
      themeRefreshCount: refreshCount + 1,
    });
    navigate('/loading');
  };

  // 进入会议
  const handleEnterMeeting = () => {
    navigate('/meeting');
  };

  return (
    <div className={styles.container}>
      {/* 背景装饰光斑：品牌色系的模糊大圆，让毛玻璃卡片有色彩可以折射 */}
      <div className={`${styles.glowOrb} ${styles.glowOrb1}`} />
      <div className={`${styles.glowOrb} ${styles.glowOrb2}`} />
      <div className={`${styles.glowOrb} ${styles.glowOrb3}`} />

      {/* 可滚动内容区 */}
      <div className={styles.scrollArea}>

        {/* ── 任务卡片（唯一主视觉卡片）── */}
        <div className={styles.missionCard}>

          {/* 2a. 头部行：难度 badge（右对齐） */}
          <div className={styles.cardHeader}>
            <div className={styles.difficultyBadge}>
              难度 <span className={styles.difficultyStars}>{renderStars(difficulty)}</span>
            </div>
          </div>

          {/* 2b. 会议主题 */}
          <div className={styles.topicSection}>
            <h2 className={styles.topicTitle}>{briefing?.topic}</h2>
            {briefing?.topicZh && (
              <p className={styles.topicSubtitle}>{briefing.topicZh}</p>
            )}
          </div>

          {/* 2c. 渐变发光分隔线 */}
          <div className={styles.gradientLine} />

          {/* 2d. 前情提要区块 */}
          <div className={styles.backstorySection}>
            <span className={styles.sectionLabel}>前情提要</span>
            {renderBackstory()}
          </div>

          {/* 2e. 渐变发光分隔线 */}
          <div className={styles.gradientLine} />

          {/* 2f. 身份行：脑洞模式显示角色头衔，正经开会显示用户名 · 职位 */}
          <div className={styles.roleIdentityRow}>
            <span className={styles.roleIdentityText}>
              {isBrainstorm
                ? (meetingData?.userRole?.title || userName || '英雄')
                : (
                  <>
                    {userName || '你'}
                    {jobTitle && <span className={styles.roleIdentitySep}> · {jobTitle}</span>}
                  </>
                )
              }
            </span>
          </div>

          {/* 2g. 目标 / 难点 / 盟友三行信息 */}
          {userRole && (
            <div className={styles.roleInfoList}>
              {/* 目标行：翡翠绿 */}
              <div className={`${styles.roleInfoItem} ${styles.roleInfoGoal}`}>
                <div className={styles.roleInfoAccentBar} style={{ background: 'var(--color-success)' }} />
                <span className={styles.roleInfoEmoji}>🎯</span>
                <span className={styles.roleInfoText}>
                  <span className={styles.roleInfoLabel}>目标：</span>
                  {userRole.goal}
                </span>
              </div>

              {/* 难点行：橙色 */}
              <div className={`${styles.roleInfoItem} ${styles.roleInfoChallenge}`}>
                <div className={styles.roleInfoAccentBar} style={{ background: 'var(--accent-orange)' }} />
                <span className={styles.roleInfoEmoji}>⚠️</span>
                <span className={styles.roleInfoText}>
                  <span className={styles.roleInfoLabel}>难点：</span>
                  {userRole.challenge}
                </span>
              </div>

              {/* 盟友行：品牌靛蓝 */}
              <div className={`${styles.roleInfoItem} ${styles.roleInfoAlly}`}>
                <div className={styles.roleInfoAccentBar} style={{ background: 'var(--color-brand)' }} />
                <span className={styles.roleInfoEmoji}>💚</span>
                <span className={styles.roleInfoText}>
                  <span className={styles.roleInfoLabel}>盟友：</span>
                  {userRole.ally}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* 底部占位，防止固定按钮遮挡内容 */}
        <div style={{ height: 96 }} />
      </div>

      {/* 固定底部：换主题按钮（脑洞模式） + 进入会议 CTA 按钮（翡翠绿） */}
      <div className={styles.footer}>
        {/* 换主题按钮：仅脑洞模式显示 */}
        {isBrainstorm && (
          <div className={styles.refreshRow}>
            <button
              className={`${styles.refreshBtn} ${canRefresh ? styles.refreshBtnActive : ''}`}
              onClick={handleRefreshTheme}
              disabled={!canRefresh}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M1 4v6h6M23 20v-6h-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 0 1 3.51 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              换一个主题
            </button>
            <span className={`${styles.refreshCount} ${!canRefresh ? styles.refreshCountDepleted : ''}`}>
              {refreshCount}/{MAX_REFRESH}
            </span>
          </div>
        )}

        <button className={styles.enterButton} onClick={handleEnterMeeting}>
          进入会议
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M5 12H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M12 5L19 12L12 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default PreMeeting;
