import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { submitPractice } from '../api/index.js';
import UserInput from '../components/UserInput.jsx';
import TtsButton from '../components/TtsButton.jsx';
import styles from './ReviewNodes.module.css';

/**
 * 在句子中高亮 pattern 中提取的关键词
 * @param {string} sentence - 完整句子
 * @param {string} pattern - 句式模板（如 "X is blocking Y"）
 * @returns {React.ReactNode}
 */
function renderHighlightedSentence(sentence, pattern) {
  if (!sentence) return null;
  if (!pattern) return <span>{sentence}</span>;

  // 从 pattern 中提取关键词（去掉占位符 X/Y 和方括号，保留长度大于 2 的词）
  const keywords = pattern
    .replace(/\[?[XY]\]?/g, '')
    .trim()
    .split(/\s+/)
    .filter(w => w.length > 2);

  if (keywords.length === 0) return <span>{sentence}</span>;

  // 逐步对 parts 数组中的字符串部分进行高亮替换
  let parts = [sentence];
  keywords.forEach(kw => {
    parts = parts.flatMap(part => {
      if (typeof part !== 'string') return [part];
      const idx = part.toLowerCase().indexOf(kw.toLowerCase());
      if (idx === -1) return [part];
      return [
        part.slice(0, idx),
        <mark key={`${kw}-${idx}`} className={styles.highlight}>
          {part.slice(idx, idx + kw.length)}
        </mark>,
        part.slice(idx + kw.length),
      ].filter(part => part !== '');
    });
  });

  return <span>{parts}</span>;
}

/**
 * 复盘学习页（翻卡片 + 分级练习版）—— 瀑布流版本
 *
 * 每个节点分步展示，步骤内容从上到下依次追加，已完成的步骤不会消失。
 * 步骤：card → flipped → practice → done
 *
 * 3 个节点依次进行，全部完成后展示汇总并跳转完成页。
 */
function ReviewNodes() {
  const navigate = useNavigate();
  const { state } = useApp();
  const { meetingId, reviewData, englishLevel } = state;

  // ===== 核心状态 =====
  // 当前节点索引（0/1/2）
  const [currentNodeIndex, setCurrentNodeIndex] = useState(0);
  // 瀑布流步骤数组：['card'] | ['card','flipped'] | ['card','flipped','practice'] | ...
  const [visibleSteps, setVisibleSteps] = useState(['card']);
  // 已掌握的句型列表，用于最终汇总展示
  const [masteredPatterns, setMasteredPatterns] = useState([]);

  // ===== A1 词块拼句状态 =====
  const [correctWords, setCorrectWords] = useState([]);
  const [shuffledWords, setShuffledWords] = useState([]);
  const [selectedWords, setSelectedWords] = useState([]);

  // ===== 练习反馈状态 =====
  const [practiceResult, setPracticeResult] = useState(null);
  const [isSubmittingPractice, setIsSubmittingPractice] = useState(false);
  const [practiceFeedback, setPracticeFeedback] = useState(null);

  // 瀑布流底部锚点，用于追加新步骤时自动滚动
  const waterfallBottomRef = useRef(null);

  // 若没有复盘数据，跳回首页
  useEffect(() => {
    if (!reviewData) {
      navigate('/');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 每次 visibleSteps 更新时，自动滚动到瀑布流底部
  useEffect(() => {
    if (waterfallBottomRef.current) {
      waterfallBottomRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [visibleSteps]);

  if (!reviewData) return null;

  const nodes = reviewData.nodes || [];
  const totalNodes = nodes.length;
  const node = nodes[currentNodeIndex];
  const level = englishLevel || 'A2';

  // ===== 步骤切换处理 =====

  /**
   * 翻开卡片：追加 flipped 步骤到瀑布流
   */
  const handleFlip = () => {
    setVisibleSteps(prev => [...prev, 'flipped']);
  };

  /**
   * 开始练习：初始化练习状态并追加 practice 步骤
   */
  const handleStartPractice = () => {
    // 重置练习相关状态
    setPracticeResult(null);
    setPracticeFeedback(null);

    // A1 等级：初始化词块拼句数据
    if (level === 'A1' && node?.betterWay?.sentence) {
      const words = node.betterWay.sentence
        .replace(/[.,!?;:]/g, '')
        .split(/\s+/)
        .filter(w => w.length > 0);
      setCorrectWords(words);
      const shuffled = [...words].sort(() => Math.random() - 0.5);
      setShuffledWords(shuffled);
      setSelectedWords([]);
    }

    setVisibleSteps(prev => [...prev, 'practice']);
  };

  /**
   * A1 词块：用户点击词块加入答题区
   */
  const addWord = (word) => {
    setSelectedWords(prev => [...prev, word]);
  };

  /**
   * A1 词块：用户点击答题区词块，从答题区移除
   */
  const removeWord = (idx) => {
    setSelectedWords(prev => prev.filter((_, i) => i !== idx));
  };

  // ===== A1 拼句自动检测 =====
  useEffect(() => {
    if (level !== 'A1' || !visibleSteps.includes('practice')) return;
    if (selectedWords.length === 0 || correctWords.length === 0) return;
    if (selectedWords.length !== correctWords.length) return;

    const isCorrect = selectedWords.every(
      (w, i) => w.toLowerCase() === correctWords[i].toLowerCase()
    );

    if (isCorrect) {
      setPracticeResult('correct');
      setTimeout(() => {
        setPracticeResult(null);
        handleNodeDone();
      }, 800);
    } else {
      setPracticeResult('incorrect');
      setTimeout(() => {
        setSelectedWords([]);
        setPracticeResult(null);
      }, 1000);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWords]);

  /**
   * A2/B1/B2 练习提交处理
   */
  const handlePracticeSubmit = async (text) => {
    if (!text.trim() || isSubmittingPractice) return;
    setIsSubmittingPractice(true);
    try {
      const result = await submitPractice(meetingId, currentNodeIndex, text);
      setPracticeFeedback(result.feedback || '很好！继续加油！');
    } catch (err) {
      console.error('提交练习失败:', err);
      setPracticeFeedback('不错的尝试！继续保持！');
    } finally {
      setIsSubmittingPractice(false);
    }
  };

  /**
   * 当前节点练习完成：记录已掌握句型，追加 done 步骤
   */
  const handleNodeDone = () => {
    if (node?.pattern?.mainPattern) {
      setMasteredPatterns(prev => [
        ...prev,
        {
          pattern: node.pattern.mainPattern,
          example: node.betterWay?.sentence || '',
        },
      ]);
    }
    setVisibleSteps(prev => [...prev, 'done']);
  };

  /**
   * 点击"下一个节点"或"查看总结"：切换到下一节点并重置状态
   */
  const handleNextNode = () => {
    if (currentNodeIndex < totalNodes - 1) {
      // 进入下一节点，重置瀑布流为初始状态
      setCurrentNodeIndex(prev => prev + 1);
      setVisibleSteps(['card']);
      setSelectedWords([]);
      setShuffledWords([]);
      setCorrectWords([]);
      setPracticeResult(null);
      setPracticeFeedback(null);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      // 所有节点完成，追加 summary 步骤（通过特殊判断渲染汇总页）
      setVisibleSteps(prev => [...prev, 'summary']);
    }
  };

  // ===== 计算词块使用状态（避免重复选同一词块） =====
  const isWordUsed = (word, index) => {
    const usedCount = selectedWords.filter(w => w === word).length;
    const availableCount = shuffledWords.slice(0, index + 1).filter(w => w === word).length;
    return usedCount >= availableCount;
  };

  // ===== 渲染 =====

  // 全部完成汇总页（当 visibleSteps 包含 summary 时全页替换渲染）
  if (visibleSteps.includes('summary')) {
    return (
      <div className={styles.container}>
        <div className={styles.summarySection}>
          <h2 className={styles.summaryTitle}>本次学到的句式</h2>
          {masteredPatterns.map((p, i) => (
            <div key={i} className={styles.summaryCard}>
              <span className={styles.summaryCheck}>✅</span>
              <div className={styles.summaryContent}>
                <p className={styles.summaryPattern}>{p.pattern}</p>
                <p className={styles.summaryExample}>"{p.example}"</p>
              </div>
            </div>
          ))}
          <button
            className={styles.completeButton}
            onClick={() => navigate('/complete')}
          >
            完成复盘
          </button>
        </div>
      </div>
    );
  }

  // 当前节点不存在时的兜底
  if (!node) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <p>暂无复盘数据</p>
          <button onClick={() => navigate('/')}>返回首页</button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* 顶部节点进度 */}
      <div className={styles.header}>
        <div className={styles.nodeProgress}>
          {nodes.map((_, idx) => (
            <div
              key={idx}
              className={`${styles.nodeDot} ${
                idx === currentNodeIndex
                  ? styles.nodeDotCurrent
                  : idx < currentNodeIndex
                  ? styles.nodeDotDone
                  : ''
              }`}
            />
          ))}
        </div>
        <p className={styles.nodeLabel}>
          节点 {currentNodeIndex + 1} / {totalNodes}
        </p>
      </div>

      {/* 瀑布流内容区：所有已完成步骤从上到下依次展示，新步骤追加在底部 */}
      <div className={styles.waterfall}>

        {/* ===== Step 1：你刚才说（翻卡前） ===== */}
        {visibleSteps.includes('card') && (
          <div className={styles.stepBlock}>
            <p className={styles.cardLabel}>你刚才说</p>
            <div className={styles.userSaidCard}>
              <p className={styles.userSaidText}>
                {node.userSaid?.original || node.userSaid?.english || '（未发言）'}
              </p>
              {/* 原话是中文/混合时，额外展示英文意译 */}
              {node.userSaid?.original &&
                node.userSaid?.english &&
                node.userSaid.original.trim() !== node.userSaid.english.trim() && (
                  <p className={styles.userSaidTranslation}>{node.userSaid.english}</p>
                )}
            </div>
            {/* 只有在 flipped 还未出现时才显示翻牌按钮 */}
            {!visibleSteps.includes('flipped') && (
              <button className={styles.flipButton} onClick={handleFlip}>
                点击翻开，看看更地道的说法
              </button>
            )}
          </div>
        )}

        {/* ===== Step 2：更地道的说法（翻开后） ===== */}
        {visibleSteps.includes('flipped') && (
          <div className={styles.stepBlock}>
            {/* 意图分析：先告诉用户 AI 理解了他想表达什么 */}
            {node.betterWay?.intentAnalysis && (
              <p className={styles.intentAnalysis}>
                💬 你想表达的是：{node.betterWay.intentAnalysis}
              </p>
            )}
            {/* 用户说得不错时先单独展示肯定语 */}
            {node.betterWay?.type === 'alternative' && (
              <p className={styles.userDidGood}>✅ 说得不错！</p>
            )}
            {/* 标签文案根据 type 变化：better → 更好的说法，alternative → 解锁新表达 */}
            <p className={styles.flippedLabel}>
              {node.betterWay?.type === 'alternative' ? '解锁新表达 🔓' : '更好的说法'}
            </p>
            <div className={styles.betterWayCard}>
              {/* 高亮展示推荐句 */}
              <p className={styles.betterSentence}>
                {renderHighlightedSentence(
                  node.betterWay?.sentence,
                  node.betterWay?.highlightPattern
                )}
              </p>

              {/* 句式标签 */}
              {node.pattern?.mainPattern && (
                <div className={styles.patternTag}>
                  句式：{node.pattern.mainPattern}
                </div>
              )}

              {/* 词块解释：在高亮句子下方、中文翻译上方 */}
              {node.betterWay?.collocationExplain &&
                Object.keys(node.betterWay.collocationExplain).length > 0 && (
                  <div className={styles.collocationList}>
                    {Object.entries(node.betterWay.collocationExplain).map(([word, explain]) => (
                      <p key={word} className={styles.collocationItem}>
                        📖 {word} = {explain}
                      </p>
                    ))}
                  </div>
                )}

              {/* 中文翻译 */}
              {node.betterWay?.sentenceZh && (
                <p className={styles.betterZh}>{node.betterWay.sentenceZh}</p>
              )}

              {/* 一句话说明这种表达好在哪里 */}
              {node.betterWay?.whyBetter && (
                <p className={styles.whyBetter}>💡 {node.betterWay.whyBetter}</p>
              )}

              {/* TTS 听一听 */}
              {node.betterWay?.sentence && (
                <div className={styles.ttsRow}>
                  <TtsButton text={node.betterWay.sentence} language="en-US" />
                  <span className={styles.ttsLabel}>听一听</span>
                </div>
              )}
            </div>

            {/* 只有在 practice 还未出现时才显示开始练习按钮 */}
            {!visibleSteps.includes('practice') && (
              <button className={styles.practiceButton} onClick={handleStartPractice}>
                记住了，开始练习
              </button>
            )}
          </div>
        )}

        {/* ===== Step 3：练习区 ===== */}
        {visibleSteps.includes('practice') && !visibleSteps.includes('done') && (
          <div className={styles.stepBlock}>
            <div className={styles.practiceSection}>

              {/* A1：词块拼句 */}
              {level === 'A1' && (
                <>
                  <p className={styles.practiceLabel}>把刚才的句子拼回来：</p>
                  <div
                    className={`${styles.selectedArea} ${
                      practiceResult === 'correct'
                        ? styles.selectedAreaCorrect
                        : practiceResult === 'incorrect'
                        ? styles.selectedAreaIncorrect
                        : ''
                    }`}
                  >
                    {correctWords.map((_, i) => (
                      <div key={i} className={styles.wordSlot}>
                        {selectedWords[i] ? (
                          <button
                            className={styles.selectedWord}
                            onClick={() => removeWord(i)}
                            disabled={practiceResult !== null}
                          >
                            {selectedWords[i]}
                          </button>
                        ) : (
                          <span className={styles.emptySlot}>___</span>
                        )}
                      </div>
                    ))}
                  </div>
                  <p className={styles.practiceHint}>点击词块，按顺序拼：</p>
                  <div className={styles.wordBank}>
                    {shuffledWords.map((word, i) => {
                      const used = isWordUsed(word, i);
                      return (
                        <button
                          key={i}
                          className={`${styles.wordChip} ${used ? styles.wordChipUsed : ''}`}
                          onClick={() => !used && addWord(word)}
                          disabled={used || practiceResult !== null}
                        >
                          {word}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              {/* A2：原场景重新说 */}
              {level === 'A2' && (
                <>
                  <p className={styles.practiceLabel}>回到刚才的场景，重新说：</p>
                  <div className={styles.scenarioCard}>
                    <p className={styles.scenarioPrompt}>{node.prompt}</p>
                  </div>
                  <p className={styles.practiceHint}>
                    这次用 <strong>{node.pattern?.mainPattern}</strong> 重新回答：
                  </p>
                  {!practiceFeedback ? (
                    <UserInput
                      placeholder="输入你的发言（支持中英文）"
                      onSubmit={handlePracticeSubmit}
                      disabled={isSubmittingPractice}
                    />
                  ) : (
                    <div className={styles.feedbackCard}>
                      <p className={styles.feedbackText}>{practiceFeedback}</p>
                      <button className={styles.doneSmallButton} onClick={handleNodeDone}>
                        继续
                      </button>
                    </div>
                  )}
                </>
              )}

              {/* B1/B2：新场景迁移 */}
              {(level === 'B1' || level === 'B2') && (
                <>
                  <p className={styles.practiceLabel}>换个场景试试：</p>
                  <div className={styles.scenarioCard}>
                    <p className={styles.scenarioPrompt}>{node.practice?.scenario}</p>
                  </div>
                  <p className={styles.practiceHint}>
                    用 <strong>{node.pattern?.mainPattern}</strong> 回答：
                  </p>
                  {!practiceFeedback ? (
                    <UserInput
                      placeholder="输入你的发言（支持中英文）"
                      onSubmit={handlePracticeSubmit}
                      disabled={isSubmittingPractice}
                    />
                  ) : (
                    <div className={styles.feedbackCard}>
                      <p className={styles.feedbackText}>{practiceFeedback}</p>
                      <button className={styles.doneSmallButton} onClick={handleNodeDone}>
                        继续
                      </button>
                    </div>
                  )}
                </>
              )}

              {/* A1 之外等级的"跳过练习"出口 */}
              {level !== 'A1' && !practiceFeedback && (
                <button className={styles.skipPracticeButton} onClick={handleNodeDone}>
                  跳过练习
                </button>
              )}
            </div>
          </div>
        )}

        {/* ===== Step 4：节点完成（句型卡片 + 下一节点按钮） ===== */}
        {visibleSteps.includes('done') && (
          <div className={styles.stepBlock}>
            <div className={styles.doneSection}>
              <div className={styles.patternCard}>
                <span className={styles.checkmark}>✅</span>
                <p className={styles.patternCardLabel}>你掌握了</p>
                <p className={styles.patternCardText}>{node.pattern?.mainPattern}</p>
                {node.betterWay?.sentence && (
                  <p className={styles.patternCardExample}>"{node.betterWay.sentence}"</p>
                )}
              </div>
              <button className={styles.nextNodeButton} onClick={handleNextNode}>
                {currentNodeIndex < totalNodes - 1 ? '下一个节点' : '查看总结'}
              </button>
            </div>
          </div>
        )}

        {/* 瀑布流底部锚点，用于自动滚动到最新步骤 */}
        <div ref={waterfallBottomRef} style={{ height: 24 }}></div>
      </div>
    </div>
  );
}

export default ReviewNodes;
