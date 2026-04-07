import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';

// ── 推流版新页面 ──
import SplashPage from './pages/SplashPage.jsx';
import OnboardingPage from './pages/OnboardingPage.jsx';
import FeedPage from './pages/FeedPage.jsx';
import ChatPage from './pages/ChatPage.jsx';
import SettlementPage from './pages/SettlementPage.jsx';
import ExpressionsPage from './pages/ExpressionsPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';

// ── 共用组件 ──
import TabNavigator from './components/TabNavigator.jsx';

// 重置页面：清除所有数据并跳转到首页
function ResetPage() {
  const { clearAll } = useApp();
  React.useEffect(() => {
    clearAll();
    window.location.href = '/';
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

// 根路由守卫：有 userName 则进 Feed，否则进 Onboarding（用于非开屏场景）
function RootRedirect() {
  const { state } = useApp();
  if (state.userName) {
    return <Navigate to="/feed" replace />;
  }
  return <Navigate to="/onboarding" replace />;
}

// AppShell：包含 Tab 导航栏的外层容器
function AppShell() {
  return (
    <>
      <Routes>
        {/* 根路由：开屏页（2-3秒后自动跳转） */}
        <Route path="/" element={<SplashPage />} />
        {/* Onboarding：简化版，只填花名 */}
        <Route path="/onboarding" element={<OnboardingPage />} />
        {/* Feed 主页 */}
        <Route path="/feed" element={<FeedPage />} />
        {/* 群聊页：全屏，无 Tab 栏 */}
        <Route path="/chat/:roomId" element={<ChatPage />} />
        {/* 结算页：全屏，无 Tab 栏 */}
        <Route path="/settlement/:sessionId" element={<SettlementPage />} />
        {/* 表达本 */}
        <Route path="/expressions" element={<ExpressionsPage />} />
        {/* 我的 */}
        <Route path="/profile" element={<ProfilePage />} />
        {/* 重置路由：清除所有数据，恢复新用户（开发用）*/}
        <Route path="/reset" element={<ResetPage />} />
        {/* 兜底重定向到 Feed */}
        <Route path="*" element={<Navigate to="/feed" replace />} />
      </Routes>
      {/* Tab 导航栏：在 /chat 和 /settlement 路由时自动隐藏 */}
      <TabNavigator />
    </>
  );
}

// 应用根组件：配置路由和全局上下文
function App() {
  return (
    <AppProvider>
      <ToastProvider>
        <BrowserRouter>
          <AppShell />
        </BrowserRouter>
      </ToastProvider>
    </AppProvider>
  );
}

export default App;
