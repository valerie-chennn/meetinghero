import React, { useState, useRef } from 'react';
import { textToSpeech } from '../api/index.js';
import styles from './TtsButton.module.css';

/**
 * TTS 播放按钮组件
 * 支持后端 TTS API，失败时使用浏览器 Web Speech API 作为 fallback
 */
function TtsButton({ text, language = 'en' }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef(null);

  // 使用浏览器原生 TTS 作为 fallback
  const playWithWebSpeech = () => {
    if (!window.speechSynthesis) return;

    // 停止当前播放
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language === 'en' ? 'en-US' : 'zh-CN';
    utterance.rate = 0.9;

    utterance.onstart = () => setIsPlaying(true);
    utterance.onend = () => setIsPlaying(false);
    utterance.onerror = () => setIsPlaying(false);

    window.speechSynthesis.speak(utterance);
  };

  // 停止播放
  const stopPlaying = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsPlaying(false);
  };

  const handleClick = async () => {
    // 如果正在播放，则停止
    if (isPlaying) {
      stopPlaying();
      return;
    }

    try {
      const audioBlob = await textToSpeech(text, language);

      if (!audioBlob) {
        // 后端未配置，使用 Web Speech API fallback
        playWithWebSpeech();
        return;
      }

      // 使用后端返回的音频
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onplay = () => setIsPlaying(true);
      audio.onended = () => {
        setIsPlaying(false);
        URL.revokeObjectURL(audioUrl);
      };
      audio.onerror = () => {
        setIsPlaying(false);
        URL.revokeObjectURL(audioUrl);
        // 尝试 fallback
        playWithWebSpeech();
      };

      await audio.play();
    } catch (err) {
      console.error('TTS 播放失败:', err);
      // 使用 Web Speech API fallback
      playWithWebSpeech();
    }
  };

  return (
    <button
      className={`${styles.ttsButton} ${isPlaying ? styles.playing : ''}`}
      onClick={handleClick}
      title={isPlaying ? '停止播放' : '播放发音'}
      aria-label={isPlaying ? '停止播放' : '播放发音'}
    >
      {isPlaying ? (
        // 播放中：声波动画
        <span className={styles.soundwave}>
          <span className={styles.bar}></span>
          <span className={styles.bar}></span>
          <span className={styles.bar}></span>
          <span className={styles.bar}></span>
        </span>
      ) : (
        // 静止：音量图标
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path
            d="M11 5L6 9H2V15H6L11 19V5Z"
            fill="currentColor"
          />
          <path
            d="M15.54 8.46C16.48 9.4 17 10.67 17 12C17 13.33 16.48 14.6 15.54 15.54"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M19.07 4.93C20.9 6.76 22 9.26 22 12C22 14.74 20.9 17.24 19.07 19.07"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      )}
    </button>
  );
}

export default TtsButton;
