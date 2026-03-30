import React, { useState, useRef, useEffect } from 'react';
import { speechToText } from '../api/index.js';
import styles from './VoiceRecorder.module.css';

/**
 * 语音录制组件
 * 支持 MediaRecorder API 录音，发送到后端 STT
 * 后端不可用时，使用 Web Speech API 作为 fallback
 */
function VoiceRecorder({ onResult, onError }) {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);   // 录音时长（秒）
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const recognitionRef = useRef(null);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (recognitionRef.current) recognitionRef.current.abort();
    };
  }, []);

  // 启动录音计时器
  const startTimer = () => {
    setDuration(0);
    timerRef.current = setInterval(() => {
      setDuration(prev => prev + 1);
    }, 1000);
  };

  // 停止计时器
  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  // 使用 Web Speech API 作为 fallback
  const startWebSpeechRecognition = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      onError?.('您的浏览器不支持语音识别，请手动输入');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US'; // 默认英文，也可检测中文
    recognition.continuous = false;
    recognition.interimResults = false;
    recognitionRef.current = recognition;

    recognition.onstart = () => {
      setIsRecording(true);
      startTimer();
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      onResult?.({ text: transcript, language: 'en' });
      stopRecording();
    };

    recognition.onerror = (event) => {
      console.error('Web Speech 识别错误:', event.error);
      onError?.('语音识别失败，请重试或手动输入');
      stopRecording();
    };

    recognition.onend = () => {
      stopRecording();
    };

    recognition.start();
  };

  // 开始录音
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      chunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      });

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // 关闭麦克风
        stream.getTracks().forEach(track => track.stop());

        const audioBlob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType });

        try {
          // 先尝试后端 STT
          const result = await speechToText(audioBlob);

          if (result === null) {
            // 后端未配置，尝试 Web Speech API
            // 注意：Web Speech API 需要在录音前启动，此处改为提示用户
            onError?.('语音识别服务未配置，请手动输入文字');
          } else {
            onResult?.(result);
          }
        } catch (err) {
          console.error('STT 请求失败:', err);
          onError?.('语音识别失败，请手动输入文字');
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(100); // 每 100ms 收集一次数据

      setIsRecording(true);
      startTimer();
    } catch (err) {
      console.error('获取麦克风权限失败:', err);
      // 尝试 Web Speech API fallback
      startWebSpeechRecognition();
    }
  };

  // 停止录音
  const stopRecording = () => {
    setIsRecording(false);
    stopTimer();

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }

    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  };

  // 切换录音状态
  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // 格式化时长
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <button
      className={`${styles.voiceButton} ${isRecording ? styles.recording : ''}`}
      onClick={toggleRecording}
      title={isRecording ? '停止录音' : '开始录音'}
      aria-label={isRecording ? '停止录音' : '开始录音'}
    >
      {isRecording ? (
        <>
          {/* 录音中：红色脉冲 + 时长 */}
          <span className={styles.recordingIndicator}>
            <span className={styles.ripple}></span>
            <span className={styles.dot}></span>
          </span>
          <span className={styles.duration}>{formatDuration(duration)}</span>
        </>
      ) : (
        // 静止：麦克风图标
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 1C10.34 1 9 2.34 9 4V12C9 13.66 10.34 15 12 15C13.66 15 15 13.66 15 12V4C15 2.34 13.66 1 12 1Z"
            fill="currentColor"
          />
          <path
            d="M19 10V12C19 15.87 15.87 19 12 19C8.13 19 5 15.87 5 12V10"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path d="M12 19V23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M8 23H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      )}
    </button>
  );
}

export default VoiceRecorder;
