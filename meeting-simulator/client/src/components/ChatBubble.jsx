import React from 'react';
import TtsButton from './TtsButton.jsx';
import styles from './ChatBubble.module.css';

/**
 * 聊天气泡组件
 * 支持三种类型：角色消息（左）、用户消息（右）、系统消息（居中）
 * Props:
 *   speaker        - 发言者全名（如 "Megan Brooks"）
 *   title          - 职位（如 "Team Lead"）
 *   text           - 英文内容
 *   textZh         - 中文翻译（可选）
 *   showTranslation - 是否显示中文翻译
 *   isUser         - 是否为用户消息
 *   isSystem       - 是否为系统消息
 *   roleColor      - 头像背景颜色
 *   roleAvatar     - 头像文字
 *   onPlayTts      - TTS 播放回调
 */
function ChatBubble({ speaker, title, text, textZh, showTranslation, isUser, isSystem, roleColor, roleAvatar, onPlayTts }) {
  // 系统消息：居中小字
  if (isSystem) {
    return (
      <div className={styles.systemMessage}>
        <div className={styles.systemLine}></div>
        <span className={styles.systemText}>{text}</span>
        <div className={styles.systemLine}></div>
      </div>
    );
  }

  // 用户消息：右对齐
  if (isUser) {
    return (
      <div className={`${styles.bubble} ${styles.userBubble}`}>
        <div className={styles.userContent}>
          <div className={styles.userBubbleBody}>
            <p className={styles.bubbleText}>{text}</p>
          </div>
        </div>
      </div>
    );
  }

  // 取名字的 firstName（空格前的第一个词）
  const firstName = speaker ? speaker.split(' ')[0] : '?';

  // 角色消息：左对齐，带头像
  return (
    <div className={`${styles.bubble} ${styles.roleBubble}`}>
      {/* 角色头像 */}
      <div
        className={styles.avatar}
        style={{ background: roleColor || 'var(--role-leader)' }}
      >
        {roleAvatar || (speaker ? speaker.charAt(0).toUpperCase() : '?')}
      </div>

      {/* 消息内容 */}
      <div className={styles.roleContent}>
        {/* 发言人信息：FirstName · 职位 */}
        <div className={styles.speakerInfo}>
          <span className={styles.speakerName}>
            {title ? `${firstName} · ${title}` : firstName}
          </span>
        </div>

        {/* 气泡 + TTS 按钮 */}
        <div className={styles.roleBubbleRow}>
          <div className={styles.roleBubbleBody}>
            <p className={styles.bubbleText}>{text}</p>
            {/* 中文翻译区域：开启翻译时显示，textZh 为空则显示兜底提示 */}
            {showTranslation && (
              <div className={styles.translationBlock}>
                <p className={styles.translationText}>
                  <span className={styles.translationTag}>译</span>
                  {textZh || <span className={styles.translationFallback}>（翻译暂不可用）</span>}
                </p>
              </div>
            )}
          </div>
          <TtsButton text={text} language="en" />
        </div>
      </div>
    </div>
  );
}

export default ChatBubble;
