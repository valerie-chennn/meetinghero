import React, { useState, useEffect } from 'react';
import styles from './SplashPage.module.css';

// 开屏覆盖层：每次 App 挂载都显示，3.5 秒后硬切消失
function SplashPage({ onDone }) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 200);
    const t2 = setTimeout(() => setPhase(2), 600);
    const t3 = setTimeout(() => setPhase(3), 1100);
    const t4 = setTimeout(() => onDone(), 3500);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, [onDone]);

  return (
    <div className={styles.container}>
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
        <div className={`${styles.chineseName} ${phase >= 2 ? styles.fadeUp : ''}`}>
          每日胡说
        </div>

        {/* Slogan */}
        <div className={`${styles.slogan} ${phase >= 3 ? styles.fadeUp : ''}`}>
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
