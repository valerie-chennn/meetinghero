import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import styles from './TabNavigator.module.css';

// 底部 Tab 配置
const TABS = [
  {
    path: '/feed',
    label: '每日胡说',
    icon: '🏠',
  },
  {
    path: '/expressions',
    label: '表达本',
    icon: '📖',
  },
  {
    path: '/profile',
    label: '我的',
    icon: '👤',
  },
];

// 需要隐藏 Tab 栏的路由前缀
const HIDDEN_PATHS = ['/chat/', '/settlement/', '/onboarding'];

// 根路径（开屏页）也隐藏 Tab 栏
const HIDDEN_EXACT = ['/'];

function TabNavigator() {
  const navigate = useNavigate();
  const location = useLocation();

  // 判断当前路由是否需要隐藏 Tab 栏
  const shouldHide = HIDDEN_PATHS.some(prefix =>
    location.pathname.startsWith(prefix)
  ) || HIDDEN_EXACT.includes(location.pathname);

  return (
    <nav
      className={styles.tabBar}
      style={{ display: shouldHide ? 'none' : 'flex' }}
      aria-label="底部导航"
    >
      {TABS.map(tab => {
        const isActive = location.pathname === tab.path ||
          (tab.path === '/feed' && location.pathname === '/');
        return (
          <button
            key={tab.path}
            className={`${styles.tabItem} ${isActive ? styles.tabItemActive : ''}`}
            onClick={() => navigate(tab.path)}
            aria-label={tab.label}
            aria-current={isActive ? 'page' : undefined}
          >
            <span className={styles.tabIcon} aria-hidden="true">{tab.icon}</span>
            <span className={styles.tabLabel}>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export default TabNavigator;
