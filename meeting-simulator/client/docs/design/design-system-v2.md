# MeetingHero 设计规范 v2.0

**文档状态**: 草稿
**最后更新**: 2026-03-30
**作者**: UI Designer
**适用范围**: 移动端 375-430px 浅色主题

---

## 一、调研摘要

### 1.1 Duolingo 设计系统关键提取

**配色哲学**: 高饱和度主色 (#58CC02 鲜绿) + 大量留白，对比极强。成功绿色对用户产生正向激励，是"学习类产品"的情感设计核心。

**卡片风格**: 无 box-shadow，改用 `border-bottom: 4px solid` 的"立体积木感"。圆角 16px 起步，选项卡高达 24px。边框颜色比背景深 20%（非透明叠加）。

**字体规律**: 全站 800 字重标题，正文 400-600，字号跨度大（32px 标题 vs 14px 正文）。

**间距规律**: 内容区 16px 网格，按钮高度固定 52px，页面内边距 16px。

**动效特征**: `cubic-bezier(0.34, 1.56, 0.64, 1)` 弹性曲线（弹回感），状态变化用 scale(1.1) 再回弹，streak 等正向反馈有 confetti + 光晕。

**对 MeetingHero 的启示**: 引入"弹性动效"增强操作反馈；成就/完成状态用更强烈的视觉庆祝；角色系统可参考高饱和度配色策略。

---

### 1.2 Linear 设计系统关键提取

**配色哲学**: 几乎无装饰，主色 (#5E6AD2 靛紫) 只用在关键操作，其余全部使用中性色系。背景分三层：`#FFFFFF` / `#F7F8F9` / `#F0F1F3`，差异极为微妙（仅 7-8 色阶差距）。

**卡片风格**: 无 box-shadow（几乎），依赖 1px `#E5E7EB` 边框区分层级。悬浮态用 `#F9FAFB` 背景高亮而非阴影加深。

**字体规律**: 正文 13-14px，行高 1.5，大量 500 字重（而非 400 或 700）——"专业感"来自这个中间值。字间距 `-0.1px` 让字母更紧凑精密。

**间距规律**: 8px 基准网格，列表项行高 40px，section gap 24px，页面边距 24px。

**对 MeetingHero 的启示**: 背景三层差异要更克制（当前差异过大显得廉价）；引入 500 字重作为"正文加粗"；卡片阴影要更轻。

---

### 1.3 2025-2026 移动聊天 UI 趋势

**气泡设计**: 去除 border（仅背景色），背景色从纯色改为极轻微渐变（2-3% 差异）。尖角从 4px 锐角改为 6px 轻圆角，视觉更柔和。

**背景色**: 纯白已过时，主流用 `#F8F9FA` 或 `#F5F6F8` 的 off-white。聊天区域背景与消息气泡要有足够对比。

**头像**: 渐变背景 + 粗体首字母成为标准，不再用纯色填充。

**时间戳**: 移到气泡内部右下角，字号 10px，颜色更淡。

**"Your Turn" 引导**: 现代设计趋向用 pill 形胶囊按钮 + 脉冲动效，比纯文字分隔线更显眼。

**状态系统**: typing 指示器从三点换成更有趣的"波形动效"。

---

## 二、MeetingHero 视觉调性定义

### 2.1 产品调性关键词

> **"职场精英感 × 游戏化成就感 × 清爽可信赖"**

MeetingHero 是一个帮助职场人提升英语会议能力的 AI 模拟器。它需要同时传递三种感受：

1. **可信赖的专业工具感** — 用户在使用前需要相信"这是严肃的学习产品"（参考 Linear 的克制精准）
2. **沉浸的游戏化体验** — 会议模拟过程应像在玩角色扮演 RPG（参考 Duolingo 的弹性动效和成就反馈）
3. **轻盈的现代感** — 不沉重、不压迫，让用户放松地练习（参考现代聊天 UI 的 off-white 和去装饰化）

### 2.2 调性对应的设计决策

| 感受 | 设计决策 |
|------|---------|
| 专业工具感 | 克制的配色（主色仅用于关键 CTA）、精密的字体（13-14px + 500字重）、轻量卡片 |
| 游戏化成就感 | 弹性动效 (spring curve)、角色渐变头像、完成/成就状态的强烈庆祝 |
| 轻盈现代感 | off-white 背景、气泡去 border、宽松间距、柔和圆角 |

---

## 三、配色系统

### 3.1 主色（品牌色）

**选色依据**: 从现有 #2563EB (Tailwind Blue-600) 升级，引入更有品牌感的靛蓝，让主色更独特。参考 Linear 的 #5E6AD2 与 Notion 的 #0F7FFF，最终选定中间路线。

```
--color-brand-500: #3B6FE8    /* 主品牌色，用于 CTA、链接、选中态 */
--color-brand-400: #6B93EF    /* 浅变体，用于 hover 背景、浅色 badge */
--color-brand-600: #2554C7    /* 深变体，用于 hover/active 按钮 */
--color-brand-50:  #EEF3FD    /* 极浅，用于选中态背景、chip 激活 */
--color-brand-100: #D5E1FA    /* 浅，用于边框激活态 */
```

### 3.2 功能色

```
/* 成功 — 借鉴 Duolingo 的高饱和绿，传递正向激励 */
--color-success-500: #22C55E   /* 绿色主色 */
--color-success-50:  #F0FDF4   /* 背景 */
--color-success-600: #16A34A   /* 深变体 */

/* 警告 — 环境色，用于"需要注意"的节点 */
--color-warning-500: #F59E0B   /* 琥珀黄 */
--color-warning-50:  #FFFBEB   /* 背景 */

/* 错误 — 低调处理，不用纯红 */
--color-error-500:   #EF4444   /* 红色 */
--color-error-50:    #FEF2F2   /* 背景 */

/* 信息 — 中性蓝灰，用于系统消息 */
--color-info-500:    #64748B   /* 蓝灰 */
--color-info-50:     #F1F5F9   /* 背景 */
```

### 3.3 背景色（三层系统）

**设计原则**: 三层背景的 L 值（HSL 亮度）差距控制在 2-4 个点，避免廉价感。参考 Linear 的极度克制。

```
/* 页面底层 — 最暗的一层，off-white 而非纯白 */
--bg-base:      #F5F7FA    /* HSL(220, 14%, 97%) — 微冷的浅灰 */

/* 卡片层 — 用于卡片、输入框、list item */
--bg-surface:   #FFFFFF    /* 纯白，与底层形成微弱对比 */

/* 浮层 — 用于 modal、drawer、tooltip */
--bg-overlay:   #FFFFFF    /* 纯白 + 更强阴影来区分 */

/* 悬浮高亮 — 鼠标经过时的背景 */
--bg-hover:     #F0F3F9    /* 微蓝灰，比 base 略深 */

/* 选中背景 */
--bg-selected:  #EEF3FD    /* 与 brand-50 一致 */
```

**注意**: `--bg-primary` (旧) → `--bg-base`；`--bg-tertiary` (旧) → `--bg-surface`；向下兼容映射见 CSS 变量部分。

### 3.4 文字色（三层系统）

```
/* 主文字 — 不用纯黑，微暖的深色更舒适 */
--text-primary:    #1A1D23    /* 接近黑，但微微偏冷 */

/* 次文字 — 用于副标题、描述、label */
--text-secondary:  #4B5563    /* 中灰，较高对比度 */

/* 弱文字 — 用于 placeholder、hint、时间戳 */
--text-muted:      #9CA3AF    /* 浅灰，WCAG AA 合规 */

/* 反色 — 深色背景上的文字 */
--text-inverse:    #FFFFFF
```

### 3.5 角色配色系统

**设计原则**: 四色要有足够区分度，但和谐不冲突。饱和度统一控制在 70-80%，亮度控制在 45-55%。

```
/* Leader — 蓝色，代表主导/权威 */
--role-leader:          #3B6FE8    /* 与品牌色一致，强调核心地位 */
--role-leader-light:    #EEF3FD    /* 头像背景浅色 */
--role-leader-gradient: linear-gradient(135deg, #4B7CF3, #3B6FE8)

/* Collaborator — 翠绿，代表合作/支持 */
--role-collaborator:          #10B981
--role-collaborator-light:    #ECFDF5
--role-collaborator-gradient: linear-gradient(135deg, #34D399, #10B981)

/* Challenger — 橙色，代表挑战/质疑 */
--role-challenger:          #F97316
--role-challenger-light:    #FFF7ED
--role-challenger-gradient: linear-gradient(135deg, #FB923C, #F97316)

/* Supporter — 紫色，代表支持/温和 */
--role-supporter:          #8B5CF6
--role-supporter-light:    #F5F3FF
--role-supporter-gradient: linear-gradient(135deg, #A78BFA, #8B5CF6)
```

---

## 四、字体系统

### 4.1 字体栈

```
/* 正文字体 — 系统原生，渲染效果最佳 */
--font-sans: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI',
             'Helvetica Neue', Arial, sans-serif;

/* 数字字体 — 等宽，用于分数、计时器 */
--font-mono: 'SF Mono', 'Fira Code', 'Consolas', monospace;
```

### 4.2 字号与字重规范

| 名称 | 场景 | 字号 | 字重 | 行高 | 字间距 |
|------|------|------|------|------|--------|
| Display | 品牌名、大标题 | 32px | 800 | 1.1 | -0.5px |
| H1 | 页面标题 | 26px | 700 | 1.2 | -0.3px |
| H2 | 卡片标题、区块标题 | 20px | 700 | 1.3 | -0.2px |
| H3 | 子标题 | 17px | 600 | 1.4 | -0.1px |
| Body-Large | 主要正文、气泡文字 | 15px | 400 | 1.6 | 0 |
| Body | 标准正文 | 14px | 400 | 1.6 | 0 |
| Body-Medium | 加粗正文、按钮 | 14px | 500 | 1.5 | 0 |
| Label | 标签、说明、发言者信息 | 13px | 500 | 1.4 | 0 |
| Caption | 时间戳、辅助说明 | 12px | 400 | 1.4 | 0.1px |
| Micro | 角标、角色标签 | 11px | 600 | 1.3 | 0.3px |
| Tiny | 全大写标签 | 10px | 700 | 1.3 | 0.8px |

**关键原则**:
- 中文翻译用 `Body` (14px/400) 或 `Caption` (12px/400)，绝不小于 12px
- 全大写文字（`text-transform: uppercase`）必须降一级字号，否则视觉过重
- `500` 字重是"专业感"的关键，比 400 更紧实，比 600 不过度强调

---

## 五、间距系统

### 5.1 基准网格：8px

所有间距值必须是 4 的倍数，优先使用 8 的倍数。

```
--space-1:   4px    /* 最小间距，用于 inline 元素间 */
--space-2:   8px    /* 紧凑间距，用于 label-input、icon-text */
--space-3:  12px    /* 默认小间距 */
--space-4:  16px    /* 标准间距 */
--space-5:  20px    /* 中等间距 */
--space-6:  24px    /* 大间距，section 内边距 */
--space-8:  32px    /* 超大间距，section 间距 */
--space-10: 40px    /* 巨大间距，页面顶部留白 */
--space-12: 48px    /* 首屏顶部，status bar 下方 */
```

### 5.2 页面布局规范

| 场景 | 数值 |
|------|------|
| 页面左右内边距 | `--space-4` (16px) |
| 页面顶部（含 safe area） | `--space-12` (48px) + safe-area |
| 页面底部（含 safe area） | `--space-6` (24px) + safe-area |
| 卡片内边距（标准） | `--space-4` (16px) |
| 卡片内边距（紧凑） | `--space-3` (12px) |
| 卡片间距 | `--space-4` (16px) |
| Section 间距 | `--space-6` (24px) |
| 列表项行高 | 44px（符合 iOS 触控规范） |

### 5.3 气泡区特殊规范

| 场景 | 数值 |
|------|------|
| 气泡左右容器内边距 | `--space-4` (16px) |
| 同一发言者相邻气泡间距 | `--space-1` (4px) |
| 不同发言者气泡间距 | `--space-3` (12px) |
| 气泡内边距（横向） | 14px |
| 气泡内边距（纵向） | 10px |
| 头像与气泡间距 | `--space-2` (8px) |
| 头像大小 | 32px |

---

## 六、卡片系统

### 6.1 圆角规范

```
--radius-xs:  6px    /* 小 badge、tag */
--radius-sm:  8px    /* 小按钮、chip、小卡片 */
--radius-md: 12px    /* 标准卡片、输入框 */
--radius-lg: 16px    /* 大卡片、主按钮 */
--radius-xl: 20px    /* 特殊卡片、预览区域 */
--radius-2xl: 24px   /* 首页预览区等大块区域 */
--radius-full: 9999px /* 胶囊按钮、头像 */
```

### 6.2 阴影规范

**设计原则**: 参考 Linear 的克制，大量场景去除阴影改用边框。阴影只用在"需要强调浮起感"的场景（按钮、modal、drawer）。

```
/* 无阴影 — 标准卡片，靠 border 区分 */
--shadow-none: none

/* 极轻 — 卡片在 off-white 背景上的微弱立体感 */
--shadow-xs: 0 1px 2px rgba(0, 0, 0, 0.05)

/* 轻量 — 标准卡片、list item */
--shadow-sm: 0 1px 4px rgba(0, 0, 0, 0.06), 0 0 0 1px rgba(0, 0, 0, 0.02)

/* 中等 — 浮动卡片、tooltip */
--shadow-md: 0 4px 12px rgba(0, 0, 0, 0.08), 0 1px 4px rgba(0, 0, 0, 0.04)

/* 重 — 模态框、drawer */
--shadow-lg: 0 8px 32px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.06)

/* 极重 — 主按钮（彩色阴影） */
--shadow-brand: 0 8px 24px rgba(59, 111, 232, 0.28)
--shadow-brand-hover: 0 12px 32px rgba(59, 111, 232, 0.38)
```

### 6.3 边框规范

```
--border-default: 1px solid #E5E7EB    /* 标准边框 */
--border-strong:  1px solid #D1D5DB    /* 强调边框 */
--border-brand:   1px solid var(--color-brand-100)  /* 品牌色边框 */
--border-focus:   2px solid var(--color-brand-500)  /* 聚焦边框 */
```

### 6.4 卡片类型规范

**普通卡片 (Card)**
- 背景: `--bg-surface` (#FFFFFF)
- 边框: `--border-default`
- 圆角: `--radius-md` (12px)
- 阴影: `--shadow-sm`
- 内边距: 16px

**强调卡片 (Featured Card)**
- 背景: `--bg-surface` + 顶部 3px 品牌色边框（`border-top: 3px solid var(--color-brand-500)`）
- 或者: 渐变背景 `linear-gradient(135deg, #EEF3FD 0%, #F5F3FF 100%)`
- 圆角: `--radius-lg` (16px)
- 阴影: `--shadow-md`

**交互卡片 (Interactive Card)** — 可点击/选择
- 默认态: 普通卡片样式
- Hover: 背景 `--bg-hover`，边框颜色 `--border-strong`
- Active/Selected: 背景 `--bg-selected`，边框 `--border-brand`，`box-shadow: 0 0 0 3px rgba(59,111,232,0.12)`

**节点卡片 (Node Card)** — 会中关键节点
- 默认: 背景 `--bg-surface`，边框 `1.5px solid --border-default`
- 激活: 背景 `#FFF7ED`，边框 `1.5px solid var(--role-challenger)` (橙色)，加 `box-shadow: 0 0 0 3px rgba(249,115,22,0.1)`
- 完成: 背景 `--bg-surface`，边框 `1.5px solid var(--role-collaborator)` (绿色)，`opacity: 0.75`

---

## 七、按钮系统

### 7.1 按钮尺寸规范

| 尺寸 | 高度 | 字号 | 字重 | 水平内边距 | 圆角 |
|------|------|------|------|-----------|------|
| XS | 28px | 12px | 600 | 10px | radius-sm (8px) |
| SM | 36px | 13px | 600 | 14px | radius-sm (8px) |
| MD | 44px | 15px | 600 | 20px | radius-md (12px) |
| LG | 52px | 16px | 700 | 24px | radius-lg (16px) |
| Full | 52px | 16px | 700 | — (width: 100%) | radius-lg (16px) |

### 7.2 按钮变体规范

**主按钮 (Primary)**
```
背景:  linear-gradient(135deg, #4B7CF3 0%, #3B6FE8 100%)
文字:  #FFFFFF
阴影:  --shadow-brand
---
Hover:  背景加深 8%，translateY(-2px)，阴影 --shadow-brand-hover
Active: translateY(0)，阴影减弱
Disabled: opacity 0.45，cursor not-allowed，无阴影
```

**次按钮 (Secondary)**
```
背景:  transparent
边框:  1.5px solid --border-strong (#D1D5DB)
文字:  --text-secondary
---
Hover:  背景 --bg-hover，边框 --border-brand
Active: 背景 --bg-selected
Disabled: opacity 0.45
```

**幽灵按钮 (Ghost)**
```
背景:  transparent
边框:  无
文字:  --text-secondary
---
Hover:  背景 --bg-hover
Active: 背景 --bg-selected，文字 --color-brand-500
```

**文字按钮 (Link)**
```
背景:  transparent
文字:  --color-brand-500
下划线: underline，offset 2px
---
Hover:  文字 --color-brand-600
Disabled: opacity 0.45
```

**危险按钮 (Danger)**
```
背景:  #FEF2F2
边框:  1px solid #FECACA
文字:  #EF4444
---
Hover:  背景 #FEE2E2
```

### 7.3 全宽 CTA 按钮（移动端专用）

会出现在页面底部的主操作按钮，固定样式：
```css
.cta-button-full {
  width: 100%;
  height: 52px;
  border-radius: 16px;
  background: linear-gradient(135deg, #4B7CF3 0%, #3B6FE8 100%);
  color: #fff;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0.1px;
  box-shadow: 0 8px 24px rgba(59, 111, 232, 0.28);
  transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.cta-button-full:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 32px rgba(59, 111, 232, 0.38);
}

.cta-button-full:active {
  transform: translateY(0) scale(0.99);
  box-shadow: 0 4px 16px rgba(59, 111, 232, 0.2);
}
```

---

## 八、聊天气泡系统

### 8.1 NPC 气泡（左对齐）

**结构**: 头像 + 内容区（发言人信息 + 气泡体）

```
气泡背景:    #FFFFFF
气泡边框:    无（去除 border，靠背景与 bg-base 的对比）
气泡圆角:    6px 16px 16px 16px（左上角锐，其他圆）
气泡阴影:    0 1px 3px rgba(0,0,0,0.06)
内边距:      10px 14px
最大宽度:    calc(100% - 60px)（留出头像和间距）

发言人姓名:  13px / 600 / --text-primary
发言人职位:  11px / 400 / --text-muted
角色标签:    10px / 700 / 全大写，颜色与角色色一致

气泡文字:    15px / 400 / --text-primary / 行高 1.6
```

**头像规范**:
```
尺寸:     34px × 34px
圆角:     50%（圆形）
背景:     角色渐变（见 3.5 角色色）
文字:     首字母大写，14px / 700 / #FFFFFF
阴影:     0 2px 6px rgba(0,0,0,0.16)
```

### 8.2 用户气泡（右对齐）

```
气泡背景:    linear-gradient(135deg, #EEF3FD 0%, #E8EDFC 100%)
气泡边框:    无
气泡圆角:    16px 6px 16px 16px（右上角锐）
气泡阴影:    0 1px 3px rgba(59,111,232,0.1)
内边距:      10px 14px
最大宽度:    80%

气泡文字:    15px / 400 / --text-primary / 行高 1.6
```

**与当前方案的差异**: 去掉 `--user-bubble: #EFF6FF` 的单色，改用微渐变增加质感；去掉 border，改用轻阴影。

### 8.3 系统消息（居中）

```
容器:       flex + center，水平分隔线
分隔线:     1px solid --border-default，flex: 1
文字:       12px / 500 / --text-muted，白色背景 pill，padding 4px 10px
```

### 8.4 内心小人（Narrator 独白）

**设计原则**: 这是 MeetingHero 的特色功能，需要独特的视觉语言——区别于普通对话气泡，传递"心理活动/教练提示"感。

```
容器背景:   rgba(245, 240, 255, 0.9)  /* 淡紫，区别于白色对话 */
左边框:     3px solid #A78BFA          /* Supporter 紫，柔和 */
圆角:       0 12px 12px 0              /* 左平右圆 */
内边距:     10px 14px
外边距:     16px 24px（左右缩进更多，强调"旁白"感）

前缀图标:   💭 emoji 或自定义 SVG，14px
文字:       13px / 400 / #6D4F9E / 斜体 / 行高 1.6
```

**入场动效**（保留并增强）:
```css
@keyframes innerVoiceEnter {
  from {
    opacity: 0;
    filter: blur(3px);
    transform: translateY(8px) scale(0.97);
  }
  to {
    opacity: 1;
    filter: blur(0);
    transform: translateY(0) scale(1);
  }
}
animation: innerVoiceEnter 0.45s cubic-bezier(0.34, 1.56, 0.64, 1);
```

### 8.5 "Your Turn" 引导元素

**当前问题**: 纯文字分隔线太弱，用户容易忽略。

**新方案**: 胶囊型引导 pill，搭配脉冲动效：

```css
.your-turn-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--role-challenger);  /* 橙色，高对比度 */
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  padding: 6px 16px;
  border-radius: 999px;
  box-shadow: 0 0 0 0 rgba(249, 115, 22, 0.4);
  animation: yourTurnPulse 2s ease-in-out infinite;
}

@keyframes yourTurnPulse {
  0% { box-shadow: 0 0 0 0 rgba(249, 115, 22, 0.4); }
  70% { box-shadow: 0 0 0 8px rgba(249, 115, 22, 0); }
  100% { box-shadow: 0 0 0 0 rgba(249, 115, 22, 0); }
}
```

### 8.6 Typing 指示器

**新方案**: 三点跳动，使用 `translateY` + `opacity` 双重动效：

```css
@keyframes typingBounce {
  0%, 60%, 100% { transform: translateY(0); opacity: 0.35; }
  30% { transform: translateY(-5px); opacity: 1; }
}

/* 气泡容器 — 与 NPC 气泡同风格 */
.typing-bubble {
  background: #FFFFFF;
  border-radius: 6px 16px 16px 16px;
  padding: 12px 16px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  display: inline-flex;
  gap: 4px;
  align-items: center;
}

.typing-dot {
  width: 7px; height: 7px;
  border-radius: 50%;
  background: #9CA3AF;
  animation: typingBounce 1.4s ease-in-out infinite;
}
.typing-dot:nth-child(2) { animation-delay: 0.15s; }
.typing-dot:nth-child(3) { animation-delay: 0.30s; }
```

---

## 九、各页面布局建议

### 9.1 首页 (Home)

**调性**: 第一印象 = 专业 + 有趣 + 激发动力

**布局结构（三段式）**:
```
[Status Bar]
[品牌区] — paddingTop: 56px
  · 品牌名 Display/32px 渐变文字（蓝→紫）
  · Slogan 14px 次文字

[预览区] — margin: 28px 16px 0
  · 渐变背景容器（off-white → 浅蓝 → 浅紫）
  · 2-3 条 NPC 气泡预览（只展示，不可交互）
  · 1 条内心小人气泡
  · "Your Turn" pill

[CTA 区] — marginTop: auto，paddingBottom: safe-area
  · 全宽主按钮（渐变）
  · 12px hint 文字
```

**关键改进点**:
- 预览区高度自然，不要固定高度（避免内容被截断）
- 品牌名加入 subtle text-shadow 增加层次感
- CTA 按钮下方增加"Free • No account needed"等信任信号

---

### 9.2 Onboarding（引导设置）

**调性**: 简洁 + 无压力 + 逐步引导

**布局结构**:
```
[顶部进度条] — 8px 点式，active 点拉长为 24px pill
[步骤内容区] — flex: 1，overflow-y: scroll
  · 步骤标签（STEP 1 OF 3，12px 全大写品牌色）
  · 主标题 H1/26px
  · 选项列表 / 输入框
[底部固定按钮] — sticky bottom，渐变白色遮罩
```

**关键改进点**:
- 选项卡 `levelCard` 的 active 态要更明显：左侧加 4px 品牌色边框（`border-left: 4px solid`）
- Chip 增加 `transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)` 弹性反馈

---

### 9.3 加载页 (Loading)

**调性**: 期待感 + 专业感

**布局结构**:
```
[全屏居中]
  · 环形加载动画（精细，边框 2px，品牌色）
  · 主标题 18px/600
  · 进度条（4px 高，渐变品牌色）
  · 百分比文字（品牌色，13px/600）
  · Tips 轮播（最大宽度 280px，居中）
```

**关键改进点**:
- 加载圆圈改为品牌色渐变（`conic-gradient`），比单色更精致
- Tips 轮播增加 `blur` 过渡（淡出时模糊，淡入时清晰）

---

### 9.4 会前页 (PreMeeting)

**调性**: 信息摘要 + 即将进入状态的仪式感

**布局结构**:
```
[可滚动内容区] — padding 16px
  · 会议类型 Badge（品牌色 pill）
  · 会议标题 H2/20px
  · 参会者卡片行（横向等宽）
  · 议程/Key Facts 卡片
  · 角色说明卡片
[底部固定 CTA] — sticky
```

**关键改进点**:
- 参会者卡片增加角色色的顶部边框（每个参与者对应其角色色）
- 增加微妙的"进入中"状态动效

---

### 9.5 会中页 (Meeting)

**调性**: 沉浸 + 专注 + 即时反馈

**布局结构**:
```
[顶部 NavBar] — 紧凑，品牌色点 + 会议名 + 工具按钮
[聊天流区域] — flex: 1，overflow-y: auto
  · NPC 气泡
  · Narrator 气泡
  · Your Turn pill
  · Typing 指示器
[关键节点卡片] — 悬浮插入聊天流（不脱离文档流）
[输入区] — sticky bottom，白色背景
  · Reference hint（可选显示）
  · 文字输入框 + 语音按钮
```

**关键改进点**:
- NPC 气泡去掉 border，改用纯白背景 + 轻阴影
- 每次新消息入场用 `fadeInUp + spring curve`（现有只用 linear）
- 节点卡片的激活态要更明显（加 glow 效果）

---

### 9.6 总结页 (Review)

**调性**: 成就感 + 反思 + 正向激励

**布局结构**:
```
[可滚动内容区] — padding 40px 24px
  · 成就标题区（称号 + emoji + 副文字）
  · 角色私信气泡列表（动态弹入）
  · 评分卡片（分维度）
  · 关键表现回顾
[底部固定 CTA] — 渐变遮罩
```

**关键改进点**:
- 称号/成就区域增加轻微的光晕背景（`radial-gradient` 从品牌色到透明）
- 角色私信气泡弹入时增加头像的 scale 弹跳

---

### 9.7 复盘页 (ReviewNodes)

**调性**: 详细回顾 + 学习提升

**布局结构**:
```
[顶部标题区]
[节点列表] — 垂直卡片流
  · 每个节点卡片：标题 + 用户回答 + AI 点评 + 优化建议
[底部按钮]
```

---

### 9.8 完成页 (Complete)

**调性**: 庆祝 + 鼓励继续

**布局结构（三段式垂直分布）**:
```
[图标 + 标题区] — 上段，居中
  · 大图标（80px 圆形，品牌色渐变背景）
  · 标题 H1
  · 副文字

[难度反馈] — 中段
  · 三个选项横排（等宽）

[CTA 区] — 下段
  · 主按钮（再来一场）
  · 文字链接（回到首页）
```

**关键改进点**:
- 图标区增加放射状光晕动效（Duolingo 风格的庆祝感）
- 难度按钮选中态改用弹性动效

---

## 十、完整 CSS 变量定义

```css
/* =====================================================
   MeetingHero Design System v2.0
   CSS Custom Properties (Design Tokens)
   ===================================================== */

:root {

  /* ===== 品牌色 ===== */
  --color-brand-50:  #EEF3FD;
  --color-brand-100: #D5E1FA;
  --color-brand-400: #6B93EF;
  --color-brand-500: #3B6FE8;   /* 主品牌色 */
  --color-brand-600: #2554C7;   /* 深变体 */

  /* ===== 功能色 ===== */
  --color-success-50:  #F0FDF4;
  --color-success-500: #22C55E;
  --color-success-600: #16A34A;

  --color-warning-50:  #FFFBEB;
  --color-warning-500: #F59E0B;

  --color-error-50:    #FEF2F2;
  --color-error-500:   #EF4444;

  --color-info-50:     #F1F5F9;
  --color-info-500:    #64748B;

  /* ===== 背景色（三层）===== */
  --bg-base:     #F5F7FA;   /* 页面底层 — off-white 微冷灰 */
  --bg-surface:  #FFFFFF;   /* 卡片层 — 纯白 */
  --bg-overlay:  #FFFFFF;   /* 浮层 — 纯白（靠阴影区分） */
  --bg-hover:    #F0F3F9;   /* 悬浮高亮 */
  --bg-selected: #EEF3FD;   /* 选中背景 */

  /* 向后兼容映射（过渡期保留）*/
  --bg-primary:   var(--bg-base);
  --bg-secondary: var(--bg-hover);
  --bg-tertiary:  var(--bg-surface);
  --bg-elevated:  var(--bg-surface);

  /* ===== 文字色（三层）===== */
  --text-primary:   #1A1D23;
  --text-secondary: #4B5563;
  --text-muted:     #9CA3AF;
  --text-inverse:   #FFFFFF;

  /* ===== 角色配色 ===== */
  --role-leader:             #3B6FE8;
  --role-leader-light:       #EEF3FD;
  --role-leader-gradient:    linear-gradient(135deg, #4B7CF3, #3B6FE8);

  --role-collaborator:          #10B981;
  --role-collaborator-light:    #ECFDF5;
  --role-collaborator-gradient: linear-gradient(135deg, #34D399, #10B981);

  --role-challenger:          #F97316;
  --role-challenger-light:    #FFF7ED;
  --role-challenger-gradient: linear-gradient(135deg, #FB923C, #F97316);

  --role-supporter:           #8B5CF6;
  --role-supporter-light:     #F5F3FF;
  --role-supporter-gradient:  linear-gradient(135deg, #A78BFA, #8B5CF6);

  /* 向后兼容 */
  --accent-primary:  var(--color-brand-500);
  --accent-orange:   var(--role-challenger);
  --accent-teal:     var(--role-collaborator);
  --accent-purple:   var(--role-supporter);

  /* ===== 用户气泡 ===== */
  --user-bubble-bg: linear-gradient(135deg, #EEF3FD 0%, #E8EDFC 100%);

  /* ===== 边框 ===== */
  --border:         #E5E7EB;   /* 默认边框 */
  --border-strong:  #D1D5DB;   /* 强调边框 */

  /* ===== 阴影 ===== */
  --shadow-xs: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-sm: 0 1px 4px rgba(0, 0, 0, 0.06), 0 0 0 1px rgba(0, 0, 0, 0.02);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.08), 0 1px 4px rgba(0, 0, 0, 0.04);
  --shadow-lg: 0 8px 32px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.06);
  --shadow-brand: 0 8px 24px rgba(59, 111, 232, 0.28);
  --shadow-brand-hover: 0 12px 32px rgba(59, 111, 232, 0.38);

  /* 向后兼容 */
  --shadow:    rgba(0, 0, 0, 0.06);
  --shadow-md-old: rgba(0, 0, 0, 0.10);

  /* ===== 圆角 ===== */
  --radius-xs:   6px;
  --radius-sm:   8px;
  --radius-md:  12px;
  --radius-lg:  16px;
  --radius-xl:  20px;
  --radius-2xl: 24px;
  --radius-full: 9999px;

  /* ===== 间距 ===== */
  --space-1:   4px;
  --space-2:   8px;
  --space-3:  12px;
  --space-4:  16px;
  --space-5:  20px;
  --space-6:  24px;
  --space-8:  32px;
  --space-10: 40px;
  --space-12: 48px;

  /* ===== 字体 ===== */
  --font-sans: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI',
               'Helvetica Neue', Arial, sans-serif;
  --font-mono: 'SF Mono', 'Fira Code', 'Consolas', monospace;
  --font-family: var(--font-sans); /* 向后兼容 */

  /* ===== 动效时间曲线 ===== */
  --ease-standard:  cubic-bezier(0.4, 0, 0.2, 1);    /* 标准过渡 */
  --ease-decelerate: cubic-bezier(0, 0, 0.2, 1);      /* 入场 */
  --ease-accelerate: cubic-bezier(0.4, 0, 1, 1);      /* 出场 */
  --ease-spring:    cubic-bezier(0.34, 1.56, 0.64, 1); /* 弹性（按钮、选项卡）*/

  /* ===== 动效时长 ===== */
  --duration-fast:   150ms;
  --duration-normal: 250ms;
  --duration-slow:   400ms;
}
```

---

## 十一、关键组件 CSS 片段

### 11.1 渐变头像

```css
/* 通用渐变头像 */
.avatar-gradient {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 700;
  color: #fff;
  flex-shrink: 0;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.16);
}

.avatar-leader       { background: var(--role-leader-gradient); }
.avatar-collaborator { background: var(--role-collaborator-gradient); }
.avatar-challenger   { background: var(--role-challenger-gradient); }
.avatar-supporter    { background: var(--role-supporter-gradient); }
```

### 11.2 NPC 气泡（去边框版）

```css
.npc-bubble-body {
  background: #FFFFFF;
  border-radius: 6px 16px 16px 16px;
  padding: 10px 14px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06), 0 0 0 1px rgba(0, 0, 0, 0.03);
  max-width: calc(100% - 60px);
}

.npc-bubble-text {
  font-size: 15px;
  font-weight: 400;
  line-height: 1.6;
  color: var(--text-primary);
  word-break: break-word;
}

/* 入场动效 */
.npc-bubble-enter {
  animation: fadeInUp 0.3s var(--ease-decelerate) both;
}
```

### 11.3 用户气泡（微渐变版）

```css
.user-bubble-body {
  background: linear-gradient(135deg, #EEF3FD 0%, #E8EDFC 100%);
  border-radius: 16px 6px 16px 16px;
  padding: 10px 14px;
  box-shadow: 0 1px 3px rgba(59, 111, 232, 0.1);
  max-width: 80%;
}
```

### 11.4 弹性选项卡

```css
.option-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  background: var(--bg-surface);
  border-radius: var(--radius-md);
  border: 1.5px solid var(--border);
  transition: all var(--duration-normal) var(--ease-standard);
  cursor: pointer;
}

.option-card:hover {
  background: var(--bg-hover);
  border-color: var(--border-strong);
}

.option-card.active {
  background: var(--bg-selected);
  border-color: var(--color-brand-500);
  border-left-width: 4px;          /* 左侧品牌色加粗 */
  padding-left: 13px;              /* 补偿 border 增加的宽度 */
  box-shadow: 0 0 0 3px rgba(59, 111, 232, 0.1);
}

/* 弹性点击反馈 */
.option-card:active {
  transform: scale(0.99);
  transition: transform 0.1s var(--ease-spring);
}
```

### 11.5 "Your Turn" 引导 Pill

```css
.your-turn-container {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px 16px;
  gap: 12px;
}

.your-turn-line {
  flex: 1;
  height: 1px;
  background: linear-gradient(to right, transparent, #E5E7EB, transparent);
}

.your-turn-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--role-challenger);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.8px;
  text-transform: uppercase;
  padding: 6px 16px;
  border-radius: var(--radius-full);
  box-shadow: 0 2px 8px rgba(249, 115, 22, 0.35);
  animation: yourTurnPulse 2.5s ease-in-out infinite;
}

@keyframes yourTurnPulse {
  0%   { box-shadow: 0 0 0 0 rgba(249, 115, 22, 0.4), 0 2px 8px rgba(249, 115, 22, 0.35); }
  70%  { box-shadow: 0 0 0 8px rgba(249, 115, 22, 0), 0 2px 8px rgba(249, 115, 22, 0.35); }
  100% { box-shadow: 0 0 0 0 rgba(249, 115, 22, 0), 0 2px 8px rgba(249, 115, 22, 0.35); }
}
```

### 11.6 内心小人气泡

```css
.narrator-bubble {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 8px 20px;
  padding: 10px 14px;
  background: rgba(245, 240, 255, 0.9);
  border-left: 3px solid #A78BFA;
  border-radius: 0 12px 12px 0;
  animation: innerVoiceEnter 0.45s var(--ease-spring) both;
}

.narrator-icon {
  font-size: 15px;
  flex-shrink: 0;
  line-height: 1.6;
  filter: grayscale(0.2);
}

.narrator-text {
  font-size: 13px;
  font-style: italic;
  color: #6D4F9E;
  line-height: 1.6;
  word-break: break-word;
}

@keyframes innerVoiceEnter {
  from {
    opacity: 0;
    filter: blur(3px);
    transform: translateY(8px) scale(0.97);
  }
  to {
    opacity: 1;
    filter: blur(0);
    transform: translateY(0) scale(1);
  }
}
```

### 11.7 全宽 CTA 按钮

```css
.btn-cta-full {
  width: 100%;
  height: 52px;
  padding: 0 24px;
  border-radius: var(--radius-lg);
  background: linear-gradient(135deg, #4B7CF3 0%, #3B6FE8 100%);
  color: #fff;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0.1px;
  border: none;
  cursor: pointer;
  box-shadow: var(--shadow-brand);
  transition: transform var(--duration-normal) var(--ease-spring),
              box-shadow var(--duration-normal) var(--ease-standard);
  -webkit-font-smoothing: antialiased;
}

.btn-cta-full:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-brand-hover);
}

.btn-cta-full:active {
  transform: translateY(0) scale(0.99);
  box-shadow: 0 4px 16px rgba(59, 111, 232, 0.22);
  transition-duration: 80ms;
}

.btn-cta-full:disabled {
  opacity: 0.45;
  transform: none;
  box-shadow: none;
  cursor: not-allowed;
}
```

### 11.8 Role Badge（角色标签）

```css
.role-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: var(--radius-xs);
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.role-badge-leader {
  background: var(--role-leader-light);
  color: var(--role-leader);
}

.role-badge-collaborator {
  background: var(--role-collaborator-light);
  color: var(--role-collaborator);
}

.role-badge-challenger {
  background: var(--role-challenger-light);
  color: var(--role-challenger);
}

.role-badge-supporter {
  background: var(--role-supporter-light);
  color: var(--role-supporter);
}
```

---

## 十二、与现有代码的差异对比（迁移指南）

| 项目 | 当前值 | 新值 | 变化原因 |
|------|--------|------|---------|
| 页面背景 | `#F5F5F7` | `#F5F7FA` | 更冷一点，减少黄味，更现代 |
| 主色 | `#2563EB` | `#3B6FE8` | 更亮，饱和度更高，个性更强 |
| 文字主色 | `#1D1D1F` | `#1A1D23` | 微冷色调，与背景更协调 |
| 文字次色 | `#6E6E73` | `#4B5563` | 对比度提升，WCAG AA 合规 |
| 角色challenger | `#EA580C` | `#F97316` | 更亮橙，活泼感更强 |
| 角色supporter | `#7C3AED` | `#8B5CF6` | 更亮紫，与其他角色色更和谐 |
| NPC气泡 | 白色背景 + border | 白色背景 + 轻阴影（去border）| 更现代，视觉更轻 |
| 用户气泡 | `#EFF6FF` 单色 | 蓝色微渐变 | 增加质感层次 |
| 主按钮梯度 | `#2563EB → #4F46E5` | `#4B7CF3 → #3B6FE8` | 更统一，品牌色系内渐变 |
| 动效曲线 | `ease` (CSS) | `cubic-bezier(0.34,1.56,0.64,1)` | 弹性感，提升操作反馈质量 |

---

## 附录 A：配色来源标注

| 颜色 | 来源参考 |
|------|---------|
| 背景三层系统 | Linear 浅色模式 (#F7F8F9 / #FFFFFF / #FFFFFF) |
| 弹性动效曲线 | Duolingo / Framer Motion `spring` 默认值 |
| Narrator 紫色 | Notion sidebar purple / Linear purple |
| "Your Turn" 橙色 | Duolingo streak orange，高可见度 |
| 文字次色 #4B5563 | Tailwind Gray-600，WCAG AA 对比度 ≥ 4.5:1 |
| 卡片阴影层次 | Linear card shadow system |
| 聊天气泡去 border | iOS Messages 2024 / WhatsApp 2025 更新方向 |
| 渐变头像 | Slack / Linear 头像系统 |

---

*文档由 UI Designer 编写，如有更新请同步通知 Programmer 和 Code Reviewer。*
