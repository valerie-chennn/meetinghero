import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import Home from './pages/Home.jsx';
import Onboarding from './pages/Onboarding.jsx';
import WorkInfoStep from './pages/WorkInfoStep.jsx';
import SourceSelect from './pages/SourceSelect.jsx';
import Loading from './pages/Loading.jsx';
import PreMeeting from './pages/PreMeeting.jsx';
import Meeting from './pages/Meeting.jsx';
import Review from './pages/Review.jsx';
import ReviewNodes from './pages/ReviewNodes.jsx';
import Complete from './pages/Complete.jsx';
import History from './pages/History.jsx';
import BrainstormEntry from './pages/BrainstormEntry.jsx';
import CharacterSearch from './pages/CharacterSearch.jsx';
import CharacterSelect from './pages/CharacterSelect.jsx';
import RandomDraw from './pages/RandomDraw.jsx';
import ThemePreview from './pages/ThemePreview.jsx';

// 重置页面：清除所有数据并跳转到首页
function ResetPage() {
  const { clearAll } = useApp();
  React.useEffect(() => {
    clearAll();
    window.location.href = '/';
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

// 应用根组件：配置路由和全局上下文
function App() {
  return (
    <AppProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            {/* 首页：两个模式入口 */}
            <Route path="/" element={<Home />} />
            {/* Onboarding 页面：花名 + 英语等级（2 步） */}
            <Route path="/onboarding" element={<Onboarding />} />
            {/* 正经开会补充信息：职位 + 行业（仅缺少信息时进入）*/}
            <Route path="/work-info" element={<WorkInfoStep />} />
            {/* 会议来源选择 */}
            <Route path="/source" element={<SourceSelect />} />
            {/* 脑洞模式入口：点将局 / 乱炖局 */}
            <Route path="/brainstorm" element={<BrainstormEntry />} />
            {/* 角色搜索页（点将局）*/}
            <Route path="/brainstorm/search" element={<CharacterSearch />} />
            {/* 角色选择页（点将局）*/}
            <Route path="/brainstorm/characters" element={<CharacterSelect />} />
            {/* 随机抽签页（乱炖局）*/}
            <Route path="/brainstorm/random" element={<RandomDraw />} />
            {/* 主题预览页（点将局 + 乱炖局共用）*/}
            <Route path="/brainstorm/theme" element={<ThemePreview />} />
            {/* 加载页：生成会议中 */}
            <Route path="/loading" element={<Loading />} />
            {/* 会前 Briefing */}
            <Route path="/pre-meeting" element={<PreMeeting />} />
            {/* 会中聊天流 */}
            <Route path="/meeting" element={<Meeting />} />
            {/* 会后总结页：称号 + 角色私信 */}
            <Route path="/review" element={<Review />} />
            {/* 复盘学习页：逐节点复盘 */}
            <Route path="/review/nodes" element={<ReviewNodes />} />
            {/* 完成页：难度反馈 + 再来一场 */}
            <Route path="/complete" element={<Complete />} />
            {/* 历史记录：展示用户过去的练习记录 */}
            <Route path="/history" element={<History />} />
            {/* 重置路由：清除所有数据，恢复新用户 */}
            <Route path="/reset" element={<ResetPage />} />
            {/* 兜底重定向到首页 */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AppProvider>
  );
}

export default App;
