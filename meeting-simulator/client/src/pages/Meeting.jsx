import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { respondToNode, completeMeeting } from '../api/index.js';
import ChatBubble from '../components/ChatBubble.jsx';
import UserInput from '../components/UserInput.jsx';
import Reference from '../components/Reference.jsx';
import BriefingCard from '../components/BriefingCard.jsx';
import styles from './Meeting.module.css';

/**
 * 前端硬裁剪：两个 keyNode（或开头到第一个 keyNode）之间，NPC 消息最多保留 3 条
 * 超过的直接丢弃，避免对话过长
 * @param {Array} dialogue - 原始 dialogue 数组
 * @returns {Array} 裁剪后的 dialogue 数组
 */
function trimDialogue(dialogue) {
  const result = [];
  // 自上次 keyNode 后的连续 NPC 消息数
  let npcSinceLastKey = 0;

  for (const msg of dialogue) {
    if (msg.isKeyNode || msg.speaker === 'narrator') {
      // keyNode 和 narrator 不计入 NPC 计数，直接保留
      npcSinceLastKey = 0;
      result.push(msg);
    } else {
      npcSinceLastKey++;
      // 超过 3 条的 NPC 消息直接丢弃
      if (npcSinceLastKey <= 3) {
        result.push(msg);
      }
    }
  }
  return result;
}

/**
 * 前端硬逻辑：在第 2 条 NPC 消息之后（不是第 1 条后）插入 narrator 内心独白
 * narrator 内容评论的是已经出现的消息，不预测未来
 * @param {Array} dialogue - 原始 dialogue 数组
 * @returns {Array} 注入 narrator 后的 dialogue 数组
 */
function injectNarrators(dialogue, roles) {
  if (!dialogue || dialogue.length === 0) return [];

  // 先做 NPC 消息数量裁剪
  const trimmed = trimDialogue(dialogue);

  const result = [];
  // 自上次 narrator/keyNode 后的连续 NPC 消息数
  let npcCount = 0;

  for (let i = 0; i < trimmed.length; i++) {
    const msg = trimmed[i];

    // AI 生成的 narrator 保留，重置计数
    if (msg.speaker === 'narrator') {
      result.push(msg);
      npcCount = 0;
      continue;
    }

    // keyNode 重置计数
    if (msg.isKeyNode) {
      npcCount = 0;
      result.push(msg);
      continue;
    }

    // 普通 NPC 消息
    npcCount++;
    result.push(msg);

    // 恰好第 2 条 NPC 消息之后，且后面还有非 keyNode 的消息时，插入 narrator
    if (npcCount === 2) {
      const next = trimmed[i + 1];
      if (next && !next.isKeyNode && next.speaker !== 'narrator') {
        // 从已显示的消息中取最近两个说话人，narrator 评论已发生的内容
        const prevSpeakers = [];
        for (let j = result.length - 1; j >= 0 && prevSpeakers.length < 2; j--) {
          if (result[j].speaker && result[j].speaker !== 'narrator' && !result[j].isKeyNode) {
            const name = result[j].speaker.split(' ')[0];
            if (!prevSpeakers.includes(name)) prevSpeakers.push(name);
          }
        }

        const name1 = prevSpeakers[0] || '他';
        const name2 = prevSpeakers[1] || '';

        // 候选文案：评论已经说过的内容
        const narratorTexts = name2 ? [
          `${name1} 和 ${name2} 在对线了…`,
          `${name2} 刚才的话有点意思…`,
          `感觉 ${name1} 不太同意 ${name2}`,
        ] : [
          `${name1} 说完了，看看接下来怎么发展`,
          `嗯，${name1} 的意思大概懂了`,
          `${name1} 这话有点意思…`,
        ];

        result.push({
          speaker: 'narrator',
          text: narratorTexts[Math.floor(Math.random() * narratorTexts.length)],
          textZh: '',
          isKeyNode: false,
          _injected: true, // 标记为前端注入，便于调试
        });
        npcCount = 0;
      }
    }
  }

  return result;
}

// 角色颜色映射
const ROLE_COLORS = {
  leader: 'var(--role-leader)',
  collaborator: 'var(--role-collaborator)',
  challenger: 'var(--role-challenger)',
  supporter: 'var(--role-supporter)',
};

/**
 * 根据角色名称从 roles 数组中查找对应颜色
 * @param {string} speaker - 发言者名称
 * @param {Array} roles - 角色列表（后端返回 roles 字段）
 * @returns {string} CSS 颜色变量
 */
function getRoleColor(speaker, roles) {
  if (!speaker || !roles || !Array.isArray(roles)) return 'var(--role-collaborator)';
  const role = roles.find(r => r.name === speaker);
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
  const role = roles.find(r => r.name === speaker);
  return role?.title;
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

  const { meetingData, meetingId } = state;

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
  // Briefing 抽屉开关
  const [showBriefing, setShowBriefing] = useState(false);
  // 是否显示中文翻译（默认开启）
  const [showTranslation, setShowTranslation] = useState(true);
  // 已完成的节点索引集合
  const [completedNodes, setCompletedNodes] = useState(new Set());
  // 是否已触发会议结束流程（防止重复触发）
  const meetingEndedRef = useRef(false);
  // 聊天流底部锚点
  const bottomRef = useRef(null);
  // 播放定时器
  const playTimerRef = useRef(null);
  // 标记是否已启动过播放（解决 StrictMode 双重 effect 问题）
  const hasStartedRef = useRef(false);

  /**
   * 预处理 dialogue：注入前端 narrator，确保每 2 条 NPC 消息间有内心独白
   * 用 useMemo 缓存，避免每次渲染重复计算
   */
  const processedDialogue = useMemo(() => {
    if (!meetingData?.dialogue) return [];
    return injectNarrators(meetingData.dialogue);
  }, [meetingData]);

  // 使用 ref 存储预处理后的 dialogue，供 useCallback 内部读取（避免闭包过时）
  const processedDialogueRef = useRef(null);
  processedDialogueRef.current = processedDialogue;

  // 如果没有会议数据，通过 useEffect 跳转，避免渲染期直接调用 navigate
  useEffect(() => {
    if (!meetingData) {
      navigate('/');
    }
  }, [meetingData, navigate]);

  /**
   * 会议结束处理：调用 completeMeeting 后跳转复盘
   * 使用 useCallback 避免在 playDialogueFrom 内部引用过时的函数
   */
  const handleMeetingEnd = useCallback(async () => {
    setDisplayedMessages(prev => [
      ...prev,
      { type: 'system', text: '会议结束', isSystem: true, isNew: true }
    ]);

    try {
      await completeMeeting(meetingId);
    } catch (err) {
      console.error('完成会议失败:', err);
    }

    // 延迟跳转到复盘页
    setTimeout(() => navigate('/review'), 1500);
  }, [meetingId, navigate]);

  /**
   * 逐条自动播放 dialogue（使用预处理后的 processedDialogue），从 startIndex 开始
   * 每次 setTimeout 只添加 1 条消息，严格逐条递归，避免批量推送
   * 遇到 isKeyNode === true 时停止，显示输入区
   * 通过 processedDialogueRef 读取 dialogue，避免闭包过时
   */
  const playDialogueFrom = useCallback((startIndex) => {
    const dialogue = processedDialogueRef.current;
    if (!dialogue || startIndex >= dialogue.length) {
      // dialogue 播放完毕，触发会议结束
      if (!meetingEndedRef.current) {
        meetingEndedRef.current = true;
        handleMeetingEnd();
      }
      return;
    }

    const msg = dialogue[startIndex];

    if (msg.isKeyNode) {
      // 遇到关键节点：显示节点提示卡片，暂停播放，等待用户输入
      const nodeId = `node-${startIndex}`;
      setDisplayedMessages(prev => {
        // 防止重复添加（StrictMode 双执行保护）
        if (prev.some(m => m.id === nodeId)) return prev;
        return [...prev, { ...msg, id: nodeId, isNew: true, _displayType: 'node_prompt' }];
      });
      setCurrentDialogueIndex(startIndex + 1); // 下次从节点之后继续
      setActiveNodeIndex(msg.nodeIndex);
      setShowInput(true);
      return;
    }

    // 普通消息：根据当前消息类型和下一条消息类型动态设置延迟时间
    // 使用 startIndex 作为消息唯一 id，防止 StrictMode 双重执行导致重复添加
    const msgId = `dialogue-${startIndex}`;
    const nextMsg = dialogue[startIndex + 1];

    // 计算下一条消息的延迟
    let delay = 1200; // 默认 NPC 消息间隔
    if (msg.speaker === 'narrator') {
      // narrator 内心小人出现稍慢，给用户注意到这是不同元素的时间
      delay = 1500;
    } else if (nextMsg && nextMsg.isKeyNode) {
      // 关键节点前最后一条 NPC 消息后快速过渡到节点提示
      delay = 800;
    }

    playTimerRef.current = setTimeout(() => {
      setDisplayedMessages(prev => {
        // 防止重复添加（StrictMode 双执行保护）
        if (prev.some(m => m.id === msgId)) return prev;
        return [...prev, { ...msg, id: msgId, isNew: true }];
      });
      playDialogueFrom(startIndex + 1);
    }, delay);
  }, [handleMeetingEnd]);

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
   * 用户提交发言
   * @param {string} text - 用户输入的文字
   */
  const handleSubmit = async (text) => {
    if (isWaiting || activeNodeIndex === null) return;

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
    setIsWaiting(true);

    // 记录对话
    addConversation({
      nodeIndex: currentNodeIndex,
      userInput: text,
      inputLanguage,
    });

    try {
      const result = await respondToNode(meetingId, currentNodeIndex, text, inputLanguage);

      if (result.inputType === 'invalid' && result.retryPrompt) {
        // 输入无效：显示重试提示，允许用户重新输入
        const retryMsg = {
          type: 'system',
          text: result.retryPrompt,
          isSystem: true,
          isNew: true,
        };
        setDisplayedMessages(prev => [...prev, retryMsg]);
        setIsWaiting(false);
        setActiveNodeIndex(currentNodeIndex);
        setShowInput(true);
        return;
      }

      // 输入有效（valid 或 weak）：标记节点完成
      setCompletedNodes(prev => new Set([...prev, currentNodeIndex]));
      setActiveNodeIndex(null);

      // 将后端返回的 responseDialogue 逐条追加到聊天流
      const responseDialogue = result.responseDialogue || [];
      const appendDelay = 400;

      const appendAndContinue = () => {
        let idx = 0;

        const appendNext = () => {
          if (idx < responseDialogue.length) {
            const rMsg = responseDialogue[idx];
            setDisplayedMessages(prev => [...prev, { ...rMsg, isNew: true }]);
            idx++;
            playTimerRef.current = setTimeout(appendNext, 800);
          } else {
            // responseDialogue 全部追加完毕，继续播放 dialogue 剩余内容
            setIsWaiting(false);
            // currentDialogueIndex 已在遇到 keyNode 时更新为 keyNode 之后的索引
            setCurrentDialogueIndex(prev => {
              playDialogueFrom(prev);
              return prev;
            });
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

      {/* 聊天流 */}
      <div className={styles.chatScroll}>
        <div className={styles.chatContent}>
          {/* 会议开始标记 */}
          <div className={styles.meetingStart}>
            <div className={styles.meetingStartLine}></div>
            <span className={styles.meetingStartText}>会议开始</span>
            <div className={styles.meetingStartLine}></div>
          </div>

          {/* 消息列表 */}
          {displayedMessages.map((msg, idx) => {
            // 系统提示消息
            if (msg.isSystem || msg.type === 'system') {
              return (
                <ChatBubble
                  key={idx}
                  isSystem
                  text={msg.text}
                />
              );
            }

            // 关键节点提示卡片（isKeyNode 为 true 的 dialogue 条目）
            if (msg.isKeyNode || msg._displayType === 'node_prompt') {
              return (
                <NodePromptCard
                  key={idx}
                  nodeIndex={msg.nodeIndex}
                  prompt={msg.prompt}
                  keyData={msg.keyData}
                  isActive={activeNodeIndex === msg.nodeIndex}
                  isCompleted={completedNodes.has(msg.nodeIndex)}
                />
              );
            }

            // 内心独白（narrator）消息：专属气泡，居中渲染
            if (msg.speaker === 'narrator') {
              return (
                <div key={idx} className={styles.narratorBubble}>
                  <span className={styles.narratorPrefix}>💭</span>
                  <span className={styles.narratorText}>{msg.text}</span>
                </div>
              );
            }

            // 用户消息
            if (msg.isUser || msg.type === 'user') {
              return (
                <div key={idx} className={msg.isNew ? styles.newMessage : ''}>
                  <ChatBubble isUser text={msg.text} />
                </div>
              );
            }

            // NPC 角色消息
            const roleColor = getRoleColor(msg.speaker, roles);
            const roleTitle = getRoleTitle(msg.speaker, roles);
            return (
              <div key={idx} className={msg.isNew ? styles.newMessage : ''}>
                <ChatBubble
                  speaker={msg.speaker}
                  title={roleTitle}
                  text={msg.text}
                  textZh={msg.textZh}
                  showTranslation={showTranslation}
                  roleColor={roleColor}
                />
              </div>
            );
          })}

          {/* 等待指示器 */}
          {isWaiting && (
            <div className={styles.typingIndicator}>
              <div className={styles.typingDot}></div>
              <div className={styles.typingDot}></div>
              <div className={styles.typingDot}></div>
            </div>
          )}

          {/* 滚动锚点 */}
          <div ref={bottomRef} style={{ height: 8 }}></div>
        </div>
      </div>

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
    </div>
  );
}

/**
 * 关键节点提示卡片
 * 展示节点 prompt 和可引用的 Key Data 数据点
 */
function NodePromptCard({ nodeIndex, prompt, keyData, isActive, isCompleted }) {
  return (
    <div className={`${styles.nodeCard} ${isActive ? styles.nodeCardActive : ''} ${isCompleted ? styles.nodeCardCompleted : ''}`}>
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
          {keyData.map((item, i) => (
            <div key={i} className={styles.keyDataItem}>
              <span className={styles.keyDataLabel}>{item.label}</span>
              <span className={styles.keyDataValue}>{item.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Meeting;
