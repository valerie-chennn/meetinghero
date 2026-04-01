import React, { useRef, useState } from 'react';
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
  // 控制上传 loading 状态，防止用户重复点击
  const [uploading, setUploading] = useState(false);

  // 选择生成模拟会议
  const handleGenerate = () => {
    updateState({ meetingSource: 'generate', uploadContent: null });
    navigate('/loading');
  };

  // 触发文件选择（上传中时禁止触发）
  const handleUploadClick = () => {
    if (uploading) return;
    fileInputRef.current?.click();
  };

  // 文件选中后，发送到服务端解析
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 前置校验文件类型
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    if (!['.txt', '.pdf'].includes(ext)) {
      showError('只支持 .txt 和 .pdf 文件');
      e.target.value = '';
      return;
    }

    // 前置校验文件大小（5MB）
    if (file.size > 5 * 1024 * 1024) {
      showError('文件超过 5MB，请压缩后重试');
      e.target.value = '';
      return;
    }

    setUploading(true);

    try {
      // 构造 multipart 表单，将文件发送到服务端解析
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload/parse', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        // 服务端返回具体错误信息时优先展示
        throw new Error(data.error || `上传失败 (${response.status})`);
      }

      if (!data.text || !data.text.trim()) {
        throw new Error('文件内容为空，无法生成会议');
      }

      // 将真实解析文本存入 context，进入 loading 页生成会议
      updateState({ meetingSource: 'upload', uploadContent: data.text });
      navigate('/loading');
    } catch (err) {
      showError(err.message || '文件解析失败，请重试');
      console.error('[SourceSelect] 文件上传/解析错误:', err);
    } finally {
      setUploading(false);
      // 重置 input，允许重复选择同一文件
      e.target.value = '';
    }
  };

  return (
    <div className={styles.container}>
      {/* 顶部标题区 */}
      <div className={styles.header}>
        <h1 className={styles.title}>选择会议内容</h1>
        <p className={styles.subtitle}>你可以让系统生成一场模拟周会，或者使用你自己的会议资料</p>
      </div>

      {/* 选项卡片 */}
      <div className={styles.options}>
        {/* 选项 1：生成模拟会议 */}
        <button className={styles.optionCard} onClick={handleGenerate}>
          <div className={`${styles.optionIcon} ${styles.optionIconBrand}`}>
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

        {/* 选项 2：上传会议资料（上传中时禁用，并显示解析提示） */}
        <button
          className={`${styles.optionCard} ${uploading ? styles.optionCardDisabled : ''}`}
          onClick={handleUploadClick}
          disabled={uploading}
        >
          <div className={`${styles.optionIcon} ${styles.optionIconTeal}`}>
            {uploading ? (
              /* 上传解析中：显示旋转动画 */
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className={styles.spinIcon}>
                <circle cx="12" cy="12" r="10" stroke="var(--accent-teal)" strokeWidth="2" strokeOpacity="0.3" />
                <path d="M12 2a10 10 0 0 1 10 10" stroke="var(--accent-teal)" strokeWidth="2" strokeLinecap="round" />
              </svg>
            ) : (
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
            )}
          </div>

          <div className={styles.optionText}>
            <h2 className={styles.optionTitle}>Use my own meeting notes</h2>
            {uploading ? (
              <p className={styles.optionDesc}>正在解析文件...</p>
            ) : (
              <>
                <p className={styles.optionDesc}>上传你的会议材料</p>
                <p className={styles.optionNote}>支持 .txt / .pdf，最大 5MB</p>
              </>
            )}
          </div>

          {!uploading && (
            <div className={styles.optionArrow}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          )}
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
