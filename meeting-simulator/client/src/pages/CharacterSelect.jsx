import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';

import styles from './CharacterSelect.module.css';

/**
 * 角色选择页（点将局专用）
 * 路由：/brainstorm/characters
 * 从搜索结果中选 2-3 个角色，确认后生成主题
 */
function CharacterSelect() {
  const navigate = useNavigate();
  const { state, updateState } = useApp();
  // 从 AppContext 取搜索结果（由 CharacterSearch 存入）
  const characters = state._searchedCharacters || [];
  const worldLabel = state._searchedWorldLabel || '';

  // 已选角色 ID 集合
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isLoading, setIsLoading] = useState(false);

  // 如果没有搜索结果，跳回搜索页
  useEffect(() => {
    if (characters.length === 0) {
      navigate('/brainstorm/search');
    }
  }, [characters, navigate]);

  // 切换选择角色
  const handleToggle = (charId) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(charId)) {
        next.delete(charId);
      } else {
        // 超过 3 个则不允许继续选
        if (next.size >= 3) return prev;
        next.add(charId);
      }
      return next;
    });
  };

  // 确认选择，直接跳 Loading 页生成完整会议（含主题生成）
  const handleConfirm = () => {
    if (selectedIds.size < 2 || isLoading) return;

    const selectedCharacters = characters.filter(c => selectedIds.has(c.id));
    const mainWorld = selectedCharacters[0]?.world || '';

    // 清除旧主题，确保 Loading 页会重新生成主题
    updateState({
      brainstormCharacters: selectedCharacters,
      brainstormMainWorld: mainWorld,
      brainstormTheme: null,
      themeRefreshCount: 0,
      sceneType: 'brainstorm-pick',
      meetingSource: 'generate',
    });
    navigate('/loading');
  };

  const selectedCount = selectedIds.size;
  const canConfirm = selectedCount >= 2;

  return (
    <div className={styles.container}>
      {/* ===== 顶部导航区 ===== */}
      <div className={styles.topNav}>
        <button className={styles.backBtn} onClick={() => navigate('/brainstorm/search')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M19 12H5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <path d="M12 19L5 12L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <div className={styles.navInfo}>
          <span className={styles.navTitle}>选 2-3 位角色</span>
          {worldLabel && <span className={styles.navSub}>{worldLabel}</span>}
        </div>
        {/* 已选计数 */}
        <div className={styles.countBadge}>
          <span className={selectedCount > 0 ? styles.countActive : styles.countDefault}>
            已选 {selectedCount} / 最多 3
          </span>
        </div>
      </div>

      {/* ===== 角色列表 ===== */}
      <div className={styles.listWrapper}>
        <div className={styles.characterList}>
          {characters.map((char, idx) => {
            const isSelected = selectedIds.has(char.id);
            const isDisabled = !isSelected && selectedCount >= 3;

            return (
              <button
                key={char.id}
                className={`${styles.characterCard} ${isSelected ? styles.cardSelected : ''} ${isDisabled ? styles.cardDisabled : ''}`}
                onClick={() => !isDisabled && handleToggle(char.id)}
                style={{ animationDelay: `${idx * 0.05}s` }}
              >
                {/* 角色头像（英文名首字母，无英文名则取中文名首字）*/}
                <div className={`${styles.charAvatar} ${isSelected ? styles.avatarSelected : ''}`}>
                  {(char.nameEn || char.name).charAt(0)}
                </div>

                {/* 角色信息：主名显示英文名，有英文名时中文名作副标题 */}
                <div className={styles.charInfo}>
                  <div className={styles.charNameRow}>
                    <span className={styles.charName}>{char.nameEn || char.name}</span>
                    {char.nameEn && <span className={styles.charNameEn}>{char.name}</span>}
                  </div>
                  {char.source && <span className={styles.charSource}>{char.source}</span>}
                  <span className={styles.charPersona}>{char.persona}</span>
                </div>

                {/* 选中状态勾选图标 */}
                <div className={`${styles.checkmark} ${isSelected ? styles.checkmarkVisible : ''}`}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ===== 底部确认按钮 ===== */}
      <div className={styles.bottomBar}>
        <button
          className={`${styles.confirmBtn} ${canConfirm && !isLoading ? styles.confirmBtnActive : ''}`}
          onClick={handleConfirm}
          disabled={!canConfirm || isLoading}
        >
          {isLoading ? (
            <span className={styles.loadingDots}>
              <span></span><span></span><span></span>
            </span>
          ) : (
            <>
              下一步：生成主题
              {canConfirm && <span className={styles.btnCount}>({selectedCount}人)</span>}
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export default CharacterSelect;
