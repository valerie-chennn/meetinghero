import { useState, useRef, useEffect, useCallback } from 'react';
import { speechToText } from '../api/index.js';

/**
 * 语音录音 hook
 * 策略：MediaRecorder 录音 + Web Speech API 静默识别 fallback
 * 录音结束：优先用后端 Whisper，失败时用 Web Speech 结果
 *
 * @param {object} opts
 * @param {(result: { text: string, language: string }) => void} opts.onResult - 识别成功回调
 * @param {(msg: string) => void} opts.onError - 错误回调
 * @param {(loading: boolean) => void} opts.onTranscribing - 转写中状态变化（用于显示 loading）
 * @returns {{
 *   isRecording: boolean,
 *   duration: number,
 *   toggleRecording: () => void,
 *   startRecording: () => Promise<void>,
 *   stopRecording: () => void,
 * }}
 */
export function useVoiceRecorder({ onResult, onError, onTranscribing } = {}) {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0); // 录音时长（秒）

  // 用 ref 同步追踪录音状态，避免 toggleRecording 的 stale closure 问题
  // （React state 更新异步，闭包可能拿到旧的 isRecording）
  const isRecordingRef = useRef(false);
  // 防止 startRecording 在 await getUserMedia 期间被重复触发
  const isStartingRef = useRef(false);

  // 用 ref 存回调，避免 stale closure
  const onResultRef = useRef(onResult);
  const onErrorRef = useRef(onError);
  const onTranscribingRef = useRef(onTranscribing);
  useEffect(() => { onResultRef.current = onResult; }, [onResult]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);
  useEffect(() => { onTranscribingRef.current = onTranscribing; }, [onTranscribing]);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const recognitionRef = useRef(null);
  // 保存 Web Speech API 识别到的文字，供 fallback 使用
  const webSpeechResultRef = useRef(null);

  // 组件卸载时清理定时器和识别器
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (recognitionRef.current) recognitionRef.current.abort();
    };
  }, []);

  // 启动录音计时器
  const startTimer = useCallback(() => {
    setDuration(0);
    timerRef.current = setInterval(() => {
      setDuration(prev => prev + 1);
    }, 1000);
  }, []);

  // 停止计时器
  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  /**
   * 在录音开始时同步启动 Web Speech API（静默模式）
   * 仅收集结果存入 ref，不直接回调 onResult
   * 实际结果由 onstop 阶段决定是否使用
   */
  const startWebSpeechSilent = useCallback(() => {
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
      console.warn('[useVoiceRecorder] Web Speech 静默识别错误（将使用后端结果）:', event.error);
    };

    try {
      recognition.start();
    } catch (err) {
      console.warn('[useVoiceRecorder] Web Speech 启动失败:', err.message);
    }
  }, []);

  /**
   * 停止 Web Speech API（录音结束时调用）
   * 停止后 webSpeechResultRef 中存有已识别的文字
   */
  const stopWebSpeech = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (_) {
        // 忽略停止时的异常
      }
      recognitionRef.current = null;
    }
  }, []);

  /**
   * 开始录音（同时启动 MediaRecorder + Web Speech API）
   */
  const startRecording = useCallback(async () => {
    // 防重入：如果正在启动或已经在录音中，忽略本次调用
    if (isStartingRef.current || isRecordingRef.current) return;
    isStartingRef.current = true;
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

        // 通知调用方：开始等待 Whisper 转写，显示加载态
        onTranscribingRef.current?.(true);

        try {
          // 优先使用后端 Whisper STT
          const result = await speechToText(audioBlob);

          // 转写完成，通知调用方关闭加载态
          onTranscribingRef.current?.(false);

          if (result && result.text && result.text.trim()) {
            // 后端识别成功，直接使用
            onResultRef.current?.(result);
          } else {
            // 后端返回空，尝试 Web Speech 结果
            const fallbackText = webSpeechResultRef.current;
            if (fallbackText) {
              console.info('[useVoiceRecorder] 后端 STT 返回空，使用 Web Speech 结果作为 fallback');
              onResultRef.current?.({ text: fallbackText, language: 'en' });
            } else {
              onErrorRef.current?.('语音识别未能检测到内容，请重试或手动输入');
            }
          }
        } catch (err) {
          console.error('[useVoiceRecorder] 后端 Whisper STT 失败，尝试 Web Speech fallback:', err);
          // 出错时也要关闭加载态
          onTranscribingRef.current?.(false);
          // 后端失败，使用 Web Speech API 结果
          const fallbackText = webSpeechResultRef.current;
          if (fallbackText) {
            onResultRef.current?.({ text: fallbackText, language: 'en' });
          } else {
            onErrorRef.current?.('语音识别失败，请重试或手动输入');
          }
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(100); // 每 100ms 收集一次数据

      // 同时启动 Web Speech API（静默收集，用于 fallback）
      startWebSpeechSilent();

      // ref 必须在 setIsRecording 前赋值，保证 toggleRecording 立即看到
      isRecordingRef.current = true;
      setIsRecording(true);
      startTimer();
    } catch (err) {
      console.error('[useVoiceRecorder] 获取麦克风权限失败:', err);
      // 明确区分常见错误类型，给出有意义的提示
      if (err.name === 'NotAllowedError') {
        onErrorRef.current?.('麦克风权限被拒绝。如果是手机访问，请确保使用 HTTPS 站点。');
      } else if (err.name === 'NotFoundError') {
        onErrorRef.current?.('未检测到麦克风设备。');
      } else {
        onErrorRef.current?.('无法访问麦克风：' + (err.message || err.name));
      }
    } finally {
      isStartingRef.current = false;
    }
  }, [startTimer, startWebSpeechSilent, stopWebSpeech]);

  /**
   * 停止录音
   */
  const stopRecording = useCallback(() => {
    // ref 必须先于 setState 更新，避免下一次点击通过 ref 又触发 startRecording
    isRecordingRef.current = false;
    setIsRecording(false);
    stopTimer();

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      // 停止 MediaRecorder 会触发 onstop 回调，onstop 里再停 Web Speech
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
  }, [stopTimer]);

  /**
   * 切换录音状态（点击大按钮时调用）
   * 用 ref 判断状态而不是 state，避免 stale closure 导致永远停不下来的 bug
   */
  const toggleRecording = useCallback(() => {
    if (isRecordingRef.current) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [startRecording, stopRecording]);

  return {
    isRecording,
    duration,
    toggleRecording,
    startRecording,
    stopRecording,
  };
}
