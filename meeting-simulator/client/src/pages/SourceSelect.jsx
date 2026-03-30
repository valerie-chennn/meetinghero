import React, { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import styles from './SourceSelect.module.css';

/**
 * 会议来源选择页
 * 两个选项：生成模拟周会 / 上传自己的会议资料
 */
function SourceSelect() {
  const navigate = useNavigate();
  const { updateState } = useApp();
  const { showError } = useToast();
  const fileInputRef = useRef(null);

  // 选择生成模拟会议
  const handleGenerate = () => {
    updateState({ meetingSource: 'generate', uploadContent: null });
    navigate('/loading');
  };

  // 触发文件选择
  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  // 读取上传的文件内容
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 校验文件类型
    const allowedTypes = ['text/plain', 'application/pdf'];
    const allowedExtensions = ['.txt', '.pdf'];
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));

    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(ext)) {
      showError('只支持 .txt 和 .pdf 文件');
      return;
    }

    try {
      let content = '';

      if (file.type === 'text/plain' || ext === '.txt') {
        // 文本文件直接读取
        content = await readFileAsText(file);
      } else {
        // PDF 文件：简化处理，读取文件名和大小信息作为提示
        content = `[用户上传了 PDF 文件: ${file.name}，大小: ${(file.size / 1024).toFixed(1)}KB]`;
      }

      updateState({ meetingSource: 'upload', uploadContent: content });
      navigate('/loading');
    } catch (err) {
      showError('文件读取失败，请重试');
      console.error('文件读取错误:', err);
    }

    // 重置 input，允许重复选择同一文件
    e.target.value = '';
  };

  // 读取文本文件
  const readFileAsText = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsText(file, 'UTF-8');
    });
  };

  return (
    <div className={styles.container}>
      {/* 顶部标题区 */}
      <div className={styles.header}>
        <h1 className={styles.title}>选择会议来源</h1>
        <p className={styles.subtitle}>你可以让系统生成一场模拟周会，或者使用你自己的会议资料</p>
      </div>

      {/* 选项卡片 */}
      <div className={styles.options}>
        {/* 选项 1：生成模拟会议 */}
        <button className={styles.optionCard} onClick={handleGenerate}>
          <div className={styles.optionIcon} style={{ background: 'rgba(59, 130, 246, 0.12)' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
                fill="var(--accent-primary)"
                fillOpacity="0.15"
                stroke="var(--accent-primary)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <div className={styles.optionText}>
            <h2 className={styles.optionTitle}>Generate a weekly sync</h2>
            <p className={styles.optionDesc}>系统为你生成一场项目周会</p>
          </div>

          <div className={styles.optionArrow}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </button>

        {/* 选项 2：上传会议资料 */}
        <button className={styles.optionCard} onClick={handleUploadClick}>
          <div className={styles.optionIcon} style={{ background: 'rgba(20, 184, 166, 0.12)' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path
                d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z"
                fill="var(--accent-teal)"
                fillOpacity="0.15"
                stroke="var(--accent-teal)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <polyline points="14,2 14,8 20,8" stroke="var(--accent-teal)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <line x1="12" y1="12" x2="12" y2="18" stroke="var(--accent-teal)" strokeWidth="2" strokeLinecap="round" />
              <polyline points="9,15 12,12 15,15" stroke="var(--accent-teal)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          <div className={styles.optionText}>
            <h2 className={styles.optionTitle}>Use my own meeting notes</h2>
            <p className={styles.optionDesc}>上传你的会议材料</p>
            <p className={styles.optionNote}>支持 .txt / .pdf</p>
          </div>

          <div className={styles.optionArrow}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </button>
      </div>

      {/* 隐藏的文件选择器 */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.pdf"
        className={styles.hiddenInput}
        onChange={handleFileChange}
      />

      {/* 底部说明文字 */}
      <p className={styles.footer}>会议内容仅用于本次练习，不会被存储</p>
    </div>
  );
}

export default SourceSelect;
