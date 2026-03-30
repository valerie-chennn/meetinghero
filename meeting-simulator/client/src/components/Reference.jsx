import React, { useState } from 'react';
import TtsButton from './TtsButton.jsx';
import styles from './Reference.module.css';

/**
 * 参考说法折叠面板组件
 * 点击展开后直接显示一句英文，如果有中文翻译则在下方显示一行灰色小字
 * Props:
 *   content    - 参考说法对象 { content, contentZh, level } 或纯字符串
 *   level      - 英语等级（A1/A2/B1/B2）
 */
function Reference({ content, level }) {
  const [isOpen, setIsOpen] = useState(false);

  if (!content) return null;

  // 兼容旧格式（纯字符串）和新格式（对象）
  let englishText = '';
  let chineseText = '';

  if (typeof content === 'string') {
    englishText = content;
    chineseText = '';
  } else if (typeof content === 'object' && !Array.isArray(content)) {
    // 新格式：{ content, contentZh, level }
    englishText = content.content || '';
    chineseText = content.contentZh || '';
  }

  return (
    <div className={styles.reference}>
      {/* 折叠触发按钮 */}
      <button
        className={`${styles.toggle} ${isOpen ? styles.open : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className={styles.toggleIcon}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 2L2 7L12 12L22 7L12 2Z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M2 17L12 22L22 17"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M2 12L12 17L22 12"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <span className={styles.toggleText}>参考说法</span>
        <span className={styles.toggleArrow}>
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}
          >
            <path
              d="M6 9L12 15L18 9"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </button>

      {/* 折叠内容区：使用 max-height 实现展开动效 */}
      <div className={`${styles.panel} ${isOpen ? styles.panelOpen : ''}`}>
        <div className={styles.panelInner}>
          {/* 英文参考说法 + TTS 按钮 */}
          <div className={styles.simpleItem}>
            <div className={styles.textBlock}>
              <p className={styles.referenceText}>{englishText}</p>
              {/* 中文翻译：非空时显示在英文下方 */}
              {chineseText && (
                <p className={styles.referenceTranslation}>{chineseText}</p>
              )}
            </div>
            {englishText && <TtsButton text={englishText} language="en" />}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Reference;
