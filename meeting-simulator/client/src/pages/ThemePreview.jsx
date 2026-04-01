import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { generateBrainstormTheme } from '../api/index.js';
import { useToast } from '../context/ToastContext.jsx';
import styles from './ThemePreview.module.css';

// 最多换主题次数
const MAX_REFRESH = 3;

/**
 * 主题预览页（点将局 + 乱炖局共用）
 * 路由：/brainstorm/theme
 * 展示 AI 生成的会议主题，支持换主题（最多 3 次）
 */
function ThemePreview() {
  const navigate = useNavigate();
  const { state, updateState } = useApp();
  const { showError } = useToast();

  const theme = state.brainstormTheme;
  const sceneType = state.sceneType;
  const refreshCount = state.themeRefreshCount || 0;

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isEntering, setIsEntering] = useState(false);

  // 没有主题数据时跳回
  useEffect(() => {
    if (!theme) {
      if (sceneType === 'brainstorm-pick') {
        navigate('/brainstorm/characters');
      } else {
        navigate('/brainstorm/random');
      }
    }
  }, [theme, sceneType, navigate]);

  // 换一个主题
  const handleRefresh = async () => {
    if (refreshCount >= MAX_REFRESH || isRefreshing) return;

    setIsRefreshing(true);
    try {
      const result = await generateBrainstormTheme({
        sessionId: state.sessionId,
        sceneType: state.sceneType,
        characters: state.brainstormCharacters,
        mainWorld: state.brainstormMainWorld,
      });

      updateState({
        brainstormTheme: result.theme,
        themeRefreshCount: refreshCount + 1,
      });
    } catch (err) {
      console.error('换主题失败:', err);
      showError('换主题失败，请重试');
    } finally {
      setIsRefreshing(false);
    }
  };

  // 进入会议：跳转 Loading 页
  const handleEnterMeeting = () => {
    if (isEntering) return;
    setIsEntering(true);

    // 设置 meetingSource 为 brainstorm（供 Loading.jsx 使用）
    updateState({ meetingSource: 'brainstorm' });
    navigate('/loading');
  };

  if (!theme) return null;

  const canRefresh = refreshCount < MAX_REFRESH;
  const isRandomMode = sceneType === 'brainstorm-random';

  return (
    <div className={styles.container}>
      {/* ===== 顶部导航 ===== */}
      <div className={styles.topNav}>
        <button
          className={styles.backBtn}
          onClick={() => {
            if (sceneType === 'brainstorm-pick') navigate('/brainstorm/characters');
            else navigate('/brainstorm/random');
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M19 12H5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <path d="M12 19L5 12L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <span className={styles.navTitle}>主题预览</span>
      </div>

      {/* ===== 主内容区 ===== */}
      <div className={styles.content}>
        {/* 主题卡片 */}
        <div className={styles.themeCard}>
          {/* 主题标题 */}
          <h1 className={styles.themeTitle}>{theme.title}</h1>

          {/* 场景设定：截断超过 50 字的文本 */}
          <p className={styles.settingText}>
            {theme.settingZh && theme.settingZh.length > 50
              ? theme.settingZh.slice(0, 50) + '…'
              : theme.settingZh}
          </p>

          {/* 你的身份标签 */}
          <div className={styles.userRoleSection}>
            <span className={styles.userRoleLabel}>你的身份</span>
            <div className={styles.userRoleBadge}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="2"/>
              </svg>
              <span>{theme.userRole}</span>
            </div>
          </div>

          {/* 参会角色列表：每行一个，格式：角色名 · 适配身份 · 性格标签 */}
          {theme.characters && theme.characters.length > 0 && (
            <div className={styles.characterList}>
              {theme.characters.map((char, idx) => (
                <div key={char.id || idx} className={styles.characterRow}>
                  <span className={styles.charName}>{char.name}</span>
                  {char.adaptedTitle && (
                    <span className={styles.charAdapted}>· {char.adaptedTitle}</span>
                  )}
                  {/* 性格标签字段预留：char.personality */}
                  {char.personality && (
                    <span className={styles.charPersonalityTag}>{char.personality}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ===== 操作按钮区 ===== */}
        <div className={styles.actions}>
          {/* 换主题按钮 + 次数计数 */}
          <div className={styles.refreshRow}>
            <button
              className={`${styles.refreshBtn} ${canRefresh && !isRefreshing ? styles.refreshBtnActive : ''}`}
              onClick={handleRefresh}
              disabled={!canRefresh || isRefreshing}
            >
              {isRefreshing ? (
                <span className={styles.loadingDots}>
                  <span></span><span></span><span></span>
                </span>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M1 4v6h6M23 20v-6h-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 0 1 3.51 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  换一个主题
                </>
              )}
            </button>
            {/* 换主题次数计数 */}
            <span className={`${styles.refreshCount} ${!canRefresh ? styles.refreshCountDepleted : ''}`}>
              {refreshCount}/{MAX_REFRESH}
            </span>
          </div>

          {/* 进入会议按钮 */}
          <button
            className={`${styles.enterBtn} ${!isEntering ? styles.enterBtnActive : ''}`}
            onClick={handleEnterMeeting}
            disabled={isEntering}
          >
            {isEntering ? (
              <span className={styles.loadingDots}>
                <span></span><span></span><span></span>
              </span>
            ) : '进入会议'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ThemePreview;
