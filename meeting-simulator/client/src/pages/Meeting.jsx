import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { respondToNode, completeMeeting, textToSpeech } from '../api/index.js';
import UserInput from '../components/UserInput.jsx';
import Reference from '../components/Reference.jsx';
import BriefingCard from '../components/BriefingCard.jsx';
import TtsButton from '../components/TtsButton.jsx';
import styles from './Meeting.module.css';

// 导入 chatscope 样式和组件
import '@chatscope/chat-ui-kit-styles/dist/default/styles.min.css';
import {
  MainContainer,
  ChatContainer,
  MessageList,
  Message,
  MessageSeparator,
  TypingIndicator,
} from '@chatscope/chat-ui-kit-react';

/**
 * 第一层：processDialogue — 纯裁剪函数
 *
 * 职责：只做一件事——裁剪多余的 NPC 对话
 * 规则：两个 keyNode 之间，AI 对话（非 narrator、非 keyNode）最多保留 3 条
 * 不做：narrator 注入、位置校验、keyNode prompt 修正
 *
 * @param {Array} dialogue - 后端原始对话数组
 * @returns {Array} 裁剪后的对话数组
 */
function processDialogue(dialogue) {
  if (!dialogue || dialogue.length === 0) return [];

  const result = [];
  // 当前段（两个 keyNode 之间）已累计的 NPC 对话数
  let npcInSegment = 0;

  for (let i = 0; i < dialogue.length; i++) {
    const msg = dialogue[i];

    if (msg.isKeyNode) {
      // keyNode 是段分隔符：重置计数，保留
      npcInSegment = 0;
      result.push(msg);
      continue;
    }

    if (msg.speaker === 'narrator') {
      // 后端自带的 narrator：保留，不校验位置（由运行时控制器处理）
      result.push(msg);
      continue;
    }

    // 普通 NPC 对话：超过 3 条上限则丢弃
    if (npcInSegment >= 3) continue;
    npcInSegment++;
    result.push(msg);
  }

  return result;
}

/**
 * 辅助函数：从消息数组末尾向前找最近 count 个不同 NPC 名字
 * 跳过 narrator、用户消息、系统消息和 keyNode
 *
 * @param {Array} messages - 已显示的消息数组
 * @param {number} count - 要找的名字数量
 * @returns {Array<string>} 最近的 NPC 名字数组（按时间顺序，最新的在后）
 */
function findRecentNpcNames(messages, count) {
  const names = [];
  for (let i = messages.length - 1; i >= 0 && names.length < count; i--) {
    const m = messages[i];
    // 只取 NPC 消息（有 speaker、非 narrator、非用户、非系统、非 keyNode）
    if (m.speaker && m.speaker !== 'narrator' && !m.isKeyNode && !m.isUser && !m.isSystem) {
      const firstName = m.speaker.split(' ')[0];
      // 去重：同一个名字只记录一次
      if (!names.includes(firstName)) {
        names.unshift(firstName); // unshift 保证时间顺序（最旧在前）
      }
    }
  }
  return names;
}

/**
 * ElevenLabs 音色 ID 映射
 * 根据角色 gender + type 分配对应音色
 */
const VOICE_IDS = {
  maleLeaderChallenger: 'XDbDbPfT1aN6oA1pIwp7',   // David：成熟男声
  maleOther: 'pryQZVlVLGYIhlqSYsGW',               // Ray：年轻男声（默认 fallback）
  femaleLeaderChallenger: 'Xv0dcEcXkcJWrXSQREue',  // Natasia：成熟女声
  femaleOther: 'XiPS9cXxAVbaIWtGDHDh',             // Brittney：年轻女声
};

/**
 * 根据角色 gender + type 分配 ElevenLabs 音色 ID
 * gender 缺失时默认视为 male（大多数 NPC 是男性名字）
 * @param {object|null} role - roles 数组中匹配到的角色对象
 * @returns {string} ElevenLabs voice_id
 */
function getVoiceId(role) {
  if (!role) return VOICE_IDS.maleOther;
  const gender = role.gender || 'male';
  const type = role.type || role.roleType || '';
  const isLeaderOrChallenger = type === 'leader' || type === 'challenger';
  if (gender === 'female') {
    return isLeaderOrChallenger ? VOICE_IDS.femaleLeaderChallenger : VOICE_IDS.femaleOther;
  }
  return isLeaderOrChallenger ? VOICE_IDS.maleLeaderChallenger : VOICE_IDS.maleOther;
}

// 角色颜色映射
const ROLE_COLORS = {
  leader: 'var(--role-leader)',
  collaborator: 'var(--role-collaborator)',
  challenger: 'var(--role-challenger)',
  supporter: 'var(--role-supporter)',
};

/**
 * 根据 speaker 字段从 roles 数组中查找匹配的角色。
 * AI 生成的 speaker 可能是中文名或英文名，需要兜底匹配。
 * 匹配优先级：中文名精确 → 英文名精确 → 中文名模糊 → 英文名模糊
 *
 * @param {Array} roles - 角色列表
 * @param {string} speaker - AI 生成的发言者标识
 * @returns {object|null} 匹配到的 role 对象，或 null
 */
function findRoleBySpeaker(roles, speaker) {
  if (!roles || !speaker) return null;
  // 精确匹配中文名
  let found = roles.find(r => r.name === speaker);
  if (found) return found;
  // 精确匹配英文名（nameEn 字段可能不存在）
  found = roles.find(r => r.nameEn && r.nameEn === speaker);
  if (found) return found;
  // 模糊匹配中文名：speaker 包含 name，或 name 包含 speaker
  found = roles.find(r => r.name && (r.name.includes(speaker) || speaker.includes(r.name)));
  if (found) return found;
  // 模糊匹配英文名（不区分大小写）
  found = roles.find(r => r.nameEn && (
    r.nameEn.toLowerCase().includes(speaker.toLowerCase()) ||
    speaker.toLowerCase().includes(r.nameEn.toLowerCase())
  ));
  return found || null;
}

/**
 * 根据角色名称从 roles 数组中查找对应颜色
 * @param {string} speaker - 发言者名称
 * @param {Array} roles - 角色列表（后端返回 roles 字段）
 * @returns {string} CSS 颜色变量
 */
function getRoleColor(speaker, roles) {
  if (!speaker || !roles || !Array.isArray(roles)) return 'var(--role-collaborator)';
  const role = findRoleBySpeaker(roles, speaker);
  return ROLE_COLORS[role?.type] || ROLE_COLORS[role?.roleType] || 'var(--role-collaborator)';
}

/**
 * 根据角色名称从 roles 数组中查找职位 title
 * @param {string} speaker - 发言者名称
 * @param {Array} roles - 角色列表
 * @returns {string|undefined} 职位名称
 */
function getRoleTitle(speaker, roles) {
  if (!speaker || !roles || !Array.isArray(roles)) return undefined;
  const role = findRoleBySpeaker(roles, speaker);
  return role?.title;
}

// stance（立场）标签映射
const STANCE_LABELS = {
  ally: { text: '盟友', color: '#16A34A', bg: 'rgba(22, 163, 74, 0.10)' },
  neutral: { text: '中立', color: '#64748B', bg: 'rgba(100, 116, 139, 0.10)' },
  pressure: { text: '施压者', color: '#EA580C', bg: 'rgba(234, 88, 12, 0.10)' },
};

// type（角色类型）标签映射
const TYPE_LABELS = {
  leader: { text: '主导者', color: '#4F46E5', bg: 'rgba(79, 70, 229, 0.10)' },
  collaborator: { text: '协作者', color: '#0284C7', bg: 'rgba(2, 132, 199, 0.10)' },
  challenger: { text: '挑战者', color: '#DC2626', bg: 'rgba(220, 38, 38, 0.10)' },
  supporter: { text: '支持者', color: '#059669', bg: 'rgba(5, 150, 105, 0.10)' },
};


/**
 * 角色信息 Popover 气泡
 * 点击 NPC 角色名后在屏幕中央弹出小卡片，信息精简为 3 行：
 *   行1：名字 · 职位
 *   行2：立场 + 类型标签胶囊
 *   行3：briefNote 简短描述
 */
function RoleInfoCard({ role, onClose }) {
  if (!role) return null;
  const stanceInfo = STANCE_LABELS[role.stance];
  const typeInfo = TYPE_LABELS[role.type] || TYPE_LABELS[role.roleType];

  return (
    /* 半透明遮罩：点击关闭，比之前更淡 */
    <div className={styles.rolePopoverOverlay} onClick={onClose}>
      {/* 气泡卡片：阻止冒泡，防止点击内容区意外关闭 */}
      <div className={styles.rolePopover} onClick={e => e.stopPropagation()}>

        {/* 行1：名字 · 职位 */}
        <div className={styles.rolePopoverName}>
          {role.name}
          {role.title && (
            <span className={styles.rolePopoverTitle}> · {role.title}</span>
          )}
        </div>

        {/* 行2：立场 + 类型标签胶囊 */}
        {(stanceInfo || typeInfo) && (
          <div className={styles.rolePopoverTags}>
            {stanceInfo && (
              <span
                className={styles.rolePopoverTag}
                style={{ color: stanceInfo.color, background: stanceInfo.bg }}
              >
                {stanceInfo.text}
              </span>
            )}
            {typeInfo && (
              <span
                className={styles.rolePopoverTag}
                style={{ color: typeInfo.color, background: typeInfo.bg }}
              >
                {typeInfo.text}
              </span>
            )}
          </div>
        )}

        {/* 行3：简短描述，斜体引号包裹 */}
        {role.briefNote && (
          <p className={styles.rolePopoverNote}>"{role.briefNote}"</p>
        )}
      </div>
    </div>
  );
}

/**
 * 打字机效果组件：文字逐字出现，模拟 AI 流式输出感
 * @param {string} text - 要显示的文字
 * @param {number} speed - 每个字的间隔（毫秒），默认 35
 * @param {function} onComplete - 全部显示完成后的回调
 */
function TypewriterText({ text, speed = 35, onComplete }) {
  const [displayedLength, setDisplayedLength] = useState(0);
  const completedRef = useRef(false);

  useEffect(() => {
    if (!text) return;
    // 每次 text 变化重置状态
    setDisplayedLength(0);
    completedRef.current = false;

    let i = 0;
    const timer = setInterval(() => {
      i++;
      setDisplayedLength(i);
      if (i >= text.length) {
        clearInterval(timer);
        if (!completedRef.current) {
          completedRef.current = true;
          onComplete?.();
        }
      }
    }, speed);

    return () => clearInterval(timer);
  }, [text, speed]);

  return <>{text.slice(0, displayedLength)}</>;
}

/**
 * 会中聊天流页面
 * 实现逐条播放 dialogue，遇到 isKeyNode 时暂停等待用户输入，
 * 用户提交后追加 responseDialogue，继续播放直到会议结束后跳转复盘
 */
function Meeting() {
  const navigate = useNavigate();
  const { state, addConversation } = useApp();
  const { showError } = useToast();

  const { meetingData, meetingId, sceneType } = state;

  // 脑洞模式标识
  // 双重判断：state.sceneType 或 meetingData.sceneType（兼容旧 localStorage 缺少 sceneType 的情况）
  const isBrainstorm =
    (sceneType && (sceneType === 'brainstorm-pick' || sceneType === 'brainstorm-random')) ||
    (meetingData?.sceneType && meetingData.sceneType.startsWith('brainstorm'));
  // 脑洞模式下用角色头衔简称来称呼用户，否则用花名
  const displayUserName = isBrainstorm
    ? (meetingData?.userRole?.title || state.userName || '英雄')
    : (state.userName || 'You');

  // 已显示的消息列表
  const [displayedMessages, setDisplayedMessages] = useState([]);
  // 当前正在播放到 dialogue 的哪个索引
  const [currentDialogueIndex, setCurrentDialogueIndex] = useState(0);
  // 当前活跃节点索引（null 表示不在关键节点等待中）
  const [activeNodeIndex, setActiveNodeIndex] = useState(null);
  // 是否显示用户输入区
  const [showInput, setShowInput] = useState(false);
  // 是否正在等待 API 响应
  const [isWaiting, setIsWaiting] = useState(false);
  // 当前正在"输入中"的角色（null 表示无），用于自定义 typing indicator
  const [typingRole, setTypingRole] = useState(null);
  // Briefing 抽屉开关
  const [showBriefing, setShowBriefing] = useState(false);
  // 当前展示的角色信息卡（null 表示关闭）
  const [activeRoleCard, setActiveRoleCard] = useState(null);
  // 是否显示中文翻译（默认开启）
  const [showTranslation, setShowTranslation] = useState(true);
  // 已完成的节点索引集合
  const [completedNodes, setCompletedNodes] = useState(new Set());
  // 已失败的节点索引集合（invalid 第 2 次后标记失败）
  const [failedNodes, setFailedNodes] = useState(new Set());
  // 会议结束后是否显示"查看复盘"按钮
  const [showEndButton, setShowEndButton] = useState(false);
  // 已完成打字机效果的消息 ID 集合（避免 re-render 时重复播放）
  const [typewriterDoneIds, setTypewriterDoneIds] = useState(new Set());
  // 是否已触发会议结束流程（防止重复触发）
  const meetingEndedRef = useRef(false);
  // 用 ref 保存显示用名（脑洞模式用角色头衔，正经开会用花名），供 playDialogueFrom 闭包读取最新值
  const userNameRef = useRef(displayUserName);
  // 聊天流底部锚点
  const bottomRef = useRef(null);
  // 播放定时器
  const playTimerRef = useRef(null);
  // 标记是否已启动过播放（解决 StrictMode 双重 effect 问题）
  const hasStartedRef = useRef(false);
  // TTS 音频播放队列：每个元素为 { text, voiceId }
  const audioQueueRef = useRef([]);
  // 当前正在播放的 Audio 对象（用于中断）
  const currentAudioRef = useRef(null);
  // 是否正在播放音频（防止队列并发处理）
  const isPlayingAudioRef = useRef(false);
  // 第二层控制器所需的段计数 ref（用户发言时归零）
  // segmentNpcCountRef：当前段（两次用户发言之间）已播放的 NPC 消息数，上限 3
  const segmentNpcCountRef = useRef(0);
  // segmentHasNarratorRef：当前段是否已播放过 narrator（含后端自带 + 前端注入）
  const segmentHasNarratorRef = useRef(false);
  // 当前节点的重试次数（0=首次，1=第二次）；遇到新节点时重置
  const retryCountRef = useRef(0);
  // 是否显示"用参考说法"按钮（invalid 第 1 次后显示）
  const [showReferenceButton, setShowReferenceButton] = useState(false);
  // 同步标志位：keyNode 后等待用户发言期间为 true，阻止任何 NPC 消息播放
  // 不依赖 React 异步 state，在 keyNode 分支中立即同步设置，杜绝时序问题
  const isWaitingForUserRef = useRef(false);
  // 同步追踪 dialogue 播放索引，供 handleSubmit 完成后恢复播放时读取
  // 避免在 React state updater 中执行副作用（Strict Mode 下 updater 可能被双重调用）
  const currentDialogueIndexRef = useRef(0);
  // 用 ref 存储 failedNodes，供 handleSubmit 闭包中读取最新值（避免闭包过时）
  const failedNodesRef = useRef(new Set());
  failedNodesRef.current = failedNodes;

  /**
   * 预处理 dialogue：只做裁剪（第一层）
   * narrator 注入和 keyNode prompt 生成均在运行时由 playDialogueFrom 负责（第二层）
   * useMemo 不再依赖 userName
   */
  const processedDialogue = useMemo(() => {
    if (!meetingData?.dialogue) return [];
    return processDialogue(meetingData.dialogue);
  }, [meetingData]);

  // 使用 ref 存储预处理后的 dialogue，供 useCallback 内部读取（避免闭包过时）
  const processedDialogueRef = useRef(null);
  processedDialogueRef.current = processedDialogue;

  // 每次渲染时同步 ref：脑洞模式用角色头衔，正经开会用花名
  userNameRef.current = displayUserName;
  const activeNodeIndexRef = useRef(activeNodeIndex);
  activeNodeIndexRef.current = activeNodeIndex;

  // 如果没有会议数据，延迟检查后跳转（避免 StrictMode 下首次 mount 时数据未同步导致误跳转）
  const noDataTimerRef = useRef(null);
  useEffect(() => {
    if (!meetingData) {
      noDataTimerRef.current = setTimeout(() => {
        if (!processedDialogueRef.current || processedDialogueRef.current.length === 0) {
          navigate('/');
        }
      }, 500);
    }
    return () => clearTimeout(noDataTimerRef.current);
  }, [meetingData, navigate]);

  /**
   * 立即停止当前音频播放，并清空待播队列
   * 在用户发言时调用，避免 NPC 音频继续干扰
   */
  const stopAndClearAudio = useCallback(() => {
    // 停止并销毁当前正在播放的 Audio 对象
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.src = '';
      currentAudioRef.current = null;
    }
    // 清空队列和播放状态
    audioQueueRef.current = [];
    isPlayingAudioRef.current = false;
  }, []);

  /**
   * 处理下一条待播音频（内部递归调用）
   * 从队列头取出一条，请求 TTS 并播放，播完继续处理下一条
   */
  const processAudioQueue = useCallback(async () => {
    // 队列为空或已有播放任务在跑，直接返回
    if (audioQueueRef.current.length === 0 || isPlayingAudioRef.current) return;

    isPlayingAudioRef.current = true;
    const { text, voiceId } = audioQueueRef.current.shift();

    try {
      const blob = await textToSpeech(text, 'en', voiceId);
      if (!blob) {
        // TTS 未配置（501），静默跳过，继续处理队列
        isPlayingAudioRef.current = false;
        processAudioQueue();
        return;
      }

      // 创建 Audio 对象并播放
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      currentAudioRef.current = audio;

      audio.onended = () => {
        URL.revokeObjectURL(url);
        currentAudioRef.current = null;
        isPlayingAudioRef.current = false;
        // 播放完毕，继续处理队列中的下一条
        processAudioQueue();
      };

      audio.onerror = () => {
        URL.revokeObjectURL(url);
        currentAudioRef.current = null;
        isPlayingAudioRef.current = false;
        processAudioQueue();
      };

      audio.play().catch(() => {
        // 浏览器自动播放策略拦截：静默失败，继续队列
        URL.revokeObjectURL(url);
        currentAudioRef.current = null;
        isPlayingAudioRef.current = false;
        processAudioQueue();
      });
    } catch (err) {
      // TTS 请求失败：静默跳过，不影响对话播放
      console.warn('[TTS] 音频请求失败，已跳过：', err.message);
      isPlayingAudioRef.current = false;
      processAudioQueue();
    }
  }, []);

  /**
   * 将一条 NPC 消息加入 TTS 播放队列
   * @param {string} text - NPC 消息文本（英文）
   * @param {string} voiceId - 对应的 ElevenLabs 音色 ID
   */
  const enqueueTts = useCallback((text, voiceId) => {
    if (!text || !text.trim()) return;
    audioQueueRef.current.push({ text: text.trim(), voiceId });
    // 若当前没有播放任务，触发处理
    processAudioQueue();
  }, [processAudioQueue]);

  /**
   * 会议结束处理：显示"会议结束"系统消息，2 秒后展示"查看会议复盘"按钮
   * 不再自动跳转，等待用户主动点击按钮
   */
  const handleMeetingEnd = useCallback(() => {
    setDisplayedMessages(prev => [
      ...prev,
      { type: 'system', text: '会议结束', isSystem: true, isNew: true }
    ]);
    // 2 秒后显示复盘 CTA 按钮，给用户一点缓冲时间
    setTimeout(() => setShowEndButton(true), 2000);
  }, []);

  /**
   * 会议因全部节点失败而被终止
   * 显示系统提示，2 秒后展示"查看复盘"按钮，跳转时附带 failed 标记
   */
  const handleMeetingFailed = useCallback(() => {
    if (meetingEndedRef.current) return;
    meetingEndedRef.current = true;
    setDisplayedMessages(prev => [
      ...prev,
      { type: 'system', text: '会议被终止了', isSystem: true, isNew: true }
    ]);
    // 2 秒后显示复盘 CTA，带 failed 标记
    setTimeout(() => setShowEndButton(true), 2000);
  }, []);

  /**
   * 用户点击"查看会议复盘"按钮后调用
   * 先 completeMeeting，再跳转复盘页
   * 若会议因全部节点失败被终止，跳转时附带 ?failed=1 参数
   */
  const handleGoToReview = async () => {
    try {
      await completeMeeting(meetingId);
    } catch (err) {
      console.error('完成会议失败:', err);
    }
    // 若已失败节点数 >= 3，携带 failed 标记
    const isFailed = failedNodesRef.current.size >= 3;
    navigate(isFailed ? '/review?failed=1' : '/review');
  };

  /**
   * 第二层：playDialogueFrom — 统一播放控制器
   *
   * 执行两条铁律：
   * 铁律 1：keyNode 出现后，下一条必须是用户发言（硬停，等待输入）
   * 铁律 2：两轮用户发言之间，NPC > 1 条时自动插入 1 条 narrator
   *
   * 通过 segmentNpcCountRef 和 segmentHasNarratorRef 跟踪当前段状态
   * 用户发言时两个 ref 归零，开始新的段计数
   */
  const playDialogueFrom = useCallback((startIndex) => {
    const dialogue = processedDialogueRef.current;

    // 播放完毕，触发会议结束
    if (!dialogue || startIndex >= dialogue.length) {
      if (!meetingEndedRef.current) {
        meetingEndedRef.current = true;
        handleMeetingEnd();
      }
      return;
    }

    const msg = dialogue[startIndex];

    // ——— 铁律 1：如果正在等待用户发言，任何消息都不播放 ———
    // 使用同步 ref 而非 React 异步 state，杜绝 setTimeout 回调中的时序竞态
    if (isWaitingForUserRef.current) return;

    // ——— keyNode 处理：延迟 1.2s 后出现，避免和最后一条 NPC 消息同时弹出 ———
    if (msg.isKeyNode) {
      // 先同步设置等待标志，阻止后续消息播放
      isWaitingForUserRef.current = true;

      setTimeout(() => {
      const nodeId = `node-${startIndex}`;

      // 通过函数形式访问最新的 displayedMessages，动态生成 prompt
      setDisplayedMessages(prev => {
        // 防重复：已渲染过则跳过
        if (prev.some(m => m.id === nodeId)) return prev;

        // 从已显示消息中向前找最近 2 个不同 NPC 名字
        const recentNames = findRecentNpcNames(prev, 2);

        // 拼装情境化 prompt
        const actionGoal = msg.actionGoal || msg.prompt || '';
        const currentUserName = userNameRef.current;
        const userNamePart = currentUserName ? `，${currentUserName}` : '';
        let dynamicPrompt;
        // 脑洞模式不需要"XX 聊完了"过渡语，直接出任务
        const isBrainstormMode = sceneType && sceneType.startsWith('brainstorm');
        if (isBrainstormMode) {
          dynamicPrompt = actionGoal || msg.prompt;
        } else if (recentNames.length >= 2) {
          dynamicPrompt = `${recentNames[0]} 和 ${recentNames[1]} 聊完了${userNamePart}，该你了——${actionGoal}`;
        } else if (recentNames.length === 1) {
          dynamicPrompt = `${recentNames[0]} 说完了${userNamePart}，该你了——${actionGoal}`;
        } else {
          dynamicPrompt = msg.prompt || actionGoal;
        }

        return [...prev, { ...msg, id: nodeId, prompt: dynamicPrompt, isNew: true, _displayType: 'node_prompt' }];
      });

      currentDialogueIndexRef.current = startIndex + 1;
      setCurrentDialogueIndex(startIndex + 1);
      setActiveNodeIndex(msg.nodeIndex);

      // 输入框延迟出现：等 keynote 整体入场(600ms) + 等待(500ms) + 选项动画完成 + 等待(400ms)
      // 选项间隔 600ms，动画 800ms：1100 + 3×600 + 800 + 400 = 4100ms
      setTimeout(() => setShowInput(true), 4100);
      }, 1000); // keyNode 延迟 1s 出现（打字机完成后等待）

      return; // 铁律 1：硬停
    }

    // ——— 后端 narrator 处理 ———
    if (msg.speaker === 'narrator') {
      // 向前扫描：找到下一条实际会播放的消息（跳过会被 NPC 上限裁掉的消息）
      // 如果下一条实际播放的是 keyNode，跳过这条 narrator（防止紫橙紧挨）
      let nextPlayable = null;
      for (let j = startIndex + 1; j < dialogue.length; j++) {
        const candidate = dialogue[j];
        if (candidate.isKeyNode || candidate.speaker === 'narrator') {
          nextPlayable = candidate;
          break;
        }
        // 普通 NPC：如果还有配额就是下一条实际播放的
        if (segmentNpcCountRef.current < 3) {
          nextPlayable = candidate;
          break;
        }
        // NPC 配额已满，这条会被跳过，继续找
      }
      if (nextPlayable && nextPlayable.isKeyNode) {
        playDialogueFrom(startIndex + 1);
        return;
      }
      // 标记当前段已有 narrator，正常播放
      segmentHasNarratorRef.current = true;
      const msgId = `dialogue-${startIndex}`;
      playTimerRef.current = setTimeout(() => {
        // 纵深防御：timer 等待期间可能已触发 keyNode 硬停
        if (isWaitingForUserRef.current) return;
        setDisplayedMessages(prev => {
          if (prev.some(m => m.id === msgId)) return prev;
          return [...prev, { ...msg, id: msgId, isNew: true }];
        });
        playDialogueFrom(startIndex + 1);
      }, 1500);
      return;
    }

    // ——— NPC 消息处理 ———

    // 已达 3 条上限，跳过该消息
    if (segmentNpcCountRef.current >= 3) {
      playDialogueFrom(startIndex + 1);
      return;
    }

    const msgId = `dialogue-${startIndex}`;
    segmentNpcCountRef.current++;

    // ——— 新播放流程：间隔等待 → typing indicator → 消息出现 ———
    const nextMsg = dialogue[startIndex + 1];
    const msgLength = (msg.text || '').length;

    // 判断是否为同一说话人连续发言（基于 dialogue 原始数组，不受 NPC 上限影响）
    const prevDialogueMsg = startIndex > 0 ? dialogue[startIndex - 1] : null;
    const isSameSpeakerInDialogue = prevDialogueMsg
      && prevDialogueMsg.speaker === msg.speaker
      && !prevDialogueMsg.isKeyNode;

    // 步骤1：计算消息间隔时间
    // 第一条消息间隔为 0，后续根据同人/换人分档
    let gapDelay;
    if (startIndex === 0) {
      gapDelay = 0;  // 第一条立即出现 typing indicator
    } else if (isSameSpeakerInDialogue) {
      // 同一人连续发言：较短间隔，节奏紧凑
      gapDelay = Math.round((600 + msgLength * 20) * 0.6);
    } else {
      // 换人发言：较长间隔，留时间"换个人"
      gapDelay = Math.round((600 + msgLength * 20) * 1.2);
    }
    // 下一条是 keyNode 时用固定较短间隔，避免等太久
    if (startIndex !== 0 && nextMsg && nextMsg.isKeyNode) {
      gapDelay = 800;
    }

    // 步骤2：计算 typing indicator 停留时间（模拟打字速度）
    const typingDuration = 1200 + msgLength * 30;

    // 步骤1：等待间隔后显示 typing indicator
    playTimerRef.current = setTimeout(() => {
      if (isWaitingForUserRef.current) return;

      // 显示"正在输入"圆点
      const speakingRole = findRoleBySpeaker(roles, msg.speaker);
      setTypingRole(speakingRole || { name: msg.speaker });

      // 步骤3：圆点停留结束后清除并插入消息
      playTimerRef.current = setTimeout(() => {
        // 无论是否被 keyNode 阻断，都先清除 typing indicator
        setTypingRole(null);
        if (isWaitingForUserRef.current) return;

        setDisplayedMessages(prev => {
          if (prev.some(m => m.id === msgId)) return prev;
          return [...prev, { ...msg, id: msgId, isNew: true }];
        });

        // NPC 消息插入后触发 TTS（narrator/keyNode/user/system 不触发）
        if (msg.text && !msg.isKeyNode && msg.speaker !== 'narrator') {
          const speakingRole = findRoleBySpeaker(roles, msg.speaker);
          enqueueTts(msg.text, getVoiceId(speakingRole));
        }

        // 打字机效果时长：等打完再调度下一条消息
        const typewriterDuration = msgLength * 35;

        // ——— 铁律 2：检查是否需要注入前端 narrator ———
        if (segmentNpcCountRef.current === 1 && !segmentHasNarratorRef.current) {
          let npcBeforeKeyNode = 0;
          for (let j = startIndex + 1; j < dialogue.length; j++) {
            const c = dialogue[j];
            if (c.isKeyNode) break;
            if (c.speaker === 'narrator') continue;
            npcBeforeKeyNode++;
          }
          const canInject = npcBeforeKeyNode >= 1;
          const nextDialogMsg = dialogue[startIndex + 1];
          const nextIsNpc = nextDialogMsg &&
            !nextDialogMsg.isKeyNode &&
            nextDialogMsg.speaker !== 'narrator';

          if (nextIsNpc && canInject) {
            segmentHasNarratorRef.current = true;
            const speakerName = msg.speaker ? msg.speaker.split(' ')[0] : '他';
            const narratorTexts = [
              `${speakerName} 向来说话不留情面`,
              `${speakerName} 每次都这样，先夸再转折`,
              `看 ${speakerName} 的语气，接下来要追问了`,
              `${speakerName} 这是在给谁铺垫？`,
              `嗯，${speakerName} 话里有话`,
              `${speakerName} 又开始施压了，老套路`,
            ];
            const narratorMsg = {
              speaker: 'narrator',
              text: narratorTexts[Math.floor(Math.random() * narratorTexts.length)],
              isNew: true,
              id: `narrator-inject-${startIndex}`,
              _injected: true,
            };

            playTimerRef.current = setTimeout(() => {
              if (isWaitingForUserRef.current) return;
              setDisplayedMessages(prev => [...prev, narratorMsg]);
              playDialogueFrom(startIndex + 1);
            }, typewriterDuration + 1500);
            return;
          }
        }

        // 等打字机打完再调度下一条
        playTimerRef.current = setTimeout(() => {
          playDialogueFrom(startIndex + 1);
        }, typewriterDuration);
      }, typingDuration);
    }, gapDelay);
  }, [handleMeetingEnd, enqueueTts]);

  // 初始化：从 processedDialogue[0] 开始播放
  // React StrictMode 下 effect 会执行两次（mount→unmount→mount），
  // cleanup 中清除定时器并重置 hasStartedRef，第二次 mount 时正常启动
  useEffect(() => {
    if (!processedDialogue || processedDialogue.length === 0) return;
    if (hasStartedRef.current) return;

    hasStartedRef.current = true;
    playDialogueFrom(0);

    return () => {
      // cleanup：清除任何已安排的定时器，并重置启动标志
      if (playTimerRef.current) {
        clearTimeout(playTimerRef.current);
        playTimerRef.current = null;
      }
      hasStartedRef.current = false;
    };
  // playDialogueFrom 是稳定引用（依赖 handleMeetingEnd，后者依赖稳定的 meetingId/navigate）
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playDialogueFrom]);

  // 新消息出现时自动滚动到底部
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [displayedMessages]);

  // 如果没有会议数据则不渲染（所有 hooks 已在上方完成注册）
  if (!meetingData) return null;

  const { briefing, roles } = meetingData;

  /**
   * 从预处理后的 dialogue 中提取所有关键节点
   * 用于渲染顶部进度条，每个关键节点对应一个圆点
   */
  const keyNodes = processedDialogue.filter(msg => msg.isKeyNode);

  /**
   * 用户提交发言
   * @param {string} text - 用户输入的文字
   */
  const handleSubmit = async (text) => {
    if (isWaiting || activeNodeIndex === null) return;

    // 用户发言时立即停止当前 TTS 播放，清空队列
    stopAndClearAudio();

    // 用户已发言，解除 keyNode 等待锁（同步，立即生效）
    isWaitingForUserRef.current = false;

    // 用户发言了，重置段计数器（开始新的一段）
    segmentNpcCountRef.current = 0;
    segmentHasNarratorRef.current = false;

    // 在异步操作前先保存当前节点索引，防止 state 更新后取值错误
    const currentNodeIndex = activeNodeIndex;

    // 检测输入语言（包含中文字符视为中文）
    const hasChinese = /[\u4e00-\u9fa5]/.test(text);
    const inputLanguage = hasChinese ? 'zh' : 'en';

    // 先把用户消息添加到聊天流
    const userMessage = {
      type: 'user',
      text,
      isUser: true,
      isNew: true,
    };
    setDisplayedMessages(prev => [...prev, userMessage]);
    setShowInput(false);
    setShowReferenceButton(false);
    setIsWaiting(true);

    // 记录对话
    addConversation({
      nodeIndex: currentNodeIndex,
      userInput: text,
      inputLanguage,
    });

    // 读取当前重试次数和已失败节点数，传入后端
    const currentRetry = retryCountRef.current;
    const currentFailedCount = failedNodesRef.current.size;

    try {
      const result = await respondToNode(
        meetingId,
        currentNodeIndex,
        text,
        inputLanguage,
        currentRetry,
        currentFailedCount
      );

      if (result.inputType === 'invalid') {
        if (currentRetry === 0) {
          // --- 第 1 次 invalid：显示 NPC 角色化补救对话，允许重试 ---
          retryCountRef.current = 1;

          // retryPrompt 为对象 { text, textZh }，以 NPC 气泡形式展示
          if (result.retryPrompt) {
            const retryMsg = {
              // 找最近的 NPC 发言者作为说话者（兜底用空字符串）
              speaker: (() => {
                // 从已显示消息中向前找最近一条 NPC 消息
                const msgs = [...(displayedMessages || [])];
                for (let i = msgs.length - 1; i >= 0; i--) {
                  if (msgs[i].speaker && msgs[i].speaker !== 'narrator' && !msgs[i].isUser && !msgs[i].isSystem) {
                    return msgs[i].speaker;
                  }
                }
                return '';
              })(),
              text: result.retryPrompt.text || result.retryPrompt,
              textZh: result.retryPrompt.textZh || '',
              isNew: true,
            };
            setDisplayedMessages(prev => [...prev, retryMsg]);
          }

          // 显示"用参考说法"按钮，允许重新输入
          setShowReferenceButton(true);
          setIsWaiting(false);
          setActiveNodeIndex(currentNodeIndex);
          setShowInput(true);
        } else {
          // --- 第 2 次 invalid：节点失败，NPC 收场，强制推进 ---
          retryCountRef.current = 0;

          // 更新失败节点集合
          const newFailedNodes = new Set([...failedNodesRef.current, currentNodeIndex]);
          setFailedNodes(newFailedNodes);

          // 显示 NPC 收场对话
          if (result.failureResponse) {
            const failureMsg = {
              speaker: (() => {
                const msgs = [...(displayedMessages || [])];
                for (let i = msgs.length - 1; i >= 0; i--) {
                  if (msgs[i].speaker && msgs[i].speaker !== 'narrator' && !msgs[i].isUser && !msgs[i].isSystem) {
                    return msgs[i].speaker;
                  }
                }
                return '';
              })(),
              text: result.failureResponse.text || result.failureResponse,
              textZh: result.failureResponse.textZh || '',
              isNew: true,
            };
            setDisplayedMessages(prev => [...prev, failureMsg]);
          }

          // 标记节点已完成（以失败方式完成）
          setCompletedNodes(prev => new Set([...prev, currentNodeIndex]));
          setActiveNodeIndex(null);

          // 检查是否所有节点都失败（达到 3 个则终止会议）
          if (newFailedNodes.size >= 3) {
            setTimeout(() => {
              setIsWaiting(false);
              handleMeetingFailed();
            }, 1500);
          } else {
            // 继续播放后续 dialogue（invalid 第 2 次后节点强制推进）
            const responseDialogue = result.responseDialogue || [];
            const appendDelay = 800;

            const appendAndContinue = () => {
              let idx = 0;
              const appendNext = () => {
                // 受 segmentNpcCountRef 约束：每段最多 3 条 NPC
                if (idx < responseDialogue.length && segmentNpcCountRef.current < 3) {
                  const rMsg = responseDialogue[idx];
                  segmentNpcCountRef.current++;
                  idx++;

                  // 快速弹入：根据消息长度动态调整间隔
                  const rMsgId = `resp-msg-invalid-${idx}`;
                  setDisplayedMessages(prev => [...prev, { ...rMsg, id: rMsgId, isNew: true }]);
                  // NPC 回应消息也触发 TTS（非 narrator/system）
                  if (rMsg.text && rMsg.speaker && rMsg.speaker !== 'narrator') {
                    const rRole = findRoleBySpeaker(roles, rMsg.speaker);
                    enqueueTts(rMsg.text, getVoiceId(rRole));
                  }
                  const rMsgLength = (rMsg.text || '').length;
                  playTimerRef.current = setTimeout(appendNext, rMsgLength < 50 ? 1800 : rMsgLength <= 120 ? 3000 : 4200);
                } else {
                  // 从同步 ref 读取索引，避免在 state updater 中执行副作用
                  setIsWaiting(false);
                  const nextIndex = currentDialogueIndexRef.current;
                  playDialogueFrom(nextIndex);
                }
              };
              playTimerRef.current = setTimeout(appendNext, appendDelay);
            };

            appendAndContinue();
          }
        }
        return;
      }

      // --- 输入有效（valid 或 weak）：标记节点完成，重置重试计数 ---
      retryCountRef.current = 0;
      setShowReferenceButton(false);
      setCompletedNodes(prev => new Set([...prev, currentNodeIndex]));
      setActiveNodeIndex(null);

      // 将后端返回的 responseDialogue 逐条追加（快速弹入，800-1000ms 间隔）
      // 受 segmentNpcCountRef 约束：每段最多 3 条 NPC（与 processedDialogue 共享段计数器）
      const responseDialogue = result.responseDialogue || [];
      const appendDelay = 400;

      const appendAndContinue = () => {
        let idx = 0;

        const appendNext = () => {
          // 段 NPC 计数未满 3 且还有消息时继续追加
          if (idx < responseDialogue.length && segmentNpcCountRef.current < 3) {
            const rMsg = responseDialogue[idx];
            segmentNpcCountRef.current++;
            idx++;

            // 快速弹入：根据消息长度动态调整间隔
            const rMsgId = `resp-msg-${idx}`;
            setDisplayedMessages(prev => [...prev, { ...rMsg, id: rMsgId, isNew: true }]);
            // NPC 回应消息也触发 TTS（非 narrator/system）
            if (rMsg.text && rMsg.speaker && rMsg.speaker !== 'narrator') {
              const rRole = findRoleBySpeaker(roles, rMsg.speaker);
              enqueueTts(rMsg.text, getVoiceId(rRole));
            }
            const rMsgLength = (rMsg.text || '').length;
            playTimerRef.current = setTimeout(appendNext, rMsgLength < 50 ? 1800 : rMsgLength <= 120 ? 3000 : 4200);
          } else {
            // 追加完毕或已达段上限，继续播放 processedDialogue 剩余内容
            // 从同步 ref 读取索引，避免在 state updater 中执行副作用
            setIsWaiting(false);
            const nextIndex = currentDialogueIndexRef.current;
            playDialogueFrom(nextIndex);
          }
        };

        playTimerRef.current = setTimeout(appendNext, appendDelay);
      };

      appendAndContinue();
    } catch (err) {
      console.error('发送响应失败:', err);
      showError('网络错误，请重试');
      setIsWaiting(false);
      // 恢复到当前节点，允许重试
      setActiveNodeIndex(currentNodeIndex);
      setShowInput(true);
    }
  };

  /**
   * 用户点击"用参考说法"按钮
   * 找到当前节点对应的参考说法英文内容，自动填入并提交
   */
  const handleUseReference = () => {
    if (!meetingData?.references || activeNodeIndex === null) return;
    const ref = meetingData.references.find(r => r.nodeIndex === activeNodeIndex);
    if (!ref) return;

    // 优先取 phrases 数组第一条的英文，或 example 字段
    let refText = '';
    if (ref.phrases && ref.phrases.length > 0) {
      refText = ref.phrases[0].en || ref.phrases[0].text || '';
    } else if (ref.example) {
      refText = ref.example;
    } else if (typeof ref === 'string') {
      refText = ref;
    }

    if (refText) {
      handleSubmit(refText);
    }
  };

  return (
    <div className={styles.container}>
      {/* 顶部导航栏 */}
      <div className={styles.topBar}>
        <div className={styles.topBarLeft}>
          <div className={styles.meetingStatusDot}></div>
          <span className={styles.meetingTitle}>
            {briefing?.topic || 'Weekly Sync'}
          </span>
        </div>
        {/* 顶栏中间：关键节点进度条（仅有 keyNode 时渲染） */}
        {keyNodes.length > 0 && (
          <div className={styles.progressDots}>
            {keyNodes.map((node, i) => {
              const isCompleted = completedNodes.has(node.nodeIndex);
              const isFailed = failedNodes.has(node.nodeIndex);
              const isActive = activeNodeIndex === node.nodeIndex;
              // 计算圆点状态类名：失败优先于完成
              let dotClass = styles.dotPending;
              if (isFailed) dotClass = styles.dotFailed;
              else if (isCompleted) dotClass = styles.dotCompleted;
              else if (isActive) dotClass = styles.dotActive;

              return (
                <React.Fragment key={node.nodeIndex}>
                  {/* 圆点之间的连接线（第一个圆点前不加） */}
                  {i > 0 && (
                    <div
                      className={`${styles.progressLine} ${
                        // 前一个节点已完成（含失败）时，连接线也变色
                        completedNodes.has(keyNodes[i - 1].nodeIndex)
                          ? styles.progressLineDone
                          : ''
                      }`}
                    />
                  )}
                  {/* 关键节点圆点 */}
                  <div
                    className={`${styles.progressDot} ${dotClass}`}
                    title={`节点 ${i + 1}${isFailed ? '（失败）' : isCompleted ? '（已完成）' : isActive ? '（进行中）' : '（未到达）'}`}
                  >
                    {/* 已失败：显示 × */}
                    {isFailed && (
                      <svg viewBox="0 0 24 24" fill="none">
                        <path d="M18 6L6 18" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
                        <path d="M6 6L18 18" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
                      </svg>
                    )}
                    {/* 已完成（非失败）：显示缩小的打勾 */}
                    {isCompleted && !isFailed && (
                      <svg viewBox="0 0 24 24" fill="none">
                        <path
                          d="M20 6L9 17L4 12"
                          stroke="#fff"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        )}

        {/* 顶栏右侧：翻译切换 + Briefing 按钮 */}
        <div className={styles.topBarRight}>
          {/* 中/英翻译切换按钮 */}
          <button
            className={`${styles.translationToggle} ${showTranslation ? styles.translationToggleOn : ''}`}
            onClick={() => setShowTranslation(prev => !prev)}
            title={showTranslation ? '关闭中文翻译' : '开启中文翻译'}
          >
            中
          </button>
          <button
            className={styles.briefingButton}
            onClick={() => setShowBriefing(true)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
              <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <line x1="12" y1="16" x2="12.01" y2="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            Briefing
          </button>
        </div>
      </div>

      {/* 聊天流：使用 chatscope MessageList 渲染消息 */}
      <div className={styles.chatScrollWrapper}>
        <MainContainer className={styles.csMainContainer}>
          <ChatContainer className={styles.csChatContainer}>
            <MessageList
              className={styles.csMessageList}
              typingIndicator={null}
            >
              {/* 会议开始分隔符 */}
              <MessageSeparator content="会议开始" />

              {/* 遍历消息列表，按类型渲染不同组件 */}
              {displayedMessages.map((msg, idx) => {
                // 系统提示消息（如无效输入重试提示）
                if (msg.isSystem || msg.type === 'system') {
                  return (
                    <MessageSeparator key={idx} content={msg.text} />
                  );
                }

                // 关键节点提示卡片：不使用 chatscope，通过 Message.CustomContent 嵌入
                if (msg.isKeyNode || msg._displayType === 'node_prompt') {
                  return (
                    <Message key={idx} model={{ type: 'custom', direction: 'incoming', position: 'single' }}>
                      <Message.CustomContent>
                        <NodePromptCard
                          nodeIndex={msg.nodeIndex}
                          prompt={msg.prompt}
                          keyData={msg.keyData}
                          isActive={activeNodeIndex === msg.nodeIndex}
                          isCompleted={completedNodes.has(msg.nodeIndex)}
                        />
                      </Message.CustomContent>
                    </Message>
                  );
                }

                // 内心独白（narrator）：用户内心 OS，右对齐（从用户方向发出）
                // 脑洞模式下不渲染 narrator（保留 IP 角色的沉浸感，不要内心 OS 打断）
                if (msg.speaker === 'narrator') {
                  // 双重判断兼容旧 localStorage 缺少 sceneType 的情况
                  if (
                    (state.sceneType && state.sceneType.startsWith('brainstorm')) ||
                    (meetingData?.sceneType && meetingData.sceneType.startsWith('brainstorm'))
                  ) {
                    return null;
                  }
                  return (
                    <Message key={idx} model={{ type: 'custom', direction: 'outgoing', position: 'single' }}>
                      <Message.CustomContent>
                        <div className={`${styles.narratorBubble} narrator-bubble ${msg.isNew ? styles.newMessageOutgoing : ''}`}>
                          <span className={styles.narratorPrefix}>💭</span>
                          <span className={styles.narratorText}>{msg.text}</span>
                        </div>
                      </Message.CustomContent>
                    </Message>
                  );
                }

                // 用户消息：右对齐 outgoing，使用 CustomContent 展示头像和名字
                // 脑洞模式用角色头衔，正经开会用花名
                if (msg.isUser || msg.type === 'user') {
                  const currentUserName = displayUserName;
                  const userInitial = currentUserName.charAt(0).toUpperCase();
                  return (
                    <Message
                      key={idx}
                      model={{ type: 'custom', direction: 'outgoing', position: 'single' }}
                      className={msg.isNew ? styles.newMessageOutgoing : ''}
                    >
                      <Message.CustomContent>
                        {/* 用户名字（右对齐） */}
                        <div className={styles.userSpeakerLabel}>{currentUserName}</div>
                        {/* 消息气泡行：气泡 + 头像横向排列，user-message-row 用于全局 CSS :has() 选择器 */}
                        <div className={`${styles.userMessageRow} user-message-row`}>
                          <div className={styles.userBubble}>{msg.text}</div>
                          {/* 24px 圆形头像，品牌色背景，白字首字母 */}
                          <div className={styles.userAvatarSmall}>{userInitial}</div>
                        </div>
                      </Message.CustomContent>
                    </Message>
                  );
                }

                // NPC 角色消息：左对齐 incoming，带头像和翻译
                // 用 findRoleBySpeaker 兜底匹配（AI 可能用中文名或英文名）
                const matchedRole = findRoleBySpeaker(roles, msg.speaker);
                const roleColor = getRoleColor(msg.speaker, roles);
                const roleTitle = getRoleTitle(msg.speaker, roles);
                // 显示时统一用中文名；匹配不上则保留原始 speaker 并取第一个词
                const displayName = matchedRole ? matchedRole.name : (msg.speaker ? msg.speaker.split(' ')[0] : '?');
                const firstName = displayName.split(' ')[0];
                // 点将局角色身份已定，不显示适配头衔；乱炖局和正式会议保留
                const showTitle = roleTitle && sceneType !== 'brainstorm-pick';
                const headerLabel = showTitle ? `${firstName} · ${roleTitle}` : firstName;

                // 判断是否为连续消息：与上一条消息同一说话人，且都不是 narrator/keyNode/用户消息
                const prevMsg = idx > 0 ? displayedMessages[idx - 1] : null;
                const isContinuous = prevMsg
                  && prevMsg.speaker === msg.speaker
                  && prevMsg.speaker !== 'narrator'
                  && !prevMsg.isKeyNode
                  && !msg.isKeyNode
                  && !prevMsg.isUser
                  && prevMsg.type !== 'user';

                return (
                  <Message
                    key={idx}
                    model={{
                      type: 'custom',
                      direction: 'incoming',
                      position: 'single',
                    }}
                    className={`${msg.isNew ? (isContinuous ? styles.newMessageContinuous : styles.newMessageIncoming) : ''} ${isContinuous ? styles.continuousMessage : ''}`}
                  >
                    <Message.CustomContent>
                      {/* 连续消息隐藏角色名头部，保留缩进对齐；首条消息正常显示 */}
                      {!isContinuous && (
                        <button
                          className={styles.npcSpeakerBtn}
                          onClick={() => {
                            // 使用 findRoleBySpeaker 兜底匹配，中英文名都能弹出角色卡
                            const role = findRoleBySpeaker(roles, msg.speaker);
                            if (role) setActiveRoleCard(role);
                          }}
                        >
                          {/* 小尺寸头像 */}
                          <div
                            className={styles.npcSpeakerAvatar}
                            style={{ background: roleColor }}
                          >
                            {firstName.charAt(0)}
                          </div>
                          {/* 角色名 · 职位 */}
                          <span className={styles.npcSpeakerLabel}>{headerLabel}</span>
                        </button>
                      )}
                      {/* 消息内容 */}
                      <div className={styles.npcMessageContent}>
                        <p className={styles.npcMessageText}>
                          {/* 新消息且未完成打字机则逐字显示，否则直接全文 */}
                          {msg.isNew && !typewriterDoneIds.has(msg.id) ? (
                            <TypewriterText
                              text={msg.text}
                              speed={35}
                              onComplete={() => setTypewriterDoneIds(prev => new Set(prev).add(msg.id))}
                            />
                          ) : msg.text}
                        </p>
                        {/* 中文翻译区域：打字机完成后淡入显示 */}
                        {showTranslation && msg.textZh && (!msg.isNew || typewriterDoneIds.has(msg.id)) && (
                          <div className={`${styles.translationBlock} ${msg.isNew && typewriterDoneIds.has(msg.id) ? styles.translationFadeIn : ''}`}>
                            <p className={styles.translationText}>
                              <span className={styles.translationTag}>译</span>
                              {msg.textZh}
                            </p>
                          </div>
                        )}
                        {/* TTS 按钮 */}
                        <div className={styles.ttsRow}>
                          <TtsButton text={msg.text} language="en" />
                        </div>
                      </div>
                    </Message.CustomContent>
                  </Message>
                );
              })}

              {/* Typing Indicator：作为消息渲染，不依赖 chatscope 的 typingIndicator prop */}
              {(typingRole || isWaiting) && (
                <Message
                  model={{ type: 'custom', direction: 'incoming', position: 'single' }}
                  className={styles.typingMessage}
                >
                  <Message.CustomContent>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '10px 16px' }}>
                      <span className="typing-dot" />
                      <span className="typing-dot" />
                      <span className="typing-dot" />
                    </div>
                  </Message.CustomContent>
                </Message>
              )}

              {/* 滚动锚点 */}
              <div ref={bottomRef} style={{ height: 8 }}></div>
            </MessageList>
          </ChatContainer>
        </MainContainer>
      </div>

      {/* 会议结束后的复盘 CTA 按钮：用户主动点击后才跳转 */}
      {showEndButton && (
        <div className={styles.endButtonArea}>
          <button className={styles.endButton} onClick={handleGoToReview}>
            查看会议复盘 →
          </button>
        </div>
      )}

      {/* 用户输入区（关键节点时显示）*/}
      {showInput && (
        <div className={styles.inputArea}>
          {/* 参考说法：从 references 数组中按 nodeIndex 查找，传入完整对象供 Reference 解析 */}
          {(() => {
            const ref = meetingData.references?.find(r => r.nodeIndex === activeNodeIndex);
            return ref ? (
              <div className={styles.referenceWrapper}>
                <Reference
                  content={ref}
                  level={state.englishLevel}
                />
              </div>
            ) : null;
          })()}

          {/* invalid 第 1 次后显示"用参考说法"按钮，点击自动填入参考英文并提交 */}
          {showReferenceButton && (
            <div className={styles.useReferenceRow}>
              <button
                className={styles.useReferenceButton}
                onClick={handleUseReference}
                disabled={isWaiting}
              >
                用参考说法
              </button>
            </div>
          )}

          <UserInput
            placeholder="输入你的发言（支持中英文）"
            onSubmit={handleSubmit}
            disabled={isWaiting}
          />
        </div>
      )}

      {/* Briefing 抽屉遮罩 */}
      {showBriefing && (
        <div
          className={styles.drawerOverlay}
          onClick={() => setShowBriefing(false)}
        ></div>
      )}

      {/* Briefing 右侧抽屉 */}
      <div className={`${styles.briefingDrawer} ${showBriefing ? styles.drawerOpen : ''}`}>
        <div className={styles.drawerHeader}>
          <h2 className={styles.drawerTitle}>Briefing</h2>
          <button
            className={styles.drawerCloseBtn}
            onClick={() => setShowBriefing(false)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className={styles.drawerContent}>
          <BriefingCard briefing={briefing} showTranslation={showTranslation} />
        </div>
      </div>

      {/* 角色信息 Popover 气泡：点击角色名后弹出 */}
      {activeRoleCard && (
        <RoleInfoCard
          role={activeRoleCard}
          onClose={() => setActiveRoleCard(null)}
        />
      )}
    </div>
  );
}

/**
 * 关键节点提示卡片
 * 展示节点 prompt 和可引用的 Key Data 数据点
 */
function NodePromptCard({ nodeIndex, prompt, keyData, isActive, isCompleted }) {
  return (
    <div className={`${styles.nodeCard} node-card ${isActive ? styles.nodeCardActive : ''} ${isCompleted ? styles.nodeCardCompleted : ''}`}>
      <div className={styles.nodeCardHeader}>
        <div className={styles.nodeIcon}>
          {isCompleted ? (
            // 已完成：显示打勾图标
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M20 6L9 17L4 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            // 待完成：使用 💬 对话图标，语气更轻松
            <span style={{ fontSize: '13px', lineHeight: 1 }}>💬</span>
          )}
        </div>
        {/* 直接展示情境化任务描述（prompt），而不是固定的"轮到你了" */}
        <span className={styles.nodeLabel}>
          {isCompleted ? '已发言' : (prompt || '轮到你了')}
        </span>
      </div>

      {/* Key Data 区：仅在有数据且未完成时显示 */}
      {!isCompleted && keyData && keyData.length > 0 && (
        <div className={styles.keyDataRow}>
          {keyData.map((item, i) => {
            // 每个选项依次出现：
            // keynote 整体入场 600ms + 等待 500ms = 1100ms 起，每个间隔 600ms
            const optionDelay = 1100 + i * 600;
            return (
              <div
                key={i}
                className={`${styles.keyDataItem} keynote-option`}
                style={{
                  '--option-delay': `${optionDelay}ms`,
                }}
              >
                <span className={styles.keyDataLabel}>{item.label}</span>
                <span className={styles.keyDataValue}>{item.value}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default Meeting;
