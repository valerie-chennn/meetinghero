import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { generateMeeting } from '../api/index.js';
import { useToast } from '../context/ToastContext.jsx';
import styles from './Loading.module.css';

// 会前预习提示内容
const TIPS = [
  '这是一场项目会议，你会和 3-4 位同事对话',
  '会议中有 3 个关键时刻需要你发言',
  '你可以用中文输入，系统会帮你转成英文',
  '不确定怎么说时，可以点开「参考说法」',
  '会后有复盘环节，帮你巩固学到的表达',
];

/**
 * 加载页
 * 调用后端生成会议，期间展示进度条和 Tips 轮播
 */
function Loading() {
  const navigate = useNavigate();
  const { state, updateState } = useApp();
  const { showError } = useToast();
  const [currentTip, setCurrentTip] = useState(0);
  const [tipVisible, setTipVisible] = useState(true);
  // 模拟进度：0~90 平滑增长，API 返回后跳到 100
  const [progress, setProgress] = useState(0);
  // 超过 30 秒后显示不同文案
  const [overtime, setOvertime] = useState(false);
  const apiDoneRef = useRef(false);

  // 模拟进度：每 300ms 递增，最多到 90
  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => {
        if (apiDoneRef.current) return 100;
        // 越接近 90 增长越慢，模拟真实感
        const remaining = 90 - prev;
        const increment = Math.max(0.3, remaining * 0.03);
        return Math.min(90, prev + increment);
      });
    }, 300);

    return () => clearInterval(interval);
  }, []);

  // 30 秒超时提示
  useEffect(() => {
    const timer = setTimeout(() => {
      setOvertime(true);
    }, 30000);

    return () => clearTimeout(timer);
  }, []);

  // Tips 轮播：每 4 秒切换，带淡入淡出
  useEffect(() => {
    const interval = setInterval(() => {
      // 先淡出
      setTipVisible(false);
      setTimeout(() => {
        setCurrentTip(prev => (prev + 1) % TIPS.length);
        // 再淡入
        setTipVisible(true);
      }, 400);
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  // 防止 StrictMode 双重执行导致重复调用
  const hasCalledRef = useRef(false);

  // 调用后端生成会议
  useEffect(() => {
    if (hasCalledRef.current) return;
    hasCalledRef.current = true;

    const generate = async () => {
      // 防止 sessionId 缺失（刷新页面等情况）
      if (!state.sessionId) {
        navigate('/');
        return;
      }

      try {
        // 脑洞模式需要额外传入角色和场景参数
        const isBrainstorm = state.sceneType && state.sceneType.startsWith('brainstorm');
        const brainstormParams = isBrainstorm ? {
          sceneType: state.sceneType,
          characters: state.brainstormCharacters || [],
          mainWorld: state.brainstormMainWorld || '',
          brainstormTheme: state.brainstormTheme || null,
        } : null;

        const meetingData = await generateMeeting(
          state.sessionId,
          state.meetingSource || 'generate',
          state.uploadContent || null,
          brainstormParams
        );

        // 标记 API 完成，进度跳到 100
        apiDoneRef.current = true;
        setProgress(100);

        // 保存会议数据
        updateState({
          meetingId: meetingData.meetingId,
          meetingData: meetingData,
        });

        // 短暂停留让用户看到 100%，再跳转
        setTimeout(() => {
          navigate('/pre-meeting');
        }, 300);
      } catch (err) {
        console.error('生成会议失败:', err);
        showError('会议生成失败，请重试');
        // 脑洞模式失败跳回主题预览，正经开会失败跳来源选择
        const isBrainstorm = state.sceneType && state.sceneType.startsWith('brainstorm');
        setTimeout(() => navigate(isBrainstorm ? '/brainstorm/theme' : '/source'), 2000);
      }
    };

    generate();
  // 只在组件挂载时执行一次
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 进度百分比取整显示
  const displayProgress = Math.round(progress);

  return (
    <div className={styles.container}>
      {/* 主标题 */}
      <div className={styles.titleGroup}>
        <h1 className={styles.title}>正在生成你的会议…</h1>
        <p className={styles.subtitle}>把你的信息整理成一场真实的会议</p>
      </div>

      {/* 进度条区域 */}
      <div className={styles.progressSection}>
        {/* 百分比大数字：28px 700，品牌色，视觉核心 */}
        <span className={styles.progressPercent}>{displayProgress}%</span>

        {/* 进度条轨道 */}
        <div className={styles.progressTrack}>
          <div
            className={styles.progressFill}
            style={{ width: `${displayProgress}%` }}
          ></div>
        </div>

        {/* 预估时间提示：超时时切换类名触发 fade 动画 */}
        <p className={overtime ? styles.timeHintOvertime : styles.timeHint}>
          {overtime ? '还在生成中，马上就好…' : '预计需要 15-30 秒'}
        </p>
      </div>

      {/* Tips 轮播：灯泡图标 + 引号包裹文字，淡入淡出切换 */}
      <div className={styles.tipContainer}>
        <p className={`${styles.tip} ${tipVisible ? styles.tipVisible : styles.tipHidden}`}>
          <span className={styles.tipIcon}>💡</span>
          <span className={styles.tipText}>「{TIPS[currentTip]}」</span>
        </p>
      </div>
    </div>
  );
}

export default Loading;
