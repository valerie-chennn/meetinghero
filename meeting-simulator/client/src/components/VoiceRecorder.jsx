import React, { useState, useRef, useEffect } from 'react';
import { speechToText } from '../api/index.js';
import styles from './VoiceRecorder.module.css';

/**
 * 语音录制组件
 * 策略：录音开始时同时启动 MediaRecorder 和 Web Speech API。
 * 录音结束后：
 *   1. 优先等待后端 Whisper STT 结果
 *   2. 若后端失败或返回空，则使用 Web Speech API 的结果作为 fallback
 * 这样可以最大化识别成功率，且不会因为 Web Speech API 而增加延迟。
 */
function VoiceRecorder({ onResult, onError, onTranscribing }) {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);   // 录音时长（秒）
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const recognitionRef = useRef(null);
  // 保存 Web Speech API 识别到的文字，供 fallback 使用
  const webSpeechResultRef = useRef(null);

  // 清理定时器和识别器
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

  /**
   * 在录音开始时同步启动 Web Speech API
   * 仅收集结果存入 ref，不直接回调 onResult
   * 实际结果由 onstop 阶段决定是否使用
   */
  const startWebSpeechSilent = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return; // 浏览器不支持，忽略

    webSpeechResultRef.current = null;

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.continuous = true;      // 持续识别，直到录音停止
    recognition.interimResults = false;
    recognitionRef.current = recognition;

    recognition.onresult = (event) => {
      // 将所有识别片段拼接成完整文字
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      webSpeechResultRef.current = transcript.trim();
    };

    recognition.onerror = (event) => {
      // 静默失败：Web Speech 失败不影响主流程，后端结果仍会使用
      console.warn('Web Speech 静默识别错误（将使用后端结果）:', event.error);
    };

    try {
      recognition.start();
    } catch (err) {
      console.warn('Web Speech 启动失败:', err.message);
    }
  };

  /**
   * 停止 Web Speech API（录音结束时调用）
   * 停止后 webSpeechResultRef 中存有已识别的文字
   */
  const stopWebSpeech = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (_) {
        // 忽略停止时的异常
      }
      recognitionRef.current = null;
    }
  };

  // 开始录音（同时启动 MediaRecorder + Web Speech API）
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      chunksRef.current = [];
      webSpeechResultRef.current = null;

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      });

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // 关闭麦克风轨道
        stream.getTracks().forEach(track => track.stop());
        // 停止 Web Speech，让其最终结果写入 ref
        stopWebSpeech();

        const audioBlob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType });

        // 通知父组件：开始等待 Whisper 转写，显示加载态
        onTranscribing?.(true);

        try {
          // 优先使用后端 Whisper STT
          const result = await speechToText(audioBlob);

          // 转写完成，通知父组件关闭加载态
          onTranscribing?.(false);

          if (result && result.text && result.text.trim()) {
            // 后端识别成功，直接使用
            onResult?.(result);
          } else {
            // 后端返回空，尝试 Web Speech 结果
            const fallbackText = webSpeechResultRef.current;
            if (fallbackText) {
              console.info('后端 STT 返回空，使用 Web Speech 结果作为 fallback');
              onResult?.({ text: fallbackText, language: 'en' });
            } else {
              onError?.('语音识别未能检测到内容，请重试或手动输入');
            }
          }
        } catch (err) {
          console.error('后端 Whisper STT 失败，尝试 Web Speech fallback:', err);
          // 出错时也要关闭加载态
          onTranscribing?.(false);
          // 后端失败，使用 Web Speech API 结果
          const fallbackText = webSpeechResultRef.current;
          if (fallbackText) {
            onResult?.({ text: fallbackText, language: 'en' });
          } else {
            onError?.('语音识别失败，请重试或手动输入');
          }
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(100); // 每 100ms 收集一次数据

      // 同时启动 Web Speech API（静默收集，用于 fallback）
      startWebSpeechSilent();

      setIsRecording(true);
      startTimer();
    } catch (err) {
      console.error('获取麦克风权限失败:', err);
      onError?.('无法访问麦克风，请检查权限设置');
    }
  };

  // 停止录音
  const stopRecording = () => {
    setIsRecording(false);
    stopTimer();

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      // 停止 MediaRecorder 会触发 onstop 回调，onstop 里再停 Web Speech
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
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
