import React, { createContext, useContext, useState, useEffect } from 'react';

// 生成 uuid v4（不引入外部依赖，crypto.randomUUID 兼容现代浏览器）
function generateUuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // 降级方案：Math.random 实现
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// 全局应用状态上下文
const AppContext = createContext(null);

// localStorage 中持久化的字段列表
const PERSIST_KEYS = ['userId', 'userName'];

// 从 localStorage 读取持久化状态
function loadPersistedState() {
  const persisted = {};
  try {
    PERSIST_KEYS.forEach(key => {
      const val = localStorage.getItem(`app_${key}`);
      if (val !== null) {
        persisted[key] = val;
      }
    });
  } catch (e) {
    // localStorage 不可用时静默忽略
    console.warn('[AppContext] localStorage 读取失败:', e.message);
  }
  return persisted;
}

// 生成或恢复 userId（设备级 uuid，首次访问自动生成）
function getOrCreateUserId() {
  try {
    const existing = localStorage.getItem('app_userId');
    if (existing) return existing;
    const newId = generateUuid();
    localStorage.setItem('app_userId', newId);
    return newId;
  } catch (e) {
    // localStorage 不可用时返回临时 uuid
    return generateUuid();
  }
}

// 初始状态（从 localStorage 恢复持久化字段）
function buildInitialState() {
  const persisted = loadPersistedState();
  // 确保 userId 始终存在：从 localStorage 读取或新建
  if (!persisted.userId) {
    persisted.userId = getOrCreateUserId();
  }
  return {
    // ── 默认值（持久化字段会被 ...persisted 覆盖）──
    userId: null,
    userName: null,

    // ── 会话级字段（不持久化，页面刷新后清空）──
    currentRoomId: null,             // 当前进入的房间 ID
    currentChatSessionId: null,      // 当前群聊会话 ID
    chatDialogueScript: [],          // join 返回的完整对话脚本（内存中按顺序播放）
    chatProgress: 0,                 // 当前播放到第几条脚本（光标）
    userTurnCount: 0,                // 用户已发言次数
    settlementData: null,            // 结算数据（complete 后拉取）

    // ── Feed 状态（会话级）──
    feedScrollIndex: 0,              // Feed 当前滚动位置（用于恢复）
    cardsSinceLastChat: 0,           // 回到 Feed 后划过的卡片数（触发私信 Banner 用）
    dmBannerShown: 0,                // 本 session 已显示的私信 Banner 数（最多 2 条）

    // 持久化字段覆盖默认值（userId、userName 从 localStorage 恢复）
    ...persisted,
  };
}

// 将指定字段同步到 localStorage
function persistState(state) {
  try {
    PERSIST_KEYS.forEach(key => {
      if (state[key] !== null && state[key] !== undefined) {
        localStorage.setItem(`app_${key}`, state[key]);
      } else {
        localStorage.removeItem(`app_${key}`);
      }
    });
  } catch (e) {
    console.warn('[AppContext] localStorage 写入失败:', e.message);
  }
}

export function AppProvider({ children }) {
  const [state, setState] = useState(buildInitialState);

  // 每次状态变化时同步持久化字段到 localStorage
  useEffect(() => {
    persistState(state);
  }, [state.userId, state.userName]);

  // 更新单个或多个字段的工具函数
  const updateState = (updates) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  // 重置状态（开始新的群聊流程，但保留用户信息）
  const resetState = () => {
    setState(prev => ({
      ...buildInitialState(),
      // 保留用户已有信息，避免重复填写
      userId: prev.userId,
      userName: prev.userName,
    }));
  };

  // 彻底清除所有状态和 localStorage（恢复新用户）
  const clearAll = () => {
    try {
      PERSIST_KEYS.forEach(key => localStorage.removeItem(`app_${key}`));
    } catch (e) { /* ignore */ }
    const newUserId = generateUuid();
    try {
      localStorage.setItem('app_userId', newUserId);
    } catch (e) { /* ignore */ }
    setState({
      userId: newUserId,
      userName: null,
      currentRoomId: null,
      currentChatSessionId: null,
      chatDialogueScript: [],
      chatProgress: 0,
      userTurnCount: 0,
      settlementData: null,
      feedScrollIndex: 0,
      cardsSinceLastChat: 0,
      dmBannerShown: 0,
    });
  };

  return (
    <AppContext.Provider value={{ state, updateState, resetState, clearAll }}>
      {children}
    </AppContext.Provider>
  );
}

// 自定义 Hook：方便各组件使用全局状态
export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp 必须在 AppProvider 内使用');
  }
  return context;
}
