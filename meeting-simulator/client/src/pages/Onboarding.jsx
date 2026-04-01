import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { createSession } from '../api/index.js';
import { useToast } from '../context/ToastContext.jsx';
import styles from './Onboarding.module.css';

// 用户名推荐 chips
const NAME_SUGGESTIONS = ['Alex', 'Chris', 'Taylor', 'Sam', 'Jamie', 'Jordan'];

// 英文水平选项（通用化描述，不限职场场景）
const LEVEL_OPTIONS = [
  { value: 'A1', label: 'A1', desc: '会一些单词和短句，还不太能组织完整的表达' },
  { value: 'A2', label: 'A2', desc: '能说完整的句子，但词汇量有限，复杂的说不出来' },
  { value: 'B1', label: 'B1', desc: '日常交流没问题，想学更地道的表达方式' },
  { value: 'B2', label: 'B2', desc: '表达流利，想挑战更复杂的场景和高级表达' },
];

// 总步骤数（0=花名, 1=英语等级，共 2 步）
const TOTAL_STEPS = 2;

function Onboarding() {
  const navigate = useNavigate();
  const { updateState } = useApp();
  const { showError } = useToast();

  // 当前步骤（0=花名, 1=英语等级）
  const [step, setStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // 表单数据
  const [userName, setUserName] = useState('');
  const [englishLevel, setEnglishLevel] = useState('');

  // 下一步：步骤 0 的校验
  const handleNext = () => {
    if (step === 0 && !userName.trim()) return;
    setStep(prev => prev + 1);
  };

  // 完成 Onboarding（最后一步提交，只传花名和英语等级）
  const handleStart = async () => {
    if (!englishLevel || isLoading) return;

    setIsLoading(true);
    try {
      // 职位和行业暂时不收集，正经开会时按需补充
      const result = await createSession({ englishLevel, userName, jobTitle: '', industry: '' });
      updateState({
        sessionId: result.sessionId,
        userName: userName.trim(),
        englishLevel,
      });
      // 完成后跳首页，让用户选择模式
      navigate('/');
    } catch (err) {
      showError('网络错误，请重试');
      console.error('创建会话失败:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // 生成步骤标签文字，如 "01 / 02"
  const stepLabel = `0${step + 1} / 0${TOTAL_STEPS}`;

  return (
    <div className={styles.container}>
      {/* 进度条：4 段线段，完成/当前/未完成三态 */}
      <div className={styles.progressBar}>
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => {
          let segClass = styles.progressSegment;
          if (i < step)        segClass += ` ${styles.progressSegmentDone}`;
          else if (i === step) segClass += ` ${styles.progressSegmentCurrent}`;
          return <div key={i} className={segClass}></div>;
        })}
      </div>

      {/* 步骤内容区 */}
      <div className={styles.stepsWrapper}>

        {/* 步骤 0：用户名字 */}
        <div className={`${styles.step} ${step === 0 ? styles.stepEnter : ''}`} style={{ display: step === 0 ? 'flex' : 'none' }}>
          <div className={styles.stepContent}>
            <div className={styles.stepHeader}>
              <span className={styles.stepLabel}>{stepLabel}</span>
              <h1 className={styles.stepTitle}>你的会议花名</h1>
              <p className={styles.stepDesc}>会议里大家会这样叫你</p>
            </div>

            <div className={styles.inputGroup}>
              <input
                className={styles.textInput}
                type="text"
                placeholder="输入你的会议花名…"
                value={userName}
                onChange={e => setUserName(e.target.value)}
                autoComplete="off"
                autoFocus
              />
            </div>

            {/* 推荐名字 chips */}
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

            <button
              className={`${styles.nextButton} ${userName.trim() ? styles.nextButtonActive : ''}`}
              onClick={handleNext}
              disabled={!userName.trim()}
            >
              下一步
            </button>
          </div>
        </div>

        {/* 步骤 1：英文水平（最后一步，点击开始） */}
        <div className={`${styles.step} ${step === 1 ? styles.stepEnter : ''}`} style={{ display: step === 1 ? 'flex' : 'none' }}>
          <div className={styles.stepContent}>
            <div className={styles.stepHeader}>
              <span className={styles.stepLabel}>{stepLabel}</span>
              <h1 className={styles.stepTitle}>你的英文水平</h1>
              <p className={styles.stepDesc}>根据你的水平，系统会调整难度和复盘深度</p>
            </div>

            <div className={styles.levelGrid}>
              {LEVEL_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  className={`${styles.levelCard} ${englishLevel === opt.value ? styles.levelCardActive : ''}`}
                  onClick={() => setEnglishLevel(opt.value)}
                >
                  <span className={styles.levelBadge}>{opt.label}</span>
                  <span className={styles.levelDesc}>{opt.desc}</span>
                </button>
              ))}
            </div>

            <button
              className={`${styles.startButton} ${englishLevel && !isLoading ? styles.startButtonActive : ''}`}
              onClick={handleStart}
              disabled={!englishLevel || isLoading}
            >
              {isLoading ? (
                <span className={styles.loadingDots}>
                  <span></span><span></span><span></span>
                </span>
              ) : '进入 MeetingHero'}
            </button>
          </div>
        </div>
      </div>

      {/* 返回按钮（第一步不显示） */}
      {step > 0 && (
        <button
          className={styles.backButton}
          onClick={() => setStep(prev => prev - 1)}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M19 12H5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M12 19L5 12L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
    </div>
  );
}

export default Onboarding;
