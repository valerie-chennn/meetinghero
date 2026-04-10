import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';

import { speechToText } from '../api';

type UseVoiceRecorderOptions = {
  onResult?: (result: { text: string; language: string }) => void;
  onError?: (message: string) => void;
  onTranscribing?: (loading: boolean) => void;
};

export function useVoiceRecorder({ onResult, onError, onTranscribing }: UseVoiceRecorderOptions = {}) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 250);
  const [isStarting, setIsStarting] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const startRecording = useCallback(async () => {
    if (isStarting || recorderState.isRecording) return;

    setIsStarting(true);

    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        onError?.('麦克风权限被拒绝，请在系统设置中允许访问后重试。');
        return;
      }

      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: true,
      });

      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch (error) {
      onError?.(`无法开始录音：${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      if (mountedRef.current) {
        setIsStarting(false);
      }
    }
  }, [isStarting, onError, recorder, recorderState.isRecording]);

  const stopRecording = useCallback(async () => {
    if (!recorderState.isRecording) return;

    try {
      recorder.stop();
      const status = recorder.getStatus();

      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: false,
      });

      if (!status.url) {
        onError?.('录音没有生成有效文件，请重试。');
        return;
      }

      onTranscribing?.(true);
      const result = await speechToText(status.url, 'audio/m4a');
      onTranscribing?.(false);

      if (result?.text?.trim()) {
        onResult?.(result);
      } else {
        onError?.('语音识别未检测到内容，请重试或改用手动输入。');
      }
    } catch (error) {
      onTranscribing?.(false);
      onError?.(`语音识别失败：${error instanceof Error ? error.message : '未知错误'}`);
    }
  }, [onError, onResult, onTranscribing, recorder, recorderState.isRecording]);

  return {
    isRecording: recorderState.isRecording,
    duration: Math.floor((recorderState.durationMillis || 0) / 1000),
    toggleRecording: recorderState.isRecording ? stopRecording : startRecording,
    startRecording,
    stopRecording,
  };
}
