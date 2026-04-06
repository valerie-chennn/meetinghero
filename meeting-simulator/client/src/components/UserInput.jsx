import React, { useState, useRef } from 'react';
import VoiceRecorder from './VoiceRecorder.jsx';
import styles from './UserInput.module.css';

/**
 * 用户输入区组件
 * 支持文字输入和语音输入两种模式
 */
function UserInput({ placeholder = '输入你要说的话...', onSubmit, onVoiceResult, disabled }) {
  const [text, setText] = useState('');
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  // 语音转写加载态：录音结束后等待 Whisper 返回结果期间为 true
  const [isTranscribing, setIsTranscribing] = useState(false);
  const textareaRef = useRef(null);

  // 提交文字
  const handleSubmit = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSubmit?.(trimmed);
    setText('');
    // 重置输入框高度
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  // 键盘事件：Enter 提交，Shift+Enter 换行
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // 自动调整输入框高度
  const handleTextChange = (e) => {
    setText(e.target.value);
    // 自动撑高
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
  };

  // 语音识别结果回调 — 直接发送，不进输入框
  const handleVoiceResult = (result) => {
    const voiceText = (result.text || '').trim();
    setIsVoiceMode(false);
    setIsTranscribing(false);
    if (voiceText) {
      onSubmit?.(voiceText);
    }
    onVoiceResult?.(result);
  };

  // 语音识别错误
  const handleVoiceError = (errorMsg) => {
    console.error('语音识别错误:', errorMsg);
    setIsVoiceMode(false);
    setIsTranscribing(false);
  };

  return (
    <div className={styles.inputContainer}>
      {/* 文字输入框 */}
      <div className={styles.inputWrapper}>
        <textarea
          ref={textareaRef}
          className={styles.textarea}
          value={text}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          placeholder={disabled ? '请等待...' : placeholder}
          disabled={disabled || isTranscribing}
          rows={1}
        />
        {/* 语音转写加载态：覆盖在输入框上方，显示 spinner + 提示文字 */}
        {isTranscribing && (
          <div className={styles.transcribingIndicator}>
            <span className={styles.transcribingSpinner} aria-hidden="true" />
            <span className={styles.transcribingText}>语音识别中...</span>
          </div>
        )}
      </div>

      {/* 操作按钮区 */}
      <div className={styles.actions}>
        {/* 语音按钮 */}
        <VoiceRecorder
          onResult={handleVoiceResult}
          onError={handleVoiceError}
          onTranscribing={setIsTranscribing}
        />

        {/* 发送按钮 */}
        <button
          className={`${styles.sendButton} ${text.trim() ? styles.active : ''}`}
          onClick={handleSubmit}
          disabled={disabled || !text.trim()}
          aria-label="发送"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path
              d="M22 2L11 13"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M22 2L15 22L11 13L2 9L22 2Z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default UserInput;
