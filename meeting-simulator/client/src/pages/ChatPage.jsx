import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import UserInput from '../components/UserInput.jsx';
import { joinChat, respondChat, completeChat, textToSpeech } from '../api/index.js';
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

function prefetchTts(text, voiceId) {
  if (!text) return;
  const key = `${text}|${voiceId || ''}`;
  if (ttsCache.has(key)) return;
  ttsCache.set(key, textToSpeech(text, 'en', voiceId).catch(() => null));
}

async function playTts(text, voiceId) {
  try {
    const key = `${text}|${voiceId || ''}`;
    const blobPromise = ttsCache.get(key) || textToSpeech(text, 'en', voiceId);
    ttsCache.delete(key);
    const audioBlob = await blobPromise;
    if (!audioBlob) return;
    return new Promise((resolve) => {
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audio.onended = () => { URL.revokeObjectURL(audioUrl); resolve(); };
      audio.onerror = () => { URL.revokeObjectURL(audioUrl); resolve(); };
      audio.play().catch(() => resolve());
    });
  } catch (err) {
    console.warn('[ChatPage] TTS 失败，静默跳过:', err.message);
  }
}

// 预加载脚本后续 N 条 NPC 消息的 TTS
function prefetchUpcoming(script, cursor, npcMap, count = 2) {
  let fetched = 0;
  for (let i = cursor; i < script.length && fetched < count; i++) {
    const t = script[i];
    if (t.type === 'npc') {
      const p = npcMap[t.speaker] || {};
      prefetchTts(t.text, p.voiceId);
      fetched++;
    }
  }
}

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

// ===== 打字机组件 =====
// 接收 text、speed（ms/字）、onDone 回调
function Typewriter({ text, speed, onDone, className }) {
  const [pos, setPos] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // text 变化时重置
    setPos(0);
    setDone(false);
    let i = 0;
    const iv = setInterval(() => {
      i++;
      setPos(i);
      if (i >= text.length) {
        clearInterval(iv);
        setDone(true);
      }
    }, speed);
    return () => clearInterval(iv);
  }, [text, speed]);

  // done 时通知父组件
  useEffect(() => {
    if (done && onDone) onDone();
  }, [done]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <span className={className}>
      {text.slice(0, pos)}
      {!done && <span className={styles.cursor}>|</span>}
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

  // ── 点击次数（区分首次和后续引导提示）──
  const [taps, setTaps] = useState(0);

  // ── 用户发言次数 ──
  const [userTurnCount, setUserTurnCount] = useState(0);

  // ── 发言模式：是否展示💡提示 ──
  const [hintOpen, setHintOpen] = useState(false);

  // ── 发言模式：已选中的立场 pill 索引 ──
  const [selectedHint, setSelectedHint] = useState(null);

  // ── 发言模式：是否切换到打字输入 ──
  const [typeMode, setTypeMode] = useState(false);

  // ── 发言模式：麦克风区收起状态 ──
  const [micCollapsed, setMicCollapsed] = useState(false);

  // ── 发言模式：拖拽过程中的 Y 偏移量（px）──
  const [micDragY, setMicDragY] = useState(0);

  // ── 拖拽起始 Y 坐标（ref，避免异步闭包问题）──
  const dragStartYRef = useRef(null);
  const isDraggingRef = useRef(false);

  // ── 用户提交防重复 ──
  const [isSubmitting, setIsSubmitting] = useState(false);

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

        // 如果有群公告，插入系统消息
        if (data.groupNotice) {
          setMessages([{
            id: 'notice',
            type: 'system',
            text: `📌 群公告：${data.groupNotice}`,
          }]);
        }

        setIsLoading(false);

        // 预加载前 2 条 NPC TTS
        prefetchUpcoming(data.dialogueScript, 0, nm, 2);

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
        prefetchTts(turn.text, profile.voiceId);
        prefetchUpcoming(script, i + 1, nm, 2);
        // dots 最少显示 800ms，同时等 TTS 预加载完成（取两者较长的）
        const dotsMinWait = sleep(800 + Math.random() * 300);
        const ttsCachePromise = ttsCache.get(ttsKey) || Promise.resolve(null);
        await Promise.all([dotsMinWait, ttsCachePromise]);
        if (!shouldContinueRef.current) break;

        // ── typing_en 阶段：TTS 已缓存，立即播放 ──
        setPhase('typing_en');
        const ttsPromise = playTts(turn.text, profile.voiceId);
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
          setTaps(t => t + 1);
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

        // ── 先播放 NPC 的 cue 话术（hint），让用户知道该回什么 ──
        if (turn.hint) {
          const cueProfile = nm[turn.speaker] || { name: turn.speaker, voiceId: null };
          const cueColor = getNpcColor(turn.speaker);

          // dots 阶段 + 预加载 TTS
          setPhase('dots');
          const cueKey = `${turn.hint}|${cueProfile.voiceId || ''}`;
          prefetchTts(turn.hint, cueProfile.voiceId);
          const cueDotsWait = sleep(800 + Math.random() * 300);
          const cueTtsCache = ttsCache.get(cueKey) || Promise.resolve(null);
          await Promise.all([cueDotsWait, cueTtsCache]);
          if (!shouldContinueRef.current) break;

          // 打字机 + TTS 同步播放
          // 临时设置 typingSource 数据（通过 curIdx 指向 user_cue 节点）
          setPhase('typing_en');
          const cueTtsPromise = playTts(turn.hint, cueProfile.voiceId);
          await waitForPhase('typing_zh');
          if (!shouldContinueRef.current) break;
          await waitForPhase('typing_done');
          if (!shouldContinueRef.current) break;
          await cueTtsPromise;
          if (!shouldContinueRef.current) break;

          // 推入历史消息
          appendMessage({
            id: `cue-${i}`,
            type: 'npc',
            speaker: turn.speaker,
            speakerName: cueProfile.name,
            speakerColor: cueColor,
            en: turn.hint,
            zh: turn.hintZh,
            voiceId: cueProfile.voiceId,
          });
        }

        // ── 进入发言模式 ──
        setPhase('mic');
        setHintOpen(false);
        setSelectedHint(null);
        setTypeMode(false);
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
    // 打字机完成，但 TTS 可能还在播 → 进 typing_done 阶段（气泡保持高亮）
    // 引擎会在 await ttsPromise 后再切到 wait_tap
    setPhase('typing_done');
  }, []);

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

      // 预缓存回复语音
      prefetchTts(result.npcReply.text, replyVoiceId);

      // dots → typing_en
      await sleep(600 + Math.random() * 300);
      if (!shouldContinueRef.current) return;

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
      });
      setPhase('typing_en');

      // 等打字机完成（等待 phase 变成 wait_tap）
      await waitForPhase('wait_tap');
      if (!shouldContinueRef.current) return;

      // 推入消息历史，清空 pendingNpcReply
      // 注意：不能在 setter 内部调用另一个 setter，需要先读值再分步更新
      const pendingMsg = {
        id: `npc-reply-${Date.now()}`,
        type: 'npc',
        speaker: result.npcReply.speaker,
        speakerName: replyProfile.name,
        speakerColor: replyColor,
        en: result.npcReply.text,
        zh: result.npcReply.textZh,
        voiceId: replyVoiceId,
      };
      setPendingNpcReply(null);
      appendMessage(pendingMsg);
      setPhase('wait_tap');

      // 播放 TTS
      playTts(result.npcReply.text, replyVoiceId);

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
        setPhase('done');
        await sleep(800);
        try {
          await completeChat(sessionData.chatSessionId);
          navigate(`/settlement/${sessionData.chatSessionId}`, { replace: true });
        } catch (err) {
          console.warn('[ChatPage] completeChat 失败:', err.message);
          appendMessage({
            id: `err-complete-${Date.now()}`,
            type: 'system',
            text: '结算失败，请稍后点击返回重试',
            isError: true,
          });
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
        setTaps(t => t + 1);
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
    // user_cue：用 hint/hintZh（NPC cue 用户的话术）
    if (s.type === 'user_cue' && s.hint) {
      const p = npcMapRef.current[s.speaker] || { name: s.speaker };
      return {
        speaker: s.speaker,
        speakerName: p.name,
        speakerColor: getNpcColor(s.speaker),
        en: s.hint,
        zh: s.hintZh,
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
  function handleDragStart(e) {
    e.stopPropagation();
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    dragStartYRef.current = clientY;
    isDraggingRef.current = true;
  }

  // ── 拖拽移动 ──
  function handleDragMove(e) {
    if (!isDraggingRef.current || dragStartYRef.current === null) return;
    e.stopPropagation();
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const delta = clientY - dragStartYRef.current;
    // 只允许往下拖（正值），负值不生效
    setMicDragY(delta > 0 ? delta : 0);
  }

  // ── 拖拽结束，判断是否超过阈值收起 ──
  function handleDragEnd(e) {
    if (!isDraggingRef.current) return;
    e.stopPropagation();
    isDraggingRef.current = false;
    dragStartYRef.current = null;

    if (micDragY > 80) {
      // 超过 80px 阈值：收起
      setMicCollapsed(true);
      setMicDragY(0);
    } else {
      // 未超过：弹回原位
      setMicDragY(0);
    }
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
    <div
      className={`${styles.container} ${phase === 'wait_tap' ? styles.containerTappable : ''}`}
      onClick={handleScreenTap}
    >
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
        {/* 已完成消息 */}
        {messages.map(msg => (
          <MessageBubble key={msg.id} msg={msg} />
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
          <div className={styles.npcRow}>
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
                {phase === 'typing_en' && (
                  <Typewriter
                    text={typingSource.en || ''}
                    speed={30}
                    onDone={onEnDone}
                    className={styles.bubbleEn}
                  />
                )}
                {(phase === 'typing_zh' || phase === 'typing_done') && (
                  <>
                    <div className={styles.bubbleEn}>{typingSource.en}</div>
                    {phase === 'typing_zh' ? (
                      <Typewriter
                        text={typingSource.zh || ''}
                        speed={25}
                        onDone={onZhDone}
                        className={styles.bubbleZh}
                      />
                    ) : (
                      <div className={styles.bubbleZh}>{typingSource.zh}</div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 滚动锚点 */}
        <div ref={messagesEndRef} />
      </div>

      {/* ===== 发言模式分割线（收起时隐藏）===== */}
      {isMicMode && !micCollapsed && <div className={styles.divider} />}

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
            // 拖拽中无 transition，松手后弹回/收起有动画
            transition: isDraggingRef.current ? 'none' : 'transform 0.3s ease',
          }}
          onClick={(e) => e.stopPropagation()}
          onTouchStart={handleDragStart}
          onTouchMove={handleDragMove}
          onTouchEnd={handleDragEnd}
          onMouseDown={handleDragStart}
          onMouseMove={handleDragMove}
          onMouseUp={handleDragEnd}
          onMouseLeave={handleDragEnd}
        >
          {/* 顶部拖拽把手 */}
          <div className={styles.dragHandle}>
            <div className={styles.dragHandleBar} />
          </div>
          {/* 💡提示展开区 */}
          {hintOpen && currentUserCue?.options && (
            <div className={styles.hintArea}>
              <div className={styles.hintPills}>
                {currentUserCue.options.map((opt, idx) => (
                  <button
                    key={idx}
                    className={`${styles.hintPill} ${selectedHint === idx ? styles.hintPillActive : ''}`}
                    onClick={() => setSelectedHint(selectedHint === idx ? null : idx)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {selectedHint !== null && currentUserCue.options[selectedHint] && (
                <div className={styles.exampleCard}>
                  <div className={styles.exampleText}>
                    {currentUserCue.options[selectedHint].example}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 打字输入模式 */}
          {typeMode ? (
            <div className={styles.typeInputArea}>
              <UserInput
                placeholder="用英语回复..."
                onSubmit={(text) => {
                  setTypeMode(false);
                  handleUserSubmit(text);
                }}
                disabled={isSubmitting}
              />
              <button
                className={styles.keyboardBtn}
                style={{ marginTop: 8, width: '100%', justifyContent: 'center' }}
                onClick={() => setTypeMode(false)}
              >
                切换回语音
              </button>
            </div>
          ) : (
            <>
              {/* 大麦克风按钮 */}
              <div className={styles.micWrap}>
                <div className={styles.pulseRingOuter}>
                  <div className={styles.pulseRing} />
                  <div className={`${styles.pulseRing} ${styles.pulseRing2}`} />
                </div>
                <button
                  className={styles.micButton}
                  onClick={() => {
                    // 暂时用第一个 example 作为发言内容（真实场景接 STT）
                    // 如果选了 hint pill，优先用 example，否则提示打字
                    if (selectedHint !== null && currentUserCue?.options?.[selectedHint]) {
                      handleUserSubmit(currentUserCue.options[selectedHint].example);
                    } else {
                      setTypeMode(true);
                    }
                  }}
                  disabled={isSubmitting}
                >
                  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="23" />
                    <line x1="8" y1="23" x2="16" y2="23" />
                  </svg>
                </button>
              </div>

              {/* 首次发言提示 */}
              {userTurnCount === 0 && (
                <div className={styles.firstHint}>支持母语混说哦</div>
              )}

              {/* 底部操作行 */}
              <div className={styles.speakBottomRow}>
                <button
                  className={styles.keyboardBtn}
                  onClick={() => setTypeMode(true)}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <rect x="2" y="4" width="20" height="16" rx="2" />
                    <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M8 16h8" />
                  </svg>
                  <span>打字</span>
                </button>
                <button
                  className={`${styles.bulbBtn} ${hintOpen ? styles.bulbBtnOn : styles.bulbBtnOff}`}
                  onClick={() => {
                    setHintOpen(h => !h);
                    if (hintOpen) setSelectedHint(null);
                  }}
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
              onClick={(e) => {
                e.stopPropagation();
                if (sessionData?.chatSessionId) {
                  completeChat(sessionData.chatSessionId).catch(() => {});
                  navigate(`/settlement/${sessionData.chatSessionId}`, { replace: true });
                }
              }}
            >
              查看结算
            </button>
          ) : phase === 'dots' ? (
            <div className={styles.statusText}>对方正在输入...</div>
          ) : (phase === 'typing_en' || phase === 'typing_zh' || phase === 'typing_done') ? (
            <div className={styles.statusText}>正在说话...</div>
          ) : phase === 'wait_tap' ? (
            <div>
              {/* 第一次：手指 + 水波纹 */}
              {taps === 0 && (
                <div className={styles.tapFirst}>
                  <div className={styles.tapGestureWrap}>
                    <div className={styles.tapRipple} />
                    <div className={styles.tapRipple2} />
                    <div className={styles.tapFinger}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2" />
                        <path d="M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v6" />
                        <path d="M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8" />
                        <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
                      </svg>
                    </div>
                  </div>
                </div>
              )}
              {/* 永远显示点击提示文字 */}
              <div className={styles.tapHintText}>点击屏幕继续</div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

// ===== 单条消息气泡组件 =====
function MessageBubble({ msg }) {
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
      <div className={styles.npcRow}>
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
            <div className={styles.bubbleEn}>{msg.en}</div>
            {msg.zh && <div className={styles.bubbleZh}>{msg.zh}</div>}
            {/* 小喇叭 TTS 图标（可点击重听）*/}
            <div className={styles.ttsIconRow}>
              <TtsIconButton text={msg.en} voiceId={msg.voiceId} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

// ===== 小喇叭 TTS 图标按钮 =====
function TtsIconButton({ text, voiceId }) {
  const [playing, setPlaying] = useState(false);

  async function handleClick(e) {
    e.stopPropagation();
    if (playing || !text) return;
    setPlaying(true);
    await playTts(text, voiceId);
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
