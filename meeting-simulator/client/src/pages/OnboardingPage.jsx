import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { initUser } from '../api/index.js';
import styles from './OnboardingPage.module.css';

// 形容词池
const ADJ = [
  'Sleepy', 'Curious', 'Clueless', 'Brave', 'Lazy', 'Dramatic',
  'Sneaky', 'Reckless', 'Polite', 'Grumpy', 'Cheerful', 'Confused',
  'Bold', 'Gentle', 'Chaotic', 'Hungry',
];

// 荒诞身份池
const NOUN = [
  'Intern', 'Diplomat', 'Spy', 'Accountant', 'Witness', 'Consultant',
  'Janitor', 'CEO', 'Penguin', 'Lobster', 'Toaster', 'Astronaut',
  'Pirate', 'Professor', 'Detective', 'Ghost',
];

// 随机生成花名：80% 形容词+身份，10% 只出身份，10% 只出形容词
function genName() {
  const r = Math.random();
  if (r < 0.1) return NOUN[Math.floor(Math.random() * NOUN.length)];
  if (r < 0.2) return ADJ[Math.floor(Math.random() * ADJ.length)];
  return ADJ[Math.floor(Math.random() * ADJ.length)] + ' ' + NOUN[Math.floor(Math.random() * NOUN.length)];
}

function OnboardingPage() {
  const navigate = useNavigate();
  const { state, updateState } = useApp();
  const [typed, setTyped] = useState('');
  const [placeholder, setPlaceholder] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // 页面加载时生成初始 placeholder
  useEffect(() => {
    setPlaceholder(genName());
  }, []);

  // 点骰子：直接替换 placeholder
  const handleRoll = () => {
    setPlaceholder(genName());
  };

  // 提交花名：有输入用输入的，没输入用当前 placeholder
  const handleStart = async () => {
    if (isLoading) return;
    const finalName = typed.trim() || placeholder;
    if (!finalName) return;

    setIsLoading(true);
    setErrorMsg('');
    try {
      await initUser(state.userId, finalName);
      updateState({ userName: finalName });
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

        {/* 大标题 */}
        <h1 className={styles.title}>你的花名</h1>

        {/* 输入框 + 骰子同行容器 */}
        <div className={styles.inputRow}>
          <input
            className={styles.textInput}
            type="text"
            value={typed}
            onChange={e => setTyped(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            autoComplete="off"
            maxLength={30}
          />
          <button
            className={styles.diceBtn}
            onClick={handleRoll}
            aria-label="换一个花名"
          >
            🎲
          </button>
        </div>

        {/* 开始胡说按钮 */}
        <button
          className={styles.startButton}
          onClick={handleStart}
          disabled={isLoading}
        >
          {isLoading ? (
            <span className={styles.loadingDots}>
              <span></span><span></span><span></span>
            </span>
          ) : '开始胡说'}
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
