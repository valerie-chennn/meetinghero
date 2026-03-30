import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import BriefingCard from '../components/BriefingCard.jsx';
import styles from './PreMeeting.module.css';

// 角色颜色映射
const ROLE_COLORS = {
  leader: 'var(--role-leader)',
  collaborator: 'var(--role-collaborator)',
  challenger: 'var(--role-challenger)',
  supporter: 'var(--role-supporter)',
};

/**
 * 会前 Briefing 页面（精简版，一屏展示）
 * 展示会议背景和参会角色，Memo 整合到 Briefing 卡片底部
 */
function PreMeeting() {
  const navigate = useNavigate();
  const { state } = useApp();

  const { meetingData } = state;

  // 如果没有会议数据，通过 useEffect 跳转，避免渲染期直接调用 navigate
  useEffect(() => {
    if (!meetingData) {
      navigate('/');
    }
  }, [meetingData, navigate]);

  if (!meetingData) return null;

  // 后端返回 roles（不是 participants），memo 为 [{ text: "..." }] 格式
  const { briefing, memo, roles } = meetingData;

  // 进入会议
  const handleEnterMeeting = () => {
    navigate('/meeting');
  };

  return (
    <div className={styles.container}>
      {/* 可滚动内容区 */}
      <div className={styles.scrollArea}>
        {/* 会议类型标签（紧凑） */}
        <div className={styles.meetingTypeBadge}>
          <span className={styles.meetingTypeIcon}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" />
              <path d="M16 2V6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="M8 2V6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="M3 10H21" stroke="currentColor" strokeWidth="2" />
            </svg>
          </span>
          <span>Weekly Project Sync</span>
        </div>

        {/* Briefing 卡片（精简版，含 Memo 内联提示） */}
        <BriefingCard briefing={briefing} memo={memo} showTranslation={true} />

        {/* 参会角色预览：竖向小卡片，等宽水平分布 */}
        {roles && roles.length > 0 && (
          <div className={styles.participantsSection}>
            <span className={styles.participantsLabel}>参会者</span>
            <div className={styles.participantsRow}>
              {roles.map((p, idx) => (
                <ParticipantCard key={idx} participant={p} />
              ))}
            </div>
          </div>
        )}

        {/* 底部占位，防止固定按钮遮挡 */}
        <div style={{ height: 80 }}></div>
      </div>

      {/* 固定底部：进入会议按钮 */}
      <div className={styles.footer}>
        <button className={styles.enterButton} onClick={handleEnterMeeting}>
          进入会议
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M5 12H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M12 5L19 12L12 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}

/**
 * 参会者竖向卡片组件
 * 展示：彩色头像（首字母）+ first name + 职位标题
 * 内部角色类型（leader/challenger 等）不外显，仅用于头像配色
 */
function ParticipantCard({ participant }) {
  // 兼容 type 和 roleType 两种字段名
  const roleColor = ROLE_COLORS[participant.type] || ROLE_COLORS[participant.roleType] || 'var(--role-leader)';
  const initial = participant.name ? participant.name.charAt(0).toUpperCase() : '?';
  // 只取 first name，避免展示全名
  const firstName = participant.name ? participant.name.split(' ')[0] : '?';

  return (
    <div className={styles.participantCard}>
      {/* 彩色头像圆圈 */}
      <div
        className={styles.participantAvatar}
        style={{ background: roleColor }}
      >
        {initial}
      </div>
      {/* First name */}
      <span className={styles.participantName}>{firstName}</span>
      {/* 职位标题（小字灰色） */}
      {participant.title && (
        <span className={styles.participantTitle}>{participant.title}</span>
      )}
    </div>
  );
}

export default PreMeeting;
