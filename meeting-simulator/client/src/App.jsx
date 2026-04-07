import React, { useState, useCallback } from 'react';
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

// AppShell：手机壳容器 + Tab 导航栏
function AppShell() {
  const [splashDone, setSplashDone] = useState(false);
  const handleSplashDone = useCallback(() => setSplashDone(true), []);

  return (
    <div className="phone-wrapper">
      <div className="phone-frame">
        <div className="phone-screen">
          {/* 状态栏 + 刘海 */}
          <div className="phone-status-bar">
            <span>9:41</span>
            <div className="phone-notch" />
            <span style={{ fontSize: 12 }}>5G</span>
          </div>

          {/* 开屏覆盖层 */}
          {!splashDone && <SplashPage onDone={handleSplashDone} />}

          {/* 页面内容 */}
          <div className="phone-content">
            <Routes>
              <Route path="/" element={<RootRedirect />} />
              <Route path="/onboarding" element={<OnboardingPage />} />
              <Route path="/feed" element={<FeedPage />} />
              <Route path="/chat/:roomId" element={<ChatPage />} />
              <Route path="/settlement/:sessionId" element={<SettlementPage />} />
              <Route path="/expressions" element={<ExpressionsPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/reset" element={<ResetPage />} />
              <Route path="*" element={<Navigate to="/feed" replace />} />
            </Routes>
          </div>

          {/* Tab 导航栏 */}
          <TabNavigator />
        </div>
      </div>
    </div>
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
