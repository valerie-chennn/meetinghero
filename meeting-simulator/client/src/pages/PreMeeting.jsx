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

  const { meetingData, userName, sceneType, brainstormTheme } = state;

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

  // userRole 包含字段：backstory / goal
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
   * 优先取 userRole.backstory（新数据格式），识别三种行类型分别渲染：
   *   - "→ " 开头：钩子问题，最醒目
   *   - "· " 开头：角色立场，角色名加粗用品牌色
   *   - 其他：大背景叙述，正常段落文字
   * 如果不存在，降级取 briefing.keyFacts 数组，每条前加 "· " 展示
   */
  const renderBackstory = () => {
    if (userRole?.backstory) {
      const lines = userRole.backstory.split('\n').filter(Boolean);
      return (
        <div className={styles.backstoryLines}>
          {lines.map((line, idx) => {
            // 钩子问题：以 "→" 开头（兼容全角/半角空格）
            if (line.startsWith('→')) {
              const text = line.replace(/^→\s*/, '');
              return (
                <p key={idx} className={styles.backstoryLineHook}>
                  <span className={styles.backstoryHookArrow}>→</span>
                  {text}
                </p>
              );
            }
            // 角色立场：以 "·" 或 "• " 开头，格式为 "· 角色名：态度"
            if (line.startsWith('·') || line.startsWith('•')) {
              const text = line.replace(/^[·•]\s*/, '');
              // 拆分"角色名：态度"，以第一个"："为界
              const colonIdx = text.indexOf('：');
              if (colonIdx !== -1) {
                const name = text.slice(0, colonIdx);
                const stance = text.slice(colonIdx + 1);
                return (
                  <p key={idx} className={styles.backstoryLineRole}>
                    <span className={styles.backstoryRoleName}>{name}</span>
                    <span className={styles.backstoryRoleStance}>：{stance}</span>
                  </p>
                );
              }
              // 没有冒号则整行作为角色行
              return (
                <p key={idx} className={styles.backstoryLineRole}>
                  <span className={styles.backstoryRoleName}>{text}</span>
                </p>
              );
            }
            // 大背景：普通叙述行
            return (
              <p key={idx} className={styles.backstoryLineContext}>{line}</p>
            );
          })}
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

          {/* 2f. 身份行：脑洞模式显示"你的角色：头衔"，正经开会显示用户名 · 职位 */}
          <div className={styles.roleIdentityRow}>
            <span className={styles.roleIdentityText}>
              {isBrainstorm
                ? (<>{'你的角色：'}{meetingData?.userRole?.title || brainstormTheme?.userRole || userName || '英雄'}</>)
                : (
                  <>
                    {userName || '你'}
                    {jobTitle && <span className={styles.roleIdentitySep}> · {jobTitle}</span>}
                  </>
                )
              }
            </span>
          </div>

          {/* 2g. 目标行 */}
          {userRole?.goal && (
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
            </div>
          )}

          {/* 按钮区域：跟随卡片内容流，不固定在底部 */}
          <div className={styles.buttonArea}>
            {/* 主 CTA：进入会议 */}
            <button className={styles.enterButton} onClick={handleEnterMeeting}>
              进入会议
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M5 12H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M12 5L19 12L12 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {/* 换主题：文字链接 */}
            {isBrainstorm && (
              <button
                className={`${styles.refreshLink} ${canRefresh ? styles.refreshLinkActive : styles.refreshLinkDepleted}`}
                onClick={handleRefreshTheme}
                disabled={!canRefresh}
              >
                换个主题试试 ({refreshCount}/{MAX_REFRESH})
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default PreMeeting;
