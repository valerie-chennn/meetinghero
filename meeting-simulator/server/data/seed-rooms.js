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
      { type: 'system', text: '你被拉入群聊「取经项目推进群（已解散待定）」' },
      // 八戒先挑起话题，短平快
      { type: 'npc', speaker: 'npc_a', text: "Someone posted the horse online. Two thousand dollars. I think it's a fair price.", textZh: '有人把马挂网上了。两千块。我觉得价格挺合理的。' },
      // 白龙马立刻反应，委屈+刺
      { type: 'npc', speaker: 'npc_b', text: "I am RIGHT HERE. And I have a name.", textZh: '我就在这里。我是有名字的。' },
      // 八戒接住白龙马的话，然后@用户，问题具体：卖还是留
      { type: 'npc', speaker: 'npc_a', text: "Name or not, the project is over. @{username} sell or keep? You decide.", textZh: '有没有名字，项目都结束了。@{username} 卖还是留？你来定。' },
      {
        type: 'user_cue',
        speaker: 'npc_a',
        hint: "八戒问你：卖还是留？",
        hintZh: '八戒问你：卖还是留？',
        // 审计员初入群，被逼表态：卖马还是留下
        options: [
          { label: '反对卖', example: "We should keep him. He did the work." },
          { label: '支持卖', example: "The project is done. Maybe it's okay to sell." },
          { label: '先缓缓', example: "Wait. I just got here. Tell me more." },
        ],
      },
      // 白龙马接住用户发言，列出自己的功劳（简短）
      { type: 'npc', speaker: 'npc_b', text: "Thank you. I carried bags the whole trip. Ninety-nine percent of the road.", textZh: '谢谢你。我驮着行李走完了整段路。百分之九十九的路程。' },
      // 八戒反驳：你是马，本来就该驮东西
      { type: 'npc', speaker: 'npc_a', text: "You are a horse. That is your job. I handled the cooking and team mood.", textZh: '你是马。那本来就是你的工作。我负责做饭和团队氛围。' },
      // 白龙马立刻拆穿八戒，然后@用户问谁贡献更大
      { type: 'npc', speaker: 'npc_b', text: "You ate twenty peaches and called it team support. @{username} who worked more, me or him?", textZh: '你吃了二十个桃子叫做团队支持。@{username} 我和他谁贡献更大？' },
      {
        type: 'user_cue',
        speaker: 'npc_b',
        hint: "白龙马问你：他俩谁贡献更大？",
        hintZh: '白龙马问你：他俩谁贡献更大？',
        // 白龙马要审计员比较贡献，站队问题
        options: [
          { label: '挺白龙马', example: "The horse did more. Carrying bags is real work." },
          { label: '挺八戒', example: "Cooking and morale are important too." },
          { label: '两边各有', example: "Both helped. Hard to pick one." },
        ],
      },
      // 八戒不服，反呛
      { type: 'npc', speaker: 'npc_a', text: "Morale is a skill. You can't measure it, but everyone felt it.", textZh: '氛围是种能力。你量不出来，但大家都感受到了。' },
      // 白龙马继续拆，带讽刺
      { type: 'npc', speaker: 'npc_b', text: "You napped for three days straight. That's not morale. That's sleep.", textZh: '你连着睡了三天。那不叫维护氛围。那叫睡觉。' },
      // 八戒@用户，问题具体：公不公平卖队友
      { type: 'npc', speaker: 'npc_a', text: "Project ended, team disbanded. @{username} is selling a teammate after the job wrong or not?", textZh: '项目结束，团队解散了。@{username} 项目完了之后卖队友，这样对不对？' },
      {
        type: 'user_cue',
        speaker: 'npc_a',
        hint: "八戒问你：项目完了卖队友，对不对？",
        hintZh: '八戒问你：项目完了卖队友，对不对？',
        // 八戒逼用户表态：卖队友公不公平
        options: [
          { label: '明确反对', example: "No. That's not right. We don't sell teammates." },
          { label: '有条件接受', example: "Maybe okay, but only if he agrees first." },
          { label: '看合同', example: "It depends. What did you agree to before?" },
        ],
      },
      // 白龙马表态：我不是商品
      { type: 'npc', speaker: 'npc_b', text: "I am not for sale. I am filing a complaint with the Jade Emperor.", textZh: '我不是商品。我要向玉皇大帝提交投诉。' },
      // 八戒嘲讽收尾
      { type: 'npc', speaker: 'npc_a', text: "Good luck. HR hasn't picked up since the Tang Dynasty.", textZh: '祝你好运。人事部自唐朝起就没人接电话了。' },
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
      { type: 'system', text: '你被拉入群聊「复联×后宫战略资源整合委员会」' },
      // 钢铁侠描述灭霸提案，带一丝欣赏
      { type: 'npc', speaker: 'npc_a', text: "Thanos handed in a restructuring plan on day one. With a pie chart. Not bad formatting.", textZh: '灭霸第一天就交了一份重组方案。带饼状图的。格式还挺不错的。' },
      // 甄嬛接话，态度分明：格式行，内容不行
      { type: 'npc', speaker: 'npc_b', text: "The chart is elegant. The content is unacceptable. Especially the part about cutting fifty percent.", textZh: '图表做工精致。内容不可接受。尤其是那个削减五十个百分点的部分。' },
      // 钢铁侠@用户，问题具体：你今天入职给灭霸培训，他第一天就搞事了
      { type: 'npc', speaker: 'npc_a', text: "Hey, you're the new HR. You're supposed to onboard him today. @{username} how's day one going?", textZh: '嘿，你是新来的HR。你今天负责给他办入职。@{username} 第一天进展怎么样？' },
      {
        type: 'user_cue',
        speaker: 'npc_a',
        hint: "钢铁侠问你：灭霸第一天表现怎么样？",
        hintZh: '钢铁侠问你：灭霸第一天表现怎么样？',
        // HR被问入职进展，灭霸已经搞出事了
        options: [
          { label: '不太顺', example: "Not great. He tried to use the Gauntlet already." },
          { label: '谨慎乐观', example: "Okay so far. He listens if you're direct with him." },
          { label: '还在观察', example: "Too early to say. Give me more time." },
        ],
      },
      // 甄嬛接，说有大志的人结局往往不好
      { type: 'npc', speaker: 'npc_b', text: "Men with big plans rarely survive the first season here. I have seen this before.", textZh: '胸怀大志的人在这里很少能撑过第一季。本宫见过太多了。' },
      // 钢铁侠补充：他已经在茶水间用手套了
      { type: 'npc', speaker: 'npc_a', text: "He used the Gauntlet in the coffee room. IT revoked his admin rights already.", textZh: '他在茶水间用了手套。IT部门已经撤销了他的管理员权限。' },
      // 甄嬛@用户，问题具体：茶水间规矩都不守的人，你打算怎么管
      { type: 'npc', speaker: 'npc_b', text: "A man who breaks tea room rules cannot be trusted with power. @{username} keep him or let him go?", textZh: '连茶水间规矩都不守的人，不能托付大事。@{username} 留还是让他走？' },
      {
        type: 'user_cue',
        speaker: 'npc_b',
        hint: "甄嬛问你：灭霸第一天就违规，留还是让他走？",
        hintZh: '甄嬛问你：灭霸第一天就违规，留还是让他走？',
        // 甄嬛逼HR表态：留还是走
        options: [
          { label: '先给机会', example: "Give him one more chance. Set clear rules first." },
          { label: '建议走人', example: "Day one and he breaks rules. That's a bad sign." },
          { label: '先给小任务', example: "Put him on something small. See how he does." },
        ],
      },
      // 钢铁侠提出让灭霸做预算报表测试
      { type: 'npc', speaker: 'npc_a', text: "Give him the budget report. Numbers don't bend to purple fists.", textZh: '让他做预算报表。数字不会向紫色拳头弯腰。' },
      // 甄嬛同意，但语气里有算计
      { type: 'npc', speaker: 'npc_b', text: "Agreed. Let the work reveal the person.", textZh: '同意。让工作来检验一个人。' },
      // 钢铁侠@用户：报表做完了，还做得挺好，要怎么处理
      { type: 'npc', speaker: 'npc_a', text: "Update: he finished the report. Correct data. Color-coded by department. I'm conflicted. @{username} what's your call?", textZh: '更新：报表做完了。数据准确。还按部门做了颜色分类。我心情很复杂。@{username} 你怎么决定？' },
      {
        type: 'user_cue',
        speaker: 'npc_a',
        hint: "钢铁侠问你：他有能力但危险，你作为HR怎么处理？",
        hintZh: '钢铁侠问你：他有能力但危险，你作为HR怎么处理？',
        // 钢铁侠要HR给结论：有才但危险怎么办
        options: [
          { label: '留但限权', example: "Keep him. But take the Gauntlet away for good." },
          { label: '设试用期', example: "One more month. If he breaks rules again, he's out." },
          { label: '建议辞退', example: "Too risky. I'd say let him go." },
        ],
      },
      // 甄嬛给经验之谈
      { type: 'npc', speaker: 'npc_b', text: "Keep him busy with work he cares about. Idle ambition is dangerous.", textZh: '让他忙于他在乎的工作。闲置的野心是最危险的。' },
      // 钢铁侠最后一句强调收回手套
      { type: 'npc', speaker: 'npc_a', text: "And remove Gauntlet access. That one is not negotiable.", textZh: '还有，把手套权限收回。这个没有商量余地。' },
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
      { type: 'system', text: '你被拉入群聊「联合年会应急处理群」' },
      // 诸葛亮冷静列清单：冻了什么
      { type: 'npc', speaker: 'npc_a', text: "Stage frozen. Microphone frozen. The speaker's chair frozen. This was not in the plan.", textZh: '舞台冻住了。麦克风冻住了。主讲嘉宾的椅子也冻住了。这不在预案里。' },
      // Elsa不觉得有问题，反而觉得好看
      { type: 'npc', speaker: 'npc_b', text: "I just wanted to add atmosphere. The ice pillars look amazing with the lights.", textZh: '我只是想增添一点氛围。冰柱在灯光下看起来真的很惊艳。' },
      // 诸葛亮接住"好看"，反驳：零下二十度，甘道夫法杖取不出来，@用户描述现场
      { type: 'npc', speaker: 'npc_a', text: "The 'atmosphere' is minus twenty degrees. Gandalf cannot reach his staff. @{username} you were there — what did you actually see?", textZh: '这个"氛围"是零下二十度。甘道夫取不到他的法杖。@{username} 你当时在场——到底看到了什么？' },
      {
        type: 'user_cue',
        speaker: 'npc_a',
        hint: "诸葛亮问你：舞台冻住那一刻你看到了什么？",
        hintZh: '诸葛亮问你：舞台冻住那一刻你看到了什么？',
        // 助理描述现场，是帮Elsa说话还是客观汇报
        options: [
          { label: '客观还原', example: "The stage froze in seconds. Everyone stopped." },
          { label: '帮Elsa说话', example: "It was fast. I think it was an accident." },
          { label: '强调损失', example: "The mic, the chairs, all broken. Nothing works now." },
        ],
      },
      // Elsa接话：那是因为有人放了"随它吧"触发了她
      { type: 'npc', speaker: 'npc_b', text: "Someone played 'Let It Go' as the walk-in music. That was a trigger. Not my fault.", textZh: '有人把"随它吧"作为入场音乐放了。那是个触发因素。不是我的错。' },
      // 诸葛亮承认是自己选的歌，但态度还是很要面子
      { type: 'npc', speaker: 'npc_a', text: "I chose that music. I did not expect this result. I am updating the risk list now.", textZh: '那首歌是我选的。我没有预料到这个后果。我现在正在更新风险清单。' },
      // Elsa觉得可以保留冰装饰，@用户问：能不能留着冰
      { type: 'npc', speaker: 'npc_b', text: "The ice chandelier in the back is stunning. @{username} can we keep it? Yes or no?", textZh: '后面那个冰吊灯真的很惊艳。@{username} 我们能留着吗？行还是不行？' },
      {
        type: 'user_cue',
        speaker: 'npc_b',
        hint: "Elsa问你：冰装饰能留着吗？",
        hintZh: 'Elsa问你：冰装饰能留着吗？',
        // Elsa要助理表态：留冰还是化冰
        options: [
          { label: '让她化冰', example: "Please melt it. We need the stage back." },
          { label: '变废为宝', example: "Actually, let's keep it. Make it a theme." },
          { label: '先道歉', example: "First say sorry to the guests. Then we talk." },
        ],
      },
      // 诸葛亮灵机一动：把晚宴搬到大堂，冰雕变主题装饰
      { type: 'npc', speaker: 'npc_a', text: "We moved dinner to the lobby. The ice is now the official decoration. We adapt.", textZh: '我们把晚宴移到了大堂。冰雕现在正式成为装饰主题。随机应变。' },
      // Elsa高兴了：我就说嘛，还能做冰酒杯
      { type: 'npc', speaker: 'npc_b', text: "See? I knew it would work out. I can also make ice wine glasses.", textZh: '看？我就说最后都会没事的。我还可以做冰酒杯。' },
      // 诸葛亮立刻叫停，要提交申请，然后@用户：怎么防止明年再出这种事
      { type: 'npc', speaker: 'npc_a', text: "No more ice without approval. @{username} how do we stop this from happening next year?", textZh: '未经批准不许再做冰制品。@{username} 我们怎么防止明年再发生这种事？' },
      {
        type: 'user_cue',
        speaker: 'npc_a',
        hint: "诸葛亮问你：怎么防止明年年会再出意外？",
        hintZh: '诸葛亮问你：怎么防止明年年会再出意外？',
        // 诸葛亮要助理提预防方案
        options: [
          { label: '加审批', example: "All special powers need approval before the event." },
          { label: '提前彩排', example: "We should do a full run-through with everyone first." },
          { label: '加入策划组', example: "Put Elsa on the planning team. Then it's controlled." },
        ],
      },
      // Elsa积极表态：把我加进策划组
      { type: 'npc', speaker: 'npc_b', text: "Add me to the planning team. I am helpful with the right brief.", textZh: '把我加进策划委员会。给我明确的方向，我能发挥很大作用。' },
      // 诸葛亮总结教训：要考虑不可预测的变量，还要检查播放列表
      { type: 'npc', speaker: 'npc_a', text: "Lesson learned: plan for what you cannot predict. And check the playlist.", textZh: '教训已记：要为无法预测的情况做准备。还要检查播放列表。' },
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
      { type: 'system', text: '你被拉入群聊「霍格沃茨数字化转型工作组」' },
      // 赫敏陈述数据：AI分847人只用3秒
      { type: 'npc', speaker: 'npc_a', text: "The AI sorted 847 students in three seconds. The Hat took eleven minutes for Harry alone.", textZh: 'AI在三秒内分配了847名学生。分院帽光给哈利就用了十一分钟。' },
      // 马尔福接话，直接否定：速度不重要，结果错了
      { type: 'npc', speaker: 'npc_b', text: "Speed means nothing if the answer is wrong. I am Slytherin. This is not open for debate.", textZh: '结果错了的话速度毫无意义。我是斯莱特林。这不是讨论的问题。' },
      // 赫敏接住马尔福，解释系统逻辑，然后@用户：你来解释怎么运作的
      { type: 'npc', speaker: 'npc_a', text: "It found loyalty and fairness values in your profile. Hufflepuff is a valid result. @{username} you built this — can you explain how it works?", textZh: '系统在你的档案里发现了忠诚和公平的价值观。赫奇帕奇是合理的结果。@{username} 这是你们建的——能解释一下它怎么运作吗？' },
      {
        type: 'user_cue',
        speaker: 'npc_a',
        hint: "赫敏问你：AI分院系统怎么工作的？",
        hintZh: '赫敏问你：AI分院系统怎么工作的？',
        // 赫敏让实习顾问解释系统
        options: [
          { label: '简单解释', example: "It reads your profile and matches you to a house." },
          { label: '承认局限', example: "It's mostly accurate, but it can miss some details." },
          { label: '为系统辩护', example: "97% is hard to argue with. The data is solid." },
        ],
      },
      // 马尔福接话：不管怎么运作，它需要修
      { type: 'npc', speaker: 'npc_b', text: "Whatever it does, it needs a patch. Log my complaint officially.", textZh: '不管它怎么运作，它需要打补丁。正式记录我的投诉。' },
      // 赫敏接住马尔福，转移到更重要的问题：是信任问题，不是准确率
      { type: 'npc', speaker: 'npc_a', text: "The real issue is not accuracy. Students need to feel the process understands them.", textZh: '真正的问题不是准确率。学生需要感受到这个过程理解他们。' },
      // 马尔福接，被系统标了"高度共情"，感觉被侮辱，@用户站队：AI该不该做这类决定
      { type: 'npc', speaker: 'npc_b', text: "It also called me 'high empathy.' That is an insult. @{username} should AI even be doing this? Yes or no?", textZh: '它还给我标了"高度共情"。那是侮辱。@{username} AI该不该做这类决定？行还是不行？' },
      {
        type: 'user_cue',
        speaker: 'npc_b',
        hint: "马尔福问你：AI该不该做身份分类这种决定？",
        hintZh: '马尔福问你：AI该不该做身份分类这种决定？',
        // 向用户发问：AI该不该做身份类决策
        options: [
          { label: '支持使用', example: "If the data is good, AI can make fair choices." },
          { label: '有条件支持', example: "It can help, but not as the final answer." },
          { label: '明确反对', example: "No. Who you are is not for a machine to decide." },
        ],
      },
      // 赫敏接，升华到工具vs替代的问题
      { type: 'npc', speaker: 'npc_a', text: "AI is a tool. The question is: do we use it to help, or to replace?", textZh: 'AI是工具。问题在于我们是用它来帮助，还是用它来替代。' },
      // 马尔福接赫敏，意外说出了一句合理的话
      { type: 'npc', speaker: 'npc_b', text: "Use it for schedules. Use it for homework reminders. Do NOT use it to say who I am.", textZh: '用它来排课。用它提醒作业。不要用它来告诉我是谁。' },
      // 赫敏@用户：你觉得AI不该碰什么
      { type: 'npc', speaker: 'npc_a', text: "That is actually reasonable. I'm surprised. @{username} what is one thing AI should never replace?", textZh: '这个其实挺合理的。我有点意外。@{username} 你觉得有什么是AI无论如何都不该替代的？' },
      {
        type: 'user_cue',
        speaker: 'npc_a',
        hint: "赫敏问你：你觉得有什么是AI不该做的？",
        hintZh: '赫敏问你：你觉得有什么是AI不该做的？',
        // 赫敏要用户说出AI的边界
        options: [
          { label: '人际关系', example: "Real connection between people. AI can't do that." },
          { label: '情感判断', example: "How someone feels. Data can't catch that." },
          { label: '道德选择', example: "Hard choices about right and wrong. Needs a human." },
        ],
      },
      // 马尔福收尾，带一点自恋
      { type: 'npc', speaker: 'npc_b', text: "Human judgment. Especially mine.", textZh: '人类的判断力。尤其是我的。' },
      // 赫敏认真总结
      { type: 'npc', speaker: 'npc_a', text: "Context and empathy. Numbers tell you what. Not what it means.", textZh: '情境理解和同理心。数字告诉你发生了什么。不告诉你那意味着什么。' },
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
      { type: 'system', text: '你被拉入群聊「中土好声音决赛后台紧急群」' },
      // 甘道夫第一句就试图转移焦点，但话里藏着心虚
      { type: 'npc', speaker: 'npc_a', text: "The chair incident was a one-time thing. A magical field in the venue caused it.", textZh: '转椅事故是个例。场馆内的魔法场造成的。' },
      // 咕噜接话，完全不接受这个解释，细数损失
      { type: 'npc', speaker: 'npc_b', text: "The chair FLEW. It hit the cake table. Three cakes are gone. Gollum counted.", textZh: '椅子飞出去了。撞到了蛋糕桌。三个蛋糕没了。咕噜数过了。' },
      // 甘道夫接住咕噜"三块蛋糕"，但试图把话题转到表演，并@用户希望记者问表演不问椅子
      { type: 'npc', speaker: 'npc_a', text: "Focus on the performances, please. @{username} reporter — ask me about the show, not the chair.", textZh: '请关注表演本身。@{username} 记者——问我节目的事，不要问椅子。' },
      {
        type: 'user_cue',
        speaker: 'npc_a',
        hint: "甘道夫让你问节目，不要问椅子。你怎么问？",
        hintZh: '甘道夫让你问节目，不要问椅子。你怎么问？',
        // 记者的第一问：顺着甘道夫说还是追问椅子
        options: [
          { label: '追问椅子', example: "Actually, did you press the button yourself?" },
          { label: '帮他圆', example: "Sure. Which performance stood out to you tonight?" },
          { label: '问法杖', example: "Witnesses said your staff glowed. Can you address that?" },
        ],
      },
      // 咕噜觉得自己的歌最好，不管椅子
      { type: 'npc', speaker: 'npc_b', text: "Gollum's song was the best. Precious melody. The judges did not hear it right.", textZh: '咕噜的歌是最好的。宝贝一般的旋律。评委们没听明白。' },
      // 甘道夫被逼，承认了自己按了按钮，但说椅子反应太快
      { type: 'npc', speaker: 'npc_a', text: "Fine. I pressed the button. The chair moved faster than expected. I may have grabbed my staff.", textZh: '好吧。我按了那个按钮。椅子转得比预期快。我可能抓了一下法杖。' },
      // 咕噜抓住"可能"这个词，@用户要求作证
      { type: 'npc', speaker: 'npc_b', text: "'May have.' The staff GLOWED. Everyone saw it. @{username} you were there — did you see it or not?", textZh: '"可能"。法杖发光了。大家都看见了。@{username} 你当时在场——你看到了吗？' },
      {
        type: 'user_cue',
        speaker: 'npc_b',
        hint: "咕噜问你：法杖发光了，你看到了吗？",
        hintZh: '咕噜问你：法杖发光了，你看到了吗？',
        // 咕噜要记者作证，是站甘道夫还是站咕噜
        options: [
          { label: '确认看见了', example: "Yes. I saw the staff glow. It was bright." },
          { label: '说没看清', example: "I'm not sure. It happened really fast." },
          { label: '转移到咕噜', example: "Let's talk about your performance. How did it feel?" },
        ],
      },
      // 甘道夫强调评分标准，为自己辩护
      { type: 'npc', speaker: 'npc_a', text: "The judging was clear. Stage presence, vocal skill, audience connection. All standard.", textZh: '评判标准是明确的。舞台表现力、演唱技巧、观众连接。全都是标准项目。' },
      // 咕噜反驳：我有所有三项，观众尖叫就是连接
      { type: 'npc', speaker: 'npc_b', text: "Gollum had all three. The audience screamed. Screaming is connection.", textZh: '咕噜三项都有。观众尖叫了。尖叫代表连接。' },
      // 甘道夫补刀：尖叫是因为椅子砸到桌子，然后@用户：你来写报道，你决定怎么写
      { type: 'npc', speaker: 'npc_a', text: "Some screams were from the chair crash. Note that for the record. @{username} what goes in your article — chair or performance?", textZh: '其中一些尖叫是因为椅子撞到桌子了。记录在案。@{username} 你的报道写什么——椅子还是表演？' },
      {
        type: 'user_cue',
        speaker: 'npc_a',
        hint: "甘道夫问你：你的报道重点写椅子还是写表演？",
        hintZh: '甘道夫问你：你的报道重点写椅子还是写表演？',
        // 甘道夫问记者重点写什么
        options: [
          { label: '写椅子', example: "The chair story is bigger. That's my lead." },
          { label: '写表演', example: "I'll focus on the music. That's why people watched." },
          { label: '两个都写', example: "Both. The whole night was a story." },
        ],
      },
      // 咕噜从心出发，感性收尾
      { type: 'npc', speaker: 'npc_b', text: "Heart. Gollum sings from the heart. From where precious things live.", textZh: '心。咕噜从心里唱出来。从珍贵的东西居住的地方。' },
      // 甘道夫说真诚+椅子都很重要，自嘲收尾
      { type: 'npc', speaker: 'npc_a', text: "Authenticity matters. A working chair also matters. Both more than people think.", textZh: '真诚很重要。一把能正常使用的椅子也很重要。两者都比人们想的更重要。' },
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
      user_role_name, user_role_desc, npc_profiles, dialogue_script,
      settlement_template, tags, difficulty, is_active, sort_order,
      bg_color, likes, comment_count
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?,
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
    UPDATE v2_rooms SET bg_color = ?, settlement_template = ?, dialogue_script = ?
    WHERE id = ?
  `);
  const initRunningData = db.prepare(`
    UPDATE v2_rooms SET likes = ?, comment_count = ?
    WHERE id = ? AND likes = 0 AND comment_count = 0
  `);
  for (const room of SEED_ROOMS) {
    updateCodeFields.run(room.bg_color || '#F7F2EC', room.settlement_template, room.dialogue_script, room.id);
    initRunningData.run(room.likes || 0, room.comment_count || 0, room.id);
  }
}

module.exports = { SEED_ROOMS, seedRooms };
