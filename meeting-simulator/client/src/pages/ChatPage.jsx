import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import UserInput from '../components/UserInput.jsx';
import TtsButton from '../components/TtsButton.jsx';
import { joinChat, respondChat, completeChat, textToSpeech } from '../api/index.js';
import styles from './ChatPage.module.css';

// 头像颜色池
const AVATAR_COLORS = [
  'linear-gradient(135deg, #4F46E5 0%, #818CF8 100%)',
  'linear-gradient(135deg, #14B8A6 0%, #0D9488 100%)',
  'linear-gradient(135deg, #F97316 0%, #EA580C 100%)',
  'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)',
];

// 根据名字哈希取颜色（保证同名字颜色一致）
function getAvatarColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// ── TTS 预加载缓存：key = "text|voiceId"，value = Promise<Blob> ──
const ttsCache = new Map();

// 预请求 TTS（不播放，只缓存 Promise）
function prefetchTts(text, voiceId) {
  if (!text) return;
  const key = `${text}|${voiceId || ''}`;
  if (ttsCache.has(key)) return; // 已在缓存中
  ttsCache.set(key, textToSpeech(text, 'en', voiceId).catch(() => null));
}

// 播放 TTS：优先从缓存取，缓存未命中则实时请求
async function playTts(text, voiceId) {
  try {
    const key = `${text}|${voiceId || ''}`;
    // 从缓存取或实时请求
    const blobPromise = ttsCache.get(key) || textToSpeech(text, 'en', voiceId);
    ttsCache.delete(key); // 用完即删，释放内存
    const audioBlob = await blobPromise;
    if (!audioBlob) return; // 后端未配置 TTS，静默跳过
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

// 预加载脚本中接下来 N 条 NPC/user_cue 消息的 TTS
function prefetchUpcoming(script, cursor, npcMap, count = 2) {
  let fetched = 0;
  for (let i = cursor; i < script.length && fetched < count; i++) {
    const t = script[i];
    if (t.type === 'npc') {
      const p = npcMap[t.speaker] || {};
      prefetchTts(t.text, p.voiceId);
      fetched++;
    } else if (t.type === 'user_cue') {
      const p = npcMap[t.speaker] || {};
      prefetchTts(t.hint, p.voiceId);
      fetched++;
    }
  }
}

// 睡眠工具函数
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

function ChatPage() {
  const navigate = useNavigate();
  const { roomId } = useParams();
  const { state, updateState } = useApp();

  // ── UI 状态 ──
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);       // NPC 输入中指示
  const [typingName, setTypingName] = useState('');      // 显示哪个 NPC 在输入
  const [typingColor, setTypingColor] = useState('');    // typing 头像颜色
  const [isInputActive, setIsInputActive] = useState(false); // 是否激活用户输入区
  const [userTurnCount, setUserTurnCount] = useState(0); // 用户已发言次数（本地副本）
  const [isSubmitting, setIsSubmitting] = useState(false); // 用户提交中，防重复发送
  const [pageError, setPageError] = useState(null);      // joinChat 失败错误信息
  const [isLoading, setIsLoading] = useState(true);      // joinChat 加载中

  // ── 会话数据（从 joinChat 获取）──
  const [sessionData, setSessionData] = useState(null);

  // ── refs（不触发 re-render，用于在回调中读最新值）──
  const chatProgressRef = useRef(0);         // 脚本播放光标（ref 版本，不进 re-render 循环）
  const isPlayingRef = useRef(false);        // 是否正在自动播放（防止并发）
  const shouldContinueRef = useRef(true);    // 组件卸载时停止播放
  const messagesEndRef = useRef(null);

  // 新消息自动滚到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // ── 初始化：调用 joinChat API ──
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
        // 将会话数据同步到 AppContext（供结算页等使用）
        updateState({
          currentRoomId: roomId,
          currentChatSessionId: data.chatSessionId,
          chatDialogueScript: data.dialogueScript,
          chatProgress: 0,
          userTurnCount: 0,
        });

        // 如果有群公告，插入一条特殊系统消息
        if (data.groupNotice) {
          setMessages([{
            id: 'notice',
            type: 'system',
            text: `📌 群公告：${data.groupNotice}`,
          }]);
        }

        setIsLoading(false);
        // 开始自动播放脚本
        shouldContinueRef.current = true;
        startScriptPlayback(data.dialogueScript, data.npcProfiles, data.chatSessionId);
      } catch (err) {
        if (cancelled) return;
        console.error('[ChatPage] joinChat 失败:', err);
        setPageError(`加入群聊失败：${err.message}`);
        setIsLoading(false);
      }
    }

    init();

    // 组件卸载时停止自动播放
    return () => {
      cancelled = true;
      shouldContinueRef.current = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  // ── 自动播放脚本引擎 ──
  // 注意：此函数通过 shouldContinueRef 感知组件卸载，不能用 state 直接控制（闭包陷阱）
  async function startScriptPlayback(script, npcProfiles, chatSessionId) {
    if (isPlayingRef.current) return; // 防止并发
    isPlayingRef.current = true;

    // 构建 npcId → profile 的映射，方便查 voiceId 和 name
    const npcMap = {};
    (npcProfiles || []).forEach(p => { npcMap[p.id] = p; });

    // 进入播放前，先预加载前 2 条 NPC 消息的 TTS
    prefetchUpcoming(script, chatProgressRef.current, npcMap, 2);

    while (chatProgressRef.current < script.length && shouldContinueRef.current) {
      const turn = script[chatProgressRef.current];

      if (turn.type === 'system') {
        // 系统消息：直接渲染，停顿 500ms
        appendMessage({
          id: `sys-${chatProgressRef.current}`,
          type: 'system',
          text: turn.text,
        });
        chatProgressRef.current += 1;
        await sleep(500);

      } else if (turn.type === 'npc') {
        // NPC 消息：先显示 typing，同时预加载后续 TTS
        const profile = npcMap[turn.speaker] || { name: turn.speaker, voiceId: null };
        showTyping(profile.name, getAvatarColor(profile.name));
        // typing 等待期间预加载下 2 条消息的 TTS（当前这条已在上轮/初始时预加载）
        prefetchUpcoming(script, chatProgressRef.current + 1, npcMap, 2);
        await sleep(600 + Math.random() * 300);
        if (!shouldContinueRef.current) break;

        hideTyping();
        const msgId = `npc-${chatProgressRef.current}`;
        appendMessage({
          id: msgId,
          type: 'npc',
          speaker: turn.speaker,
          speakerName: profile.name,
          text: turn.text,
          textZh: turn.textZh,
          voiceId: profile.voiceId,
        });
        chatProgressRef.current += 1;

        // TTS 播放（从缓存取，已预加载，几乎无延迟）
        await playTts(turn.text, profile.voiceId);
        if (!shouldContinueRef.current) break;
        await sleep(800);

      } else if (turn.type === 'user_cue') {
        // user_cue：先渲染 NPC 的 cue 气泡，播放 TTS，然后暂停等用户输入
        const profile = npcMap[turn.speaker] || { name: turn.speaker, voiceId: null };
        showTyping(profile.name, getAvatarColor(profile.name));
        await sleep(600 + Math.random() * 300);
        if (!shouldContinueRef.current) break;

        hideTyping();
        appendMessage({
          id: `cue-${chatProgressRef.current}`,
          type: 'user_cue',
          speaker: turn.speaker,
          speakerName: profile.name,
          text: turn.hint,
          textZh: turn.hintZh,
          voiceId: profile.voiceId,
        });
        chatProgressRef.current += 1;

        // 播放 cue 的 TTS（从缓存取）
        await playTts(turn.hint, profile.voiceId);
        if (!shouldContinueRef.current) break;

        // 暂停自动播放，激活用户输入
        isPlayingRef.current = false;
        setIsInputActive(true);
        return; // 退出循环，等用户输入后再调 resumeAfterUserTurn

      } else {
        // 未知类型，跳过
        chatProgressRef.current += 1;
      }
    }

    isPlayingRef.current = false;
  }

  // ── 添加消息到列表（用函数形式避免闭包里的 stale state）──
  function appendMessage(msg) {
    setMessages(prev => [...prev, msg]);
  }

  // ── 显示/隐藏 typing indicator ──
  function showTyping(name, color) {
    setTypingName(name);
    setTypingColor(color);
    setIsTyping(true);
  }

  function hideTyping() {
    setIsTyping(false);
  }

  // ── 用户发言处理 ──
  const handleUserSubmit = useCallback(async (text) => {
    if (isSubmitting || !sessionData) return;
    setIsSubmitting(true);
    setIsInputActive(false);

    const currentTurnCount = userTurnCount + 1;

    // 渲染用户消息气泡
    appendMessage({
      id: `user-${Date.now()}`,
      type: 'user',
      text,
    });

    // 显示 NPC 输入中
    showTyping('NPC', AVATAR_COLORS[0]);

    try {
      const result = await respondChat(sessionData.chatSessionId, currentTurnCount, text);

      hideTyping();

      // 渲染 NPC 回复
      const npcMap = {};
      (sessionData.npcProfiles || []).forEach(p => { npcMap[p.id] = p; });
      const replyProfile = npcMap[result.npcReply.speaker] || { name: result.npcReply.speaker };

      // NPC 回复可能带自己的 voiceId（来自后端），优先使用
      const replyVoiceId = result.npcReply.voiceId || replyProfile.voiceId;

      // 先显示 typing，再渲染气泡
      showTyping(replyProfile.name, getAvatarColor(replyProfile.name));
      await sleep(700);
      hideTyping();

      appendMessage({
        id: `npc-reply-${Date.now()}`,
        type: 'npc',
        speaker: result.npcReply.speaker,
        speakerName: replyProfile.name,
        text: result.npcReply.text,
        textZh: result.npcReply.textZh,
        voiceId: replyVoiceId,
      });

      // 更新发言次数
      setUserTurnCount(currentTurnCount);
      updateState({ userTurnCount: currentTurnCount });

      // TTS 播放 NPC 回复
      await playTts(result.npcReply.text, replyVoiceId);

      if (!shouldContinueRef.current) return;

      if (result.isLastTurn) {
        // 最后一次发言：等 1.5s 后 complete + 跳结算页
        await sleep(1500);
        if (!shouldContinueRef.current) return;
        try {
          await completeChat(sessionData.chatSessionId);
          navigate(`/settlement/${sessionData.chatSessionId}`, { replace: true });
        } catch (err) {
          console.warn('[ChatPage] completeChat 失败:', err.message);
          // complete 失败不跳结算，提示用户重试
          appendMessage({
            id: `err-complete-${Date.now()}`,
            type: 'system',
            text: '结算失败，请稍后点击返回重试',
            isError: true,
          });
        }
      } else {
        // 继续播放剩余预制脚本
        await sleep(500);
        if (!shouldContinueRef.current) return;
        startScriptPlayback(
          sessionData.dialogueScript,
          sessionData.npcProfiles,
          sessionData.chatSessionId
        );
      }
    } catch (err) {
      console.error('[ChatPage] respondChat 失败:', err);
      hideTyping();
      // 失败提示：用系统消息展示，不消耗 turnIndex
      appendMessage({
        id: `err-${Date.now()}`,
        type: 'system',
        text: '发送失败，请重试',
        isError: true,
      });
      // 重新激活输入区（不消耗这次 turn）
      setIsInputActive(true);
    } finally {
      setIsSubmitting(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSubmitting, sessionData, userTurnCount, navigate]);

  // ── 计算群名和成员数 ──
  const groupName = sessionData?.groupName || '群聊加载中...';
  const memberCount = sessionData ? (sessionData.npcProfiles?.length || 0) + 1 : 0;

  // ── 加载中 / 错误状态 ──
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

  // ── 正常渲染 ──
  return (
    <div className={styles.container}>
      {/* 顶部栏 */}
      <header className={styles.header}>
        <button
          className={styles.backButton}
          onClick={() => {
            // 中途退出时静默 force complete（不阻塞导航）
            if (sessionData?.chatSessionId) {
              completeChat(sessionData.chatSessionId, true).catch(() => {});
            }
            navigate('/feed');
          }}
          aria-label="返回"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M19 12H5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M12 19L5 12L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className={styles.headerCenter}>
          <h1 className={styles.groupName}>{groupName}</h1>
          {memberCount > 0 && (
            <span className={styles.memberCount}>{memberCount} 位成员</span>
          )}
        </div>
        <div className={styles.headerRight} />
      </header>

      {/* 消息列表区 */}
      <div className={styles.messageList}>
        {messages.map(msg => (
          <MessageItem
            key={msg.id}
            msg={msg}
            userName={state.userName || '我'}
          />
        ))}

        {/* NPC 正在输入指示器 */}
        {isTyping && (
          <div className={styles.typingIndicator}>
            <div
              className={styles.typingAvatar}
              style={{ background: typingColor || AVATAR_COLORS[0] }}
            >
              {typingName?.[0] || 'N'}
            </div>
            <div className={styles.typingBubble}>
              <span className={styles.typingDot} />
              <span className={styles.typingDot} />
              <span className={styles.typingDot} />
            </div>
          </div>
        )}

        {/* 滚动锚点 */}
        <div ref={messagesEndRef} />
      </div>

      {/* 底部区域：输入中 or 用户输入框 */}
      {isInputActive ? (
        <div className={styles.inputArea}>
          {/* 发言次数提示 */}
          <div className={styles.turnHint}>
            第 {userTurnCount + 1} / 3 次发言
          </div>
          <UserInput
            placeholder="用英语回复..."
            onSubmit={handleUserSubmit}
            disabled={isSubmitting}
          />
        </div>
      ) : (
        !isTyping && !isLoading && (
          <div className={styles.waitingArea}>
            <span className={styles.waitingText}>NPC 正在讨论中...</span>
          </div>
        )
      )}
    </div>
  );
}

// ── 单条消息组件 ──
function MessageItem({ msg, userName }) {
  if (msg.type === 'system') {
    return (
      <div className={`${styles.systemMessage} ${msg.isError ? styles.systemMessageError : ''}`}>
        <span>{msg.text}</span>
      </div>
    );
  }

  if (msg.type === 'user') {
    return (
      <div className={`${styles.messageRow} ${styles.messageRowUser}`}>
        <div className={styles.userBubble}>
          <p className={styles.bubbleText}>{msg.text}</p>
        </div>
        <div className={styles.userAvatar} aria-label={userName}>
          {(userName || '我')[0]}
        </div>
      </div>
    );
  }

  if (msg.type === 'npc' || msg.type === 'user_cue') {
    return (
      <div className={styles.messageRow}>
        <div
          className={styles.npcAvatar}
          style={{ background: getAvatarColor(msg.speakerName || msg.speaker) }}
          aria-label={msg.speakerName || msg.speaker}
        >
          {(msg.speakerName || msg.speaker || 'N')[0]}
        </div>
        <div className={styles.npcBubble}>
          <span className={styles.speakerName}>{msg.speakerName || msg.speaker}</span>
          <p className={styles.bubbleText}>{msg.text}</p>
          {msg.textZh && (
            <p className={styles.bubbleTextZh}>{msg.textZh}</p>
          )}
          {/* user_cue 节点额外显示"轮到你了"提示 */}
          {msg.type === 'user_cue' && (
            <p className={styles.cueTip}>轮到你了 →</p>
          )}
          {/* 手动重听按钮 */}
          {msg.voiceId && (
            <div className={styles.ttsButtonWrapper}>
              <TtsButton text={msg.text} language="en" voiceId={msg.voiceId} />
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}

export default ChatPage;
