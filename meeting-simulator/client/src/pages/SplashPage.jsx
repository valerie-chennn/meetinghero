import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import styles from './SplashPage.module.css';

function SplashPage() {
  const navigate = useNavigate();
  const { state } = useApp();
  // 动画阶段：0=初始 → 1=英文大字+装饰线 → 2=中文名+分隔符 → 3=slogan
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 200);
    const t2 = setTimeout(() => setPhase(2), 700);
    const t3 = setTimeout(() => setPhase(3), 1200);
    // 3.5 秒后硬切跳转，无过渡动画
    const t4 = setTimeout(() => {
      if (state.userName) {
        navigate('/feed', { replace: true });
      } else {
        navigate('/onboarding', { replace: true });
      }
    }, 3500);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, [navigate, state.userName]);

  return (
    <div className={styles.container}>
      {/* 背景纹理：细点阵 */}
      <div className={styles.bgTexture} />

      {/* 顶部装饰双线 */}
      <div className={`${styles.topLines} ${phase >= 1 ? styles.visible : ''}`}>
        <div className={styles.lineThick} />
        <div className={styles.lineThin} />
      </div>

      {/* 主内容 */}
      <div className={styles.content}>
        {/* 英文名 — 视觉主体 */}
        <div className={`${styles.englishName} ${phase >= 1 ? styles.stampIn : ''}`}>
          <span className={styles.englishLine}>The Daily</span>
          <span className={styles.englishLine}>Nonsense</span>
        </div>

        {/* 装饰分隔符 */}
        <div className={`${styles.ruler} ${phase >= 2 ? styles.visible : ''}`}>
          <span className={styles.rulerLine} />
          <span className={styles.rulerDot} />
          <span className={styles.rulerLine} />
        </div>

        {/* 中文名 */}
        <div className={`${styles.chineseName} ${phase >= 2 ? styles.slideUp : ''}`}>
          每日胡说
        </div>

        {/* Slogan */}
        <div className={`${styles.slogan} ${phase >= 3 ? styles.slideUp : ''}`}>
          一起来胡说八道。
        </div>
      </div>

      {/* 底部装饰双线 */}
      <div className={`${styles.bottomLines} ${phase >= 1 ? styles.visible : ''}`}>
        <div className={styles.lineThin} />
        <div className={styles.lineThick} />
      </div>
    </div>
  );
}

export default SplashPage;
