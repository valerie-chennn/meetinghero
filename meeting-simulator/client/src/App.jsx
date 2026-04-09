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
      try {
        // ── 关键：创建全局单例 Audio 元素并在 user gesture 内 play 一次 ──
        // iOS Safari 的规则：每个 Audio 实例都要在 user gesture 内 play 过一次才能解锁。
        // 一旦这个"实例"被解锁，后续改它的 src 可以在任何时候 play（跨 await 也行）。
        // ChatPage 的 playTts 会复用 window.__unlockedAudio 这个实例，而不是 new Audio()。
        if (!window.__unlockedAudio) {
          const audio = new Audio();
          audio.playsInline = true;
          // 静音的 wav data URL
          audio.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
          audio.play().catch(() => {});
          window.__unlockedAudio = audio;
        }
        // 同时解锁 AudioContext（TTS 的 Web Audio 路径需要）
        // iOS Safari 关键坑：光 resume() 不够，必须在 user gesture 内真正 play 过
        // 一个 buffer source 才算"激活"，之后在任意时刻 play 新的 source 才会出声
        // 这是 iOS Safari Web Audio 社区公认的解锁姿势
        if (!window.__sharedAudioCtx) {
          window.__sharedAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        const ctx = window.__sharedAudioCtx;
        // 1. 同步 play 一个 1-sample 的静音 buffer，强制 iOS Safari 激活
        try {
          const silentBuffer = ctx.createBuffer(1, 1, 22050);
          const silentSource = ctx.createBufferSource();
          silentSource.buffer = silentBuffer;
          silentSource.connect(ctx.destination);
          silentSource.start(0);
        } catch (audioUnlockErr) {
          // 某些旧浏览器不支持 createBuffer/createBufferSource，忽略
        }
        // 2. 再 resume 一次兜底（有些 iOS 版本需要显式 resume）
        if (ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
        }
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
