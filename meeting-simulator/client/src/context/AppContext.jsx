import React, { createContext, useContext, useState, useEffect } from 'react';

// 全局应用状态上下文
const AppContext = createContext(null);

// localStorage 中持久化的字段列表
// sceneType 是会话级字段，不持久化（用户刷新后应重新选择模式）
const PERSIST_KEYS = ['sessionId', 'userName', 'englishLevel', 'jobTitle', 'industry'];

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

// 初始状态（从 localStorage 恢复持久化字段）
function buildInitialState() {
  const persisted = loadPersistedState();
  return {
    sessionId: null,        // 会话 ID
    userName: null,         // 用户名字
    meetingId: null,        // 会议 ID
    englishLevel: null,     // 英文水平（A1/A2/B1/B2）
    jobTitle: null,         // 职位
    industry: null,         // 行业
    meetingData: null,      // 完整的会议数据（含 briefing、participants、conversations）
    reviewData: null,       // 复盘数据
    conversations: [],      // 用户在关键节点的输入记录
    // ── 会话级字段（不持久化）──
    pendingMode: null,          // 用户在首页选的模式，onboarding 完成后用于跳转：'brainstorm' | 'formal'
    // ── 脑洞模式字段（会话级，不持久化）──
    sceneType: null,            // 场景类型：'formal' | 'brainstorm-pick' | 'brainstorm-random'
    brainstormWorld: null,      // 点将局：用户搜索的 IP/世界名称
    brainstormCharacters: [],   // 已选角色对象数组（含 id/name/world/worldLabel/persona）
    brainstormMainWorld: null,  // 确定的主场景世界 ID（ThemePreview 传给 generate）
    themeRefreshCount: 0,       // 当前会话已换主题次数（0-3，不持久化）
    brainstormTheme: null,      // AI 生成的主题数据
    ...persisted,           // 覆盖持久化的字段
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
  }, [state.sessionId, state.userName, state.englishLevel, state.jobTitle, state.industry]);

  // 更新单个或多个字段的工具函数
  const updateState = (updates) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  // 重置状态（开始新的会议流程，但保留用户信息）
  const resetState = () => {
    setState(prev => ({
      ...buildInitialState(),
      // 保留用户已有信息，避免重复填写
      sessionId: prev.sessionId,
      userName: prev.userName,
      englishLevel: prev.englishLevel,
      jobTitle: prev.jobTitle,
      industry: prev.industry,
    }));
  };

  // 彻底清除所有状态和 localStorage（恢复新用户）
  const clearAll = () => {
    try {
      PERSIST_KEYS.forEach(key => localStorage.removeItem(`app_${key}`));
    } catch (e) { /* ignore */ }
    setState({
      sessionId: null, userName: null, meetingId: null,
      englishLevel: null, jobTitle: null, industry: null,
      meetingData: null, reviewData: null, conversations: [],
      // 脑洞模式字段同步清除
      pendingMode: null,
      sceneType: null, brainstormWorld: null, brainstormCharacters: [],
      brainstormMainWorld: null, themeRefreshCount: 0, brainstormTheme: null,
    });
  };

  // 添加一条对话记录
  const addConversation = (conversation) => {
    setState(prev => ({
      ...prev,
      conversations: [...prev.conversations, conversation]
    }));
  };

  return (
    <AppContext.Provider value={{ state, updateState, resetState, clearAll, addConversation }}>
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
