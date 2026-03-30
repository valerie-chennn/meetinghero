import React from 'react';
import TtsButton from './TtsButton.jsx';
import styles from './ReviewCard.module.css';

/**
 * 复盘卡片组件
 * 根据 step 展示不同内容：
 * - userSaid: 你刚才说
 * - betterWay: 这里可以这样说
 * - pattern: 下次可以这么说
 * - practice: 试着说一次
 */
function ReviewCard({ step, data }) {
  if (!data) return null;

  switch (step) {
    case 'userSaid':
      return <UserSaidCard data={data} />;
    case 'betterWay':
      return <BetterWayCard data={data} />;
    case 'pattern':
      return <PatternCard data={data} />;
    case 'practice':
      return <PracticeCard data={data} />;
    default:
      return null;
  }
}

// 步骤 1：你刚才说
function UserSaidCard({ data }) {
  // 只有 original 和 english 不同时（用户输入了非英文内容），才显示系统转写区块
  const showTranscription = data.showTranscription;

  return (
    <div className={styles.card}>
      <div className={styles.stepHeader}>
        <span className={styles.stepNumber}>1</span>
        <span className={styles.stepTitle}>你刚才说</span>
      </div>
      <div className={styles.userSaidContent}>
        {/* 如果是中文输入，同时展示原文 */}
        {showTranscription && data.originalChinese && (
          <div className={styles.chineseBlock}>
            <p className={styles.chineseText}>{data.originalChinese}</p>
          </div>
        )}

        {/* 英文内容：只有非英文输入时才显示"系统转写"标签 */}
        <div className={styles.englishBlock}>
          {showTranscription && (
            <span className={styles.transcribeTag}>系统转写</span>
          )}
          <p className={styles.englishText}>{data.userText}</p>
        </div>
      </div>
    </div>
  );
}

// 步骤 2：这里可以这样说
function BetterWayCard({ data }) {
  return (
    <div className={`${styles.card} ${styles.betterWayCard}`}>
      <div className={styles.stepHeader}>
        <span className={`${styles.stepNumber} ${styles.stepNumberBright}`}>2</span>
        <span className={styles.stepTitle}>这里可以这样说</span>
      </div>

      {/* 完整句子 + TTS */}
      <div className={styles.betterSentenceRow}>
        {/* 高亮渲染：句型加粗紫色，搭配下划线青绿 */}
        <p className={styles.betterSentence}>
          {renderHighlightedText(data.betterText, data.highlights)}
        </p>
        {data.betterText && <TtsButton text={data.betterText} language="en" />}
      </div>

      {/* 翻译说明 */}
      {data.translation && (
        <p className={styles.translation}>{data.translation}</p>
      )}
    </div>
  );
}

// 步骤 3：下次可以这么说
function PatternCard({ data }) {
  return (
    <div className={`${styles.card} ${styles.patternCard}`}>
      <div className={styles.stepHeader}>
        <span className={styles.stepNumber}>3</span>
        <span className={styles.stepTitle}>下次可以这么说</span>
      </div>

      {/* 句型卡片（紫色左边框）*/}
      {data.pattern && (
        <div className={styles.patternBlock}>
          <span className={styles.patternLabel}>句型</span>
          <p className={styles.patternText}>{data.pattern}</p>
        </div>
      )}

      {/* 搭配词 */}
      {data.collocations && data.collocations.length > 0 && (
        <div className={styles.collocationsBlock}>
          <span className={styles.collocationsLabel}>搭配</span>
          <div className={styles.collocationsRow}>
            {data.collocations.map((col, idx) => (
              <span key={idx} className={styles.collocationChip}>{col}</span>
            ))}
          </div>
        </div>
      )}

      {/* 场景说明 */}
      {data.usage && (
        <p className={styles.usageText}>{data.usage}</p>
      )}
    </div>
  );
}

// 步骤 4：试着说一次（输入由父组件处理）
function PracticeCard({ data }) {
  return (
    <div className={`${styles.card} ${styles.practiceCard}`}>
      <div className={styles.stepHeader}>
        <span className={styles.stepNumber}>4</span>
        <span className={styles.stepTitle}>试着说一次</span>
      </div>

      {/* 新场景描述 */}
      {data.scenario && (
        <div className={styles.scenarioBlock}>
          <span className={styles.scenarioLabel}>新场景</span>
          <p className={styles.scenarioText}>{data.scenario}</p>
        </div>
      )}

      {/* 用户任务 */}
      {data.task && (
        <p className={styles.taskText}>{data.task}</p>
      )}

      {/* 提示 */}
      {data.hint && (
        <p className={styles.hintText}>
          <span className={styles.hintIcon}>💡</span>
          {data.hint}
        </p>
      )}
    </div>
  );
}

/**
 * 高亮文本渲染：
 * highlights 格式：[{ text: '...', type: 'pattern'|'collocation' }]
 * type=pattern 时：加粗 + accent-purple 背景
 * type=collocation 时：下划线 + accent-teal 颜色
 */
function renderHighlightedText(fullText, highlights) {
  if (!highlights || highlights.length === 0) {
    return fullText;
  }

  // 简单实现：按 highlights 分割文本并高亮
  let remaining = fullText;
  const parts = [];

  highlights.forEach((hl, idx) => {
    const pos = remaining.indexOf(hl.text);
    if (pos === -1) return;

    // 高亮前的普通文字
    if (pos > 0) {
      parts.push(<span key={`text-${idx}`}>{remaining.slice(0, pos)}</span>);
    }

    // 高亮部分
    if (hl.type === 'pattern') {
      parts.push(
        <strong key={`hl-${idx}`} className={styles.patternHighlight}>
          {hl.text}
        </strong>
      );
    } else if (hl.type === 'collocation') {
      parts.push(
        <em key={`hl-${idx}`} className={styles.collocationHighlight}>
          {hl.text}
        </em>
      );
    } else {
      parts.push(<span key={`hl-${idx}`}>{hl.text}</span>);
    }

    remaining = remaining.slice(pos + hl.text.length);
  });

  // 剩余文字
  if (remaining) {
    parts.push(<span key="remainder">{remaining}</span>);
  }

  return parts.length > 0 ? parts : fullText;
}

export default ReviewCard;
