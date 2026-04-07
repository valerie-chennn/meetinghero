import React, { useEffect } from 'react';
import styles from './DmBanner.module.css';

/**
 * NPC 私信 Banner 浮层
 * 固定在页面顶部，3 秒后自动消失，也可手动关闭
 * @param {string} npcName - NPC 名字
 * @param {string} message - 消息文本（英文）
 * @param {string} messageZh - 消息文本（中文）
 * @param {function} onClose - 关闭回调
 */
function DmBanner({ npcName, message, messageZh, onClose }) {
  // 3 秒后自动关闭
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={styles.banner} role="alert" aria-live="polite">
      {/* NPC 头像首字母 */}
      <div className={styles.avatar}>{npcName ? npcName[0] : '?'}</div>

      {/* 消息内容 */}
      <div className={styles.content}>
        <span className={styles.npcName}>{npcName} 给你发了私信</span>
        <p className={styles.message}>{message}</p>
        {messageZh && <p className={styles.messageZh}>{messageZh}</p>}
      </div>

      {/* 关闭按钮 */}
      <button
        className={styles.closeButton}
        onClick={onClose}
        aria-label="关闭私信提醒"
      >
        ×
      </button>
    </div>
  );
}

export default DmBanner;
