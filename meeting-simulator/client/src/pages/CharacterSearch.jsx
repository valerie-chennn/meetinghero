import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { searchCharacters } from '../api/index.js';
import styles from './CharacterSearch.module.css';

// 热门 IP 推荐标签
const HOT_IP_TAGS = ['西游记', '哈利波特', '三国', '漫威', '甄嬛传', '海贼王', '红楼梦', '权游'];

/**
 * 角色搜索页（点将局专用）
 * 路由：/brainstorm/search
 * 用户输入 IP 名称 → 调用 API 获取角色列表 → 跳转选择页
 */
function CharacterSearch() {
  const navigate = useNavigate();
  const { state, updateState } = useApp();

  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  // 搜索结果状态：null=未搜索，'tooFew'=结果不足，Array=正常结果
  const [searchResult, setSearchResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  // 执行搜索
  const handleSearch = async (searchQuery) => {
    const q = searchQuery.trim();
    if (!q) return;

    setIsLoading(true);
    setSearchResult(null);
    setErrorMsg('');

    try {
      const result = await searchCharacters(q, state.sessionId);

      if (result.tooFew) {
        // 角色不足 4 个
        setSearchResult('tooFew');
        setErrorMsg(result.message || '找到的角色太少，换个关键词试试');
      } else {
        // 保存搜索到的角色列表和世界信息，跳转选择页
        updateState({
          brainstormWorld: q,
          // 临时存储搜索结果供 CharacterSelect 使用（借用 brainstormTheme 字段的搜索结果部分）
          _searchedCharacters: result.characters,
          _searchedWorldLabel: result.worldLabel || '',
        });
        navigate('/brainstorm/characters');
      }
    } catch (err) {
      console.error('搜索角色失败:', err);
      setErrorMsg('搜索失败，请重试');
      setSearchResult('error');
    } finally {
      setIsLoading(false);
    }
  };

  // 点击热门标签
  const handleTagClick = (tag) => {
    setQuery(tag);
    handleSearch(tag);
  };

  // 回车搜索
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSearch(query);
    }
  };

  return (
    <div className={styles.container}>
      {/* ===== 顶部导航区 ===== */}
      <div className={styles.topNav}>
        <button className={styles.backBtn} onClick={() => navigate('/brainstorm')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M19 12H5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <path d="M12 19L5 12L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <span className={styles.navTitle}>点将局</span>
      </div>

      {/* ===== 内容区 ===== */}
      <div className={styles.content}>
        {/* 页面大标题 */}
        <h1 className={styles.pageTitle}>想跟谁开会？</h1>

        {/* 搜索输入框 */}
        <div className={styles.searchBox}>
          <div className={styles.searchInputWrap}>
            {/* 搜索图标 */}
            <svg className={styles.searchIcon} width="18" height="18" viewBox="0 0 24 24" fill="none">
              <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/>
              <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <input
              className={styles.searchInput}
              type="text"
              placeholder="输入角色、作品名称..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
            />
            {/* 清除按钮 */}
            {query && (
              <button className={styles.clearBtn} onClick={() => { setQuery(''); setSearchResult(null); setErrorMsg(''); }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            )}
          </div>
          {/* 搜索按钮 */}
          <button
            className={`${styles.searchBtn} ${query.trim() ? styles.searchBtnActive : ''}`}
            onClick={() => handleSearch(query)}
            disabled={!query.trim() || isLoading}
          >
            {isLoading ? (
              <span className={styles.loadingDots}>
                <span></span><span></span><span></span>
              </span>
            ) : '搜索'}
          </button>
        </div>

        {/* 热门推荐标签 */}
        {!isLoading && !searchResult && (
          <div className={styles.hotSection}>
            <p className={styles.hotLabel}>热门 IP</p>
            <div className={styles.tagList}>
              {HOT_IP_TAGS.map(tag => (
                <button
                  key={tag}
                  className={`${styles.tag} ${query === tag ? styles.tagActive : ''}`}
                  onClick={() => handleTagClick(tag)}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 搜索加载态——"召唤中"状态，替代无聊的灰色骨架屏 */}
        {isLoading && (
          <div className={styles.summonLoading}>
            {/* 脉冲圆点：表达"正在进行" */}
            <div className={styles.summonDots}>
              <span className={styles.summonDot} />
              <span className={styles.summonDot} />
              <span className={styles.summonDot} />
            </div>
            {/* 带关键字的动态文案 */}
            <p className={styles.summonText}>
              正在从<span className={styles.summonKeyword}>「{query}」</span>世界召唤角色...
            </p>
            {/* 占位行：暗示即将出现的角色卡片 */}
            <div className={styles.summonLines}>
              <div className={styles.summonLine} style={{ width: '72%' }} />
              <div className={styles.summonLine} style={{ width: '55%' }} />
              <div className={styles.summonLine} style={{ width: '88%' }} />
            </div>
          </div>
        )}

        {/* 结果不足提示 */}
        {(searchResult === 'tooFew' || searchResult === 'error') && (
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon}>🤔</span>
            <p className={styles.emptyText}>{errorMsg}</p>
            <button
              className={styles.retryBtn}
              onClick={() => { setSearchResult(null); setQuery(''); setErrorMsg(''); }}
            >
              换一个试试
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default CharacterSearch;
