import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { joinChat, respondChat, completeChat, textToSpeech, generateHint } from '../api/index.js';
import { useVoiceRecorder } from '../hooks/useVoiceRecorder.js';
import styles from './ChatPage.module.css';

// ── NPC 角色色彩池（按 speakerId 哈希取色）──
const NPC_COLORS = ['#7C5CBF', '#1A8A6E', '#C84B31', '#1A6A8A', '#A05020'];

function getNpcColor(id) {
  if (!id) return NPC_COLORS[0];
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = id.charCodeAt(i) + ((h << 5) - h);
  }
  return NPC_COLORS[Math.abs(h) % NPC_COLORS.length];
}

// ── TTS 预加载缓存 ──
const ttsCache = new Map();

// 清洗文本用于 TTS：
// 1. 把 @{username} 占位符替换为实际花名（去掉 @ 符号，TTS 直接读名字）
// 2. 剩下的 @ 符号也一律去掉（处理种子里已替换好的 @实际花名 的情况）
// 口语里 @ 本来就是打字符号不发音
function cleanTextForTts(text, userName) {
  if (!text) return text;
  let out = text;
  // 1. 替换占位符 @{username} → 实际花名（或空字符串，如果没花名）
  const name = userName || '';
  out = out.replace(/@\{username\}/g, name);
  // 2. 去掉残留的 @ 符号
  out = out.replace(/@/g, '');
  // 3. 合并可能出现的多余空格
  out = out.replace(/\s+/g, ' ').trim();
  return out;
}

function prefetchTts(text, voiceId, userName) {
  if (!text) return;
  // 缓存 key 用原文（调用方也用原文），TTS 请求用清洗后的文本
  const key = `${text}|${voiceId || ''}`;
  if (ttsCache.has(key)) return;
  const cleanText = cleanTextForTts(text, userName);
  ttsCache.set(key, textToSpeech(cleanText, 'en', voiceId).catch(() => null));
}

async function playTts(text, voiceId, userName) {
  try {
    const key = `${text}|${voiceId || ''}`;
    const cleanText = cleanTextForTts(text, userName);
    const blobPromise = ttsCache.get(key) || textToSpeech(cleanText, 'en', voiceId);
    ttsCache.delete(key);
    const audioBlob = await blobPromise;
    if (!audioBlob) return;

    return new Promise((resolve) => {
      const audioUrl = URL.createObjectURL(audioBlob);
      // ── 关键：复用全局解锁的 Audio 实例 ──
      // iOS Safari 的 HTMLAudioElement 解锁是"元素级"的：
      //   new Audio() 创建的新实例必须在 user gesture 内才能 play
      //   但一个已解锁的实例可以无限次改 src 在任何地方 play
      // window.__unlockedAudio 是 useAudioUnlock 在用户首次点击时创建并解锁的单例
      const audio = window.__unlockedAudio || new Audio();
      const cleanup = () => {
        URL.revokeObjectURL(audioUrl);
        audio.onended = null;
        audio.onerror = null;
      };
      audio.onended = () => { cleanup(); resolve(); };
      audio.onerror = () => { cleanup(); resolve(); };
      audio.src = audioUrl;
      audio.play().catch((err) => {
        console.warn('[ChatPage] audio.play() 被拒绝:', err.message);
        cleanup();
        resolve();
      });
    });
  } catch (err) {
    console.warn('[ChatPage] TTS 失败，静默跳过:', err.message);
  }
}

// 预加载脚本后续 N 条 NPC 消息的 TTS
function prefetchUpcoming(script, cursor, npcMap, userName, count = 2) {
  let fetched = 0;
  for (let i = cursor; i < script.length && fetched < count; i++) {
    const t = script[i];
    if (t.type === 'npc') {
      const p = npcMap[t.speaker] || {};
      prefetchTts(t.text, p.voiceId, userName);
      fetched++;
    }
  }
}

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

// ===== 打字机组件（全文铺底浅灰 + 逐字染色）=====
// 接收 text、userName（用于替换 @{username}）、onDone 回调
function Typewriter({ text, userName, onDone, className }) {
  // 分词：@{username} 整体作为 mention token，其余每字一个 char token
  const tokens = React.useMemo(() => {
    const result = [];
    const placeholder = '@{username}';
    let i = 0;
    while (i < text.length) {
      if (text.startsWith(placeholder, i)) {
        result.push({ type: 'mention' });
        i += placeholder.length;
      } else {
        result.push({ type: 'char', char: text[i] });
        i++;
      }
    }
    return result;
  }, [text]);

  // 根据文本内容估算每个节拍的时长（ms）
  const speed = React.useMemo(() => {
    const isCJK = /[\u4e00-\u9fa5]/.test(text);
    const perChar = isCJK ? 180 : 60;
    const raw = 400 + perChar * tokens.length;
    const total = Math.max(800, Math.min(6000, raw));
    return tokens.length > 0 ? total / tokens.length : 50;
  }, [text, tokens.length]);

  const [highlightIdx, setHighlightIdx] = useState(0);
  const doneRef = useRef(false);

  // text 变化时重置，并启动染色 interval
  useEffect(() => {
    setHighlightIdx(0);
    doneRef.current = false;
    if (tokens.length === 0) return;
    const iv = setInterval(() => {
      setHighlightIdx(prev => {
        const next = prev + 1;
        if (next >= tokens.length) {
          clearInterval(iv);
        }
        return next;
      });
    }, speed);
    return () => clearInterval(iv);
  }, [text, tokens.length, speed]);

  // highlightIdx 推进到末尾时，触发一次 onDone
  useEffect(() => {
    if (highlightIdx >= tokens.length && tokens.length > 0 && !doneRef.current) {
      doneRef.current = true;
      onDone?.();
    }
  }, [highlightIdx, tokens.length, onDone]);

  return (
    <span className={className}>
      {tokens.map((tok, i) => {
        const lit = i < highlightIdx;
        if (tok.type === 'mention') {
          return (
            <span key={`t-${i}`} className={lit ? styles.mentionBright : styles.mentionDim}>
              @{userName || 'you'}
            </span>
          );
        }
        return (
          <span key={`t-${i}`} className={lit ? styles.charBright : styles.charDim}>
            {tok.char}
          </span>
        );
      })}
    </span>
  );
}

// ===== 主组件 =====
function ChatPage() {
  const navigate = useNavigate();
  const { roomId } = useParams();
  const { state, updateState } = useApp();

  // ── 加载/错误状态 ──
  const [isLoading, setIsLoading] = useState(true);
  const [pageError, setPageError] = useState(null);

  // ── 会话数据 ──
  const [sessionData, setSessionData] = useState(null);

  // ── 消息列表（已完成的消息，历史滚动显示）──
  const [messages, setMessages] = useState([]);

  // ── 状态机阶段 ──
  // idle | dots | typing_en | typing_zh | wait_tap | mic | done
  const [phase, setPhase] = useState('idle');

  // ── 当前脚本光标（指向正在播放的条目）──
  const [curIdx, setCurIdx] = useState(0);

  // ── 用户发言次数 ──
  const [userTurnCount, setUserTurnCount] = useState(0);

  // ── 发言模式：是否展示💡提示 ──
  const [hintOpen, setHintOpen] = useState(false);

  // ── 发言模式：AI 动态生成的参考说法（点💡时展示）──
  const [dynamicHint, setDynamicHint] = useState(null);
  // 参考说法加载中
  const [hintLoading, setHintLoading] = useState(false);

  // ── done 阶段，completeChat 是否还在进行中（禁用按钮用）──
  const [isCompleting, setIsCompleting] = useState(false);

  // ── 发言模式：是否切换到打字输入 ──
  const [typeMode, setTypeMode] = useState(false);
  // ── 文字输入模式下的文本内容 ──
  const [typeText, setTypeText] = useState('');
  const typeTextareaRef = useRef(null);

  // ── 发言模式：麦克风区收起状态 ──
  const [micCollapsed, setMicCollapsed] = useState(false);

  // 转写中状态：录音停止后、Whisper 返回结果前显示 loading UI
  // 避免用户点完停止后按钮立即回到 idle，体感"啥都没发生"
  const [isTranscribing, setIsTranscribing] = useState(false);

  // ── 录音 hook：录音完成后自动 submit ──
  const { isRecording, duration: recordDuration, toggleRecording } = useVoiceRecorder({
    onResult: (result) => {
      if (result?.text?.trim()) {
        handleUserSubmit(result.text.trim());
      }
    },
    onError: (msg) => {
      console.warn('[ChatPage] 录音失败:', msg);
      // ChatPage 暂无 toast 机制，用 alert 兜底
      alert(msg);
    },
    onTranscribing: (loading) => {
      // 转写中：按钮显示 spinner + "识别中…"
      setIsTranscribing(loading);
    },
  });

  // ── 发言模式：拖拽过程中的 Y 偏移量（px）──
  const [micDragY, setMicDragY] = useState(0);

  // ── 拖拽起始 Y 坐标（ref，避免异步闭包问题）──
  const dragStartYRef = useRef(null);
  const isDraggingRef = useRef(false);

  // ── 用户提交防重复 ──
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Task 8：Emoji 雨展示状态 ──
  const [showEmojiRain, setShowEmojiRain] = useState(false);

  // ── 连续 NPC 发言计数（不超过3条不进入 user_cue 时强制暂停）──
  const consecutiveNpcRef = useRef(0);

  // ── 等待用户点击推进的标志（不用 state 避免闭包陷阱）──
  const waitingTapRef = useRef(false);

  // ── 组件卸载标志 ──
  const shouldContinueRef = useRef(true);

  // ── 脚本光标（ref 版本，供回调中读最新值）──
  const curIdxRef = useRef(0);

  // ── 推进脚本的触发函数（由用户点击或自动调用）──
  // 用 ref 存函数，避免状态机循环中闭包捕获过期值
  const advanceRef = useRef(null);

  // ── npcMap（从 sessionData 构建，ref 保持稳定）──
  const npcMapRef = useRef({});

  const messagesEndRef = useRef(null);
  const chatAreaRef = useRef(null);

  // 自动滚到底部
  useEffect(() => {
    if (messagesEndRef.current) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 60);
    }
  }, [messages, phase]);

  // ── 初始化：调用 joinChat ──
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

        setSessionData(data);
        updateState({
          currentRoomId: roomId,
          currentChatSessionId: data.chatSessionId,
          chatDialogueScript: data.dialogueScript,
          chatProgress: 0,
          userTurnCount: 0,
        });

        // 构建 npcMap
        const nm = {};
        (data.npcProfiles || []).forEach(p => { nm[p.id] = p; });
        npcMapRef.current = nm;

        setIsLoading(false);

        // 预加载前 2 条 NPC TTS
        prefetchUpcoming(data.dialogueScript, 0, nm, state.userName, 2);

        // 延迟后启动脚本
        setTimeout(() => {
          if (!cancelled) startPlayback(data.dialogueScript, nm, data.chatSessionId, 0);
        }, 400);

      } catch (err) {
        if (cancelled) return;
        console.error('[ChatPage] joinChat 失败:', err);
        setPageError(`加入群聊失败：${err.message}`);
        setIsLoading(false);
      }
    }

    init();
    return () => {
      cancelled = true;
      shouldContinueRef.current = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  // ── 脚本播放引擎 ──
  // script: 完整脚本，nm: npcMap，sessionId，startAt: 从哪条开始
  async function startPlayback(script, nm, sessionId, startAt) {
    shouldContinueRef.current = true;
    let i = startAt;

    // 用于在 wait_tap 时暂停
    const waitTap = () => new Promise((resolve) => {
      waitingTapRef.current = true;
      // 把 resolve 挂到 ref，用户点击时调用
      advanceRef.current = () => {
        waitingTapRef.current = false;
        advanceRef.current = null;
        resolve();
      };
    });

    while (i < script.length && shouldContinueRef.current) {
      const turn = script[i];
      curIdxRef.current = i;
      setCurIdx(i);

      if (turn.type === 'system') {
        // 系统消息：直接显示，500ms 后继续
        appendMessage({ id: `sys-${i}`, type: 'system', text: turn.text });
        i++;
        await sleep(500);

      } else if (turn.type === 'npc') {
        const profile = nm[turn.speaker] || { name: turn.speaker, voiceId: null };
        const color = getNpcColor(turn.speaker);

        // ── dots 阶段：显示三个跳动点，同时预加载 TTS ──
        setPhase('dots');
        // 发起 TTS 预加载请求（存入缓存，不播放）
        const ttsKey = `${turn.text}|${profile.voiceId || ''}`;
        prefetchTts(turn.text, profile.voiceId, state.userName);
        prefetchUpcoming(script, i + 1, nm, state.userName, 2);
        // dots 最少显示 800ms，同时等 TTS 预加载完成（取两者较长的）
        const dotsMinWait = sleep(800 + Math.random() * 300);
        const ttsCachePromise = ttsCache.get(ttsKey) || Promise.resolve(null);
        await Promise.all([dotsMinWait, ttsCachePromise]);
        if (!shouldContinueRef.current) break;

        // ── typing_en 阶段：TTS 已缓存，立即播放 ──
        setPhase('typing_en');
        const ttsPromise = playTts(turn.text, profile.voiceId, state.userName);
        // 等打字机打完（通过 onEnDone 回调驱动）
        await waitForPhase('typing_zh');
        if (!shouldContinueRef.current) break;

        // ── typing_zh 阶段 → typing_done（打字完成，TTS 可能还在播）──
        await waitForPhase('typing_done');
        if (!shouldContinueRef.current) break;

        // 等 TTS 播完（气泡在 typing_done 阶段保持高亮色）
        await ttsPromise;
        if (!shouldContinueRef.current) break;

        // TTS + 打字机都完成，推入历史列表（白色气泡）
        appendMessage({
          id: `npc-${i}`,
          type: 'npc',
          speaker: turn.speaker,
          speakerName: profile.name,
          speakerColor: color,
          en: turn.text,
          zh: turn.textZh,
          voiceId: profile.voiceId,
        });

        // ── wait_tap 阶段 ──
        setPhase('wait_tap');

        // 连续 NPC 计数
        consecutiveNpcRef.current += 1;

        i++;

        // 检查下一条是否是 user_cue
        const nextTurn = script[i];
        const isNextUserCue = nextTurn?.type === 'user_cue';
        // 连续3条强制暂停（即使下一条不是 user_cue）
        const forcePause = consecutiveNpcRef.current >= 3 && !isNextUserCue;

        // "第一条自动出现"指 dots+打字机自动启动（不需要点击触发），
        // 但播完后仍需等用户点击才进下一条。所以每条 NPC 消息都要等 tap。
        // 唯一例外：下一条是 user_cue 时直接进发言模式，不需要 tap。
        const needTap = !isNextUserCue && i < script.length;

        if (needTap || forcePause) {
          // 等 TTS 播完再显示"点击屏幕继续"提示
          await ttsPromise;
          if (!shouldContinueRef.current) break;
          // 等用户点击
          await waitTap();
          if (!shouldContinueRef.current) break;
        } else if (isNextUserCue) {
          // 下一条是 user_cue：等 TTS 播完再进发言模式，避免气泡还在说话就弹麦克风
          await ttsPromise;
          if (!shouldContinueRef.current) break;
          await sleep(500);
          if (!shouldContinueRef.current) break;
        }

        if (forcePause) {
          // 强制暂停后重置计数
          consecutiveNpcRef.current = 0;
        }

      } else if (turn.type === 'user_cue') {
        // 重置连续计数
        consecutiveNpcRef.current = 0;

        // ── 直接进入发言模式（@提及已在 NPC 对话中完成 cue）──
        setPhase('mic');
        setHintOpen(false);
        setTypeMode(false);
        setDynamicHint(null);
        // 后台预加载 AI 参考说法，用户点💡时就能直接看到
        fetchDynamicHint();
        // 等用户发言（handleUserSubmit 会调用 resumeAfterUser）
        return;

      } else {
        i++;
      }
    }

    // 脚本播放完毕
    if (shouldContinueRef.current && i >= script.length) {
      setPhase('done');
    }
  }

  // ── 等待 phase 变成目标值的 Promise ──
  // 通过 ref 实现（避免在 async 函数中订阅 state 变化的闭包问题）
  const phaseRef = useRef('idle');
  const phaseWaitersRef = useRef([]);

  // 每次 phase 变化时通知等待者
  useEffect(() => {
    phaseRef.current = phase;
    const waiters = phaseWaitersRef.current;
    phaseWaitersRef.current = waiters.filter(w => {
      if (w.target === phase) { w.resolve(); return false; }
      return true;
    });
  }, [phase]);

  function waitForPhase(target) {
    if (phaseRef.current === target) return Promise.resolve();
    return new Promise((resolve) => {
      phaseWaitersRef.current.push({ target, resolve });
    });
  }

  // ── 打字机打完英文后的回调 ──
  const onEnDone = useCallback(() => {
    setPhase('typing_zh');
  }, []);

  // ── 打字机打完中文后的回调 ──
  const onZhDone = useCallback(() => {
    // 中文不再走打字机染色（直接静态呈现），但仍需推进状态机到 typing_done
    // 引擎会在 await ttsPromise 后再切到 wait_tap
    setPhase('typing_done');
  }, []);

  // ── 中文不做打字机效果：进入 typing_zh 后立即推进到 typing_done ──
  // （保留 typing_zh → typing_done 的两段状态是为了让 state machine 的
  //  waitForPhase('typing_zh') / waitForPhase('typing_done') 依次 resolve）
  useEffect(() => {
    if (phase === 'typing_zh') {
      onZhDone();
    }
  }, [phase, onZhDone]);

  // ── 整屏点击推进 ──
  function handleScreenTap() {
    if (phase !== 'wait_tap') return;
    if (advanceRef.current) {
      advanceRef.current();
    }
  }

  // ── 添加消息 ──
  function appendMessage(msg) {
    setMessages(prev => [...prev, msg]);
  }

  // ── 拉取 AI 动态生成的💡参考说法 ──
  async function fetchDynamicHint() {
    if (!sessionData?.chatSessionId) return;
    setHintLoading(true);
    try {
      const result = await generateHint(sessionData.chatSessionId);
      if (result?.hint && shouldContinueRef.current) {
        setDynamicHint(result.hint);
      }
    } catch (err) {
      console.warn('[ChatPage] 生成参考说法失败:', err.message);
      // 失败静默，用户点💡时会显示 fallback
    } finally {
      if (shouldContinueRef.current) setHintLoading(false);
    }
  }

  // ── 用户发言处理 ──
  const handleUserSubmit = useCallback(async (text) => {
    if (isSubmitting || !sessionData) return;
    setIsSubmitting(true);
    setPhase('idle');

    const currentTurnCount = userTurnCount + 1;

    appendMessage({
      id: `user-${Date.now()}`,
      type: 'user',
      en: text,
    });

    // 显示 NPC typing
    setPhase('dots');
    const npcMap = npcMapRef.current;

    try {
      const result = await respondChat(sessionData.chatSessionId, currentTurnCount, text);

      // NPC 回复：先展示 dots，再走打字机
      const replyProfile = npcMap[result.npcReply.speaker] || { name: result.npcReply.speaker, voiceId: null };
      const replyVoiceId = result.npcReply.voiceId || replyProfile.voiceId;
      const replyColor = getNpcColor(result.npcReply.speaker);

      // 设置 dots 预览（用于 dots 阶段显示正确的头像）
      setDotsPreview({ speakerName: replyProfile.name, speakerColor: replyColor });

      // 预缓存回复语音（返回 promise，下面要 await 它）
      prefetchTts(result.npcReply.text, replyVoiceId, state.userName);

      // dots → typing_en
      // 关键：同时等 dots 最短时长 + TTS 就绪（取两者较长的）
      // 否则 TTS 还在合成就进入 typing，气泡先出 TTS 落后，体感 NPC 回复滞后
      // 这是 startPlayback 路径已有的做法，handleUserSubmit 路径之前漏了
      const ttsKey = `${result.npcReply.text}|${replyVoiceId || ''}`;
      const ttsCachePromise = ttsCache.get(ttsKey) || Promise.resolve(null);
      const dotsMinWait = sleep(600 + Math.random() * 300);
      await Promise.all([dotsMinWait, ttsCachePromise]);
      if (!shouldContinueRef.current) return;

      // Task 7：第 2 轮 + emotion 为 angry/sad 时标记 shake
      const replyEmotion = result.npcReply.emotion || 'neutral';
      const shouldShake = currentTurnCount === 2 && (replyEmotion === 'angry' || replyEmotion === 'sad');
      // Task 8：第 3 轮 + emotion 为 happy 时触发 emoji 雨
      const shouldEmojiRain = currentTurnCount === 3 && replyEmotion === 'happy';

      // 把 NPC 回复挂到打字机 state
      setDotsPreview(null); // 清除预览，pendingNpcReply 接管
      setPendingNpcReply({
        speaker: result.npcReply.speaker,
        speakerName: replyProfile.name,
        speakerColor: replyColor,
        en: result.npcReply.text,
        zh: result.npcReply.textZh,
        voiceId: replyVoiceId,
        id: `npc-reply-${Date.now()}`,
        shake: shouldShake,
      });
      setPhase('typing_en');
      // 开始播放 TTS（与打字机同步）
      const ttsPromise = playTts(result.npcReply.text, replyVoiceId, state.userName);

      // 逐步等打字机完成：typing_en → typing_zh → typing_done
      await waitForPhase('typing_zh');
      if (!shouldContinueRef.current) return;
      await waitForPhase('typing_done');
      if (!shouldContinueRef.current) return;

      // 打字机完成后触发 emoji 雨（Task 8）
      if (shouldEmojiRain) {
        setShowEmojiRain(true);
      }

      // 等 TTS 播完（气泡在 typing_done 阶段保持高亮色）
      await ttsPromise;
      if (!shouldContinueRef.current) return;

      // TTS + 打字机都完成，推入消息历史（白色气泡）
      const pendingMsg = {
        id: `npc-reply-${Date.now()}`,
        type: 'npc',
        speaker: result.npcReply.speaker,
        speakerName: replyProfile.name,
        speakerColor: replyColor,
        en: result.npcReply.text,
        zh: result.npcReply.textZh,
        voiceId: replyVoiceId,
        shake: shouldShake,
      };
      setPendingNpcReply(null);
      appendMessage(pendingMsg);
      setPhase('wait_tap');
      // NPC 回复计入连续发言计数（避免 1+3=4 条 NPC 连续不让用户插嘴）
      consecutiveNpcRef.current = 1;

      // 更新发言次数
      setUserTurnCount(currentTurnCount);
      updateState({ userTurnCount: currentTurnCount });

      if (result.isLastTurn) {
        // 最后一次：等用户点击后跳结算
        await new Promise((resolve) => {
          advanceRef.current = () => {
            waitingTapRef.current = false;
            advanceRef.current = null;
            resolve();
          };
          waitingTapRef.current = true;
        });
        if (!shouldContinueRef.current) return;
        // 先进 done 显示按钮（loading 状态），后台 await completeChat
        // 完成后 setIsCompleting(false) 按钮才可点击，避免提前跳转
        setPhase('done');
        setIsCompleting(true);
        await sleep(500);
        try {
          await completeChat(sessionData.chatSessionId);
          if (!shouldContinueRef.current) return;
        } catch (err) {
          console.warn('[ChatPage] completeChat 失败:', err.message);
        } finally {
          if (shouldContinueRef.current) setIsCompleting(false);
        }
      } else {
        // 继续脚本
        await new Promise((resolve) => {
          advanceRef.current = () => {
            waitingTapRef.current = false;
            advanceRef.current = null;
            resolve();
          };
          waitingTapRef.current = true;
        });
        if (!shouldContinueRef.current) return;
        await sleep(300);
        const nextIdx = curIdxRef.current + 1;
        startPlayback(
          sessionData.dialogueScript,
          npcMap,
          sessionData.chatSessionId,
          nextIdx,
        );
      }
    } catch (err) {
      console.error('[ChatPage] respondChat 失败:', err);
      setPhase('mic'); // 回到发言模式重试
      appendMessage({
        id: `err-${Date.now()}`,
        type: 'system',
        text: '发送失败，请重试',
        isError: true,
      });
    } finally {
      setIsSubmitting(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSubmitting, sessionData, userTurnCount, navigate]);

  // ── NPC 回复打字机内容（动态）──
  // 用于 handleUserSubmit 后的 dots + typing 阶段显示
  const [pendingNpcReply, setPendingNpcReply] = useState(null);

  // ── 用户发言后 NPC 回复的预览（dots 阶段就需要显示头像，此时 pendingNpcReply 还未设置）──
  const [dotsPreview, setDotsPreview] = useState(null); // { speakerName, speakerColor }

  // ── 判断当前打字机/dots 显示什么内容 ──
  // 优先级：pendingNpcReply > dotsPreview > 脚本当前条目
  const typingSource = pendingNpcReply || dotsPreview || (() => {
    if (!sessionData?.dialogueScript) return null;
    const s = sessionData.dialogueScript[curIdx];
    if (!s) return null;
    // NPC 消息：用 text/textZh
    if (s.type === 'npc') {
      const p = npcMapRef.current[s.speaker] || { name: s.speaker };
      return {
        speaker: s.speaker,
        speakerName: p.name,
        speakerColor: getNpcColor(s.speaker),
        en: s.text,
        zh: s.textZh,
      };
    }
    return null;
  })();

  // ── 计算成员列表文字 ──
  const memberNames = sessionData?.npcProfiles?.map(p => p.name).join(' · ') || '';
  const memberListText = memberNames ? `${memberNames} · 你` : '';
  const groupName = sessionData?.groupName || '群聊加载中...';

  // ── 当前 user_cue 节点（发言模式时）──
  const currentUserCue = (() => {
    if (phase !== 'mic' || !sessionData?.dialogueScript) return null;
    const s = sessionData.dialogueScript[curIdx];
    return s?.type === 'user_cue' ? s : null;
  })();

  const isMicMode = phase === 'mic';
  const isDone = phase === 'done';

  // ── 进入 mic 模式时重置收起状态 ──
  useEffect(() => {
    if (isMicMode) {
      setMicCollapsed(false);
      setMicDragY(0);
    }
  }, [isMicMode]);

  // ── 拖拽开始（touch / mouse）──
  // 用 ref 存最新 micDragY，供 document 级事件读取（避免闭包捕获旧值）
  const micDragYRef = useRef(0);

  function handleDragStart(e) {
    e.stopPropagation();
    e.preventDefault();
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    dragStartYRef.current = clientY;
    isDraggingRef.current = true;
    micDragYRef.current = 0;

    // 绑到 document，手指离开把手区域也能继续拖
    const onMove = (ev) => {
      if (!isDraggingRef.current) return;
      const y = ev.touches ? ev.touches[0].clientY : ev.clientY;
      const delta = y - dragStartYRef.current;
      const val = delta > 0 ? delta : 0;
      micDragYRef.current = val;
      setMicDragY(val);
    };
    const onEnd = () => {
      isDraggingRef.current = false;
      dragStartYRef.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onEnd);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);

      if (micDragYRef.current > 80) {
        setMicCollapsed(true);
      }
      setMicDragY(0);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onEnd);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
  }

  // ── 展开麦克风区 ──
  function handleExpandMic(e) {
    e.stopPropagation();
    setMicCollapsed(false);
    setMicDragY(0);
  }

  // ── 加载/错误屏幕 ──
  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingScreen}>
          <div className={styles.loadingSpinner} />
          <p className={styles.loadingText}>加入群聊中...</p>
        </div>
      </div>
    );
  }

  if (pageError) {
    return (
      <div className={styles.container}>
        <div className={styles.errorScreen}>
          <p className={styles.errorText}>{pageError}</p>
          <button className={styles.errorBackButton} onClick={() => navigate('/feed')}>
            返回首页
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Task 8：Emoji 雨特效层 */}
      {showEmojiRain && <EmojiRain onDone={() => setShowEmojiRain(false)} />}

      {/* ===== 顶部导航栏 ===== */}
      <header className={styles.header}>
        <button
          className={styles.backButton}
          onClick={(e) => {
            e.stopPropagation();
            shouldContinueRef.current = false;
            if (sessionData?.chatSessionId) {
              completeChat(sessionData.chatSessionId, true).catch(() => {});
            }
            navigate('/feed');
          }}
          aria-label="返回"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div className={styles.headerCenter}>
          <div className={styles.groupName}>{groupName}</div>
          {memberListText && (
            <div className={styles.memberList}>{memberListText}</div>
          )}
        </div>
        <div className={styles.liveTag}>LIVE</div>
      </header>

      {/* ===== 消息列表区 ===== */}
      {/* 收起状态下用 messageList（全屏），正常发言模式用 messageListCompact（42%）*/}
      <div
        ref={chatAreaRef}
        className={(isMicMode && !micCollapsed) ? styles.messageListCompact : styles.messageList}
      >
        {/* ── 三层系统消息区块（静态，不走 messages state）── */}
        {sessionData && (
          <div className={styles.headerInfo}>
            {/* 第 1 层：群公告 */}
            {sessionData.groupNotice && (
              <div className={styles.headerInfoNotice}>📌 {sessionData.groupNotice}</div>
            )}
            {/* 第 2 层：谁拉你进群 */}
            <div className={styles.headerInfoInvite}>
              {(sessionData.npcProfiles && sessionData.npcProfiles[0]
                ? sessionData.npcProfiles.find(p => p.id === 'npc_a')?.name || sessionData.npcProfiles[0].name
                : ''
              )} invited you to the group
            </div>
            {/* 第 3 层：你的角色（英文，左右横线）*/}
            {sessionData.userRoleNameEn && (
              <div className={styles.headerInfoRole}>
                <span className={styles.headerInfoRoleLine} />
                <span className={styles.headerInfoRoleText}>
                  <span className={styles.headerInfoRoleYoure}>{"You're "}</span>
                  <span className={styles.headerInfoRoleName}>{sessionData.userRoleNameEn}</span>
                </span>
                <span className={styles.headerInfoRoleLine} />
              </div>
            )}
          </div>
        )}

        {/* 已完成消息 */}
        {messages.map(msg => (
          <MessageBubble key={msg.id} msg={msg} userName={state.userName} />
        ))}

        {/* ── dots 阶段：显示跳动三点 ── */}
        {(phase === 'dots') && typingSource && (
          <div className={styles.dotsRow}>
            <div
              className={styles.npcAvatar}
              style={{ background: typingSource.speakerColor }}
            >
              {(typingSource.speakerName || '')[0]}
            </div>
            <div className={styles.dotsBubble}>
              <div className={styles.dot} />
              <div className={styles.dot} />
              <div className={styles.dot} />
            </div>
          </div>
        )}

        {/* ── typing/typing_done 阶段：打字机气泡（高亮色，TTS播完才消失）── */}
        {(phase === 'typing_en' || phase === 'typing_zh' || phase === 'typing_done') && typingSource && (
          <div className={`${styles.npcRow}${typingSource.shake ? ` ${styles.npcRowShake}` : ''}`}>
            <div
              className={styles.npcAvatar}
              style={{ background: typingSource.speakerColor }}
            >
              {(typingSource.speakerName || '')[0]}
            </div>
            <div className={styles.npcMeta}>
              <div
                className={styles.speakerName}
                style={{ color: typingSource.speakerColor }}
              >
                {typingSource.speakerName}
              </div>
              <div className={styles.npcBubbleTyping}>
                {/* 英文：typing_en 阶段走打字机染色，其余阶段静态呈现 */}
                {phase === 'typing_en' ? (
                  <Typewriter
                    text={typingSource.en || ''}
                    userName={state.userName}
                    onDone={onEnDone}
                    className={styles.bubbleEn}
                  />
                ) : (
                  <div className={styles.bubbleEn}>{renderTextWithMention(typingSource.en, state.userName)}</div>
                )}
                {/* 中文：所有阶段都静态呈现，气泡从一开始就是完整尺寸，不会因为中文晚到而跳变 */}
                <div className={styles.bubbleZh}>{renderTextWithMention(typingSource.zh, state.userName)}</div>
              </div>
            </div>
          </div>
        )}

        {/* 滚动锚点 */}
        <div ref={messagesEndRef} />
      </div>

      {/* ===== 发言模式分割线 = 拖拽把手（收起时隐藏）===== */}
      {isMicMode && !micCollapsed && (
        <div
          className={styles.dividerHandle}
          onTouchStart={handleDragStart}
          onMouseDown={handleDragStart}
        >
          <div className={styles.dragHandleBar} />
        </div>
      )}

      {/* ===== 底部区域 ===== */}
      {isMicMode ? (
        /* ── 发言模式下半屏 ── */
        <>
        {/* 收起状态：隐藏麦克风区，底部显示悬浮条 */}
        {micCollapsed ? (
          <div
            className={styles.micCollapseBar}
            onClick={handleExpandMic}
          >
            {/* 紫色麦克风图标 */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7C5CBF" strokeWidth="2" strokeLinecap="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
            <span className={styles.micCollapseBarText}>准备好了，点击发言</span>
          </div>
        ) : (
        /* 正常发言模式：显示麦克风区 */
        <div
          className={styles.speakMode}
          style={{
            transform: `translateY(${micDragY}px)`,
            transition: isDraggingRef.current ? 'none' : 'transform 0.3s ease',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* 💡提示：AI 动态生成的参考说法（fallback 到种子数据）*/}
          {hintOpen && (
            <div className={styles.hintArea}>
              <div className={styles.exampleCard}>
                <div className={styles.exampleText}>
                  {hintLoading && !dynamicHint
                    ? '生成中...'
                    : (dynamicHint || currentUserCue?.options?.[0]?.example || '')}
                </div>
              </div>
            </div>
          )}

          {/* 打字输入模式 */}
          {typeMode ? (
            <div className={styles.typeInputArea}>
              {/* 输入行：[麦克风图标] [输入框] [发送按钮] */}
              <div className={styles.typeInputRow}>
                {/* 左侧麦克风图标：点击切回语音模式 */}
                <button
                  type="button"
                  className={styles.typeMicIcon}
                  onClick={() => setTypeMode(false)}
                  aria-label="切回语音模式"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="23" />
                    <line x1="8" y1="23" x2="16" y2="23" />
                  </svg>
                </button>

                {/* 文字输入框 */}
                <textarea
                  ref={typeTextareaRef}
                  className={styles.typeTextarea}
                  value={typeText}
                  onChange={(e) => {
                    setTypeText(e.target.value);
                    // 自动撑高
                    const ta = e.target;
                    ta.style.height = 'auto';
                    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      const trimmed = typeText.trim();
                      if (trimmed && !isSubmitting) {
                        setTypeText('');
                        if (typeTextareaRef.current) typeTextareaRef.current.style.height = 'auto';
                        setTypeMode(false);
                        handleUserSubmit(trimmed);
                      }
                    }
                  }}
                  placeholder="用英语回复..."
                  disabled={isSubmitting}
                  rows={1}
                />

                {/* 发送按钮 */}
                <button
                  type="button"
                  className={`${styles.typeSendBtn} ${typeText.trim() ? styles.typeSendBtnActive : ''}`}
                  disabled={isSubmitting || !typeText.trim()}
                  onClick={() => {
                    const trimmed = typeText.trim();
                    if (!trimmed) return;
                    setTypeText('');
                    if (typeTextareaRef.current) typeTextareaRef.current.style.height = 'auto';
                    setTypeMode(false);
                    handleUserSubmit(trimmed);
                  }}
                  aria-label="发送"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 2L11 13" />
                    <path d="M22 2L15 22L11 13L2 9L22 2Z" />
                  </svg>
                </button>
              </div>

              {/* 底部"提示"入口（与语音模式行为一致）*/}
              <div className={styles.typeBottomRow}>
                <button
                  type="button"
                  className={`${styles.bulbBtn} ${hintOpen ? styles.bulbBtnOn : styles.bulbBtnOff}`}
                  onClick={() => setHintOpen(h => !h)}
                >
                  <span className={`${styles.bulbEmoji} ${!hintOpen ? styles.bulbEmojiIdle : ''}`}>💡</span>
                  <span>提示</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* 大麦克风按钮：三态切换 idle / recording / transcribing */}
              <div className={`${styles.micWrap} ${isRecording ? styles.micWrapRecording : ''}`}>
                <div className={styles.pulseRingOuter}>
                  <div className={styles.pulseRing} />
                  <div className={`${styles.pulseRing} ${styles.pulseRing2}`} />
                </div>
                <button
                  className={`${styles.micButton} ${isRecording ? styles.micButtonRecording : ''} ${isTranscribing ? styles.micButtonTranscribing : ''}`}
                  onClick={toggleRecording}
                  disabled={isSubmitting || isTranscribing}
                >
                  {isTranscribing ? (
                    /* 转写中：spinner */
                    <div className={styles.micSpinner} />
                  ) : isRecording ? (
                    /* 录音中：红色方块停止图标 */
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="#fff">
                      <rect x="6" y="6" width="12" height="12" rx="2" />
                    </svg>
                  ) : (
                    /* 静止：麦克风图标 */
                    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
                      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                      <line x1="12" y1="19" x2="12" y2="23" />
                      <line x1="8" y1="23" x2="16" y2="23" />
                    </svg>
                  )}
                </button>
                {/* 状态文字：录音中显示时长，转写中显示"识别中..." */}
                {isRecording && (
                  <div className={styles.recordDurationText}>
                    {Math.floor(recordDuration / 60)}:{String(recordDuration % 60).padStart(2, '0')}
                  </div>
                )}
                {isTranscribing && (
                  <div className={styles.transcribingText}>识别中…</div>
                )}
              </div>

              {/* 底部操作行 */}
              <div className={styles.speakBottomRow}>
                <button
                  className={styles.keyboardBtn}
                  onClick={() => setTypeMode(true)}
                  aria-label="切换到打字模式"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <rect x="2" y="4" width="20" height="16" rx="2" />
                    <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M8 16h8" />
                  </svg>
                </button>
                <button
                  className={`${styles.bulbBtn} ${hintOpen ? styles.bulbBtnOn : styles.bulbBtnOff}`}
                  onClick={() => setHintOpen(h => !h)}
                >
                  <span className={`${styles.bulbEmoji} ${!hintOpen ? styles.bulbEmojiIdle : ''}`}>💡</span>
                  <span>提示</span>
                </button>
              </div>
            </>
          )}
        </div>
        )}
        </>
      ) : (
        /* ── 非发言模式底部状态区 ── */
        <div className={styles.bottomStatus}>
          {isDone ? (
            <button
              className={styles.doneButton}
              disabled={isCompleting}
              onClick={(e) => {
                e.stopPropagation();
                if (!sessionData?.chatSessionId || isCompleting) return;
                // complete 已在 handleUserSubmit 里 await 完成，这里只跳转
                navigate(`/settlement/${sessionData.chatSessionId}`, { replace: true, state: { roomId } });
              }}
            >
              {isCompleting ? '正在结算中...' : '查看结算'}
            </button>
          ) : phase === 'dots' ? (
            <div className={styles.statusText}>
              {typingSource?.speakerName && <span style={{ color: typingSource.speakerColor, fontWeight: 600 }}>{typingSource.speakerName} </span>}
              正在输入...
            </div>
          ) : (phase === 'typing_en' || phase === 'typing_zh' || phase === 'typing_done') ? (
            <div className={styles.statusText}>
              {typingSource?.speakerName && <span style={{ color: typingSource.speakerColor, fontWeight: 600 }}>{typingSource.speakerName} </span>}
              正在说话...
            </div>
          ) : phase === 'wait_tap' ? (
            <button
              className={styles.tapContinueBtn}
              onClick={(e) => {
                e.stopPropagation();
                handleScreenTap();
              }}
            >
              点击继续
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}

// ===== @{username} 替换为带紫色高亮的 React 元素 =====
// 把文本中的 @{username} 占位符替换为用户花名，紫色高亮
function renderTextWithMention(text, userName) {
  if (!text || !text.includes('@{username}')) return text;
  const parts = text.split('@{username}');
  const result = [];
  parts.forEach((part, idx) => {
    if (part) result.push(part);
    // 最后一段后面不再插入 @
    if (idx < parts.length - 1) {
      result.push(
        <span
          key={`mention-${idx}`}
          style={{ color: '#7C5CBF', fontWeight: 600 }}
        >
          @{userName || 'you'}
        </span>
      );
    }
  });
  return result;
}

// ===== 单条消息气泡组件 =====
function MessageBubble({ msg, userName }) {
  if (msg.type === 'system') {
    return (
      <div className={`${styles.systemMessage} ${msg.isError ? styles.systemMessageError : ''}`}>
        <span>{msg.text}</span>
      </div>
    );
  }

  if (msg.type === 'user') {
    return (
      <div className={styles.userRow}>
        <div className={styles.userMeta}>
          <div className={styles.userSpeakerName}>你</div>
          <div className={styles.userBubble}>
            <div className={styles.userBubbleText}>{msg.en}</div>
          </div>
        </div>
      </div>
    );
  }

  if (msg.type === 'npc') {
    return (
      <div className={`${styles.npcRow}${msg.shake ? ` ${styles.npcRowShake}` : ''}`}>
        <div
          className={styles.npcAvatar}
          style={{ background: msg.speakerColor }}
        >
          {(msg.speakerName || msg.speaker || 'N')[0]}
        </div>
        <div className={styles.npcMeta}>
          <div
            className={styles.speakerName}
            style={{ color: msg.speakerColor }}
          >
            {msg.speakerName || msg.speaker}
          </div>
          <div className={styles.npcBubble}>
            {/* renderTextWithMention 把 @{username} 替换为紫色高亮的用户花名 */}
            <div className={styles.bubbleEn}>{renderTextWithMention(msg.en, userName)}</div>
            {msg.zh && <div className={styles.bubbleZh}>{renderTextWithMention(msg.zh, userName)}</div>}
            {/* 小喇叭 TTS 图标（可点击重听）*/}
            <div className={styles.ttsIconRow}>
              <TtsIconButton text={msg.en} voiceId={msg.voiceId} userName={userName} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

// ===== Task 8：Emoji 雨组件 =====
function EmojiRain({ onDone }) {
  const emojis = ['👏', '🎉', '🙌', '✨'];
  const count = 18 + Math.floor(Math.random() * 5); // 18-22 个
  const items = React.useMemo(() => {
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      emoji: emojis[Math.floor(Math.random() * emojis.length)],
      left: Math.random() * 100, // 随机 x 位置 (%)
      size: 18 + Math.random() * 14, // 18-32px
      duration: 1.8 + Math.random() * 1.2, // 1.8-3s
      delay: i * 0.1, // 每个间隔 100ms
      swayAmount: 15 + Math.random() * 20, // 左右摇摆幅度
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // 最长的动画完成后清理
    const maxTime = Math.max(...items.map(i => (i.delay + i.duration) * 1000));
    const timer = setTimeout(() => onDone(), maxTime + 200);
    return () => clearTimeout(timer);
  }, [items, onDone]);

  return (
    <div className={styles.emojiRainContainer}>
      {items.map(item => (
        <span
          key={item.id}
          className={styles.emojiRainItem}
          style={{
            left: `${item.left}%`,
            fontSize: `${item.size}px`,
            animationDuration: `${item.duration}s`,
            animationDelay: `${item.delay}s`,
            '--sway': `${item.swayAmount}px`,
          }}
        >
          {item.emoji}
        </span>
      ))}
    </div>
  );
}

// ===== 小喇叭 TTS 图标按钮 =====
function TtsIconButton({ text, voiceId, userName }) {
  const [playing, setPlaying] = useState(false);

  async function handleClick(e) {
    e.stopPropagation();
    if (playing || !text) return;
    setPlaying(true);
    await playTts(text, voiceId, userName);
    setPlaying(false);
  }

  return (
    <button
      className={styles.ttsIcon}
      onClick={handleClick}
      aria-label="重听"
      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={playing ? '#7C5CBF' : '#ccc'} strokeWidth="2" strokeLinecap="round">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
        <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      </svg>
    </button>
  );
}

export default ChatPage;
