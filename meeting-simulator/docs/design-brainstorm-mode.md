# 脑洞模式 UI 设计方案

**设计版本**：v1.0  
**设计日期**：2026-04-01  
**设计师**：UI Designer  
**对应 PRD**：`docs/prd-brainstorm-mode.md`

---

## 设计总纲

### 氛围差异化策略

脑洞模式与正经开会在同一设计系统内，但通过以下手段拉开氛围：

| 维度 | 正经开会 | 脑洞模式 |
|------|---------|---------|
| 主色调 | `--color-brand` 靛蓝 + `--color-success` 翡翠绿 CTA | 靛蓝品牌色 + `--accent-purple` 紫色作为第二强调色 |
| 圆角 | `--radius-lg`（16px）为主 | `--radius-xl`（20px）为主，更圆润 |
| 阴影 | `--shadow-sm` / `--shadow-md` | `--shadow-md` / `--shadow-lg` + 品牌色光晕 |
| 动效曲线 | `--ease-out`（沉稳减速） | `--ease-spring`（弹性感，活泼） |
| 入场动画 | `fadeInUp` + 各元素 stagger | `springIn` 弹性出场 + 各元素 stagger |
| 文案风格 | 专业、指引性 | 俏皮、游戏感 |

### 新增 Token（补充到设计系统）

```css
/* 脑洞模式专用 Token — 建议追加到 App.css :root */

/* 紫色强调渐变（脑洞模式入口卡片） */
--brainstorm-gradient: linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%);

/* 翻牌卡背面渐变（RandomDraw 用） */
--card-back-gradient: linear-gradient(135deg, #1E1B4B 0%, #312E81 60%, #4C1D95 100%);

/* 脑洞模式卡片悬浮阴影（紫色光晕） */
--shadow-brainstorm: 0 4px 16px rgba(139, 92, 246, 0.22);
--shadow-brainstorm-hover: 0 8px 28px rgba(139, 92, 246, 0.32);

/* 角色卡选中光晕 */
--shadow-character-selected: 0 0 0 2px #8B5CF6, 0 4px 16px rgba(139, 92, 246, 0.20);
```

---

## 页面 1：首页重构（Home）

### 设计意图

> 两扇门并排立着，左边严肃右边好玩——用户一眼看到就知道该选哪个，顺手就进去了。

### 视觉动线

品牌区（MeetingHero） → 两张模式入口卡片（左右权重相等，眼睛在两者间扫视） → CTA 区（老用户的历史记录和修改信息链接）

### 页面结构（从上到下）

```
┌─────────────────────────────────┐  max-width: 430px
│                                 │
│   ●  MeetingHero                │  品牌区
│      i人会议生存指南              │
│                                 │
│  ┌─────────────┐ ┌─────────────┐│  模式入口区（2列等宽）
│  │  📋          │ │  ✨          ││
│  │  正经开会     │ │  脑洞模式    ││
│  │             │ │             ││
│  │  职场真实场景 │ │ IP角色跨界  ││
│  │             │ │ 开会         ││
│  └─────────────┘ └─────────────┘│
│                                 │
│  ── 老用户区（新用户不显示）── ─  │
│  [查看练习记录]  [修改我的信息]   │
│                                 │
└─────────────────────────────────┘
```

### 各区块详细规格

#### 品牌区（Header）

```
位置：padding-top: var(--space-12) = 48px
对齐：居中

MeetingHero
  font-size: var(--font-2xl) = 28px  → 比旧版 32px 稍收，给卡片让位
  font-weight: 700
  color: var(--color-brand) = #4F46E5
  font-family: 'Plus Jakarta Sans', var(--font-sans)
  letter-spacing: -0.5px

i人会议生存指南
  font-size: var(--font-sm) = 13px
  color: var(--text-secondary)
  letter-spacing: 3px
  margin-top: var(--space-1) = 4px

入场动画：fadeInUp 0.35s var(--ease-out) 0ms both
```

#### 模式入口区（Mode Cards）

```
容器：
  padding: var(--space-8) var(--space-5) 0  = 32px 20px 0
  display: grid
  grid-template-columns: 1fr 1fr
  gap: var(--space-3) = 12px
  入场动画：fadeInUp 0.4s var(--ease-out) 0.1s both

──── 正经开会卡片 ────
  background: var(--bg-surface) = #FFFFFF
  border-radius: var(--radius-xl) = 20px
  border: 1.5px solid var(--border) = #E2E8F0
  box-shadow: var(--shadow-sm)
  padding: var(--space-5) var(--space-4) = 20px 16px
  cursor: pointer
  min-height: 148px
  display: flex; flex-direction: column; justify-content: space-between
  transition: transform var(--duration-normal) var(--ease-spring),
              box-shadow var(--duration-normal) var(--ease-spring),
              border-color var(--duration-fast) var(--ease-out)

  图标区：
    width: 40px; height: 40px; border-radius: var(--radius-md) = 12px
    background: var(--color-brand-light) = #EEF2FF
    display: flex; align-items: center; justify-content: center
    SVG 图标：公文包/日历，color: var(--color-brand)，size: 20px

  标题：
    font-size: var(--font-md) = 16px
    font-weight: 700
    color: var(--text-primary)
    margin-top: var(--space-3) = 12px

  副标题：
    font-size: var(--font-xs) = 12px
    color: var(--text-secondary)
    line-height: 1.45
    margin-top: var(--space-1) = 4px

  底部箭头标记：
    font-size: var(--font-xs)
    color: var(--text-muted)
    align-self: flex-end

  Hover 状态：
    transform: translateY(-3px)
    box-shadow: var(--shadow-md)
    border-color: var(--color-brand-mid) = #818CF8

  Active 状态：
    transform: scale(0.97) translateY(0)

──── 脑洞模式卡片 ────
  背景：渐变（区别于正经开会白底，制造对比）
    background: linear-gradient(145deg, #F5F3FF 0%, #EDE9FE 100%)
    （--color-brand-light 的紫色版，保持色调统一但明显差异化）
  border-radius: var(--radius-xl) = 20px
  border: 1.5px solid rgba(139, 92, 246, 0.20)
  box-shadow: var(--shadow-brainstorm) = 0 4px 16px rgba(139, 92, 246, 0.22)
  padding: var(--space-5) var(--space-4) = 20px 16px
  cursor: pointer
  min-height: 148px

  图标区：
    width: 40px; height: 40px; border-radius: var(--radius-md)
    background: rgba(139, 92, 246, 0.12)
    SVG 图标：魔法棒/星星，color: var(--accent-purple) = #8B5CF6，size: 20px

  标题：
    font-size: var(--font-md) = 16px
    font-weight: 700
    color: var(--text-primary)
    margin-top: var(--space-3)

  副标题：
    font-size: var(--font-xs) = 12px
    color: var(--accent-purple) / 0.8（紫色调，呼应卡片背景）
    line-height: 1.45

  底部"NEW"徽标：
    font-size: 10px; font-weight: 700
    color: #FFFFFF
    background: var(--accent-purple)
    border-radius: var(--radius-full)
    padding: 2px 7px
    align-self: flex-start; margin-top: var(--space-2)

  Hover 状态：
    transform: translateY(-3px)
    box-shadow: var(--shadow-brainstorm-hover)
    border-color: rgba(139, 92, 246, 0.45)

  Active 状态：
    transform: scale(0.97)
```

#### 老用户区（仅 hasSession 时渲染）

```
容器：
  padding: var(--space-6) var(--space-5)
  display: flex; flex-direction: column; align-items: center; gap: var(--space-2)
  margin-top: auto（贴底）
  padding-bottom: max(var(--space-6), env(safe-area-inset-bottom))

查看练习记录（按钮）：
  display: flex; align-items: center; gap: 5px
  font-size: var(--font-sm) = 13px; font-weight: 500
  color: var(--text-secondary)
  background: none
  border: 1px solid var(--border)
  border-radius: var(--radius-full)
  padding: 6px 14px
  cursor: pointer
  transition: color/border/background var(--duration-fast)
  Hover：color: var(--color-brand), border-color: var(--color-brand), background: var(--color-brand-light)

修改我的信息（文字链接）：
  font-size: var(--font-xs) = 12px
  color: var(--text-muted)
  background: none; border: none
  text-decoration: underline dashed
  text-underline-offset: 3px
  Hover：color: var(--text-secondary)
```

### 交互状态汇总

| 元素 | 默认 | Hover | Active | 禁用 |
|------|------|-------|--------|------|
| 正经开会卡片 | 白底 + shadow-sm | 上浮3px + shadow-md + 品牌色边框 | scale(0.97) | - |
| 脑洞模式卡片 | 紫浅渐变 + 紫色阴影 | 上浮3px + 加深紫色阴影 | scale(0.97) | - |
| 历史记录按钮 | 灰色边框文字 | 品牌色边框 + 浅品牌色底 | scale(0.97) | - |

---

## 页面 2：脑洞模式入口（BrainstormEntry）

### 设计意图

> 像翻开一本冒险书的目录——点将局是我选角色，乱炖局是命运转盘，两张卡片要让人感受到截然不同的掌控感 vs. 随机感。

### 视觉动线

顶部返回箭头 → 页面标题"脑洞模式" → 两张竖向大卡片（上下排列，依次吸引注意力） → 卡片内的图标+标题+描述文案

### 页面结构

```
┌─────────────────────────────────┐
│ ←  脑洞模式                     │  顶部导航区
│                                 │
│  ┌───────────────────────────┐  │  点将局卡片（高度约 180px）
│  │  🎯  点将局                │  │
│  │      重生之开局就是一场会   │  │
│  │                           │  │
│  │      ──────────           │  │
│  │      我选角色，我定局       │  │
│  │                        →  │  │
│  └───────────────────────────┘  │
│                                 │
│  ┌───────────────────────────┐  │  乱炖局卡片（高度约 180px）
│  │  🎲  乱炖局                │  │
│  │      随机召唤，可能是神     │  │
│  │      也可能是猪             │  │
│  │                           │  │
│  │      ──────────           │  │
│  │      命运自行决定           │  │
│  │                        →  │  │
│  └───────────────────────────┘  │
│                                 │
└─────────────────────────────────┘
```

### 各区块详细规格

#### 顶部导航区

```
height: 56px
padding: 0 var(--space-4) = 0 16px
display: flex; align-items: center; gap: var(--space-3)
background: var(--bg-surface)（白色，有轻微分割感）
border-bottom: 1px solid var(--border-subtle)

返回按钮：
  width: 36px; height: 36px; border-radius: 50%
  background: var(--bg-elevated) = #F8FAFC
  color: var(--text-secondary)
  display: flex; align-items: center; justify-content: center
  SVG 左箭头，size: 18px
  Hover：background: var(--color-brand-light), color: var(--color-brand), transform: translateX(-1px)

页面标题：
  font-size: var(--font-md) = 16px
  font-weight: 600
  color: var(--text-primary)
```

#### 内容区（两张竖排卡片）

```
容器：
  padding: var(--space-5) var(--space-5)  = 20px 20px
  display: flex; flex-direction: column; gap: var(--space-4) = 16px
  flex: 1

──── 点将局卡片 ────
  background: var(--bg-surface) = #FFFFFF
  border-radius: var(--radius-xl) = 20px
  border: 1.5px solid var(--border)
  box-shadow: var(--shadow-md)
  padding: var(--space-6) = 24px
  cursor: pointer
  min-height: 175px
  position: relative; overflow: hidden
  入场动画：springIn 0.45s var(--ease-spring) 0.05s both

  左侧竖条装饰：
    position: absolute; left: 0; top: 0; bottom: 0; width: 4px
    background: var(--color-brand) = #4F46E5
    border-radius: 20px 0 0 20px

  图标+标题行：
    display: flex; align-items: center; gap: var(--space-3)

    图标容器：
      width: 48px; height: 48px; border-radius: var(--radius-md) = 12px
      background: var(--color-brand-light) = #EEF2FF
      display: flex; align-items: center; justify-content: center
      font-size: 24px（表情符号 🎯 或 SVG 靶心图标）

    标题：
      font-size: var(--font-xl) = 22px（加大，让用户一眼看到模式名）
      font-weight: 700
      color: var(--text-primary)

  标语（重生之开局就是一场会）：
    font-size: var(--font-sm) = 13px
    color: var(--color-brand)
    font-weight: 500
    margin-top: var(--space-3) = 12px
    letter-spacing: 0.3px

  分割线：
    height: 1px
    background: var(--border-subtle)
    margin: var(--space-3) 0

  描述（一行小字）：
    font-size: var(--font-xs) = 12px
    color: var(--text-secondary)
    "从你喜欢的世界，挑选 2-3 位角色"

  右下角箭头：
    position: absolute; right: var(--space-5); bottom: var(--space-5)
    width: 32px; height: 32px; border-radius: 50%
    background: var(--color-brand-light)
    color: var(--color-brand)
    display: flex; align-items: center; justify-content: center
    SVG 右箭头，size: 14px

  Hover 状态：
    transform: translateY(-3px)
    box-shadow: var(--shadow-lg)
    border-color: var(--color-brand-mid) = #818CF8

  Active 状态：
    transform: scale(0.975) translateY(0)

──── 乱炖局卡片 ────
  基础布局与点将局相同，差异如下：

  左侧竖条装饰：
    background: var(--accent-purple) = #8B5CF6

  图标容器：
    background: rgba(139, 92, 246, 0.10)
    图标：🎲 骰子或随机 SVG，size: 24px

  标题色：同 var(--text-primary)（与点将局一致，不用彩色）

  标语（随机召唤，可能是神也可能是猪）：
    color: var(--accent-purple)

  描述：
    "来自不同世界的三位角色，命运随机碰撞"

  右下角箭头圆：
    background: rgba(139, 92, 246, 0.10)
    color: var(--accent-purple)

  Hover 状态：
    box-shadow: var(--shadow-brainstorm-hover)
    border-color: rgba(139, 92, 246, 0.35)

  入场动画：springIn 0.45s var(--ease-spring) 0.15s both（delay 比点将局晚 100ms）
```

### 交互状态汇总

| 元素 | 默认 | Hover | Active |
|------|------|-------|--------|
| 点将局卡片 | 白底 + 蓝色竖条 + shadow-md | 上浮3px + shadow-lg + 品牌蓝边 | scale(0.975) |
| 乱炖局卡片 | 白底 + 紫色竖条 + shadow-md | 上浮3px + 紫色光晕加深 | scale(0.975) |
| 返回按钮 | 灰色背景 | 品牌蓝底色 + 左移 | scale(0.93) |

---

## 页面 3：角色搜索（CharacterSearch）

### 设计意图

> 像搜索一个网络书单——搜索框大而突出，热门标签给犹豫的人一个快速跳板，结果列表要能扫视，不要逼用户仔细阅读。

### 视觉动线

顶部导航返回 → 大标题"想跟谁开会？" → 高亮的搜索输入框（焦点默认落在这里） → 热门推荐标签横排滚动 → 搜索结果列表（出现后从上向下依次呈现）

### 页面结构

```
┌─────────────────────────────────┐
│ ←                               │  顶部导航
│                                 │
│  想跟谁开会？                    │  大标题区
│  搜索角色、作品、或任何你想到的  │  副标题
│                                 │
│  ┌───────────────────────────┐  │  搜索框
│  │ 🔍  输入角色名、作品名…    │  │
│  └───────────────────────────┘  │
│                                 │
│  热门  [西游记] [哈利波特] [三国]│  热门标签（横向滚动）
│        [漫威] [甄嬛传] [海贼王] │
│                                 │
│  ── 搜索结果区（搜索后出现）──   │
│  ┌───────────────────────────┐  │
│  │ 孙悟空    天生反骨，不服管教│  │
│  ├───────────────────────────┤  │
│  │ 猪八戒    好吃懒做，贪图享乐│  │
│  ├───────────────────────────┤  │
│  │ 唐僧      菩萨心肠，原则至上│  │
│  └───────────────────────────┘  │
│                                 │
└─────────────────────────────────┘
```

### 各区块详细规格

#### 顶部导航区

```
与 BrainstormEntry 导航完全一致（复用）：
  height: 56px; padding: 0 var(--space-4)
  返回按钮 + 页面标题"点将局"
```

#### 标题区

```
padding: var(--space-6) var(--space-5) 0  = 24px 20px 0

大标题：
  font-size: var(--font-xl) = 22px
  font-weight: 700
  color: var(--text-primary)
  line-height: 1.2
  入场动画：fadeInUp 0.35s var(--ease-out) 0ms both

副标题（搜索前显示，搜索后隐藏）：
  font-size: var(--font-sm) = 13px
  color: var(--text-secondary)
  margin-top: var(--space-1)
  入场动画：fadeInUp 0.35s var(--ease-out) 0.05s both
```

#### 搜索框区

```
padding: var(--space-4) var(--space-5) 0  = 16px 20px 0

搜索框容器：
  position: relative; width: 100%

搜索图标：
  position: absolute; left: 14px; top: 50%; transform: translateY(-50%)
  color: var(--text-muted)
  SVG 搜索图标，size: 16px
  点击后聚焦输入框时变色：color: var(--color-brand)
  transition: color var(--duration-fast)

输入框（<input>）：
  width: 100%; height: 48px
  background: var(--bg-surface)
  border: 1.5px solid var(--border)
  border-radius: var(--radius-xl) = 20px
  padding: 0 16px 0 42px（左留图标位）
  font-size: var(--font-base) = 15px
  color: var(--text-primary)
  placeholder color: var(--text-muted)
  transition: border-color var(--duration-fast), box-shadow var(--duration-fast)
  outline: none

  聚焦态：
    border-color: var(--color-brand)
    border-width: 2px
    box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.12)

  输入有值时：
    右侧显示清除按钮（× SVG，color: var(--text-muted)）
    Hover：color: var(--text-secondary)

清除按钮：
  position: absolute; right: 12px; top: 50%; transform: translateY(-50%)
  width: 20px; height: 20px; border-radius: 50%
  background: var(--bg-elevated)
  display: flex; align-items: center; justify-content: center
  cursor: pointer
```

#### 热门标签区

```
padding: var(--space-4) var(--space-5) 0  = 16px 20px 0

标签行头：
  font-size: var(--font-xs) = 12px
  font-weight: 500
  color: var(--text-muted)
  letter-spacing: 0.5px
  text-transform: uppercase
  margin-bottom: var(--space-2)

标签容器：
  display: flex; flex-wrap: wrap; gap: var(--space-2) = 8px
  （不横向滚动，改用换行更适合移动端）

单个热门标签（chip）：
  height: 34px
  padding: 0 var(--space-4) = 0 16px
  font-size: var(--font-sm) = 13px
  font-weight: 500
  color: var(--text-secondary)
  background: var(--bg-elevated) = #F8FAFC
  border: 1px solid var(--border)
  border-radius: var(--radius-full)
  cursor: pointer
  transition: all var(--duration-fast) var(--ease-out)
  入场动画：各标签 springIn，delay 依次 +30ms

  Hover：
    background: var(--color-brand-light)
    color: var(--color-brand)
    border-color: var(--color-brand-mid)
    transform: translateY(-1px)

  Active（被点击选中，填入搜索框）：
    background: var(--color-brand)
    color: #FFFFFF
    border-color: var(--color-brand)
```

#### 搜索结果区（搜索后显示）

```
padding: var(--space-5) var(--space-5) var(--space-4) = 20px 20px 16px

状态机：
  idle（未搜索）→ 显示热门标签，结果区不渲染
  loading（请求中）→ 搜索框右侧 spinner + 结果区显示 3 个骨架屏 item
  success（≥4个）→ 显示角色列表
  empty（<4个）→ 显示提示"换一个试试" + 副提示文字
  error → 显示错误提示 + 重试按钮

加载骨架屏（loading 态）：
  3 个占位行，每行 60px
  background: linear-gradient(90deg, var(--bg-elevated) 25%, var(--border-subtle) 50%, var(--bg-elevated) 75%)
  animation: shimmer 1.4s infinite  （骨架闪动）
  border-radius: var(--radius-md)

结果列表容器：
  background: var(--bg-surface)
  border-radius: var(--radius-lg) = 16px
  border: 1px solid var(--border)
  box-shadow: var(--shadow-sm)
  overflow: hidden
  入场动画：fadeInUp 0.3s var(--ease-out) both

单个角色行：
  display: flex; align-items: center; gap: var(--space-3)
  padding: var(--space-4) var(--space-4) = 16px 16px
  min-height: 64px
  cursor: pointer
  border-bottom: 1px solid var(--border-subtle)（最后一个无边框）
  transition: background var(--duration-fast)
  入场动画：各行 fadeInUp，delay 依次 +50ms

  头像占位圆（无图片，用名字首字符）：
    width: 36px; height: 36px; border-radius: 50%
    background: var(--color-brand-light)
    color: var(--color-brand)
    font-size: var(--font-sm); font-weight: 700
    display: flex; align-items: center; justify-content: center
    flex-shrink: 0

  文字区：
    flex: 1; min-width: 0
    角色名：font-size: var(--font-base) = 15px; font-weight: 600; color: var(--text-primary)
    一句话人设：font-size: var(--font-xs) = 12px; color: var(--text-secondary); margin-top: 2px

  右箭头：
    color: var(--text-muted)
    SVG 右箭头，size: 14px
    flex-shrink: 0

  Hover 状态：
    background: var(--bg-elevated) = #F8FAFC

空结果提示区：
  padding: var(--space-10) var(--space-6) = 40px 24px
  text-align: center

  图标（疑惑表情或搜索无结果 SVG）：
    color: var(--text-muted)
    font-size: 36px（表情符号）或 SVG 40px

  主文字：
    font-size: var(--font-md) = 16px; font-weight: 600
    color: var(--text-primary); margin-top: var(--space-3)
    "换一个试试"

  副文字：
    font-size: var(--font-sm) = 13px; color: var(--text-secondary)
    margin-top: var(--space-2)
    "这个世界的角色有点冷门，换个关键词试试吧"
```

---

## 页面 4：角色选择（CharacterSelect）

### 设计意图

> 像在班级花名册上圈人——角色卡简洁明了，已选中的卡片立刻有视觉反馈，数量提示像游戏进度条一样让人想"集齐"。

### 视觉动线

顶部导航（已选X位，最多3） → 大标题"选 2-3 位角色" → 角色卡网格（2列）→ 底部"下一步"按钮（满足条件后点亮）

### 页面结构

```
┌─────────────────────────────────┐
│ ←  点将局            已选 1/3   │  顶部导航 + 计数
│                                 │
│  选 2-3 位角色                  │  标题
│  选好后一起开一场神奇的会议       │  副标题
│                                 │
│  ┌──────────────┐ ┌───────────┐ │  角色卡网格（2列）
│  │ ✓ 孙悟空     │ │ 猪八戒    │ │
│  │   天生反骨    │ │ 好吃懒做  │ │
│  │   不服管教    │ │ 贪图享乐  │ │
│  └──────────────┘ └───────────┘ │
│  ┌──────────────┐ ┌───────────┐ │
│  │ 唐僧         │ │ 沙悟净    │ │
│  │ 菩萨心肠     │ │ 沉默寡言  │ │
│  │ 原则至上     │ │ 任劳任怨  │ │
│  └──────────────┘ └───────────┘ │
│                                 │
│  ┌───────────────────────────┐  │  底部 CTA
│  │        下一步  →           │  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

### 各区块详细规格

#### 顶部导航区

```
height: 56px; padding: 0 var(--space-4)
display: flex; align-items: center; justify-content: space-between

左侧：返回按钮（同 BrainstormEntry）

中间：标题"点将局"
  font-size: var(--font-md) = 16px; font-weight: 600

右侧：已选计数徽标
  display: inline-flex; align-items: center; gap: 4px
  font-size: var(--font-xs) = 12px; font-weight: 600

  计数圆点（已选数量）：
    min-width: 22px; height: 22px; border-radius: var(--radius-full)
    font-size: var(--font-xs); font-weight: 700; color: #FFFFFF
    未选（0个）→ background: var(--text-muted) + opacity: 0.5
    选了1个 → background: var(--color-warning) = #F59E0B（黄色：不够）
    选了2-3个 → background: var(--color-success) = #10B981（绿色：可以下一步）
    display: flex; align-items: center; justify-content: center
    transition: background var(--duration-normal) var(--ease-spring)

  文字"/3"：color: var(--text-muted)
```

#### 标题区

```
padding: var(--space-5) var(--space-5) 0

大标题：
  font-size: var(--font-xl) = 22px; font-weight: 700
  color: var(--text-primary)

副标题：
  font-size: var(--font-sm) = 13px; color: var(--text-secondary)
  margin-top: var(--space-1)
```

#### 角色卡网格

```
padding: var(--space-4) var(--space-5) = 16px 20px
display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3) = 12px
overflow-y: auto; flex: 1

单个角色卡（默认态）：
  background: var(--bg-surface)
  border-radius: var(--radius-lg) = 16px
  border: 2px solid var(--border)
  padding: var(--space-4) = 16px
  cursor: pointer
  min-height: 100px
  position: relative
  transition: all var(--duration-normal) var(--ease-spring)
  入场动画：springIn，各卡片 delay 依次 +40ms

  角色名：
    font-size: var(--font-base) = 15px; font-weight: 700
    color: var(--text-primary)

  人设文字：
    font-size: var(--font-xs) = 12px
    color: var(--text-secondary)
    line-height: 1.5; margin-top: var(--space-1)

  选中勾（默认隐藏）：
    position: absolute; top: 10px; right: 10px
    width: 20px; height: 20px; border-radius: 50%
    background: var(--accent-purple)
    display: flex; align-items: center; justify-content: center
    SVG 勾形，color: #FFFFFF, size: 11px
    transition: opacity var(--duration-fast), transform var(--duration-normal) var(--ease-spring)
    默认 opacity: 0; transform: scale(0)

单个角色卡（选中态）：
  border-color: var(--accent-purple)
  background: linear-gradient(145deg, #F5F3FF, #EDE9FE)（与脑洞模式卡片同色调）
  box-shadow: var(--shadow-character-selected)
  transform: scale(1.02)

  选中勾：opacity: 1; transform: scale(1)

单个角色卡（超限态，第4个以后禁止再选）：
  opacity: 0.45
  cursor: not-allowed
  pointer-events: none

单个角色卡 Hover（未选中、未超限时）：
  border-color: rgba(139, 92, 246, 0.30)
  transform: translateY(-2px)
  box-shadow: var(--shadow-md)
```

#### 底部 CTA

```
padding: var(--space-4) var(--space-5) max(var(--space-5), env(safe-area-inset-bottom))
background: var(--bg-surface)
border-top: 1px solid var(--border-subtle)
box-shadow: 0 -4px 12px rgba(0,0,0,0.04)

下一步按钮（禁用态，<2个选中时）：
  width: 100%; height: 52px; border-radius: var(--radius-lg)
  font-size: var(--font-md); font-weight: 600
  background: var(--bg-elevated)
  color: var(--text-muted)
  border: none; cursor: not-allowed
  opacity: 0.55

下一步按钮（激活态，2-3个选中时）：
  background: var(--accent-purple) = #8B5CF6
  color: #FFFFFF
  box-shadow: 0 4px 16px rgba(139, 92, 246, 0.28)
  cursor: pointer

  Hover：
    background: #7C3AED
    transform: translateY(-1px)
    box-shadow: 0 8px 24px rgba(139, 92, 246, 0.36)

  Active：transform: scale(0.98)

  transition: all var(--duration-normal) var(--ease-spring)
```

### 交互状态汇总

| 元素 | 默认 | Hover | 选中 | 超限禁用 |
|------|------|-------|------|---------|
| 角色卡 | 白底灰框 | 上浮+紫色淡框 | 紫渐变底+深紫框+勾 | 半透明+无交互 |
| 下一步按钮 | 灰底不可点 | - | - | - |
| 下一步按钮（激活） | 紫色+阴影 | 上浮+加深 | - | - |
| 右上角计数 | 灰色 | - | 黄→绿 | - |

---

## 页面 5：随机抽签（RandomDraw）

### 设计意图

> 像抽卡游戏里的开包动画——翻牌前是期待，翻牌时是惊喜，翻牌后是评估。设计要把这三个阶段拉开节奏，让用户真实体验到"揭晓"的仪式感。

### 视觉动线

大标题"乱炖局" → 3张并排翻牌卡（目光依次扫过背面花纹） → 翻牌按钮（强烈 CTA） → 翻牌完成后两个操作按钮（换一批 / 就这三位）

### 页面结构

```
┌─────────────────────────────────┐
│ ←  脑洞模式                     │
│                                 │
│         乱炖局                   │  大标题
│   随机召唤，命运自行安排            │  副标题
│                                 │
│   ┌───────┐ ┌───────┐ ┌───────┐ │  3张翻牌卡（横排）
│   │  ///  │ │  ///  │ │  ///  │ │  翻牌前（背面）
│   │  ///  │ │  ///  │ │  ///  │ │
│   │  ///  │ │  ///  │ │  ///  │ │
│   └───────┘ └───────┘ └───────┘ │
│                                 │
│   ┌───────────────────────────┐ │  翻牌按钮（翻牌前）
│   │       翻开看看  ✨         │ │
│   └───────────────────────────┘ │
│                                 │
│   ──── 翻牌后 ────               │
│   ┌──────────────────────────┐  │
│   │ [换一批]    [就这三位 →]  │  │
│   └──────────────────────────┘  │
│                                 │
└─────────────────────────────────┘
```

### 各区块详细规格

#### 顶部导航区

```
同 BrainstormEntry（返回按钮 + "脑洞模式"标题）
```

#### 标题区

```
padding: var(--space-6) var(--space-5) 0
text-align: center

大标题"乱炖局"：
  font-size: var(--font-xl) = 22px; font-weight: 800
  color: var(--text-primary)
  入场动画：fadeInUp 0.35s var(--ease-out) 0ms both

副标题：
  font-size: var(--font-sm) = 13px
  color: var(--text-secondary)
  margin-top: var(--space-1)
```

#### 翻牌卡区域

```
padding: var(--space-6) var(--space-4) 0  = 24px 16px 0
display: flex; gap: var(--space-3) = 12px; justify-content: center

单张翻牌卡（3张等宽）：
  flex: 1; max-width: 120px
  height: 165px（宽高比约 3:4.1，略高）
  border-radius: var(--radius-xl) = 20px
  position: relative
  perspective: 600px（父容器设置，用于 3D 翻转）

  翻牌内部包裹容器：
    position: absolute; inset: 0
    transform-style: preserve-3d
    transition: transform 0.6s var(--ease-spring)
    （翻开时 rotateY(180deg)）

  ── 背面（card-back）──
    position: absolute; inset: 0
    backface-visibility: hidden; -webkit-backface-visibility: hidden
    border-radius: var(--radius-xl)
    background: var(--card-back-gradient) = linear-gradient(135deg, #1E1B4B, #312E81, #4C1D95)
    border: 1px solid rgba(255,255,255,0.08)
    box-shadow: var(--shadow-lg)
    overflow: hidden

    背面纹理图案（纯 CSS 实现，无图片）：
      重复的菱形网格 pattern：
        background-image:
          repeating-linear-gradient(45deg, rgba(255,255,255,0.04) 0, rgba(255,255,255,0.04) 1px, transparent 0, transparent 50%),
          repeating-linear-gradient(-45deg, rgba(255,255,255,0.04) 0, rgba(255,255,255,0.04) 1px, transparent 0, transparent 50%)
        background-size: 20px 20px

    中央花纹图标（SVG 星形 / 问号）：
      position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%)
      width: 36px; height: 36px
      color: rgba(255,255,255,0.20)

  ── 正面（card-front）──
    position: absolute; inset: 0
    backface-visibility: hidden; -webkit-backface-visibility: hidden
    transform: rotateY(180deg)
    border-radius: var(--radius-xl)
    background: var(--bg-surface)
    border: 1.5px solid var(--border)
    box-shadow: var(--shadow-md)
    padding: var(--space-3) = 12px
    display: flex; flex-direction: column; justify-content: space-between

    世界标签（顶部）：
      font-size: 10px; font-weight: 600
      color: var(--accent-purple)
      background: rgba(139, 92, 246, 0.10)
      border-radius: var(--radius-sm) = 8px
      padding: 2px 7px
      align-self: flex-start
      letter-spacing: 0.3px

    角色名（中部）：
      font-size: var(--font-md) = 16px; font-weight: 700
      color: var(--text-primary)
      line-height: 1.2
      margin-top: var(--space-2)

    人设文字（底部）：
      font-size: 11px; color: var(--text-secondary)
      line-height: 1.45
      margin-top: var(--space-1)
      display: -webkit-box; -webkit-line-clamp: 3; overflow: hidden（超出截断）

翻牌入场动画（翻牌按钮触发后，3张卡依次翻开）：
  第1张：delay 0ms
  第2张：delay 160ms
  第3张：delay 320ms
  每张通过 rotateY(0deg) → rotateY(180deg) + spring ease

换一批动画（重置）：
  所有卡先同时 rotateY(0deg)（回到背面），duration 300ms ease-out
  200ms 后重新触发翻开动画
```

#### 操作按钮区

```
padding: var(--space-6) var(--space-5) max(var(--space-5), env(safe-area-inset-bottom))

翻牌按钮（翻牌前显示，翻牌后隐藏）：
  width: 100%; height: 52px; border-radius: var(--radius-lg)
  font-size: var(--font-md); font-weight: 600
  background: var(--color-brand) = #4F46E5
  color: #FFFFFF
  box-shadow: var(--shadow-brand) = 0 4px 16px rgba(79,70,229,0.20)
  border: none; cursor: pointer
  animation: glowPulse 2.5s ease-in-out infinite（轻微呼吸光晕，吸引点击）

  Hover：
    background: var(--color-brand-dark)
    transform: translateY(-2px)
    box-shadow: 0 8px 24px rgba(79,70,229,0.32)

  Active：transform: scale(0.98)

翻牌后按钮区（翻牌完成后 fade in）：
  display: flex; gap: var(--space-3)
  入场动画：fadeInUp 0.35s var(--ease-out) both（翻完最后一张后 200ms 出现）

  换一批（左，次要）：
    flex: 1; height: 52px; border-radius: var(--radius-lg)
    background: var(--bg-elevated)
    color: var(--text-secondary)
    border: 1.5px solid var(--border)
    font-size: var(--font-base); font-weight: 600
    cursor: pointer
    Hover：background: var(--bg-surface), color: var(--text-primary), border-color: var(--color-brand-mid)

  就这三位（右，主要）：
    flex: 2; height: 52px; border-radius: var(--radius-lg)
    background: var(--accent-purple) = #8B5CF6
    color: #FFFFFF
    box-shadow: 0 4px 16px rgba(139,92,246,0.25)
    font-size: var(--font-base); font-weight: 600
    cursor: pointer
    Hover：background: #7C3AED, transform: translateY(-2px), box-shadow 加深
    Active：transform: scale(0.98)
```

### 交互状态汇总

| 元素 | 翻牌前 | 翻牌中 | 翻牌后 |
|------|--------|--------|--------|
| 翻牌卡 | 深靛蓝背面+纹理 | 3D rotateY 翻转中 | 白底正面+角色信息 |
| 翻牌按钮 | 靛蓝+glowPulse | 禁用防重复点击 | 隐藏 |
| 换一批+就这三位 | 隐藏 | 隐藏 | fadeIn 出现 |

---

## 页面 6：主题预览（ThemePreview）

### 设计意图

> 像电影放映前的预告片字幕——会议主题、场景、角色阵容依次展示，给用户一种"我知道要进去什么世界了"的期待感，换主题的计数器则像有限次的重随机，制造适度稀缺感。

### 视觉动线

顶部返回 → 主题标题（最大，最先看到） → 场景设定（2-3句，用缩进区分层级） → 用户身份标签（彩色徽标，突出"我是谁"） → 角色阵容列表（乱炖局才显示，点将局简略） → 底部双按钮（换主题 / 进入会议）

### 页面结构

```
┌─────────────────────────────────┐
│ ←  主题预览                     │
│                                 │
│  ┌───────────────────────────┐  │  主题卡片（核心信息卡）
│  │  🏛️  会议主题               │  │
│  │                           │  │
│  │  《天庭议事厅紧急公告》      │  │  主题标题
│  │                           │  │
│  │  场景设定                  │  │  分区标签
│  │  玉帝宣召紧急御前会议，讨    │  │
│  │  论东海龙宫失职一事。各路    │  │
│  │  神仙依次述职…              │  │
│  │                           │  │
│  │  你的身份                  │  │  分区标签
│  │  ┌──────────────────────┐ │  │
│  │  │ 天庭派来的监察仙官     │ │  │  身份徽标
│  │  └──────────────────────┘ │  │
│  └───────────────────────────┘  │
│                                 │
│  ┌───────────────────────────┐  │  角色阵容（乱炖局）
│  │ 与会角色                  │  │
│  │ 孙悟空 · 天庭巡察大使      │  │
│  │ 乔布斯 · 天庭机关创新师长   │  │
│  │ 贾宝玉 · 玉帝御前起居录事  │  │
│  └───────────────────────────┘  │
│                                 │
│  ┌──────────┐ ┌───────────────┐ │  底部按钮
│  │换一个 2/3│ │  进入会议  →  │ │
│  └──────────┘ └───────────────┘ │
│                                 │
└─────────────────────────────────┘
```

### 各区块详细规格

#### 顶部导航区

```
同前，返回按钮 + "主题预览"标题
```

#### 主题信息卡

```
padding: var(--space-5) var(--space-5) 0  = 20px 20px 0
入场动画：fadeInUp 0.4s var(--ease-out) 0ms both

卡片容器：
  background: var(--bg-surface)
  border-radius: var(--radius-xl) = 20px
  border: 1px solid var(--border)
  box-shadow: var(--shadow-md)
  overflow: hidden

── 卡片顶部色条（世界色调，2个场景不同颜色）──
  height: 4px
  点将局（中国古典）：background: linear-gradient(90deg, #F97316, #EF4444)（橙红，有古典感）
  点将局（西方文学）：background: linear-gradient(90deg, #3B82F6, #8B5CF6)
  乱炖局：background: var(--brainstorm-gradient) = linear-gradient(135deg, #8B5CF6, #6D28D9)
  注：前端根据 mainWorld 动态切换，颜色复用现有 Token

── 卡片内容区 ──
  padding: var(--space-5) var(--space-5) = 20px 20px

  世界标签徽标（左对齐）：
    font-size: 11px; font-weight: 600; letter-spacing: 0.5px
    color: var(--accent-purple)
    background: rgba(139,92,246,0.10)
    border-radius: var(--radius-sm)
    padding: 3px 9px
    display: inline-flex
    margin-bottom: var(--space-3)

  会议主题标题：
    font-size: var(--font-xl) = 22px; font-weight: 700
    color: var(--text-primary)
    line-height: 1.25
    margin-bottom: var(--space-4)

  ── 场景设定区 ──
  分区小标签：
    font-size: var(--font-xs) = 12px; font-weight: 600
    color: var(--text-muted); letter-spacing: 1px
    text-transform: uppercase
    margin-bottom: var(--space-2)

  场景文字：
    font-size: var(--font-sm) = 13px
    color: var(--text-secondary)
    line-height: 1.7
    padding-left: var(--space-3)
    border-left: 2px solid var(--border)
    margin-bottom: var(--space-5)

  ── 用户身份区 ──
  分区小标签（同上格式）

  身份徽标：
    display: inline-flex; align-items: center; gap: var(--space-2)
    background: var(--color-brand-light)
    border: 1px solid var(--color-brand-mid)
    border-radius: var(--radius-full)
    padding: var(--space-2) var(--space-4) = 8px 16px

    前缀图标（王冠 SVG）：
      width: 14px; height: 14px; color: var(--color-brand)

    身份文字：
      font-size: var(--font-sm) = 13px; font-weight: 600
      color: var(--color-brand)
```

#### 角色阵容区（仅乱炖局显示，点将局不显示）

```
padding: var(--space-4) var(--space-5) 0

卡片容器：
  background: var(--bg-surface)
  border-radius: var(--radius-lg) = 16px
  border: 1px solid var(--border)
  box-shadow: var(--shadow-xs)
  overflow: hidden
  入场动画：fadeInUp 0.35s var(--ease-out) 0.1s both

标题行：
  padding: var(--space-3) var(--space-4)
  border-bottom: 1px solid var(--border-subtle)
  font-size: var(--font-xs) = 12px; font-weight: 600
  color: var(--text-muted); letter-spacing: 1px; text-transform: uppercase

角色行（每个参会角色）：
  display: flex; align-items: center; gap: var(--space-3)
  padding: var(--space-3) var(--space-4)
  border-bottom: 1px solid var(--border-subtle)（最后一个无）

  头像圆（名字首字）：
    width: 32px; height: 32px; border-radius: 50%
    background: var(--color-brand-light); color: var(--color-brand)
    font-size: var(--font-xs); font-weight: 700
    display: flex; align-items: center; justify-content: center

  文字区：
    flex: 1
    角色名：font-size: var(--font-sm) = 13px; font-weight: 600; color: var(--text-primary)
    适配头衔：font-size: var(--font-xs) = 12px; color: var(--text-muted); margin-top: 1px

  世界来源标签（最右）：
    font-size: 10px; font-weight: 600; color: var(--accent-purple)
    background: rgba(139,92,246,0.08)
    border-radius: var(--radius-sm)
    padding: 2px 6px
    flex-shrink: 0
```

#### 底部按钮区

```
padding: var(--space-4) var(--space-5) max(var(--space-5), env(safe-area-inset-bottom))
background: var(--bg-surface)
border-top: 1px solid var(--border-subtle)
box-shadow: 0 -4px 12px rgba(0,0,0,0.04)
display: flex; gap: var(--space-3)

换一个主题按钮（左，次要，宽度固定约 130px）：
  height: 52px; border-radius: var(--radius-lg)
  background: var(--bg-elevated)
  border: 1.5px solid var(--border)
  font-size: var(--font-sm) = 13px; font-weight: 600
  color: var(--text-secondary)
  cursor: pointer
  padding: 0 var(--space-4)
  display: flex; align-items: center; justify-content: center; gap: var(--space-2)
  white-space: nowrap

  计数徽标（x/3）：
    font-size: var(--font-xs); font-weight: 700
    color: var(--color-brand)
    background: var(--color-brand-light)
    border-radius: var(--radius-full)
    padding: 1px 6px
    min-width: 28px; text-align: center

  激活态（次数 < 3）：
    Hover：background: var(--bg-surface), border-color: var(--color-brand-mid), color: var(--text-primary)

  禁用态（次数 = 3）：
    opacity: 0.45; cursor: not-allowed; pointer-events: none

换一个主题按钮 Loading 态（AI 生成中）：
  显示 3 点 loading 动画（同 Onboarding 的 loadingDots 样式）
  pointer-events: none; opacity: 0.7

进入会议按钮（右，主要，flex-1）：
  height: 52px; border-radius: var(--radius-lg)
  background: var(--color-success) = #10B981
  color: #FFFFFF
  box-shadow: var(--shadow-success) = 0 4px 16px rgba(16,185,129,0.20)
  font-size: var(--font-md); font-weight: 600
  cursor: pointer; border: none
  display: flex; align-items: center; justify-content: center; gap: var(--space-2)

  右箭头图标：SVG 16px，color: rgba(255,255,255,0.8)

  Hover：
    background: var(--color-success-hover) = #059669
    transform: translateY(-2px)
    box-shadow: 0 8px 24px rgba(16,185,129,0.32)

  Active：transform: scale(0.98)

  Loading 态（进入会议请求中）：
    同换主题 Loading，显示白色 3 点动画
```

### 交互状态汇总

| 元素 | 默认 | Loading | 禁用（用完次数） |
|------|------|---------|----------------|
| 换一个主题 | 灰底可点 + 计数徽标 | 3点动画 + 半透明 | 全透明45% + 无交互 |
| 进入会议 | 绿色CTA激活 | 白色3点动画 | 不会禁用 |
| 角色阵容卡 | 静态展示 | - | - |

---

## 共用组件设计规范

### 顶部导航栏（PageNav）

所有脑洞模式页面共用，抽取为组件：

```css
.pageNav {
  height: 56px;
  padding: 0 var(--space-4);
  display: flex;
  align-items: center;
  gap: var(--space-3);
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border-subtle);
  position: sticky;
  top: 0;
  z-index: 100;
}

.navBack {
  /* 40x40 圆形返回按钮 */
  width: 40px; height: 40px; border-radius: 50%;
  background: var(--bg-elevated);
  color: var(--text-secondary);
  display: flex; align-items: center; justify-content: center;
  border: none; cursor: pointer;
  flex-shrink: 0;
  transition: background var(--duration-fast), color var(--duration-fast), transform var(--duration-fast);
}

.navBack:hover {
  background: var(--color-brand-light);
  color: var(--color-brand);
  transform: translateX(-1px);
}

.navTitle {
  font-size: var(--font-md);
  font-weight: 600;
  color: var(--text-primary);
  flex: 1;
}
```

### 翻牌动画 CSS（Card Flip）

```css
/* 翻牌卡容器 — 设置透视 */
.flipCardContainer {
  perspective: 600px;
  border-radius: var(--radius-xl);
}

/* 翻牌内部包裹，3D 翻转依靠此元素 */
.flipCardInner {
  position: relative;
  width: 100%; height: 100%;
  transform-style: preserve-3d;
  transition: transform 0.55s var(--ease-spring);
  border-radius: var(--radius-xl);
}

/* 翻开状态 */
.flipCardInner.flipped {
  transform: rotateY(180deg);
}

/* 正面和背面共同规则 */
.flipCardFront,
.flipCardBack {
  position: absolute;
  inset: 0;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  border-radius: var(--radius-xl);
}

/* 正面：默认不可见（rotateY 180 = 反面朝上），需翻转后才显示 */
.flipCardFront {
  transform: rotateY(180deg);
  background: var(--bg-surface);
  border: 1.5px solid var(--border);
  box-shadow: var(--shadow-md);
}

/* 背面：深靛蓝 */
.flipCardBack {
  background: var(--card-back-gradient);
  box-shadow: var(--shadow-lg);
}
```

### 骨架屏动画（Shimmer）

```css
@keyframes shimmer {
  0%   { background-position: -300px 0; }
  100% { background-position: 300px 0; }
}

.skeletonItem {
  border-radius: var(--radius-md);
  background: linear-gradient(
    90deg,
    var(--bg-elevated) 25%,
    var(--border-subtle) 50%,
    var(--bg-elevated) 75%
  );
  background-size: 600px 100%;
  animation: shimmer 1.4s infinite linear;
}
```

---

## 前端技术要点（供程序员参考）

1. **翻牌动画**：使用 CSS `transform-style: preserve-3d` + `backface-visibility: hidden`，不需要 JS 动画库，通过切换 class 控制翻转。三张卡依次翻开用 `setTimeout(fn, i * 160)` 控制 delay。

2. **角色卡选择状态**：用 `Set` 维护已选 ID，超过 3 个时设 `pointerEvents: none` 到未选中卡片，不是禁用选中卡片（已选中的还要能反选）。

3. **主题预览页卡片顶色条**：根据 `brainstormWorld` 动态计算颜色，建议在 `data/world-colors.js` 中维护世界→颜色的映射表，Token 层直接引用现有强调色。

4. **换主题次数计数**：`themeRefreshCount` 存 context state，不持久化到 localStorage。按钮 disabled 条件：`themeRefreshCount >= 3 || isLoading`。

5. **底部固定按钮区**：统一使用 `padding-bottom: max(20px, env(safe-area-inset-bottom))` 适配 iPhone 刘海屏。

6. **Onboarding 改造**（2步）：只需改 `TOTAL_STEPS = 2`，删除 step 2/3 的 JSX 块，`handleStart` 改为在 step 1 完成后直接调用，不再传 jobTitle/industry。英语等级描述换为 PRD 中的通用化文案。

7. **CSS Module 命名规范**：新页面各自对应 `PageName.module.css`，脑洞模式系列页面可在文件顶部设置局部变量覆盖以统一紫色调：
   ```css
   .container {
     --mode-accent: var(--accent-purple);        /* #8B5CF6 */
     --mode-accent-light: rgba(139, 92, 246, 0.10);
     --mode-accent-shadow: var(--shadow-brainstorm);
   }
   ```

---

*设计方案完成。所有颜色均引用 Token，新增 Token 已在"设计总纲"中标注。*
