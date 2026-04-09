import { useState, useRef, useEffect, useCallback } from 'react';
import { speechToText } from '../api/index.js';

/**
 * 语音录音 hook
 * 策略：MediaRecorder 录音 + Web Speech API 实时识别（主路径）+ Whisper 兜底
 *
 * 性能优化（方案 B）：
 * - 录音开始时同时启动 MediaRecorder 和 Web Speech（浏览器原生流式 STT）
 * - 停止录音后等 Web Speech flush 最终结果（最多 400ms），
 *   **有结果走快路径**：立即调用 onResult，不等 Whisper（感知延迟 <500ms）
 *   **无结果走慢路径**：发 Whisper 请求，和优化前行为一致（兜底）
 * - Web Speech 在 iOS Safari 支持历史不稳定，失败自动退回 Whisper，最差等于旧体验
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
   * 停止 Web Speech 并等待 onend 事件 flush 最终结果
   * recognition.stop() 是异步的，stop 调用后还可能有最后一次 onresult 触发，
   * 之后才 onend。等 onend 才能确保 webSpeechResultRef 是最终值。
   * 带 400ms 超时兜底，防止某些浏览器 onend 永不触发导致挂起。
   * @returns {Promise<void>}
   */
  const stopWebSpeechAndWait = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return Promise.resolve();

    return new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        recognitionRef.current = null;
        resolve();
      };

      // recognition 自然结束或被 stop() 触发的 end 事件
      recognition.onend = finish;
      // onerror 也视为结束（失败静默处理，让快路径判断 ref 即可）
      recognition.onerror = finish;

      try {
        recognition.stop();
      } catch (_) {
        finish();
        return;
      }

      // 兜底：400ms 仍没 onend 就强制继续
      setTimeout(finish, 400);
    });
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

        // 关键：等 Web Speech flush 最终结果（最多 400ms），而不是立即停
        // 这样 webSpeechResultRef 才是"说话的最终识别文本"
        await stopWebSpeechAndWait();

        const audioBlob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType });
        const webSpeechText = webSpeechResultRef.current && webSpeechResultRef.current.trim();

        // ⚡ 快路径：Web Speech 已有结果，立即返回，不等 Whisper
        // 这条路径下感知延迟 <500ms（主要是 onend 等待时间）
        if (webSpeechText) {
          console.info('[useVoiceRecorder] ⚡ Web Speech 快路径命中，长度:', webSpeechText.length);
          onResultRef.current?.({ text: webSpeechText, language: 'en' });
          // 不触发 loading：快路径没有异步等待
          // （如果调用方之前把 isTranscribing 设为 true 作为"录音处理中"的过渡态，
          //  也显式设一次 false 保险）
          onTranscribingRef.current?.(false);
          return;
        }

        // 🐢 慢路径：Web Speech 没识别出任何内容（iOS Safari 偶发、不支持、说得太轻等），
        // 退回到 Whisper，行为和优化前一致
        console.info('[useVoiceRecorder] 🐢 Web Speech 无结果，走 Whisper 慢路径');
        onTranscribingRef.current?.(true);

        try {
          const result = await speechToText(audioBlob);
          onTranscribingRef.current?.(false);

          if (result && result.text && result.text.trim()) {
            onResultRef.current?.(result);
          } else {
            onErrorRef.current?.('语音识别未能检测到内容，请重试或手动输入');
          }
        } catch (err) {
          console.error('[useVoiceRecorder] Whisper STT 失败:', err);
          onTranscribingRef.current?.(false);
          onErrorRef.current?.('语音识别失败，请重试或手动输入');
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
  }, [startTimer, startWebSpeechSilent, stopWebSpeechAndWait]);

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
