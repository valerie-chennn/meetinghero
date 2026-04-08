import React, { useState, useCallback, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';

// ── 音频上下文解锁：用户首次点击时播放静音音频，解除浏览器 autoplay 限制 ──
// 解锁后后续所有 audio.play() 调用不再被拦截
function useAudioUnlock() {
  useEffect(() => {
    let unlocked = false;
    const unlock = () => {
      if (unlocked) return;
      unlocked = true;
      // 创建极短的静音音频并播放，解锁 AudioContext
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const buf = ctx.createBuffer(1, 1, 22050);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.connect(ctx.destination);
        src.start(0);
        // 同时用 Audio 元素解锁（部分浏览器需要）
        const audio = new Audio();
        audio.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
        audio.play().catch(() => {});
      } catch (e) { /* 静默忽略 */ }
      document.removeEventListener('click', unlock);
      document.removeEventListener('touchstart', unlock);
    };
    document.addEventListener('click', unlock, { once: true });
    document.addEventListener('touchstart', unlock, { once: true });
    return () => {
      document.removeEventListener('click', unlock);
      document.removeEventListener('touchstart', unlock);
    };
  }, []);
}

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
  // 用户首次点击时解锁音频，确保后续 TTS 能立即播放
  useAudioUnlock();

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
