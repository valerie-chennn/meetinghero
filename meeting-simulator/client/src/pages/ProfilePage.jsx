import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { getUserStats } from '../api/index.js';
import styles from './ProfilePage.module.css';

function ProfilePage() {
  const { state } = useApp();
  const [stats, setStats] = useState(null);

  // 加载用户统计数据
  useEffect(() => {
    if (!state.userId) return;

    getUserStats(state.userId)
      .then(data => setStats(data))
      .catch(err => {
        // 统计数据加载失败不影响页面主体显示，静默处理
        console.error('加载用户统计失败:', err);
      });
  }, [state.userId]);

  return (
    <div className={styles.container}>
      {/* 顶部标题 */}
      <header className={styles.header}>
        <h1 className={styles.title}>我的</h1>
      </header>

      <div className={styles.content}>
        {/* 用户信息卡片 */}
        <div className={styles.userCard}>
          <div className={styles.userAvatar}>
            {state.userName ? state.userName[0] : '?'}
          </div>
          <div className={styles.userInfo}>
            <h2 className={styles.userName}>{state.userName || '未设置花名'}</h2>
            <p className={styles.userId}>ID: {state.userId?.slice(0, 8) || '—'}</p>
          </div>
        </div>

        {/* 统计卡片 */}
        <div className={styles.statsGrid}>
          <div className={styles.statsItem}>
            <span className={styles.statsNumber}>{stats?.chatCount || 0}</span>
            <span className={styles.statsLabel}>参与群聊</span>
          </div>
          <div className={styles.statsItem}>
            <span className={styles.statsNumber}>{stats?.messageCount || 0}</span>
            <span className={styles.statsLabel}>发言次数</span>
          </div>
          <div className={styles.statsItem}>
            <span className={styles.statsNumber}>{stats?.savedCount || 0}</span>
            <span className={styles.statsLabel}>收藏表达</span>
          </div>
        </div>

        {/* 设置列表 */}
        <div className={styles.settingsList}>
          <div className={styles.settingsItem}>
            <span>花名</span>
            <span className={styles.settingsValue}>{state.userName || '未设置'}</span>
          </div>
          <div className={styles.settingsItem}>
            <span>语音设置</span>
            <span className={styles.settingsArrow}>›</span>
          </div>
          <div className={styles.settingsItem}>
            <span>关于每日胡说</span>
            <span className={styles.settingsArrow}>›</span>
          </div>
        </div>
      </div>

      {/* 底部 Tab 占位 */}
      <div className={styles.bottomPadding} />
    </div>
  );
}

export default ProfilePage;
