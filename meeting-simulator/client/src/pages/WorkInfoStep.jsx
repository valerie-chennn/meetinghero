import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { updateWorkInfo } from '../api/index.js';
import { useToast } from '../context/ToastContext.jsx';
import styles from './WorkInfoStep.module.css';

// 职位推荐 chips
const JOB_SUGGESTIONS = ['Product Manager', 'Designer', 'Engineer', 'Sales', 'Data Analyst', 'Marketing'];

// 行业推荐 chips
const INDUSTRY_SUGGESTIONS = ['SaaS', 'E-commerce', 'Education', 'Finance', 'Healthcare', 'Gaming'];

// 总步骤数
const TOTAL_STEPS = 2;

/**
 * 正经开会补充信息页
 * 当用户选择"正经开会"但缺少 jobTitle/industry 时进入
 * 收集完毕后保存到 AppContext 并跳转 /source
 */
function WorkInfoStep() {
  const navigate = useNavigate();
  const { state, updateState } = useApp();
  const { showError } = useToast();

  // 当前步骤（0=职位, 1=行业）
  const [step, setStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // 表单数据（预填已有值）
  const [jobTitle, setJobTitle] = useState(state.jobTitle || '');
  const [industry, setIndustry] = useState(state.industry || '');

  // 下一步
  const handleNext = () => {
    if (step === 0 && !jobTitle.trim()) return;
    setStep(1);
  };

  // 完成：保存工作信息并跳转
  const handleFinish = async () => {
    if (!industry.trim() || isLoading) return;

    setIsLoading(true);
    try {
      // 更新后端 session 的工作信息（如果后端端点存在）
      if (state.sessionId) {
        await updateWorkInfo({
          sessionId: state.sessionId,
          jobTitle: jobTitle.trim(),
          industry: industry.trim(),
        });
      }
      // 更新本地状态
      updateState({ jobTitle: jobTitle.trim(), industry: industry.trim() });
      navigate('/source');
    } catch (err) {
      // 后端接口报错不阻塞流程，只更新本地状态
      console.warn('更新工作信息失败（非阻断性）:', err);
      updateState({ jobTitle: jobTitle.trim(), industry: industry.trim() });
      navigate('/source');
    } finally {
      setIsLoading(false);
    }
  };

  // 步骤标签
  const stepLabel = `0${step + 1} / 0${TOTAL_STEPS}`;

  return (
    <div className={styles.container}>
      {/* 进度条 */}
      <div className={styles.progressBar}>
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => {
          let segClass = styles.progressSegment;
          if (i < step) segClass += ` ${styles.progressSegmentDone}`;
          else if (i === step) segClass += ` ${styles.progressSegmentCurrent}`;
          return <div key={i} className={segClass} />;
        })}
      </div>

      {/* 步骤内容区 */}
      <div className={styles.stepsWrapper}>

        {/* 步骤 0：职位 */}
        <div
          className={`${styles.step} ${step === 0 ? styles.stepEnter : ''}`}
          style={{ display: step === 0 ? 'flex' : 'none' }}
        >
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
                autoFocus
              />
            </div>

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

        {/* 步骤 1：行业 */}
        <div
          className={`${styles.step} ${step === 1 ? styles.stepEnter : ''}`}
          style={{ display: step === 1 ? 'flex' : 'none' }}
        >
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
              onClick={handleFinish}
              disabled={!industry.trim() || isLoading}
            >
              {isLoading ? (
                <span className={styles.loadingDots}>
                  <span></span><span></span><span></span>
                </span>
              ) : '进入正经开会'}
            </button>
          </div>
        </div>
      </div>

      {/* 返回按钮（第一步返回首页，第二步返回上一步）*/}
      <button
        className={styles.backButton}
        onClick={() => {
          if (step === 0) navigate('/');
          else setStep(0);
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M19 12H5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          <path d="M12 19L5 12L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
    </div>
  );
}

export default WorkInfoStep;
