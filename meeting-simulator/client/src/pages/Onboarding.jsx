import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { createSession } from '../api/index.js';
import { useToast } from '../context/ToastContext.jsx';
import styles from './Onboarding.module.css';

// 用户名推荐 chips
const NAME_SUGGESTIONS = ['Alex', 'Chris', 'Taylor', 'Sam', 'Jamie', 'Jordan'];

// 英文水平选项
const LEVEL_OPTIONS = [
  { value: 'A1', label: 'A1', desc: '我只能说非常简单的英文句子' },
  { value: 'A2', label: 'A2', desc: '我可以进行简单的工作相关表达' },
  { value: 'B1', label: 'B1', desc: '我可以表达基本想法，但容易卡顿' },
  { value: 'B2', label: 'B2', desc: '我可以比较顺畅地参与英文会议' },
];

// 职位推荐 chips
const JOB_SUGGESTIONS = ['Product Manager', 'Designer', 'Engineer', 'Sales', 'Data Analyst', 'Marketing'];

// 行业推荐 chips
const INDUSTRY_SUGGESTIONS = ['SaaS', 'E-commerce', 'Education', 'Finance', 'Healthcare', 'Gaming'];

// 总步骤数（0/1/2/3 共 4 步）
const TOTAL_STEPS = 4;

function Onboarding() {
  const navigate = useNavigate();
  const { updateState } = useApp();
  const { showError } = useToast();

  // 当前步骤（0=名字, 1=英文水平, 2=职位, 3=行业）
  const [step, setStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // 表单数据
  const [userName, setUserName] = useState('');
  const [englishLevel, setEnglishLevel] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [industry, setIndustry] = useState('');

  // 下一步：各步骤的校验
  const handleNext = () => {
    if (step === 0 && !userName.trim()) return;
    if (step === 1 && !englishLevel) return;
    if (step === 2 && !jobTitle.trim()) return;
    setStep(prev => prev + 1);
  };

  // 开始模拟（最后一步提交）
  const handleStart = async () => {
    if (!industry.trim() || isLoading) return;

    setIsLoading(true);
    try {
      const result = await createSession({ englishLevel, jobTitle, industry, userName });
      updateState({
        sessionId: result.sessionId,
        userName: userName.trim(),
        englishLevel,
        jobTitle,
        industry,
      });
      navigate('/source');
    } catch (err) {
      showError('网络错误，请重试');
      console.error('创建会话失败:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // 生成步骤标签文字，如 "01 / 04"
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

        {/* 步骤 1：英文水平 */}
        <div className={`${styles.step} ${step === 1 ? styles.stepEnter : ''}`} style={{ display: step === 1 ? 'flex' : 'none' }}>
          <div className={styles.stepContent}>
            <div className={styles.stepHeader}>
              <span className={styles.stepLabel}>{stepLabel}</span>
              <h1 className={styles.stepTitle}>你的英文水平</h1>
              <p className={styles.stepDesc}>根据你的水平，系统会调整会议难度和复盘深度</p>
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
              className={`${styles.nextButton} ${englishLevel ? styles.nextButtonActive : ''}`}
              onClick={handleNext}
              disabled={!englishLevel}
            >
              下一步
            </button>
          </div>
        </div>

        {/* 步骤 2：职位 */}
        <div className={`${styles.step} ${step === 2 ? styles.stepEnter : ''}`} style={{ display: step === 2 ? 'flex' : 'none' }}>
          <div className={styles.stepContent}>
            <div className={styles.stepHeader}>
              <span className={styles.stepLabel}>{stepLabel}</span>
              <h1 className={styles.stepTitle}>你的职位</h1>
              <p className={styles.stepDesc}>系统会根据你的职位生成更真实的会议场景</p>
            </div>

            <div className={styles.inputGroup}>
              <input
                className={styles.textInput}
                type="text"
                placeholder="输入或选择职位..."
                value={jobTitle}
                onChange={e => setJobTitle(e.target.value)}
                autoComplete="off"
              />
            </div>

            {/* 推荐 chips */}
            <div className={styles.chipsRow}>
              {JOB_SUGGESTIONS.map(s => (
                <button
                  key={s}
                  className={`${styles.chip} ${jobTitle === s ? styles.chipActive : ''}`}
                  onClick={() => setJobTitle(s)}
                >
                  {s}
                </button>
              ))}
            </div>

            <button
              className={`${styles.nextButton} ${jobTitle.trim() ? styles.nextButtonActive : ''}`}
              onClick={handleNext}
              disabled={!jobTitle.trim()}
            >
              下一步
            </button>
          </div>
        </div>

        {/* 步骤 3：行业 */}
        <div className={`${styles.step} ${step === 3 ? styles.stepEnter : ''}`} style={{ display: step === 3 ? 'flex' : 'none' }}>
          <div className={styles.stepContent}>
            <div className={styles.stepHeader}>
              <span className={styles.stepLabel}>{stepLabel}</span>
              <h1 className={styles.stepTitle}>你的行业</h1>
              <p className={styles.stepDesc}>行业背景让会议内容更贴近你的日常工作</p>
            </div>

            <div className={styles.inputGroup}>
              <input
                className={styles.textInput}
                type="text"
                placeholder="输入或选择行业..."
                value={industry}
                onChange={e => setIndustry(e.target.value)}
                autoComplete="off"
              />
            </div>

            {/* 推荐 chips */}
            <div className={styles.chipsRow}>
              {INDUSTRY_SUGGESTIONS.map(s => (
                <button
                  key={s}
                  className={`${styles.chip} ${industry === s ? styles.chipActive : ''}`}
                  onClick={() => setIndustry(s)}
                >
                  {s}
                </button>
              ))}
            </div>

            <button
              className={`${styles.startButton} ${industry.trim() && !isLoading ? styles.startButtonActive : ''}`}
              onClick={handleStart}
              disabled={!industry.trim() || isLoading}
            >
              {isLoading ? (
                <span className={styles.loadingDots}>
                  <span></span><span></span><span></span>
                </span>
              ) : '开始模拟'}
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
