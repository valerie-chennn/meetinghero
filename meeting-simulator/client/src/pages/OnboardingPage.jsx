import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { initUser } from '../api/index.js';
import styles from './OnboardingPage.module.css';

// 推荐花名列表
const NAME_SUGGESTIONS = ['Alex', 'Chris', 'Taylor', 'Sam', 'Jamie', 'Jordan'];

function OnboardingPage() {
  const navigate = useNavigate();
  const { state, updateState } = useApp();
  const [userName, setUserName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // 提交花名，调用真实 API /api/v2/users/init
  const handleStart = async () => {
    const trimmed = userName.trim();
    if (!trimmed || isLoading) return;

    setIsLoading(true);
    setErrorMsg('');
    try {
      await initUser(state.userId, trimmed);
      updateState({ userName: trimmed });
      navigate('/feed');
    } catch (err) {
      console.error('初始化用户失败:', err);
      setErrorMsg('提交失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  // Enter 键提交
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleStart();
  };

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        {/* 标题区 */}
        <div className={styles.header}>
          <div className={styles.logo}>💬</div>
          <h1 className={styles.title}>加入每日胡说</h1>
          <p className={styles.desc}>起一个花名，让大家记住你</p>
        </div>

        {/* 输入框 */}
        <div className={styles.inputGroup}>
          <input
            className={styles.textInput}
            type="text"
            placeholder="输入你的花名…"
            value={userName}
            onChange={e => setUserName(e.target.value)}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            autoFocus
            maxLength={20}
          />
        </div>

        {/* 推荐花名 chips */}
        <div className={styles.chipsRow}>
          {NAME_SUGGESTIONS.map(s => (
            <button
              key={s}
              className={`${styles.chip} ${userName === s ? styles.chipActive : ''}`}
              onClick={() => setUserName(s)}
            >
              {s}
            </button>
          ))}
        </div>

        {/* 开始按钮 */}
        <button
          className={`${styles.startButton} ${userName.trim() && !isLoading ? styles.startButtonActive : ''}`}
          onClick={handleStart}
          disabled={!userName.trim() || isLoading}
        >
          {isLoading ? (
            <span className={styles.loadingDots}>
              <span></span><span></span><span></span>
            </span>
          ) : '进入每日胡说'}
        </button>

        {/* 错误提示 */}
        {errorMsg && (
          <p className={styles.errorMsg}>{errorMsg}</p>
        )}
      </div>
    </div>
  );
}

export default OnboardingPage;
