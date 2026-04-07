# Feed 页面重新设计方案
# 全屏滑动 + 中英双语

---

## 设计意图

这个页面要让用户感受到「哇这也太好笑了，我要进去聊」，所以视觉重心在中文标题的冲击力，英文作为副角悄悄告诉用户「这是英语 App」，CTA 按钮固定在屏幕底部随时触手可及，不需要滚动找到它。

---

## 一、视觉动线分析

用户的眼睛在全屏卡片上的移动路径：

1. **第一眼**：新闻来源标签 + 中文大标题（最大字号，冲击力最强）
2. **第二眼**：英文副标题（小字，下意识扫过，意识到是英语 App）
3. **第三眼**：两个角色的头像 + 中文反应（情绪渲染，引发共鸣）
4. **第四眼**：角色反应下方的英文小字（让用户看到「原来说英语也能这么聊」）
5. **最后**：底部「加入讨论」按钮（时机成熟，冲动最强）

---

## 二、布局结构

### 整体容器

```jsx
// 全屏滚动容器，替换原有 .container
<div className={styles.container}>
  {/* DmBanner 浮层保持不变，position: fixed */}
  {bannerData && <DmBanner ... />}

  {/* 全屏卡片滑动区域，撑满剩余视口高度 */}
  <div className={styles.feedScroller}>
    {feeds.map((item, index) => (
      <article
        key={item.roomId}
        className={styles.card}
        data-card-id={item.roomId}
      >
        {/* 卡片内容区 */}
        <div className={styles.cardInner}>
          {/* 上方：标签行 */}
          <div className={styles.tagsRow}>...</div>

          {/* 中间：新闻标题区（中英双语） */}
          <div className={styles.titleBlock}>
            <h2 className={styles.newsTitleZh}>{item.newsTitle}</h2>
            <p className={styles.newsTitleEn}>{item.newsTitleEn}</p>
          </div>

          {/* 中间：角色反应区（中英双语） */}
          <div className={styles.reactions}>
            <div className={styles.reaction}>
              <span className={styles.npcAvatar}>{item.npcAName[0]}</span>
              <div className={styles.reactionContent}>
                <span className={styles.npcName}>{item.npcAName}</span>
                <p className={styles.reactionTextZh}>{item.npcAReaction}</p>
                <p className={styles.reactionTextEn}>{item.npcAReactionEn}</p>
              </div>
            </div>
            <div className={styles.reaction}>
              <span className={styles.npcAvatar}>{item.npcBName[0]}</span>
              <div className={styles.reactionContent}>
                <span className={styles.npcName}>{item.npcBName}</span>
                <p className={styles.reactionTextZh}>{item.npcBReaction}</p>
                <p className={styles.reactionTextEn}>{item.npcBReactionEn}</p>
              </div>
            </div>
          </div>
        </div>

        {/* 底部固定：加入讨论 + 滑动提示 */}
        <div className={styles.cardFooter}>
          <button className={styles.joinButton} onClick={() => handleJoinChat(item.roomId)}>
            加入讨论  Join the Chat
            <svg .../>
          </button>
          {/* 最后一张卡片不显示向下箭头 */}
          {index < feeds.length - 1 && (
            <div className={styles.swipeHint}>
              <svg .../>  {/* 向下箭头，breathing 动画 */}
            </div>
          )}
        </div>
      </article>
    ))}
  </div>

  {/* 位置指示器：右侧圆点 */}
  <div className={styles.dotIndicator}>
    {feeds.map((_, i) => (
      <span
        key={i}
        className={`${styles.dot} ${currentIndex === i ? styles.dotActive : ''}`}
      />
    ))}
  </div>
</div>
```

### 数据字段说明

卡片需要新增以下英文字段（由后端在 seed 数据或 API 返回时补充）：
- `newsTitleEn` — 新闻标题英文版（信达雅风格）
- `npcAReactionEn` — NPC A 反应英文版
- `npcBReactionEn` — NPC B 反应英文版

---

## 三、CSS 关键样式

### 全屏滑动核心

```css
/* 替换原 .container — 全屏布局 */
.container {
  max-width: 430px;
  margin: 0 auto;
  width: 100%;
  height: 100dvh;          /* 撑满动态视口，排除顶部状态栏 */
  overflow: hidden;        /* 外层不滚动 */
  background: var(--bg-elevated);
  position: relative;
}

/* 全屏滑动滚动容器 */
.feedScroller {
  height: 100%;
  overflow-y: scroll;
  scroll-snap-type: y mandatory;   /* 强制吸附到整张卡片 */
  scroll-behavior: smooth;
  /* 隐藏滚动条，保留功能 */
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.feedScroller::-webkit-scrollbar {
  display: none;
}

/* 单张全屏卡片 */
.card {
  height: 100dvh;                  /* 每张卡片撑满一屏 */
  scroll-snap-align: start;        /* 吸附到卡片顶部 */
  scroll-snap-stop: always;        /* 禁止一次滑过多张 */
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  position: relative;
  /* 卡片背景：每张微妙不同（见下方背景策略） */
  background: var(--bg-surface);
  padding: var(--space-6) var(--space-5) var(--space-5);
}
```

### 卡片背景策略（区分不同卡片，非纯色）

用 `nth-child` 给每张卡片分配不同的极浅底色，避免视觉单调，但不影响内容可读性：

```css
/* 卡片底色轮换：Indigo浅 → Teal浅 → Orange浅 → 回到Indigo */
.card:nth-child(1) { background: #FAFBFE; }   /* 默认 --bg-base */
.card:nth-child(2) { background: #F0FDFA; }   /* Teal-50 */
.card:nth-child(3) { background: #FFF7ED; }   /* Orange-50 */
.card:nth-child(4) { background: #F5F3FF; }   /* Violet-50 */
.card:nth-child(5) { background: #ECFDF5; }   /* Emerald-50 */
```

新增 Token（供开发引用）：
- `--bg-card-teal: #F0FDFA`，理由：第2张卡片轮换底色，来自 Tailwind Teal-50
- `--bg-card-orange: #FFF7ED`，理由：第3张卡片轮换底色，来自 Tailwind Orange-50
- `--bg-card-violet: #F5F3FF`，理由：第4张卡片轮换底色，来自 Tailwind Violet-50
- `--bg-card-emerald: #ECFDF5`，理由：第5张卡片轮换底色，来自 Tailwind Emerald-50

### 中英双语排版

```css
/* 标题区块 */
.titleBlock {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);    /* 中英文间距紧凑，8px */
  margin: var(--space-4) 0;
}

/* 中文主标题 — 大字冲击力 */
.newsTitleZh {
  font-size: 20px;          /* 介于 --font-xl(22px) 和 --font-lg(18px) 之间，实际值 */
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.4;
  letter-spacing: -0.02em;
}

/* 英文副标题 — 小字低调 */
.newsTitleEn {
  font-size: var(--font-sm);   /* 13px */
  font-weight: 500;
  color: var(--text-secondary); /* #64748B，比中文轻 */
  line-height: 1.5;
  font-style: italic;           /* 斜体暗示这是英文内容，区分中文 */
  letter-spacing: 0.01em;
}

/* 角色反应区 */
.reactions {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4);
  background: var(--bg-elevated);
  border-radius: var(--radius-lg);
  flex: 1;                     /* 占据中间剩余空间 */
  justify-content: center;
}

/* 中文反应文本 */
.reactionTextZh {
  font-size: var(--font-base);  /* 15px */
  color: var(--text-primary);
  line-height: 1.5;
  word-break: break-word;
  margin-bottom: 3px;
}

/* 英文反应文本 */
.reactionTextEn {
  font-size: var(--font-xs);    /* 12px */
  color: var(--text-muted);     /* #94A3B8，更轻 */
  line-height: 1.4;
  font-style: italic;
}
```

### 底部固定区

```css
/* 卡片底部固定区：按钮 + 滑动提示 */
.cardFooter {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  padding-bottom: env(safe-area-inset-bottom, 0px);  /* iPhone 底部安全区 */
}

/* 加入讨论按钮 — 延续现有样式，加上英文副文案 */
.joinButton {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  height: 52px;               /* 比原来 44px 稍高，全屏模式下更有份量 */
  background: var(--color-brand);
  color: #FFFFFF;
  border-radius: var(--radius-lg);
  font-size: var(--font-base); /* 15px */
  font-weight: 600;
  letter-spacing: 0.02em;
  transition: background 200ms var(--ease-out),
              transform 200ms var(--ease-out),
              box-shadow 200ms var(--ease-out);
  box-shadow: var(--shadow-brand);
}

/* 向下滑动提示 */
.swipeHint {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  color: var(--text-muted);
  font-size: 11px;
  animation: breathe 2s var(--ease-gentle) infinite;  /* 现有 breathe 动画 */
}
.swipeHint svg {
  width: 16px;
  height: 16px;
  color: var(--text-muted);
}
```

### 右侧圆点指示器

```css
/* 位置：右侧垂直居中，position: fixed 在 .container 内 */
.dotIndicator {
  position: fixed;
  right: calc((100vw - 430px) / 2 + 12px);  /* 贴合卡片右边缘内 12px */
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  gap: 6px;
  z-index: 10;
}

/* 在 430px 以下的窗口（手机）直接 right: 12px */
@media (max-width: 430px) {
  .dotIndicator { right: 12px; }
}

.dot {
  width: 4px;
  height: 4px;
  border-radius: var(--radius-full);
  background: var(--border);
  transition: all 250ms var(--ease-out);
}

.dotActive {
  width: 4px;
  height: 12px;              /* 激活状态拉长成胶囊形，不用颜色大变化 */
  background: var(--color-brand);
}
```

### 标签 chip（延续现有样式）

```css
.tagsRow {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: var(--space-2);
}

.tag {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-brand);
  background: var(--color-brand-light);
  padding: 3px 8px;
  border-radius: var(--radius-full);
  letter-spacing: 0.02em;
  text-transform: uppercase;
}
```

---

## 四、英文翻译策略

### 翻译原则

**新闻标题翻译原则：**
- 参考英文新闻标题惯例：简洁、主动语态、省略冠词和系动词
- 保留幽默感：用词要有一点语气，不能是干巴巴的陈述
- 长度控制在 12 个单词以内，一行能读完

**角色反应翻译原则：**
- 翻译成角色「真的会说」的英文口语，有个性
- 允许口语缩写（gonna, tbh, ngl 等）
- 中文语气词（"你说谁"、"这马"）要找到对应的英文语气表达，不是逐字翻译
- 保留角色性格特征（八戒的嘴欠、白龙马的委屈、甄嬛的端庄等）

---

### 5 张卡片英文翻译

#### 卡片 1：东海三太子闲鱼挂牌（西游记 × 职场）

**新闻标题**
- 中文：【东海商报】东海三太子惊现闲鱼，挂牌价两万，卖家疑为队友
- 英文：`Dragon Prince Listed on eBay for $2K — Seller Reportedly a Former Teammate`
  > 说明：用「Former Teammate」点明职场叙事，「Listed on eBay」对标二手平台语境，自然且有冲击力。

**八戒反应**
- 中文：这马吃得多还不干活，不卖留着过年啊
- 英文：`"Eats half the budget, delivers zero output. Selling makes sense, tbh."`
  > 说明：「half the budget」比「吃得多」更职场化，「tbh」保留八戒嘴欠的语气。

**白龙马反应**
- 中文：你说谁不干活？？我驮行李的时候你在哪里？
- 英文：`"Excuse me?? I carried everyone's stuff the entire trip. Where were YOU exactly?"`
  > 说明：「Excuse me??」传递原文双问号的激动语气，「Where were YOU」重音强调还原原意。

---

#### 卡片 2：灭霸入职（漫威 × 宫斗）

**新闻标题**
- 中文：【复联内部周报】灭霸入职首日提交裁员方案，饼状图获CEO好评
- 英文：`New Hire Thanos Submits Restructuring Plan on Day One. The Pie Chart? Impressive.`
  > 说明：句号+独立句制造节奏感，「Impressive」单独成句是英文新闻标题惯用戏剧性句式。

**钢铁侠反应**
- 中文：我算了一下，数学上确实成立，但这不代表我支持
- 英文：`"The math checks out. That does NOT mean I'm endorsing this."`
  > 说明：「The math checks out」是标准英文口语，「NOT」大写模拟说话重音，还原原文的矛盾感。

**甄嬛反应**
- 中文：这饼状图做工精致，本宫欣赏，但裁的那半个不能是本宫的人
- 英文：`"Elegant work on the chart. We appreciate the craftsmanship. The half being cut? Not my people."`
  > 说明：「We appreciate」对应「本宫」的高冷语气，「Not my people」简洁有力，符合宫斗人物的划清界限风格。

---

#### 卡片 3：年会舞台被冻（迪士尼 × 三国）

**新闻标题**
- 中文：【中土娱乐周刊】年会现场突发事故，舞台被不明力量冻住，司仪诸葛亮哑口无言
- 英文：`Stage Frozen Mid-Show by "Unknown Force." Emcee Zhuge Liang Had No Words.`
  > 说明：加引号的「Unknown Force」暗示说法可疑，增加幽默层次；「Had No Words」是英文惯用语，双关（说不出话 / 无话可说）。

**诸葛亮反应**
- 中文：亮夜观星象，未曾料到今日有此一冻，计划赶不上变化，此乃天意也
- 英文：`"I read the stars last night. Nothing indicated ice. Sometimes the universe just overrides the plan."`
  > 说明：「The universe just overrides the plan」比直译「天意」更自然，保留了诸葛亮强行找理由的喜感。

**Elsa 反应**
- 中文：我觉得效果挺好的，冰雕背景比你们原来那个PPT好看多了
- 英文：`"I thought it looked great, honestly. The ice backdrop beats your original slideshow by a mile."`
  > 说明：「beats by a mile」是口语惯用语，还原 Elsa 毫无愧疚感的语气；「honestly」模拟她的无辜态度。

---

#### 卡片 4：霍格沃茨 AI 分院（哈利波特 × 科技）

**新闻标题**
- 中文：【魔法日报】霍格沃茨宣布引入AI教学系统，分院帽失业，邓布利多："它比我们分得准"
- 英文：`Hogwarts Rolls Out AI Sorting System. Sorting Hat Laid Off. Dumbledore: "It's More Accurate."`
  > 说明：三句短句，节奏像真实新闻快讯，「Laid Off」给魔法物品用职场词汇是笑点所在。

**赫敏反应**
- 中文：我研究了它的算法，它的分类准确率确实是97%，但这不代表我们应该用它
- 英文：`"I've reviewed the algorithm. 97% accuracy is real. That still doesn't mean we should use it."`
  > 说明：拆成三句，每句递进，还原赫敏「承认事实但不妥协」的性格；语气比直译更有说服力。

**马尔福反应**
- 中文：它把我分到了赫奇帕奇，系统明显有bug，我要投诉
- 英文：`"It sorted me into Hufflepuff. The system is clearly broken. I am filing a complaint."`
  > 说明：三句话，每句都是马尔福独特的逻辑链；「clearly broken」比「有bug」更像他说话的方式，傲慢且绝对。

---

#### 卡片 5：中土好声音转椅脱轨（指环王 × 综艺）

**新闻标题**
- 中文：【中土娱乐快报】"中土好声音"总决赛现场爆冷，甘道夫盲选转椅直接脱轨，导师组集体道歉
- 英文：`The Voice of Middle-Earth Grand Finale: Gandalf's Chair Comes Off the Rails. Literally.`
  > 说明：「Off the Rails. Literally.」双关：一是字面上椅子脱轨，二是比喻性的「失控」；「Literally」单独成句是英文网络语气词，制造幽默效果。

**甘道夫反应**
- 中文：我转椅这件事可以解释，那是魔法干扰，不是我操作失误
- 英文：`"There is a perfectly logical explanation for the chair. It was a magical interference. Not operator error."`
  > 说明：「There is a perfectly logical explanation」是英文中经典的辩解开场白，带有明显的「心虚」感，符合甘道夫此刻极力维护体面的状态。

**咕噜反应**
- 中文：我们的，我们的！冠军是我们的！裁判不公平，我们要上诉！
- 英文：`"It's ours, precious. The trophy is OURS. The judges are biased. We appeal!"`
  > 说明：「precious」是咕噜的标志性词汇必须保留；「OURS」大写模拟他激动喊叫的语气；整体还原他反复强调、逻辑奇特的说话方式。

---

## 五、交互细节

### 滑动行为

- 滚动容器使用 `scroll-snap-type: y mandatory`，每次滑动锁定到整张卡片
- `scroll-snap-stop: always` 防止快速滑动跳过多张
- JS 监听 `scroll` 事件更新 `currentIndex` 状态，驱动右侧圆点指示器
- 圆点激活态使用高度变化（4px → 12px 胶囊）而非颜色大跳变，保持克制

### 进入视口计数（IntersectionObserver）

当前的 IntersectionObserver threshold 是 0.5（进入视口 50% 时触发）。全屏模式下每张卡片 = 一屏，用户滑到一张就是 100% 进入视口，threshold 可以降至 0.8，更精准触发。这个改动涉及 JS 逻辑，开发实施时注意。

### 过渡动画

- 卡片入场：移除原有的 `fadeInUp + animationDelay`（列表模式的入场动画在全屏模式下无意义）
- 替代方案：卡片首次进入视口时，内容区做一次轻微的 `fadeIn`（透明度 0→1，200ms）
- 不做位移动画，避免和滑动手势产生视觉叠加干扰

```css
/* 内容区淡入，卡片首次可见时触发（通过 JS 添加 .visible class） */
.cardInner {
  opacity: 0;
  transition: opacity 200ms var(--ease-out);
}
.card.visible .cardInner {
  opacity: 1;
}
```

### 按钮状态

- **默认**：`background: var(--color-brand)`，`box-shadow: var(--shadow-brand)`
- **hover（桌面端）**：`background: var(--color-brand-dark)`，上移 1px，阴影加强
- **active（移动端点按）**：`scale(0.98)`，反馈即时，100ms
- **loading（进入聊天室期间）**：按钮文字替换为「进入中...」，禁用再次点击，opacity 降至 0.7

### DmBanner 浮层

浮层是 `position: fixed`，在全屏滑动模式下不受影响，行为不变。确认不需要修改。

---

## 六、响应式考虑（430px 硬约束验证）

### 核心内容一屏可见性检查

在 430px × 844px（标准 iPhone 尺寸）下，卡片内容纵向分布：

```
顶部安全区 / 状态栏：约 44px（env(safe-area-inset-top)）
─────────────────────────────────────────────────
标签行：约 28px（chip 高度 20px + 上方 space-4 16px 边距）
标题区（中文20px × 最多3行 + 英文13px × 1-2行）：约 120px
间距：space-4 = 16px
角色反应区（两组，每组头像32px + 中英文约3行）：约 160px
间距：space-4 = 16px
加入讨论按钮：52px
滑动提示：约 32px
底部安全区：约 34px
─────────────────────────────────────────────────
合计：约 502px < 844px
```

结论：在标准 iPhone 上，所有内容一屏可见，不需要滚动。核心 CTA 始终在屏幕内。

### 小屏适配（iPhone SE，375px × 667px）

屏幕较矮，667px 减去顶底安全区约 590px 可用高度，内容 502px 仍可放入，但空间变紧。需要调整：

- 角色反应区的 `flex: 1` 会自动压缩，反应文字可能出现省略（可接受）
- 如果内容超出，添加 `overflow: hidden` + 轻微的渐变遮罩在底部（不用滚动条）

---

## 七、Token 引用清单

| 用途 | Token |
|------|-------|
| 卡片背景基础色 | `var(--bg-surface)` |
| 页面背景 | `var(--bg-elevated)` |
| 反应区背景 | `var(--bg-elevated)` |
| 中文主标题颜色 | `var(--text-primary)` |
| 英文副标题颜色 | `var(--text-secondary)` |
| 英文反应文字颜色 | `var(--text-muted)` |
| NPC 名字颜色 | `var(--text-secondary)` |
| 标签前景 | `var(--color-brand)` |
| 标签背景 | `var(--color-brand-light)` |
| NPC A 头像渐变 | `linear-gradient(135deg, var(--color-brand), var(--color-brand-mid))` |
| NPC B 头像渐变 | `linear-gradient(135deg, var(--accent-teal), #0D9488)` |
| 按钮背景 | `var(--color-brand)` |
| 按钮 hover | `var(--color-brand-dark)` |
| 按钮阴影 | `var(--shadow-brand)` |
| 圆点默认色 | `var(--border)` |
| 圆点激活色 | `var(--color-brand)` |
| 反应区圆角 | `var(--radius-lg)` — 16px |
| 按钮圆角 | `var(--radius-lg)` — 16px |
| 按钮入场动效 | `var(--ease-out)` |
| 向下提示动效 | `var(--ease-gentle)` + `breathe` 现有动画 |
| 卡片内容淡入时长 | `var(--duration-normal)` — 250ms |

### 新增 Token

| Token 名 | 值 | 理由 |
|----------|-----|------|
| `--bg-card-teal` | `#F0FDFA` | 第2张卡片轮换底色，来自 Tailwind Teal-50，与 teal 系角色头像呼应 |
| `--bg-card-orange` | `#FFF7ED` | 第3张卡片轮换底色，来自 Tailwind Orange-50 |
| `--bg-card-violet` | `#F5F3FF` | 第4张卡片轮换底色，来自 Tailwind Violet-50，与魔法主题呼应 |
| `--bg-card-emerald` | `#ECFDF5` | 第5张卡片轮换底色，来自 Tailwind Emerald-50 |

---

## 八、开发注意事项

1. **数据字段扩展**：Feed API 和 seed-rooms.js 需要新增 `newsTitleEn`、`npcAReactionEn`、`npcBReactionEn` 三个字段。英文翻译内容见第四节。

2. **currentIndex 状态追踪**：需要新增 `currentIndex` state，通过监听 `.feedScroller` 的 `scroll` 事件 + 防抖（50ms）计算当前可见卡片序号，驱动圆点指示器。

3. **IntersectionObserver threshold 调整**：全屏模式下建议从 0.5 改为 0.8，避免卡片露出一点就被计数。

4. **骨架屏**：加载状态下骨架屏也需要改为全屏单张格式，不再是列表式多张骨架。每次展示一张骨架卡片，高度撑满 `100dvh`。

5. **DmBanner z-index**：Banner 是 `position: fixed`，确认其 z-index 高于圆点指示器（`z-index: 10`）。

6. **Tab 栏遮挡**：原来有 `bottomPadding` 解决 Tab 栏遮挡问题。全屏模式下，`.cardFooter` 的 `padding-bottom: env(safe-area-inset-bottom)` 仅覆盖 iPhone 的 home indicator。如果 Tab 栏是 App 自己的组件且浮在内容之上，需要给 `.cardFooter` 额外加上 Tab 栏高度（通常约 60px）的 padding-bottom，或将 Tab 栏高度抽成 CSS 变量。

7. **滑动提示文字**：在最后一张卡片不显示向下箭头（index === feeds.length - 1），改为显示「上滑查看更多」或不显示。

8. **按钮双语文案**：按钮改为中英双语「加入讨论 · Join Chat」，排在一行。字号维持 `var(--font-base)`（15px），两段文字用 `·` 分隔，英文部分字重可以降为 400，颜色用 `rgba(255,255,255,0.75)` 弱化，中文保持 600 加粗。
