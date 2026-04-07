import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import styles from './SplashPage.module.css';

function SplashPage() {
  const navigate = useNavigate();
  const { state } = useApp();
  // 动画阶段：0=初始 → 1=装饰线+日期+logo → 2=英文名+装饰线 → 3=slogan+滚动条 → 4=淡出
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 300);
    const t2 = setTimeout(() => setPhase(2), 900);
    const t3 = setTimeout(() => setPhase(3), 1500);
    const t4 = setTimeout(() => setPhase(4), 2600);
    // 淡出后跳转
    const t5 = setTimeout(() => {
      if (state.userName) {
        navigate('/feed', { replace: true });
      } else {
        navigate('/onboarding', { replace: true });
      }
    }, 3200);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); clearTimeout(t5); };
  }, [navigate, state.userName]);

  return (
    <div className={`${styles.container} ${phase === 4 ? styles.fadeOut : ''}`}>
      {/* 背景纹理：细点阵 */}
      <div className={styles.bgTexture} />

      {/* 顶部装饰双线 */}
      <div className={`${styles.topRuleThick} ${phase >= 1 ? styles.visible : ''}`} />
      <div className={`${styles.topRuleThin} ${phase >= 1 ? styles.visible : ''}`} />

      {/* 主内容 */}
      <div className={styles.content}>
        {/* 日期行 */}
        <div className={`${styles.dateLine} ${phase >= 1 ? styles.slideIn : ''}`}>
          EST. 2026 · THE DAILY NONSENSE
        </div>

        {/* Logo「歪报」 */}
        <div className={`${styles.logoWrap} ${phase >= 1 ? styles.stampIn : ''}`}>
          <span className={styles.logo}>歪报</span>
        </div>

        {/* 英文名 */}
        <div className={`${styles.englishName} ${phase >= 2 ? styles.slideUp : ''}`}>
          The Daily Nonsense
        </div>

        {/* 装饰分隔线 */}
        <div className={`${styles.ruler} ${phase >= 2 ? styles.visible : ''}`}>
          <span className={styles.rulerLine} />
          <span className={styles.rulerDot} />
          <span className={styles.rulerLine} />
        </div>

        {/* Slogan */}
        <div className={`${styles.slogan} ${phase >= 3 ? styles.slideUp : ''}`}>
          一起来胡说八道。
        </div>
      </div>

      {/* 底部滚动新闻条 */}
      <div className={`${styles.ticker} ${phase >= 3 ? styles.visible : ''}`}>
        <div className={styles.tickerTrack}>
          BREAKING: 东海三太子闲鱼被拍 · 灭霸入职首日提裁员 · 孙悟空述职仅三字 · 白雪公主职场PUA案开庭 · 甘道夫年会冻住舞台 · 辛巴IPO路演遭砸场
        </div>
      </div>

      {/* 底部装饰双线 */}
      <div className={`${styles.bottomRuleThin} ${phase >= 1 ? styles.visible : ''}`} />
      <div className={`${styles.bottomRuleThick} ${phase >= 1 ? styles.visible : ''}`} />

      {/* 加载提示 */}
      <div className={`${styles.loadingHint} ${phase >= 3 ? styles.pulse : ''}`}>
        正在排版今日头条...
      </div>
    </div>
  );
}

export default SplashPage;
