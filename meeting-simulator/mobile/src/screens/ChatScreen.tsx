import { useLocalSearchParams, router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { completeChat, generateHint, joinChat, respondChat } from '../api';
import { AppSurface } from '../components/AppSurface';
import { ChatMessageBubble } from '../components/ChatMessageBubble';
import { PrimaryButton } from '../components/PrimaryButton';
import { TypewriterText } from '../components/TypewriterText';
import { TypingDots } from '../components/TypingDots';
import { useAppState } from '../context/AppStateContext';
import { useVoiceRecorder } from '../hooks/useVoiceRecorder';
import { colors } from '../theme/colors';
import { estimateSpeechDurationMs, playPreparedTts, prepareTts } from '../utils/audio';
import { renderMentionText } from '../utils/text';

const NPC_COLORS = ['#7C5CBF', '#1A8A6E', '#C84B31', '#1A6A8A', '#A05020'];
const MIN_DOTS_MS = 450;
const AUTO_TTS_READY_TIMEOUT_MS = 3200;
const TTS_SYNC_START_WAIT_MS = 520;

type Phase = 'idle' | 'dots' | 'typing_en' | 'typing_done' | 'wait_tap' | 'mic' | 'done';

type UiMessage =
  | { id: string; type: 'system'; text: string; isError?: boolean }
  | { id: string; type: 'user'; en: string }
  | {
      id: string;
      type: 'npc';
      speaker: string;
      speakerName: string;
      speakerColor: string;
      en: string;
      zh?: string;
      voiceId?: string;
      shake?: boolean;
    };

function getNpcColor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return NPC_COLORS[Math.abs(hash) % NPC_COLORS.length];
}

function getCueByCompletedTurns(script: any[] | undefined, completedTurns: number) {
  if (!Array.isArray(script)) return null;

  let cueCount = 0;
  for (const turn of script) {
    if (turn?.type !== 'user_cue') continue;
    if (cueCount === completedTurns) {
      return turn;
    }
    cueCount += 1;
  }

  return null;
}

export function ChatScreen() {
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  const { state, updateState } = useAppState();

  const [isLoading, setIsLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [sessionData, setSessionData] = useState<any>(null);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [phase, setPhase] = useState<Phase>('idle');
  const [curIdx, setCurIdx] = useState(0);
  const [userTurnCount, setUserTurnCount] = useState(0);
  const [hintOpen, setHintOpen] = useState(false);
  const [dynamicHint, setDynamicHint] = useState<string | null>(null);
  const [hintLoading, setHintLoading] = useState(false);
  const [typeMode, setTypeMode] = useState(false);
  const [typeText, setTypeText] = useState('');
  const [isCompleting, setIsCompleting] = useState(false);
  const [pendingNpcReply, setPendingNpcReply] = useState<any>(null);
  const [dotsPreview, setDotsPreview] = useState<any>(null);
  const [micCollapsed, setMicCollapsed] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  const npcMapRef = useRef<Record<string, any>>({});
  const curIdxRef = useRef(0);
  const shouldContinueRef = useRef(true);
  const advanceResolverRef = useRef<null | (() => void)>(null);
  const typingResolverRef = useRef<null | (() => void)>(null);
  const dragStartRef = useRef(0);
  const pendingShakeX = useRef(new Animated.Value(0)).current;
  const hintRequestIdRef = useRef(0);

  const { isRecording, duration, toggleRecording } = useVoiceRecorder({
    onResult: (result) => {
      if (result?.text?.trim()) {
        handleUserSubmit(result.text.trim());
      }
    },
    onError: (message) => {
      appendMessage({ id: `err-${Date.now()}`, type: 'system', text: message, isError: true });
      setPhase('mic');
    },
    onTranscribing: setIsTranscribing,
  });

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages, phase, pendingNpcReply]);

  const panelPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) => gesture.dy > 6,
        onPanResponderGrant: () => {
          dragStartRef.current = 0;
        },
        onPanResponderMove: (_, gesture) => {
          const next = Math.max(0, gesture.dy);
          dragStartRef.current = next;
          setDragOffset(next);
        },
        onPanResponderRelease: () => {
          if (dragStartRef.current > 90) {
            setMicCollapsed(true);
          }
          setDragOffset(0);
        },
      }),
    []
  );

  const appendMessage = useCallback((message: UiMessage) => {
    setMessages((prev) => [...prev, message]);
  }, []);

  const fetchDynamicHint = useCallback(async (chatSessionId: string, requestId: number) => {
    if (hintRequestIdRef.current !== requestId) {
      return;
    }

    setHintLoading(true);
    try {
      const result = await generateHint(chatSessionId);
      if (result?.hint && shouldContinueRef.current && hintRequestIdRef.current === requestId) {
        setDynamicHint(result.hint);
      }
    } catch {
      // 静默忽略
    } finally {
      if (shouldContinueRef.current && hintRequestIdRef.current === requestId) {
        setHintLoading(false);
      }
    }
  }, []);

  const enterMicMode = useCallback((chatSessionId: string, cueIndex?: number) => {
    if (typeof cueIndex === 'number') {
      curIdxRef.current = cueIndex;
      setCurIdx(cueIndex);
    }

    setHintOpen(false);
    setDynamicHint(null);
    setHintLoading(false);
    setMicCollapsed(false);
    setPhase('mic');

    hintRequestIdRef.current += 1;
    fetchDynamicHint(chatSessionId, hintRequestIdRef.current);
  }, [fetchDynamicHint]);

  const showNpcReply = useCallback(
    async (
      reply: { speaker: string; text: string; textZh?: string; voiceId?: string; shake?: boolean },
      speakerName: string
    ) => {
      const speakerColor = getNpcColor(reply.speaker);
      const typingDurationMs = estimateSpeechDurationMs(reply.text, state.userName);
      const preview = {
        id: `preview-${Date.now()}`,
        speaker: reply.speaker,
        speakerName,
        speakerColor,
        en: reply.text,
        zh: reply.textZh,
        voiceId: reply.voiceId,
        shake: !!reply.shake,
        typingDurationMs,
      };

      setDotsPreview(preview);
      setPhase('dots');
      const preparedUri = await Promise.race<string | null>([
        Promise.all([
          prepareTts(reply.text, reply.voiceId, state.userName),
          new Promise((resolve) => setTimeout(resolve, MIN_DOTS_MS)),
        ]).then(([uri]) => uri),
        new Promise<null>((resolve) => {
          setTimeout(() => resolve(null), AUTO_TTS_READY_TIMEOUT_MS);
        }),
      ]);
      if (!shouldContinueRef.current) return;

      setDotsPreview(null);
      setPendingNpcReply(preview);

      const typingPromise = new Promise<void>((resolve) => {
        typingResolverRef.current = resolve;
      });
      const typingFallbackMs = Math.max(typingDurationMs + 400, 1600);

      let ttsPromise: Promise<void> = Promise.resolve();
      if (preparedUri) {
        const waitForPlaybackStart = new Promise<void>((resolve) => {
          ttsPromise = Promise.resolve(
            playPreparedTts(preparedUri, {
              onStart: resolve,
            })
          ).catch(() => undefined);
        });

        await Promise.race([
          waitForPlaybackStart,
          new Promise<void>((resolve) => {
            setTimeout(resolve, TTS_SYNC_START_WAIT_MS);
          }),
        ]);
        if (!shouldContinueRef.current) return;
      }

      setPhase('typing_en');

      await Promise.race([
        typingPromise,
        new Promise<void>((resolve) => {
          setTimeout(resolve, typingFallbackMs);
        }),
      ]);
      typingResolverRef.current = null;

      setPhase('typing_done');

      appendMessage({
        id: `npc-${Date.now()}`,
        type: 'npc',
        speaker: reply.speaker,
        speakerName,
        speakerColor,
        en: reply.text,
        zh: reply.textZh,
        voiceId: reply.voiceId,
        shake: !!reply.shake,
      });

      setPendingNpcReply(null);

      await Promise.race([
        ttsPromise.then(() => undefined),
        new Promise<void>((resolve) => {
          setTimeout(resolve, 1200);
        }),
      ]);
    },
    [appendMessage, state.userName]
  );

  const startPlayback = useCallback(
    async (script: any[], startAt: number, chatSessionId: string) => {
      shouldContinueRef.current = true;

      let index = startAt;
      while (index < script.length && shouldContinueRef.current) {
        const turn = script[index];
        curIdxRef.current = index;
        setCurIdx(index);

        if (turn.type === 'system') {
          appendMessage({ id: `sys-${index}`, type: 'system', text: turn.text });
          index += 1;
          continue;
        }

        if (turn.type === 'npc') {
          const profile = npcMapRef.current[turn.speaker] || { name: turn.speaker };
          await showNpcReply(
            {
              speaker: turn.speaker,
              text: renderMentionText(turn.text, state.userName),
              textZh: turn.textZh ? renderMentionText(turn.textZh, state.userName) : undefined,
              voiceId: profile.voiceId,
              shake: index === 3,
            },
            profile.name
          );

          index += 1;
          const nextTurn = script[index];
          if (nextTurn?.type === 'user_cue') {
            enterMicMode(chatSessionId, index);
            return;
          }

          setPhase('wait_tap');
          await new Promise<void>((resolve) => {
            advanceResolverRef.current = resolve;
          });
          advanceResolverRef.current = null;
          continue;
        }

        if (turn.type === 'user_cue') {
          enterMicMode(chatSessionId, index);
          return;
        }

        index += 1;
      }

      if (shouldContinueRef.current && chatSessionId) {
        setPhase('done');
        setIsCompleting(true);
        try {
          await completeChat(chatSessionId);
        } catch {
          appendMessage({ id: `complete-${Date.now()}`, type: 'system', text: '结算生成失败，请稍后再试。', isError: true });
        } finally {
          setIsCompleting(false);
        }
      }
    },
    [appendMessage, enterMicMode, showNpcReply, state.userName]
  );

  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (!state.userId || !roomId) {
        setPageError('缺少用户信息或房间 ID，请返回首页重试。');
        setIsLoading(false);
        return;
      }

      try {
        const data = await joinChat(state.userId, roomId);
        if (cancelled) return;

        const nextScript = Array.isArray(data.dialogueScript) ? [...data.dialogueScript] : [];
        if (nextScript.length > 0 && nextScript[nextScript.length - 1].type === 'npc') {
          nextScript.pop();
        }
        data.dialogueScript = nextScript;

        const nextNpcMap = Object.fromEntries((data.npcProfiles || []).map((profile: any) => [profile.id, profile]));
        npcMapRef.current = nextNpcMap;
        setSessionData(data);
        updateState({
          currentRoomId: roomId,
          currentChatSessionId: data.chatSessionId,
          chatDialogueScript: data.dialogueScript,
          chatProgress: 0,
          userTurnCount: 0,
        });
        setIsLoading(false);
        setTimeout(() => {
          if (!cancelled) {
            startPlayback(data.dialogueScript, 0, data.chatSessionId);
          }
        }, 350);
      } catch (error) {
        if (!cancelled) {
          setPageError(error instanceof Error ? error.message : '加入群聊失败');
          setIsLoading(false);
        }
      }
    }

    init();

    return () => {
      cancelled = true;
      shouldContinueRef.current = false;
    };
  }, [roomId, startPlayback, state.userId, updateState]);

  async function handleUserSubmit(text: string) {
    if (!sessionData || isSubmitting) return;

    setIsSubmitting(true);
    setPhase('idle');
    appendMessage({ id: `user-${Date.now()}`, type: 'user', en: text });

    try {
      const turnCount = userTurnCount + 1;
      const result = await respondChat(sessionData.chatSessionId, turnCount, text);
      const profile = npcMapRef.current[result.npcReply.speaker] || { name: result.npcReply.speaker };
      const replyEmotion = result.npcReply.emotion || 'neutral';
      const shouldShake =
        turnCount === 2 ||
        (turnCount === 3 && (replyEmotion === 'angry' || replyEmotion === 'sad'));

      await showNpcReply(
        {
          speaker: result.npcReply.speaker,
          text: renderMentionText(result.npcReply.text, state.userName),
          textZh: result.npcReply.textZh ? renderMentionText(result.npcReply.textZh, state.userName) : undefined,
          voiceId: result.npcReply.voiceId || profile.voiceId,
          shake: shouldShake,
        },
        profile.name
      );

      const nextTurnCount = userTurnCount + 1;
      setUserTurnCount(nextTurnCount);
      updateState({ userTurnCount: nextTurnCount });

      setPhase('wait_tap');
      await new Promise<void>((resolve) => {
        advanceResolverRef.current = resolve;
      });
      advanceResolverRef.current = null;

      startPlayback(sessionData.dialogueScript, curIdxRef.current + 1, sessionData.chatSessionId);
    } catch (error) {
      appendMessage({
        id: `err-${Date.now()}`,
        type: 'system',
        text: error instanceof Error ? error.message : '发送失败，请重试',
        isError: true,
      });
      setPhase('mic');
    } finally {
      setIsSubmitting(false);
    }
  }

  const typingSource = pendingNpcReply || dotsPreview;

  useEffect(() => {
    if ((phase !== 'dots' && phase !== 'typing_en') || !typingSource?.shake) {
      pendingShakeX.setValue(0);
      return;
    }

    const animation = Animated.sequence([
      Animated.timing(pendingShakeX, { toValue: -5, duration: 40, useNativeDriver: true }),
      Animated.timing(pendingShakeX, { toValue: 5, duration: 40, useNativeDriver: true }),
      Animated.timing(pendingShakeX, { toValue: -4, duration: 40, useNativeDriver: true }),
      Animated.timing(pendingShakeX, { toValue: 4, duration: 40, useNativeDriver: true }),
      Animated.timing(pendingShakeX, { toValue: 0, duration: 40, useNativeDriver: true }),
    ]);
    animation.start();
  }, [pendingShakeX, phase, typingSource?.id, typingSource?.shake]);

  if (isLoading) {
    return (
      <AppSurface>
        <View style={styles.centerState}>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.centerText}>加入群聊中...</Text>
        </View>
      </AppSurface>
    );
  }

  if (pageError) {
    return (
      <AppSurface>
        <View style={styles.centerState}>
          <Text style={styles.errorText}>{pageError}</Text>
          <PrimaryButton label="返回首页" onPress={() => router.replace('/feed')} />
        </View>
      </AppSurface>
    );
  }

  const currentUserCue = phase === 'mic'
    ? getCueByCompletedTurns(sessionData?.dialogueScript, userTurnCount)
    : null;
  const memberListText = sessionData?.npcProfiles?.map((profile: any) => profile.name).join(' · ') || '';

  return (
    <AppSurface backgroundColor="#FBF7F0">
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Pressable
            onPress={async () => {
              shouldContinueRef.current = false;
              if (sessionData?.chatSessionId) {
                try {
                  await completeChat(sessionData.chatSessionId, true);
                } catch {
                  // ignore
                }
              }
              router.replace('/feed');
            }}
          >
            <Text style={styles.backLabel}>‹ 返回</Text>
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.groupName}>{sessionData?.groupName}</Text>
            {!!memberListText && <Text style={styles.memberList}>{memberListText} · 你</Text>}
          </View>
          <Text style={styles.liveTag}>LIVE</Text>
        </View>

        <ScrollView ref={scrollRef} style={styles.messagesArea} contentContainerStyle={styles.messagesContent}>
          {!!sessionData?.groupNotice && <Text style={styles.notice}>📌 {sessionData.groupNotice}</Text>}
          {!!sessionData?.userRoleNameEn && (
            <Text style={styles.roleLine}>
              You're <Text style={styles.roleName}>{sessionData.userRoleNameEn}</Text>
            </Text>
          )}

          {messages.map((message) => (
            <ChatMessageBubble key={message.id} message={message as any} userName={state.userName} />
          ))}

          {phase === 'dots' && !!typingSource && (
            <Animated.View style={[styles.pendingRow, { transform: [{ translateX: pendingShakeX }] }]}>
              <View style={[styles.pendingAvatar, { backgroundColor: typingSource.speakerColor }]}>
                <Text style={styles.pendingAvatarLabel}>{typingSource.speakerName?.[0]}</Text>
              </View>
              <View style={styles.pendingBubble}>
                <TypingDots />
              </View>
            </Animated.View>
          )}

          {(phase === 'typing_en' || phase === 'typing_done') && !!typingSource && (
            <Animated.View style={[styles.pendingRow, { transform: [{ translateX: pendingShakeX }] }]}>
              <View style={[styles.pendingAvatar, { backgroundColor: typingSource.speakerColor }]}>
                <Text style={styles.pendingAvatarLabel}>{typingSource.speakerName?.[0]}</Text>
              </View>
              <View style={styles.pendingMeta}>
                <Text style={[styles.pendingName, { color: typingSource.speakerColor }]}>{typingSource.speakerName}</Text>
                <View style={styles.pendingBubble}>
                  {phase === 'typing_en' ? (
                    <TypewriterText
                      text={typingSource.en}
                      userName={state.userName}
                      style={styles.pendingText}
                      durationMs={typingSource.typingDurationMs}
                      onDone={() => {
                        typingResolverRef.current?.();
                        typingResolverRef.current = null;
                      }}
                    />
                  ) : (
                    <Text style={styles.pendingText}>{typingSource.en}</Text>
                  )}
                  {!!typingSource.zh && <Text style={styles.pendingTextZh}>{typingSource.zh}</Text>}
                </View>
              </View>
            </Animated.View>
          )}
        </ScrollView>

        {phase === 'mic' ? (
          <View
            style={[
              styles.panelContainer,
              micCollapsed ? styles.panelCollapsed : null,
              { transform: [{ translateY: dragOffset }] },
            ]}
          >
            {!micCollapsed && (
              <View style={styles.dragHandleWrap} {...panelPanResponder.panHandlers}>
                <View style={styles.dragHandle} />
              </View>
            )}

            {micCollapsed ? (
              <Pressable onPress={() => setMicCollapsed(false)} style={styles.collapsedBar}>
                <Text style={styles.collapsedBarText}>准备好了，点击发言</Text>
              </Pressable>
            ) : (
              <>
                {hintOpen && (
                  <View style={styles.hintCard}>
                    <Text style={styles.hintLabel}>💡 提示</Text>
                    <Text style={styles.hintText}>
                      {hintLoading && !dynamicHint
                        ? '生成中...'
                        : dynamicHint || currentUserCue?.options?.[0]?.example || 'What do you mean?'}
                    </Text>
                  </View>
                )}

                {typeMode ? (
                  <View style={styles.typeArea}>
                    <View style={styles.typeRow}>
                      <Pressable onPress={() => setTypeMode(false)} style={styles.modeSwitch}>
                        <Text style={styles.modeSwitchText}>🎙</Text>
                      </Pressable>
                      <TextInput
                        style={styles.textInput}
                        multiline
                        value={typeText}
                        onChangeText={setTypeText}
                        placeholder="用英语回复..."
                        placeholderTextColor={colors.inkSoft}
                      />
                      <Pressable
                        onPress={() => {
                          const nextText = typeText.trim();
                          if (!nextText) return;
                          setTypeText('');
                          setTypeMode(false);
                          handleUserSubmit(nextText);
                        }}
                        style={[styles.sendButton, !typeText.trim() ? styles.sendButtonDisabled : null]}
                      >
                        <Text style={styles.sendButtonLabel}>发送</Text>
                      </Pressable>
                    </View>
                    <Pressable onPress={() => setHintOpen((prev) => !prev)} style={styles.hintToggle}>
                      <Text style={styles.hintToggleText}>💡 提示</Text>
                    </Pressable>
                  </View>
                ) : (
                  <>
                    <View style={styles.micWrap}>
                      <Pressable
                        onPress={toggleRecording}
                        disabled={isSubmitting || isTranscribing}
                        style={[
                          styles.micButton,
                          isRecording ? styles.micButtonRecording : null,
                          isTranscribing ? styles.micButtonTranscribing : null,
                        ]}
                      >
                        <Text style={styles.micButtonText}>
                          {isTranscribing ? '...' : isRecording ? '■' : '🎙'}
                        </Text>
                      </Pressable>
                      {isRecording ? (
                        <Text style={styles.recordingLabel}>
                          {Math.floor(duration / 60)}:{String(duration % 60).padStart(2, '0')}
                        </Text>
                      ) : isTranscribing ? (
                        <Text style={styles.recordingLabel}>识别中…</Text>
                      ) : null}
                    </View>
                    <View style={styles.bottomRow}>
                      <Pressable onPress={() => setTypeMode(true)} style={styles.modeSwitch}>
                        <Text style={styles.modeSwitchText}>⌨️</Text>
                      </Pressable>
                      <Pressable onPress={() => setHintOpen((prev) => !prev)} style={styles.hintToggle}>
                        <Text style={styles.hintToggleText}>💡 提示</Text>
                      </Pressable>
                    </View>
                  </>
                )}
              </>
            )}
          </View>
        ) : (
          <View style={styles.bottomStatus}>
            {phase === 'wait_tap' ? (
              <PrimaryButton
                label="点击继续"
                onPress={() => {
                  advanceResolverRef.current?.();
                }}
              />
            ) : phase === 'done' ? (
              <PrimaryButton
                label={isCompleting ? '正在结算中...' : '查看结算'}
                disabled={isCompleting}
                onPress={() => router.replace(`/settlement/${sessionData.chatSessionId}`)}
              />
            ) : (
              <Text style={styles.centerText}>
                {phase === 'dots' || phase === 'typing_en' || phase === 'typing_done'
                  ? `${typingSource?.speakerName || 'NPC'} 正在说话...`
                  : ''}
              </Text>
            )}
          </View>
        )}
      </KeyboardAvoidingView>
    </AppSurface>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 20,
  },
  centerText: {
    color: colors.inkSoft,
  },
  errorText: {
    color: colors.danger,
    textAlign: 'center',
  },
  header: {
    minHeight: 72,
    paddingHorizontal: 16,
    paddingTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    backgroundColor: '#FBF7F0',
  },
  backLabel: {
    color: colors.ink,
    fontWeight: '700',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  groupName: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.ink,
  },
  memberList: {
    fontSize: 12,
    color: colors.inkSoft,
  },
  liveTag: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '800',
  },
  messagesArea: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: 16,
    paddingVertical: 18,
    gap: 12,
  },
  notice: {
    color: colors.inkSoft,
    fontSize: 12,
    textAlign: 'center',
  },
  roleLine: {
    color: colors.inkSoft,
    textAlign: 'center',
    marginBottom: 6,
  },
  roleName: {
    color: colors.accent,
    fontWeight: '700',
  },
  pendingRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  pendingAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingAvatarLabel: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  pendingMeta: {
    flex: 1,
    gap: 4,
  },
  pendingName: {
    fontSize: 13,
    fontWeight: '700',
  },
  pendingBubble: {
    borderRadius: 20,
    padding: 14,
    backgroundColor: colors.paperStrong,
    borderWidth: 1,
    borderColor: colors.line,
  },
  pendingText: {
    color: colors.ink,
    fontSize: 16,
    lineHeight: 22,
  },
  pendingTextZh: {
    color: colors.inkSoft,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6,
  },
  panelContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 28 : 18,
    gap: 12,
  },
  panelCollapsed: {
    paddingTop: 10,
  },
  dragHandleWrap: {
    alignItems: 'center',
  },
  dragHandle: {
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: colors.line,
  },
  collapsedBar: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  collapsedBarText: {
    color: colors.accent,
    fontWeight: '700',
  },
  hintCard: {
    backgroundColor: colors.accentSoft,
    borderRadius: 18,
    padding: 14,
    gap: 6,
  },
  hintLabel: {
    color: colors.accent,
    fontWeight: '800',
  },
  hintText: {
    color: colors.ink,
    lineHeight: 22,
  },
  typeArea: {
    gap: 12,
  },
  typeRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-end',
  },
  modeSwitch: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line,
  },
  modeSwitchText: {
    fontSize: 18,
  },
  textInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paper,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.ink,
  },
  sendButton: {
    minHeight: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    backgroundColor: colors.ink,
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
  sendButtonLabel: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  micWrap: {
    alignItems: 'center',
    gap: 10,
  },
  micButton: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micButtonRecording: {
    backgroundColor: colors.coral,
  },
  micButtonTranscribing: {
    backgroundColor: colors.gold,
  },
  micButtonText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
  },
  recordingLabel: {
    color: colors.inkSoft,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  hintToggle: {
    minHeight: 44,
    borderRadius: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
  },
  hintToggleText: {
    color: colors.ink,
    fontWeight: '700',
  },
  bottomStatus: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: '#FFFFFF',
  },
});
