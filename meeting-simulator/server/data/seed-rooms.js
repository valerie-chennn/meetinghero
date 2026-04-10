/**
 * v2 推流版种子房间数据
 * 首次启动时自动插入 5 个预制房间
 * 使用 INSERT OR IGNORE 避免重复插入
 *
 * NPC 消息写作规则：
 * - 每条最多 2 句短句，接住上一条，一条只说一个点
 * - @用户的消息必须包含具体的、可以站队的问题
 * - options[0].example 严格 A2 级别，最多 1-2 句，每句不超过 8 词
 */

const SEED_ROOMS = [
  // ──────────────────────────────────────────────
  // 房间 1：西游记 × 职场 — 东海三太子闲鱼挂牌
  // ──────────────────────────────────────────────
  {
    id: 'room-001',
    news_title: '【东海商报】东海三太子惊现闲鱼，挂牌价两万，卖家疑为队友',
    npc_a_name: '八戒',
    npc_a_reaction: '这马吃多干少，不卖留着干啥',
    npc_b_name: '白龙马',
    npc_b_reaction: '谁不干活？我驮行李时你在哪',
    group_name: '取经项目推进群（已解散待定）',
    group_notice: '取经任务结项，各成员请处理个人物品，白龙马问题请联系HR',
    user_role_name: '外部审计顾问',
    user_role_name_en: 'Outside Auditor',
    user_role_desc: '你是天庭派来做项目复盘的审计员，刚被拉进群，不太清楚来龙去脉。',
    npc_profiles: JSON.stringify([
      {
        id: 'npc_a',
        name: '八戒',
        gender: 'male',
        voiceId: 'TxGEqnHWrfWFTfGW9XjX', // ElevenLabs: Josh
        persona: '懒散嘴欠，爱占便宜，但关键时刻能说出金句。对白龙马有偏见。',
      },
      {
        id: 'npc_b',
        name: '白龙马',
        gender: 'male',
        voiceId: 'VR6AewLTigWG4xSOukaG', // ElevenLabs: Arnold
        persona: '委屈满满的实干派，干了最多活却最没有存在感，反击起来字字带刺。',
      },
    ]),
    dialogue_script: JSON.stringify([
      // 核心冲突：卖白龙马 vs 不卖白龙马
      // 八戒立场：应该卖，项目结束了留着没用
      { type: 'npc', speaker: 'npc_a', text: "@{username}, perfect timing! They listed this horse for 20k — help me sell him!", textZh: '@{username}，你来得正好！他们把这马挂了两万——帮我卖了它！' },
      // 白龙马直接反驳：凭什么卖，我干了所有活
      { type: 'npc', speaker: 'npc_b', text: "I carried bags for fourteen years. You want to SELL me for that?", textZh: '我驮了十四年行李。你要因为这个把我卖掉？' },
      // 八戒接住白龙马"十四年"这个点，@用户站队
      { type: 'npc', speaker: 'npc_a', text: "Projects end. Jobs end. @{username} you're new — help me tell this drama horse it's just business!", textZh: '项目结束了，工作也就结束了。@{username} 你是新来的——帮我告诉这匹戏精马这就是正常流程！' },
      {
        type: 'user_cue',
        speaker: 'npc_a',
        hint: "八戒要拉你站队，帮他说服白龙马",
        hintZh: '八戒要拉你站队，帮他说服白龙马',
        options: [
          { label: '反对卖', example: "Wait, that's not fair to him." },
          { label: '支持卖', example: "Yeah, projects end. That's life." },
          { label: '先缓缓', example: "Did anyone even ask him?" },
        ],
      },
      // 白龙马接住用户发言，提出新论据：卖也要给补偿
      { type: 'npc', speaker: 'npc_b', text: "If you sell me, I need severance pay. Fourteen years of work.", textZh: '要卖我的话，我要遣散费。十四年的工龄。' },
      // 八戒直接反驳：马不算员工，没有劳动合同
      { type: 'npc', speaker: 'npc_a', text: "You are a horse. No contract. No severance. That is not how it works.", textZh: '你是马。没有合同。没有遣散费。规则不是这样的。' },
      // 白龙马反驳那个"没有合同"的论据，@用户站队
      { type: 'npc', speaker: 'npc_b', text: "I talked. I fought. I carried everything. @{username} look at me — do I look like just a horse to you?!", textZh: '我会说话。我打过仗。行李全是我驮的。@{username} 你看看我——我在你眼里就是一匹普通马吗？！' },
      {
        type: 'user_cue',
        speaker: 'npc_b',
        hint: "白龙马向你求声援",
        hintZh: '白龙马向你求声援',
        options: [
          { label: '算员工', example: "No, you look like a real teammate." },
          { label: '不算员工', example: "Honestly? Kind of like a horse." },
          { label: '模糊地带', example: "Somewhere in between, I guess." },
        ],
      },
      // 八戒让步：好吧，可以给点补偿，但要扣伙食费
      { type: 'npc', speaker: 'npc_a', text: "Fine. Some pay. But we deduct fourteen years of food costs first.", textZh: '好吧。给点钱。但要先扣掉十四年的伙食费。' },
      // 白龙马回应：伙食费正好可以抵掉，那就不卖了吧
      { type: 'npc', speaker: 'npc_b', text: "Food cost equals my wages. So we are even. No sale needed.", textZh: '伙食费等于我的工资。那正好扯平了。不用卖了。' },
      // 八戒逼用户做最终裁定：卖还是扯平
      { type: 'npc', speaker: 'npc_a', text: "This horse will argue forever. @{username} I'm starving — just break the tie so we can eat!", textZh: '这马能吵到天荒地老。@{username} 我饿疯了——你赶紧打破僵局，我们好去吃饭！' },
      {
        type: 'user_cue',
        speaker: 'npc_a',
        hint: "八戒要你打破僵局，终结这场吵架",
        hintZh: '八戒要你打破僵局，终结这场吵架',
        options: [
          { label: '明确反对卖', example: "Don't sell him. Pay him instead." },
          { label: '支持卖但要补偿', example: "Fine, sell him. But pay him first." },
          { label: '让他自由', example: "Just let him go. No sale." },
        ],
      },
      // 白龙马表态：自由最好
      { type: 'npc', speaker: 'npc_b', text: "Free is fine. I have a cousin in the East Sea. I call him.", textZh: '自由最好。我在东海有个表亲。我去找他。' },
      // 八戒没想到这个结局，自嘲收尾
      { type: 'npc', speaker: 'npc_a', text: "So nobody gets the two thousand. Typical.", textZh: '所以那两千块没人拿到。一如既往。' },
    ]),
    bg_color: '#F7F2EC',
    likes: 2300,
    comment_count: 128,
    settlement_template: JSON.stringify({
      type: 'news',
      newsletter: {
        publisher: '东海商报 · 后续',
        headline: '白龙马闲鱼交易已撤回',
        bullets: [
          '你促成了双方和解',
          '八戒同意用钉耙抵押',
          '白龙马已关注你',
        ],
      },
      absurd_attributes_pool: [
        { name: '爱护动物', delta: 3 },
        { name: '甩锅能力', delta: -1 },
        { name: '取经团队稳定性', delta: 5 },
        { name: '闲鱼鉴赏力', delta: 2 },
        { name: '审计权威度', delta: 4 },
      ],
    }),
    tags: JSON.stringify(['西游记', '职场', '跨IP']),
    difficulty: 'A2',
    sort_order: 50,
    news_title_en: 'Dragon Prince Listed on eBay for $2K — Seller Reportedly a Former Teammate',
    npc_a_reaction_en: '"Eats loads, does nothing. Selling tracks."',
    npc_b_reaction_en: '"I carried bags the whole trip. Where were you?"',
  },

  // ──────────────────────────────────────────────
  // 房间 2：漫威 × 宫斗 — 灭霸入职甄嬛的后宫
  // ──────────────────────────────────────────────
  {
    id: 'room-002',
    news_title: '【复联内部周报】灭霸入职首日提交裁员方案，饼状图获CEO好评',
    npc_a_name: '钢铁侠',
    npc_a_reaction: '数学上成立，但我不支持这么做',
    npc_b_name: '甄嬛',
    npc_b_reaction: '图表精致，本宫欣赏，但不裁本宫',
    group_name: '复联×后宫战略资源整合委员会',
    group_notice: '本群禁止使用无限手套，违者取消午膳资格',
    user_role_name: '新入职HR专员',
    user_role_name_en: 'New HR Hire',
    user_role_desc: '你是今天刚入职的HR，负责给灭霸做入职培训，没想到第一天就摊上了这件事。',
    npc_profiles: JSON.stringify([
      {
        id: 'npc_a',
        name: '钢铁侠',
        gender: 'male',
        voiceId: 'JBFqnCBsd6RMkjVDRZzb', // ElevenLabs: George
        persona: '自负的技术大佬，嘴上不支持灭霸，但脑子里已经在优化那个饼状图了。',
      },
      {
        id: 'npc_b',
        name: '甄嬛',
        gender: 'female',
        voiceId: 'EXAVITQu4vr4xnSDxMaL', // ElevenLabs: Bella
        persona: '宫斗高手空降职场，说话文雅但每句话都藏着刀，对权力结构敏感异常。',
      },
    ]),
    dialogue_script: JSON.stringify([
      // 核心冲突：灭霸的裁员方案该不该执行
      // 钢铁侠立场：方案数学上成立，可以考虑
      { type: 'npc', speaker: 'npc_a', text: "@{username}, you're HR — Thanos filed a restructuring plan. Help me tell her it's real!", textZh: '@{username}，你是HR——灭霸提交了裁员方案。帮我告诉她这是认真的！' },
      // 甄嬛直接反驳：数学成立不代表该执行
      { type: 'npc', speaker: 'npc_b', text: "Math is not the point. You cannot cut people like a pie chart. This plan is wrong.", textZh: '数学不是重点。人不能像饼状图一样切。这个方案不对。' },
      // 钢铁侠接住"不对"，反驳：那你拿出更好的方案，@用户站队
      { type: 'npc', speaker: 'npc_a', text: "She has no real plan, just drama. @{username} you work with budgets — tell her these numbers are real!", textZh: '她没有方案，只有戏。@{username} 你是管预算的——告诉她这些数字是真的！' },
      {
        type: 'user_cue',
        speaker: 'npc_a',
        hint: "钢铁侠找你撑场，要你确认数字是真的",
        hintZh: '钢铁侠找你撑场，要你确认数字是真的',
        options: [
          { label: '否决方案', example: "But cutting people isn't the only answer." },
          { label: '支持执行', example: "He's right. The numbers are real." },
          { label: '先看细节', example: "Wait, I need to see the names first." },
        ],
      },
      // 甄嬛接住用户发言，提出新论据：这种方案会让剩下的人寒心
      { type: 'npc', speaker: 'npc_b', text: "Even if the numbers work — after this, nobody will trust the team again.", textZh: '就算数字成立——这之后，没有人会再信任这个团队了。' },
      // 钢铁侠反驳：不信任 vs 公司倒闭，哪个更糟
      { type: 'npc', speaker: 'npc_a', text: "You think morale beats bankruptcy? If we don't cut, everyone loses their job.", textZh: '你觉得士气比破产更重要？不裁的话，所有人都会失业。' },
      // 甄嬛反驳"破产"这个论据，@用户
      { type: 'npc', speaker: 'npc_b', text: "He waves numbers like weapons. @{username} you've seen real books — is this truth or theater?", textZh: '他挥着数字当武器。@{username} 你见过真的账本——这是事实还是表演？' },
      {
        type: 'user_cue',
        speaker: 'npc_b',
        hint: "甄嬛拉你做见证人，质疑钢铁侠的数字",
        hintZh: '甄嬛拉你做见证人，质疑钢铁侠的数字',
        options: [
          { label: '相信数字', example: "Honestly, the numbers look real to me." },
          { label: '不相信', example: "I'd want to see the real books first." },
          { label: '有第三条路', example: "Maybe there's a way to cut costs, not people." },
        ],
      },
      // 钢铁侠让步一点：好，不一定全裁，但要减少人数
      { type: 'npc', speaker: 'npc_a', text: "Fine. Not fifty percent. But some cuts are needed. That part is not wrong.", textZh: '好吧。不一定是五十个百分点。但要裁一些。这个前提没错。' },
      // 甄嬛抓住这个让步：一裁就是接受了灭霸的逻辑
      { type: 'npc', speaker: 'npc_b', text: "Any cut means you accepted his logic. Once you start, where do you stop?", textZh: '只要裁一个人，就是接受了他的逻辑。一旦开始，在哪里停下来？' },
      // 钢铁侠@用户做最终裁定
      { type: 'npc', speaker: 'npc_a', text: "I'm done arguing. @{username} you're HR, this mess is literally your job — break the tie!", textZh: '我吵不动了。@{username} 你是HR，这事本来就该你管——你来拍板！' },
      {
        type: 'user_cue',
        speaker: 'npc_a',
        hint: "钢铁侠甩锅给你做最终决定",
        hintZh: '钢铁侠甩锅给你做最终决定',
        options: [
          { label: '否决', example: "Reject it. Too risky for the team." },
          { label: '执行', example: "Run it. The problem is real and urgent." },
          { label: '重写', example: "Rewrite it. Find cuts that don't hurt people." },
        ],
      },
      // 甄嬛认可"重写"这个思路
      { type: 'npc', speaker: 'npc_b', text: "A new plan is the right call. But Thanos does not write the new one.", textZh: '重新做方案是对的。但新方案不能让灭霸来写。' },
      // 钢铁侠接，带点幽默
      { type: 'npc', speaker: 'npc_a', text: "Agreed. I'll do the new chart. With better colors.", textZh: '同意。我来做新图表。换个好看的配色。' },
    ]),
    bg_color: '#ECF0F7',
    likes: 4100,
    comment_count: 267,
    settlement_template: JSON.stringify({
      type: 'news',
      newsletter: {
        publisher: '复联内部通报 · 后续',
        headline: '灭霸裁员方案被否决，预算报表获年度最佳格式奖',
        bullets: [
          '你的建议推动了最终决定',
          '手套权限已永久收回',
          '甄嬛表示愿意为灭霸提供宫廷生存培训',
        ],
      },
      absurd_attributes_pool: [
        { name: '职场生存智慧', delta: 4 },
        { name: '饼状图鉴赏力', delta: 3 },
        { name: '手套依赖度', delta: -2 },
        { name: '宫斗防御力', delta: 2 },
        { name: 'HR专业度', delta: 5 },
      ],
    }),
    tags: JSON.stringify(['漫威', '宫斗', '跨IP', '职场']),
    difficulty: 'B1',
    sort_order: 40,
    news_title_en: 'New Hire Thanos Submits Restructuring Plan on Day One. The Pie Chart? Impressive.',
    npc_a_reaction_en: '"Math checks out. Does NOT mean I endorse it."',
    npc_b_reaction_en: '"Lovely chart. The half being cut? Not my people."',
  },

  // ──────────────────────────────────────────────
  // 房间 3：迪士尼 × 三国 — 冰雪奇缘×年会事故
  // ──────────────────────────────────────────────
  {
    id: 'room-003',
    news_title: '【中土娱乐周刊】年会现场突发事故，舞台被不明力量冻住，司仪诸葛亮哑口无言',
    npc_a_name: '诸葛亮',
    npc_a_reaction: '昨夜星象无异兆，此冻乃天意也',
    npc_b_name: 'Elsa',
    npc_b_reaction: '冰雕背景比原来PPT好看多了',
    group_name: '联合年会应急处理群',
    group_notice: '请Elsa同学不要再冻东西了，甘道夫的法杖还在冰里',
    user_role_name: '活动执行助理',
    user_role_name_en: 'Event Assistant',
    user_role_desc: '你是这次年会的执行助理，刚刚亲眼目睹舞台被冻住，现在需要向两位大佬汇报情况。',
    npc_profiles: JSON.stringify([
      {
        id: 'npc_a',
        name: '诸葛亮',
        gender: 'male',
        voiceId: 'VR6AewLTigWG4xSOukaG', // ElevenLabs: Arnold
        persona: '运筹帷幄的智者，但第一次遇到冰雪魔法完全没有预案，努力保持镇定。',
      },
      {
        id: 'npc_b',
        name: 'Elsa',
        gender: 'female',
        voiceId: 'AZnzlk1XvdvUeBnXmlld', // ElevenLabs: Domi
        persona: '真心不觉得自己做错了，认为冰雪装饰比任何人工布景都好看，完全不理解大家为什么慌。',
      },
    ]),
    dialogue_script: JSON.stringify([
      // 核心冲突：冰雕事故的责任归属 — Elsa说是外部触发，诸葛亮说Elsa没有控制
      // 诸葛亮立场：Elsa应该为事故负责
      { type: 'npc', speaker: 'npc_a', text: "@{username}, good — the stage got frozen mid-show. Tell me who is responsible here!", textZh: '@{username}，来得正好——舞台在演出中途被冻住了。帮我判断一下谁该负责！' },
      // Elsa直接反驳：不是我的错，有人放了触发音乐
      { type: 'npc', speaker: 'npc_b', text: "Someone played 'Let It Go' without warning me. That triggered it. Not my fault.", textZh: '有人没提前告诉我就放了"随它吧"。那触发了我。不是我的错。' },
      // 诸葛亮接住"触发"论据，反驳：你本应该能控制，@用户站队
      { type: 'npc', speaker: 'npc_a', text: "She knew her own powers. She should have warned us. @{username} you saw the whole thing — whose fault is this really?", textZh: '她知道自己的能力。她应该提前告知我们。@{username} 你全程在场——这到底是谁的错？' },
      {
        type: 'user_cue',
        speaker: 'npc_a',
        hint: "诸葛亮问你：冰雕事故谁来负责？Elsa还是主办方？",
        hintZh: '诸葛亮问你：冰雕事故谁来负责？Elsa还是主办方？',
        options: [
          { label: 'Elsa负责', example: "Honestly, Elsa should control her powers." },
          { label: '主办方负责', example: "The song was a bad choice. That started it." },
          { label: '两边都有责任', example: "Both sides made mistakes here." },
        ],
      },
      // Elsa接住用户，提出新论据：我没有在合同里写过任何演出限制
      { type: 'npc', speaker: 'npc_b', text: "My contract said 'perform.' It did not say 'control the weather.' That is not my job.", textZh: '我的合同写的是"表演"。没有写"控制天气"。那不是我的工作范围。' },
      // 诸葛亮反驳合同论据：常识比合同更重要
      { type: 'npc', speaker: 'npc_a', text: "Common sense is not in a contract. You froze a stage. You own that.", textZh: '常识不需要写进合同。你把舞台冻住了。你得认。' },
      // Elsa抓住"常识"这个词，反驳，@用户
      { type: 'npc', speaker: 'npc_b', text: "They played Let It Go. TO ME. @{username} come on, anyone would lose control over that, right?!", textZh: '他们放了"随它吧"，对着我放！@{username} 你说嘛，谁能顶得住这个，对吧？！' },
      {
        type: 'user_cue',
        speaker: 'npc_b',
        hint: "Elsa问你：放那首歌算不算合理的触发因素？",
        hintZh: 'Elsa问你：放那首歌算不算合理的触发因素？',
        options: [
          { label: '算，主办方失误', example: "Yeah, that song was a really bad choice." },
          { label: '不算，Elsa还是要控制', example: "No, you should still control it." },
          { label: '都是失误', example: "Both sides dropped the ball." },
        ],
      },
      // 诸葛亮让步：好，选歌是我的失误，但损失要分担
      { type: 'npc', speaker: 'npc_a', text: "Fine. The song was my mistake. But the damage is real. We split the cost.", textZh: '好，选歌是我的失误。但损失是真实存在的。我们分摊费用。' },
      // Elsa回应：分摊可以，但比例要讲
      { type: 'npc', speaker: 'npc_b', text: "Split is fair. But I pay less. The trigger was outside my control.", textZh: '分摊可以。但我少付一点。触发因素不在我控制范围内。' },
      // 诸葛亮@用户做最终裁定
      { type: 'npc', speaker: 'npc_a', text: "We can't split the bill. @{username} you're writing this up — just tell us who pays more!", textZh: '我们分不了账。@{username} 你要写报道的——你直接说谁多付就行！' },
      {
        type: 'user_cue',
        speaker: 'npc_a',
        hint: "诸葛亮要你裁定：冰雕损失谁来多付？",
        hintZh: '诸葛亮要你裁定：冰雕损失谁来多付？',
        options: [
          { label: 'Elsa多付', example: "Elsa pays more. Freezing was still her call." },
          { label: '主办方多付', example: "Event team pays more. The song started it." },
          { label: '五五开', example: "Fifty-fifty. Both sides messed up." },
        ],
      },
      // Elsa愿意接受结果，带点委屈
      { type: 'npc', speaker: 'npc_b', text: "Okay. I accept. But next year, send me the playlist first.", textZh: '好吧。我接受。但明年，先把歌单发给我看。' },
      // 诸葛亮总结，稍微认错
      { type: 'npc', speaker: 'npc_a', text: "Noted. And I will not pick that song again. Ever.", textZh: '记住了。那首歌我以后不会再选了。永远不会。' },
    ]),
    bg_color: '#F7F4EC',
    likes: 1800,
    comment_count: 95,
    settlement_template: JSON.stringify({
      type: 'news',
      newsletter: {
        publisher: '联合年会快报 · 后续',
        headline: '冰雪意外变主题，年会收视超历届',
        bullets: [
          '你的应急方案让晚宴顺利转场',
          'Elsa 正式加入下届年会策划委员会',
          '甘道夫已更新风险预案，播放列表已审查',
        ],
      },
      absurd_attributes_pool: [
        { name: '冰雪抵抗力', delta: -3 },
        { name: '随机应变能力', delta: 5 },
        { name: '年会存活率', delta: 4 },
        { name: '甘道夫信任度', delta: 2 },
        { name: '活动策划灵感', delta: 3 },
      ],
    }),
    tags: JSON.stringify(['迪士尼', '三国', '跨IP', '年会']),
    difficulty: 'A2',
    sort_order: 30,
    news_title_en: 'Stage Frozen Mid-Show by "Unknown Force." Emcee Zhuge Liang Had No Words.',
    npc_a_reaction_en: '"Stars clear. Universe overruled the plan."',
    npc_b_reaction_en: '"Ice backdrop beats the original PPT, honestly."',
  },

  // ──────────────────────────────────────────────
  // 房间 4：哈利波特 × 现代科技 — 霍格沃茨引入AI教学
  // ──────────────────────────────────────────────
  {
    id: 'room-004',
    news_title: '【魔法日报】霍格沃茨宣布引入AI教学系统，分院帽失业，邓布利多："它比我们分得准"',
    npc_a_name: '赫敏',
    npc_a_reaction: '准确率97%是真的，但不代表该用',
    npc_b_name: '马尔福',
    npc_b_reaction: '分我进赫奇帕奇？系统有bug',
    group_name: '霍格沃茨数字化转型工作组',
    group_notice: 'AI系统正在学习中，请勿对它施咒，上次有人试了，它现在只会说拉丁语',
    user_role_name: '技术顾问实习生',
    user_role_name_en: 'Tech Intern',
    user_role_desc: '你是麻瓜科技公司派来的技术顾问实习生，负责协助AI系统落地，第一天就碰上了分院帽失业风波。',
    npc_profiles: JSON.stringify([
      {
        id: 'npc_a',
        name: '赫敏',
        gender: 'female',
        voiceId: '21m00Tcm4TlvDq8ikWAM', // ElevenLabs: Rachel
        persona: '用数据说话的学霸，对新技术有理性判断，但对"AI取代传统"有情感上的抗拒。',
      },
      {
        id: 'npc_b',
        name: '马尔福',
        gender: 'male',
        voiceId: 'TxGEqnHWrfWFTfGW9XjX', // ElevenLabs: Josh
        persona: '觉得自己永远是对的，这次只是把抱怨对象从哈利换成了AI系统。',
      },
    ]),
    dialogue_script: JSON.stringify([
      // 核心冲突：AI分院系统该不该用
      // 赫敏立场：数据准确，应该用
      { type: 'npc', speaker: 'npc_a', text: "@{username}, you're the tech consultant — the AI sorting system went live. Was it the right call?", textZh: '@{username}，你是技术顾问——AI分院系统上线了。这个决定对吗？' },
      // 马尔福直接反驳：我就是那3%，结果是错的
      { type: 'npc', speaker: 'npc_b', text: "I am the three percent. The result is wrong. You cannot call that a success.", textZh: '我就是那3%。结果是错的。你不能说那是成功。' },
      // 赫敏接住马尔福，反驳"3%就否定全部"，@用户站队
      { type: 'npc', speaker: 'npc_a', text: "He's ranting because HE got the wrong house. @{username} you're the tech consultant — one error doesn't break a system, right?", textZh: '他抓狂是因为自己被分错了。@{username} 你是技术顾问——一个错误不能否定整个系统，对吧？' },
      {
        type: 'user_cue',
        speaker: 'npc_a',
        hint: "赫敏问你：用AI分院还是回到分院帽？",
        hintZh: '赫敏问你：用AI分院还是回到分院帽？',
        options: [
          { label: '支持用AI', example: "Right. 97% is pretty solid." },
          { label: '回到分院帽', example: "Still, one second feels way too fast." },
          { label: '两者结合', example: "Maybe use AI first, Hat for hard cases." },
        ],
      },
      // 马尔福接住用户，提出新论据：分院决定了你的人生，AI不该做这种决定
      { type: 'npc', speaker: 'npc_b', text: "Sorting decides your whole school life. That is too important for a machine.", textZh: '分院决定了你整个在校生活。这太重要了，不能交给机器。' },
      // 赫敏反驳这个论据：分院帽也只是一顶帽子，不是神
      { type: 'npc', speaker: 'npc_a', text: "The Hat is also just an object. At least AI has data, not just vibes.", textZh: '分院帽也只是个物件。AI至少有数据支撑，不只是感觉。' },
      // 马尔福反驳"只是感觉"，@用户
      { type: 'npc', speaker: 'npc_b', text: "The Hat talked to Harry for MINUTES. One second for me? @{username} you tell me — does that feel fair to you?", textZh: '分院帽和哈利谈了好几分钟。分给我只用了一秒？@{username} 你告诉我——这公平吗？' },
      {
        type: 'user_cue',
        speaker: 'npc_b',
        hint: "马尔福问你：你信任AI一秒钟做出的身份分类吗？",
        hintZh: '马尔福问你：你信任AI一秒钟做出的身份分类吗？',
        options: [
          { label: '信任', example: "Honestly, if it's accurate, speed is fine." },
          { label: '不信任', example: "No way. One second isn't enough for that." },
          { label: '看情况', example: "Only if I can appeal the result." },
        ],
      },
      // 赫敏让步：好，可以加申诉机制，但不废掉系统
      { type: 'npc', speaker: 'npc_a', text: "Fine. We add an appeal option. Students can contest the result. But the system stays.", textZh: '好吧。我们加一个申诉选项。学生可以提出异议。但系统保留。' },
      // 马尔福接：申诉可以，但要让分院帽最终裁定
      { type: 'npc', speaker: 'npc_b', text: "Appeals go to the Hat. Not back to AI. The Hat makes the final call.", textZh: '申诉交给分院帽裁定。不是再跑一遍AI。分院帽做最终决定。' },
      // 赫敏@用户做最终裁定：AI分院该不该用，加申诉行不行
      { type: 'npc', speaker: 'npc_a', text: "Fine — AI for speed, Hat for appeals. @{username} please tell him that's actually reasonable!", textZh: '行——AI负责速度，分院帽处理申诉。@{username} 求你告诉他这个方案其实很合理！' },
      {
        type: 'user_cue',
        speaker: 'npc_a',
        hint: "赫敏问你：AI分院+分院帽申诉的混合方案，行不行？",
        hintZh: '赫敏问你：AI分院+分院帽申诉的混合方案，行不行？',
        options: [
          { label: '可行', example: "Yeah, that's actually a fair balance." },
          { label: '不行，AI还是不该用', example: "Honestly? Just use the Hat." },
          { label: '不行，全用AI', example: "Trust the AI. Skip the appeals." },
        ],
      },
      // 马尔福意外接受了，但还是要追加条件
      { type: 'npc', speaker: 'npc_b', text: "Fine. But I am first in the appeal queue.", textZh: '好吧。但我要排申诉队列的第一个。' },
      // 赫敏认可，带点小幽默
      { type: 'npc', speaker: 'npc_a', text: "Noted. The Hat said loyalty twice when it read your file. Just so you know.", textZh: '记下了。分院帽分析你的档案时提到了两次"忠诚"。顺便说一声。' },
    ]),
    bg_color: '#ECF3F7',
    likes: 3200,
    comment_count: 186,
    settlement_template: JSON.stringify({
      type: 'news',
      newsletter: {
        publisher: '魔法日报 · 后续',
        headline: 'AI分院系统降为辅助工具，分院帽复职',
        bullets: [
          '你的技术分析推动了最终决策',
          '马尔福二次分院仍入赫奇帕奇',
          '分院帽发表复职感言：没有什么能取代我的判断',
        ],
      },
      absurd_attributes_pool: [
        { name: 'AI理解力', delta: 4 },
        { name: '分院帽好感度', delta: 3 },
        { name: '马尔福耐心值', delta: -2 },
        { name: '麻瓜科技推广力', delta: 5 },
        { name: '赫奇帕奇气质', delta: 1 },
      ],
    }),
    tags: JSON.stringify(['哈利波特', '科技', '跨IP', 'AI']),
    difficulty: 'B1',
    sort_order: 20,
    news_title_en: 'Hogwarts Rolls Out AI Sorting System. Sorting Hat Laid Off. Dumbledore: "It\'s More Accurate."',
    npc_a_reaction_en: '"97% accuracy confirmed. Still shouldn\'t use it."',
    npc_b_reaction_en: '"Hufflepuff?! System is broken. Filing complaint."',
  },

  // ──────────────────────────────────────────────
  // 房间 5：指环王 × 综艺选秀 — 中土好声音总决赛
  // ──────────────────────────────────────────────
  {
    id: 'room-005',
    news_title: '【中土娱乐快报】"中土好声音"总决赛现场爆冷，甘道夫盲选转椅直接脱轨，导师组集体道歉',
    npc_a_name: '甘道夫',
    npc_a_reaction: '转椅可以解释，是魔法干扰',
    npc_b_name: '咕噜',
    npc_b_reaction: '冠军是我们的！裁判不公平！',
    group_name: '中土好声音决赛后台紧急群',
    group_notice: '请所有选手和导师保持冷静，禁止在后台使用魔法道具，甘道夫你的椅子已经修好了',
    user_role_name: '节目组现场记者',
    user_role_name_en: 'On-Site Reporter',
    user_role_desc: '你是节目组派来的现场记者，全程目击了转椅脱轨事故，现在需要采访当事人了解情况。',
    npc_profiles: JSON.stringify([
      {
        id: 'npc_a',
        name: '甘道夫',
        gender: 'male',
        voiceId: 'JBFqnCBsd6RMkjVDRZzb', // ElevenLabs: George
        persona: '德高望重的老导师，极力维护自己的体面，对"转椅脱轨"事件的解释越说越乱。',
      },
      {
        id: 'npc_b',
        name: '咕噜',
        gender: 'male',
        voiceId: 'VR6AewLTigWG4xSOukaG', // ElevenLabs: Arnold
        persona: '参赛选手兼最大搅局者，认为"宝贝"（冠军奖杯）理应属于自己，逻辑奇特但坚定。',
      },
    ]),
    dialogue_script: JSON.stringify([
      // 核心冲突：转椅事故是魔法干扰还是操作失误
      // 甘道夫立场：是魔法场干扰，不是我的问题
      { type: 'npc', speaker: 'npc_a', text: "@{username}, you saw it — the chair flew out by itself! Back me up here!", textZh: '@{username}，你亲眼看见了——椅子自己飞出去的！帮我说一句！' },
      // 咕噜直接反驳：我们都看到你抓了法杖
      { type: 'npc', speaker: 'npc_b', text: "Everyone saw your staff glow. The magic came FROM you. Not the venue.", textZh: '所有人都看见你的法杖发光了。魔法是从你那里来的。不是场馆。' },
      // 甘道夫接住"法杖发光"，解释是反应动作，@用户站队
      { type: 'npc', speaker: 'npc_a', text: "It was pure reflex, I swear. @{username} you're the reporter — you saw the chair shake first, didn't you?", textZh: '我是反射动作，真的。@{username} 你是记者——你看到椅子先晃的，对吧？' },
      {
        type: 'user_cue',
        speaker: 'npc_a',
        hint: "甘道夫问你：转椅事故是椅子故障还是他法杖干扰？",
        hintZh: '甘道夫问你：转椅事故是椅子故障还是他法杖干扰？',
        options: [
          { label: '是法杖', example: "Actually the staff glowed first." },
          { label: '是椅子故障', example: "Yeah, the chair looked broken." },
          { label: '说不清', example: "Too fast. I can't be sure." },
        ],
      },
      // 咕噜接住用户，提出新论据：法杖在前，椅子飞在后，时间线很清楚
      { type: 'npc', speaker: 'npc_b', text: "Staff glowed FIRST. Then the chair flew. Gollum watched the whole thing. The order is clear.", textZh: '法杖先发光。然后椅子才飞出去。咕噜全程都看着。顺序很清楚。' },
      // 甘道夫反驳：时间太快，咕噜没可能看清楚
      { type: 'npc', speaker: 'npc_a', text: "It was one second. You cannot track that. Nobody can.", textZh: '只有一秒钟。你不可能看得那么准。没有人能。' },
      // 咕噜反驳"看不清"，@用户
      { type: 'npc', speaker: 'npc_b', text: "Gollum saw it, precious. Staff glowed first. @{username} do you believe old wizard or Gollum's own eyes?!", textZh: '咕噜看见了，宝贝。法杖先发光的。@{username} 你是信这老巫师，还是信咕噜自己的眼睛？！' },
      {
        type: 'user_cue',
        speaker: 'npc_b',
        hint: "咕噜问你：你相信甘道夫的说法还是咕噜的目击？",
        hintZh: '咕噜问你：你相信甘道夫的说法还是咕噜的目击？',
        options: [
          { label: '相信咕噜', example: "Okay, Gollum saw it clearly." },
          { label: '相信甘道夫', example: "Sorry, Gollum could be wrong." },
          { label: '需要更多证据', example: "I really need the video first." },
        ],
      },
      // 甘道夫让步：好，承认法杖可能有影响，但也有椅子的问题
      { type: 'npc', speaker: 'npc_a', text: "Fine. The staff may have added force. But the chair was already unstable. Both played a role.", textZh: '好吧。法杖可能增加了力道。但椅子本身也不稳。两者都有问题。' },
      // 咕噜抓住"都有问题"：那你就不是完全没责任
      { type: 'npc', speaker: 'npc_b', text: "Both. So you are not fully innocent. That is what Gollum said from the start.", textZh: '都有问题。所以你不是完全没责任。这就是咕噜一开始说的。' },
      // 甘道夫@用户做最终裁定
      { type: 'npc', speaker: 'npc_a', text: "This goes in tomorrow's paper. @{username} your article, your call — tell the world what really happened!", textZh: '这事明天要见报的。@{username} 你的报道，你来定——告诉世界到底是怎么回事！' },
      {
        type: 'user_cue',
        speaker: 'npc_a',
        hint: "甘道夫让你定性：事故是魔法干扰、操作失误，还是两者都有？",
        hintZh: '甘道夫让你定性：事故是魔法干扰、操作失误，还是两者都有？',
        options: [
          { label: '操作失误', example: "Operator error. The staff started it." },
          { label: '魔法干扰', example: "Magical interference. Venue wasn't ready." },
          { label: '两者都有', example: "Both. A perfect storm." },
        ],
      },
      // 咕噜表示认可，但还要蛋糕赔偿
      { type: 'npc', speaker: 'npc_b', text: "Good. Now — three cakes. Gollum wants them back.", textZh: '好。现在——三个蛋糕。咕噜要赔偿。' },
      // 甘道夫认了，自嘲收尾
      { type: 'npc', speaker: 'npc_a', text: "I will replace the cakes. But I am keeping the chair story out of my Wikipedia page.", textZh: '蛋糕我来赔。但这件事我不会让它出现在我的维基百科页面上。' },
    ]),
    bg_color: '#F5ECF7',
    likes: 5600,
    comment_count: 342,
    settlement_template: JSON.stringify({
      type: 'news',
      newsletter: {
        publisher: '中土娱乐快报 · 后续',
        headline: '甘道夫转椅事故调查结案，咕噜获最具个性特别奖',
        bullets: [
          '你的采访还原了现场真相',
          '甘道夫将录制道歉视频并赔偿蛋糕',
          '决赛收视率创节目历史新高',
        ],
      },
      absurd_attributes_pool: [
        { name: '转椅操控力', delta: -3 },
        { name: '综艺感', delta: 5 },
        { name: '蛋糕挽救率', delta: -2 },
        { name: '咕噜好感度', delta: 3 },
        { name: '采访专业度', delta: 4 },
      ],
    }),
    tags: JSON.stringify(['指环王', '综艺', '跨IP', '选秀']),
    difficulty: 'B1',
    sort_order: 10,
    news_title_en: 'The Voice of Middle-Earth Grand Finale: Gandalf\'s Chair Comes Off the Rails. Literally.',
    npc_a_reaction_en: '"Magical interference. Not operator error."',
    npc_b_reaction_en: '"It\'s ours, precious. Trophy is OURS. We appeal!"',
  },
];

/**
 * 将种子房间数据插入数据库
 * 同时在 v2_feed_items 中创建对应的展示记录
 * @param {import('better-sqlite3').Database} db
 */
function seedRooms(db) {
  const insertRoom = db.prepare(`
    INSERT OR IGNORE INTO v2_rooms (
      id, news_title, npc_a_name, npc_a_reaction,
      npc_b_name, npc_b_reaction,
      news_title_en, npc_a_reaction_en, npc_b_reaction_en,
      group_name, group_notice,
      user_role_name, user_role_name_en, user_role_desc, npc_profiles, dialogue_script,
      settlement_template, tags, difficulty, is_active, sort_order,
      bg_color, likes, comment_count
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?,
      ?, ?, ?
    )
  `);

  const insertFeedItem = db.prepare(`
    INSERT OR IGNORE INTO v2_feed_items (id, room_id, sort_order, is_visible)
    VALUES (?, ?, ?, 1)
  `);

  let insertedCount = 0;

  for (const room of SEED_ROOMS) {
    const result = insertRoom.run(
      room.id,
      room.news_title,
      room.npc_a_name,
      room.npc_a_reaction,
      room.npc_b_name,
      room.npc_b_reaction,
      room.news_title_en || null,
      room.npc_a_reaction_en || null,
      room.npc_b_reaction_en || null,
      room.group_name,
      room.group_notice || null,
      room.user_role_name,
      room.user_role_name_en || null,
      room.user_role_desc || null,
      room.npc_profiles,
      room.dialogue_script,
      room.settlement_template,
      room.tags || null,
      room.difficulty || 'A2',
      room.sort_order || 0,
      room.bg_color || '#F7F2EC',
      room.likes || 0,
      room.comment_count || 0
    );

    if (result.changes > 0) {
      // 同时插入 feed_items 记录（feed item id = "fi-" + room id）
      insertFeedItem.run(`fi-${room.id}`, room.id, room.sort_order || 0);
      insertedCount++;
    }
  }

  if (insertedCount > 0) {
    console.log(`[Seed] 已插入 ${insertedCount} 个种子房间`);
  } else {
    console.log('[Seed] 种子房间已存在，跳过插入');
  }

  // 更新已有房间的代码版本字段（INSERT OR IGNORE 不会更新已存在的记录）
  // 注意：likes/comment_count 是运营数据，只在值为 0 时初始化，不覆盖已有值
  const updateCodeFields = db.prepare(`
    UPDATE v2_rooms SET bg_color = ?, settlement_template = ?, dialogue_script = ?, user_role_name_en = ?
    WHERE id = ?
  `);
  const initRunningData = db.prepare(`
    UPDATE v2_rooms SET likes = ?, comment_count = ?
    WHERE id = ? AND likes = 0 AND comment_count = 0
  `);
  for (const room of SEED_ROOMS) {
    updateCodeFields.run(room.bg_color || '#F7F2EC', room.settlement_template, room.dialogue_script, room.user_role_name_en || null, room.id);
    initRunningData.run(room.likes || 0, room.comment_count || 0, room.id);
  }
}

module.exports = { SEED_ROOMS, seedRooms };
