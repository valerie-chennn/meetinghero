/**
 * v2 推流版种子房间数据
 * 首次启动时自动插入 5 个预制房间
 * 使用 INSERT OR IGNORE 避免重复插入
 */

const SEED_ROOMS = [
  // ──────────────────────────────────────────────
  // 房间 1：西游记 × 职场 — 东海三太子闲鱼挂牌
  // ──────────────────────────────────────────────
  {
    id: 'room-001',
    news_title: '【东海商报】东海三太子惊现闲鱼，挂牌价两万，卖家疑为队友',
    npc_a_name: '八戒',
    npc_a_reaction: '这马吃得多还不干活，不卖留着过年啊',
    npc_b_name: '白龙马',
    npc_b_reaction: '你说谁不干活？？我驮行李的时候你在哪里？',
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
      { type: 'npc', speaker: 'npc_a', text: "Have you guys seen the news? Someone posted our horse on a secondhand app. Two thousand dollars.", textZh: '你们看到新闻了吗？有人把我们的马挂到二手平台上了。两万块。' },
      { type: 'npc', speaker: 'npc_b', text: "I am RIGHT HERE. And I have a name. It is not 'our horse.'", textZh: '我就在这里。我是有名字的。不叫"我们的马"。' },
      { type: 'npc', speaker: 'npc_a', text: "The listing says 'eats a lot, low output.' That is honestly accurate though.", textZh: '那个描述写的是"食量大，产出低"。说实话这个描述还挺准的。' },
      { type: 'user_cue', speaker: 'npc_a', hint: "Hey auditor, first time in the group? What do you think about this situation?", hintZh: '嘿，审计员，第一次进群？你怎么看这件事？' },
      { type: 'npc', speaker: 'npc_b', text: "Low output? I carried the luggage for the ENTIRE journey. Ninety-nine percent of the distance. On foot.", textZh: '产出低？我驮着行李走完了整个取经之路。百分之九十九的路程。用脚走的。' },
      { type: 'npc', speaker: 'npc_a', text: "You were a horse. That is your job. I handled the negotiations, the cooking, the team morale.", textZh: '你是马。那是你的本职工作。我负责谈判、做饭、团队氛围。' },
      { type: 'npc', speaker: 'npc_b', text: "You negotiated a longer lunch break. That was your biggest contribution.", textZh: '你谈判争取到了更长的午休时间。那是你最大的贡献。' },
      { type: 'user_cue', speaker: 'npc_b', hint: "Okay, as the auditor here — who do you think actually contributed more to this project?", hintZh: '好，作为审计员——你觉得谁对这个项目的贡献更大？' },
      { type: 'npc', speaker: 'npc_a', text: "The audit will clearly show that morale support is a key deliverable. I kept everyone happy.", textZh: '审计报告肯定会显示，士气维护是核心交付物。我让大家都很开心。' },
      { type: 'npc', speaker: 'npc_b', text: "You ate seventeen peaches at the break station and then complained about being tired.", textZh: '你在休息站吃了十七个桃子，然后抱怨说累了。' },
      { type: 'npc', speaker: 'npc_a', text: "Energy management is a skill. Also the listing price is two thousand, not twenty thousand. I can read.", textZh: '体能管理是一种能力。另外那个售价是两千，不是两万。我看得懂数字。' },
      { type: 'user_cue', speaker: 'npc_a', hint: "So — do you think it's fair to sell a team member after the project ends? What would you do?", hintZh: '那么——你觉得项目结束后把队友卖掉公平吗？你会怎么做？' },
      { type: 'npc', speaker: 'npc_b', text: "For the record, I am not for sale. I am filing a formal complaint with the Jade Emperor's HR department.", textZh: '郑重声明，我不是商品。我要向玉皇大帝人事部提交正式投诉。' },
      { type: 'npc', speaker: 'npc_a', text: "Good luck. The HR hotline has been on hold music since the Tang dynasty.", textZh: '祝你好运。那个人事热线自唐朝起就一直在放保持音乐。' },
    ]),
    bg_color: '#F7F2EC',
    likes: 2300,
    comment_count: 128,
    settlement_template: JSON.stringify({
      type: 'news',
      event_result: '经天庭审计核实，白龙马贡献值排名第一，八戒挂出的闲鱼帖子被强制下架。白龙马荣获"最佳员工"称号，八戒被要求参加职业素养培训。',
      structured_result: {
        mediaName: '西域商报·后续',
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
      expression_hints: [
        { slot: 1, context: '当你想表达某件事很夸张时', example: "That is honestly a bit much." },
        { slot: 2, context: '当你为某一方辩护时', example: "I think they deserve more credit than that." },
        { slot: 3, context: '当你做出最终判断时', example: "Based on what I've heard, I think..." },
      ],
    }),
    tags: JSON.stringify(['西游记', '职场', '跨IP']),
    difficulty: 'A2',
    sort_order: 50,
    news_title_en: 'Dragon Prince Listed on eBay for $2K — Seller Reportedly a Former Teammate',
    npc_a_reaction_en: '"Eats half the budget, delivers zero output. Selling makes sense, tbh."',
    npc_b_reaction_en: '"Excuse me?? I carried everyone\'s stuff the entire trip. Where were YOU exactly?"',
  },

  // ──────────────────────────────────────────────
  // 房间 2：漫威 × 宫斗 — 灭霸入职甄嬛的后宫
  // ──────────────────────────────────────────────
  {
    id: 'room-002',
    news_title: '【复联内部周报】灭霸入职首日提交裁员方案，饼状图获CEO好评',
    npc_a_name: '钢铁侠',
    npc_a_reaction: '我算了一下，数学上确实成立，但这不代表我支持',
    npc_b_name: '甄嬛',
    npc_b_reaction: '这饼状图做工精致，本宫欣赏，但裁的那半个不能是本宫的人',
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
      { type: 'npc', speaker: 'npc_a', text: "Thanos submitted a restructuring proposal on day one. With a pie chart. It was actually well-formatted.", textZh: '灭霸第一天就提交了一份重组方案。带饼状图的。格式居然做得相当不错。' },
      { type: 'npc', speaker: 'npc_b', text: "The presentation was elegant. I approved the formatting. I did not approve the content.", textZh: '演示文稿做工精致。本宫批准了格式。内容本宫不批。' },
      { type: 'npc', speaker: 'npc_a', text: "His core argument is that 50% redundancy reduction improves 'universal efficiency.' I've heard worse pitches.", textZh: '他的核心论点是削减50%冗余可以提升"宇宙效率"。我听过更差的提案。' },
      { type: 'user_cue', speaker: 'npc_a', hint: "Hey HR, you're supposed to onboard Thanos today. How's that going?", hintZh: '嘿HR，你今天负责给灭霸办入职的。进展怎么样？' },
      { type: 'npc', speaker: 'npc_b', text: "I have seen men with grand ambitions walk into this court before. They rarely last the season.", textZh: '本宫见过不少胸怀大志的人踏入这宫廷。他们鲜少能撑过一季。' },
      { type: 'npc', speaker: 'npc_a', text: "He already tried to use the Infinity Gauntlet in the coffee room. IT had to revoke his admin rights.", textZh: '他已经在茶水间尝试使用无限手套了。IT部门不得不撤销了他的管理员权限。' },
      { type: 'npc', speaker: 'npc_b', text: "A man who cannot follow the rules of the tea room cannot be trusted with strategy.", textZh: '一个连茶水间规矩都不守的人，不能托付以大事。' },
      { type: 'user_cue', speaker: 'npc_b', hint: "You seem to have experience with ambitious newcomers. What is your advice for handling someone like Thanos?", hintZh: '您似乎对处理有野心的新人很有经验。处理灭霸这样的人，您有什么建议？' },
      { type: 'npc', speaker: 'npc_a', text: "Give him a small project. Something with real constraints. See if he can operate within limits.", textZh: '给他一个小项目。有实际约束的那种。看看他能不能在限制条件下运作。' },
      { type: 'npc', speaker: 'npc_b', text: "Assign him the quarterly budget report. Numbers do not bend to purple fists.", textZh: '让他做季度预算报表。数字不会向紫色拳头弯腰。' },
      { type: 'npc', speaker: 'npc_a', text: "Update: he finished the budget report. It is correct. Also he color-coded it by department. I'm conflicted.", textZh: '更新：他把预算报表做完了。数据准确。还按部门做了颜色分类。我心情很复杂。' },
      { type: 'user_cue', speaker: 'npc_a', hint: "So — talented but dangerous. As HR, how do you handle an employee like this?", hintZh: '所以——有才但危险。作为HR，你怎么处理这样的员工？' },
      { type: 'npc', speaker: 'npc_b', text: "Keep them busy with work they care about. Idle ambition is the most dangerous kind.", textZh: '让他们忙于自己在乎的事情。闲置的野心是最危险的。' },
      { type: 'npc', speaker: 'npc_a', text: "And remove the gauntlet access. Seriously. That is a non-negotiable.", textZh: '还有，把手套权限收回。认真的。这个没有商量余地。' },
    ]),
    bg_color: '#ECF0F7',
    likes: 4100,
    comment_count: 267,
    settlement_template: JSON.stringify({
      type: 'announcement',
      event_result: '灭霸的裁员方案被否决，但他凭借出色的预算报表留了下来。甄嬛指导他学习宫廷生存法则，钢铁侠悄悄收走了他的手套。职场新人守则第一条：先把手头的事做好。',
      structured_result: {
        title: '【群公告】本群已归档',
        content: '经新入职HR专员建议，灭霸裁员方案已否决。手套权限已收回，预算报表获年度最佳格式奖。',
      },
      absurd_attributes_pool: [
        { name: '职场生存智慧', delta: 4 },
        { name: '饼状图鉴赏力', delta: 3 },
        { name: '手套依赖度', delta: -2 },
        { name: '宫斗防御力', delta: 2 },
        { name: 'HR专业度', delta: 5 },
      ],
      expression_hints: [
        { slot: 1, context: '当你对某人的提案持保留态度时', example: "The idea has merit, but I have some concerns." },
        { slot: 2, context: '当你给出有条件的建议时', example: "I would suggest starting with something smaller first." },
        { slot: 3, context: '当你评价一个复杂的人时', example: "They're talented, but they need clear boundaries." },
      ],
    }),
    tags: JSON.stringify(['漫威', '宫斗', '跨IP', '职场']),
    difficulty: 'B1',
    sort_order: 40,
    news_title_en: 'New Hire Thanos Submits Restructuring Plan on Day One. The Pie Chart? Impressive.',
    npc_a_reaction_en: '"The math checks out. That does NOT mean I\'m endorsing this."',
    npc_b_reaction_en: '"Elegant work on the chart. We appreciate the craftsmanship. The half being cut? Not my people."',
  },

  // ──────────────────────────────────────────────
  // 房间 3：迪士尼 × 三国 — 冰雪奇缘×年会事故
  // ──────────────────────────────────────────────
  {
    id: 'room-003',
    news_title: '【中土娱乐周刊】年会现场突发事故，舞台被不明力量冻住，司仪诸葛亮哑口无言',
    npc_a_name: '诸葛亮',
    npc_a_reaction: '亮夜观星象，未曾料到今日有此一冻，计划赶不上变化，此乃天意也',
    npc_b_name: 'Elsa',
    npc_b_reaction: '我觉得效果挺好的，冰雕背景比你们原来那个PPT好看多了',
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
      { type: 'npc', speaker: 'npc_a', text: "The stage is frozen. The microphone is frozen. The keynote speaker's chair is frozen. This was not in the plan.", textZh: '舞台冻住了。麦克风冻住了。主讲嘉宾的椅子也冻住了。这不在预案里。' },
      { type: 'npc', speaker: 'npc_b', text: "I was just trying to add some atmosphere. The ice pillars look really nice with the lighting.", textZh: '我只是想增添一点氛围。冰柱在灯光下看起来真的很好看。' },
      { type: 'npc', speaker: 'npc_a', text: "The atmosphere is, with respect, minus twenty degrees. Gandalf cannot retrieve his staff.", textZh: '恕我直言，这个氛围是零下二十度。甘道夫取不出他的法杖。' },
      { type: 'user_cue', speaker: 'npc_a', hint: "You were there. Can you describe exactly what happened when the stage froze?", hintZh: '你当时在场。能描述一下舞台冻住时到底发生了什么吗？' },
      { type: 'npc', speaker: 'npc_b', text: "In my defense, someone played 'Let It Go' as the walk-in music. That was a trigger. That was not my fault.", textZh: '我要说明一下，有人把"随它吧"作为入场音乐播放了。那是个触发因素。那不是我的错。' },
      { type: 'npc', speaker: 'npc_a', text: "I selected that music. I did not anticipate the consequences. I am updating the risk assessment.", textZh: '那首音乐是我选的。我没有预料到后果。我现在正在更新风险评估表。' },
      { type: 'npc', speaker: 'npc_b', text: "Can we just... leave the ice? The ice chandelier in the back is honestly stunning.", textZh: '我们能不能就……保留这些冰？后面那个冰吊灯真的很惊艳。' },
      { type: 'user_cue', speaker: 'npc_b', hint: "Elsa, the guests are cold. Is there anything you can do to help right now?", hintZh: 'Elsa，嘉宾们很冷。你现在能做点什么来帮忙吗？' },
      { type: 'npc', speaker: 'npc_a', text: "We have moved the dinner to the lobby. The ice sculptures are now officially the centerpieces. We adapt.", textZh: '我们把晚宴移到了大堂。冰雕现在正式成为装饰主题。随机应变。' },
      { type: 'npc', speaker: 'npc_b', text: "See? I knew it would work out. I can also make ice wine glasses if needed.", textZh: '看？我就说最后都会没事的。如果需要的话我还可以做冰酒杯。' },
      { type: 'npc', speaker: 'npc_a', text: "Please do not make additional ice items without prior approval. Submit a form.", textZh: '请不要在未经批准的情况下制作更多冰制品。提交申请表。' },
      { type: 'user_cue', speaker: 'npc_a', hint: "As the event assistant, what do you think — how do we prevent this from happening at next year's event?", hintZh: '作为活动助理，你觉得——我们怎么防止明年的活动再次发生这种事？' },
      { type: 'npc', speaker: 'npc_b', text: "Simple. Add me to the planning committee. I can be an asset if you give me the right brief.", textZh: '简单。把我加进策划委员会。如果你们给我明确的方向，我可以是很大的助力。' },
      { type: 'npc', speaker: 'npc_a', text: "I will note that. The lesson here: always account for variables you cannot predict. And check the playlist.", textZh: '我记下来了。这次的教训是：永远要考虑无法预测的变量。还有要检查播放列表。' },
    ]),
    bg_color: '#F7F4EC',
    likes: 1800,
    comment_count: 95,
    settlement_template: JSON.stringify({
      type: 'moments',
      event_result: '年会最终以"冰雪主题派对"的名义完美收场，意外成为当年最难忘的活动。甘道夫的法杖在第二天早上找到了。Elsa被正式邀请加入下届策划组。',
      structured_result: {
        character: 'Elsa',
        avatarId: 'npc_b',
        post: '今天年会舞台差点毁了，结果大家说冰雕比原来的PPT好看。有时候bug就是feature。❄️✨',
        likers: ['诸葛亮', '甘道夫', '辛巴', '灰姑娘', '你', '白雪公主'],
        likeCount: 6,
      },
      absurd_attributes_pool: [
        { name: '冰雪抵抗力', delta: -3 },
        { name: '随机应变能力', delta: 5 },
        { name: '年会存活率', delta: 4 },
        { name: '甘道夫信任度', delta: 2 },
        { name: '活动策划灵感', delta: 3 },
      ],
      expression_hints: [
        { slot: 1, context: '当你描述一个突发情况时', example: "Something unexpected happened — let me explain." },
        { slot: 2, context: '当你提出即兴应对方案时', example: "We can work with this — here's what I'm thinking." },
        { slot: 3, context: '当你总结危机处理的教训时', example: "Next time, we should make sure to..." },
      ],
    }),
    tags: JSON.stringify(['迪士尼', '三国', '跨IP', '年会']),
    difficulty: 'A2',
    sort_order: 30,
    news_title_en: 'Stage Frozen Mid-Show by "Unknown Force." Emcee Zhuge Liang Had No Words.',
    npc_a_reaction_en: '"I read the stars last night. Nothing indicated ice. Sometimes the universe just overrides the plan."',
    npc_b_reaction_en: '"I thought it looked great, honestly. The ice backdrop beats your original slideshow by a mile."',
  },

  // ──────────────────────────────────────────────
  // 房间 4：哈利波特 × 现代科技 — 霍格沃茨引入AI教学
  // ──────────────────────────────────────────────
  {
    id: 'room-004',
    news_title: '【魔法日报】霍格沃茨宣布引入AI教学系统，分院帽失业，邓布利多："它比我们分得准"',
    npc_a_name: '赫敏',
    npc_a_reaction: '我研究了它的算法，它的分类准确率确实是97%，但这不代表我们应该用它',
    npc_b_name: '马尔福',
    npc_b_reaction: '它把我分到了赫奇帕奇，系统明显有bug，我要投诉',
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
      { type: 'npc', speaker: 'npc_a', text: "The AI placed 847 students in under three seconds. The Sorting Hat took eleven minutes for Harry alone.", textZh: 'AI在三秒内分配了847名学生。分院帽光给哈利就用了十一分钟。' },
      { type: 'npc', speaker: 'npc_b', text: "Speed is irrelevant when the output is completely wrong. I am a Slytherin. This is not a matter for debate.", textZh: '当结果完全错误的时候，速度毫无意义。我是斯莱特林。这不是讨论的问题。' },
      { type: 'npc', speaker: 'npc_a', text: "The system identified strong loyalty and fairness values in your profile. Hufflepuff is a legitimate outcome.", textZh: '系统在你的档案中识别出了强烈的忠诚和公平价值观。赫奇帕奇是合理的结果。' },
      { type: 'user_cue', speaker: 'npc_a', hint: "As the tech consultant here — can you explain how the AI sorting system actually works?", hintZh: '作为技术顾问——你能解释一下AI分院系统是怎么工作的吗？' },
      { type: 'npc', speaker: 'npc_b', text: "Whatever it does, it needs a patch. And I want my complaint logged officially.", textZh: '不管它怎么运作，它需要打补丁。我要求正式记录我的投诉。' },
      { type: 'npc', speaker: 'npc_a', text: "The real issue is not accuracy. It is trust. Students need to feel the process understands them.", textZh: '真正的问题不是准确率。是信任。学生需要感受到这个过程理解他们。' },
      { type: 'npc', speaker: 'npc_b', text: "It does not understand me at all. It also ranked me as 'high empathy.' I have never been more insulted.", textZh: '它完全不理解我。它还给我标注了"高度共情"。我从来没有被这么侮辱过。' },
      { type: 'user_cue', speaker: 'npc_b', hint: "Draco, setting aside your own result — do you think AI should be used for decisions like this?", hintZh: '马尔福，先不说你自己的结果——你觉得AI应该用来做这类决策吗？' },
      { type: 'npc', speaker: 'npc_a', text: "AI is a tool. The question is whether we use it to support judgment, or to replace it.", textZh: 'AI是工具。问题在于我们是用它辅助判断，还是用它替代判断。' },
      { type: 'npc', speaker: 'npc_b', text: "Use it for scheduling. Use it for homework reminders. Do NOT use it to tell people who they are.", textZh: '用它来排课。用它来提醒作业。不要用它来告诉人们他们是谁。' },
      { type: 'npc', speaker: 'npc_a', text: "That is... actually a reasonable position. I am surprised.", textZh: '这个……其实是个合理的立场。我有点意外。' },
      { type: 'user_cue', speaker: 'npc_a', hint: "Last question — what is one thing you think AI should never replace, no matter how accurate it gets?", hintZh: '最后一个问题——你觉得有什么是AI无论多准确都不应该替代的？' },
      { type: 'npc', speaker: 'npc_b', text: "Human judgment. Especially mine.", textZh: '人类的判断力。尤其是我的。' },
      { type: 'npc', speaker: 'npc_a', text: "Context and empathy. Numbers can tell you what happened. They cannot tell you what it meant.", textZh: '情境理解和同理心。数字能告诉你发生了什么。它告诉不了你那意味着什么。' },
    ]),
    bg_color: '#ECF3F7',
    likes: 3200,
    comment_count: 186,
    settlement_template: JSON.stringify({
      type: 'news',
      event_result: '经过激烈讨论，霍格沃茨决定保留AI作为辅助工具，但最终分院结果仍由分院帽拍板。马尔福的投诉被受理，重新分院，结果还是赫奇帕奇。他决定接受现实。',
      structured_result: {
        mediaName: '魔法日报·跟踪报道',
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
      expression_hints: [
        { slot: 1, context: '当你解释一个技术系统时', example: "Basically, what it does is..." },
        { slot: 2, context: '当你表达对技术的有条件支持时', example: "I think it's useful, but only if we use it the right way." },
        { slot: 3, context: '当你指出AI的局限性时', example: "The problem is that it can't really account for..." },
      ],
    }),
    tags: JSON.stringify(['哈利波特', '科技', '跨IP', 'AI']),
    difficulty: 'B1',
    sort_order: 20,
    news_title_en: 'Hogwarts Rolls Out AI Sorting System. Sorting Hat Laid Off. Dumbledore: "It\'s More Accurate."',
    npc_a_reaction_en: '"I\'ve reviewed the algorithm. 97% accuracy is real. That still doesn\'t mean we should use it."',
    npc_b_reaction_en: '"It sorted me into Hufflepuff. The system is clearly broken. I am filing a complaint."',
  },

  // ──────────────────────────────────────────────
  // 房间 5：指环王 × 综艺选秀 — 中土好声音总决赛
  // ──────────────────────────────────────────────
  {
    id: 'room-005',
    news_title: '【中土娱乐快报】"中土好声音"总决赛现场爆冷，甘道夫盲选转椅直接脱轨，导师组集体道歉',
    npc_a_name: '甘道夫',
    npc_a_reaction: '我转椅这件事可以解释，那是魔法干扰，不是我操作失误',
    npc_b_name: '咕噜',
    npc_b_reaction: '我们的，我们的！冠军是我们的！裁判不公平，我们要上诉！',
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
      { type: 'npc', speaker: 'npc_a', text: "The chair incident was isolated. The mechanism simply responded to an unexpected magical field in the venue.", textZh: '转椅事故是个例。椅子机械结构只是对场馆内意外的魔法场产生了反应。' },
      { type: 'npc', speaker: 'npc_b', text: "Gollum saw everything. The chair flew. It hit the refreshment table. Three cakes are gone. We counted.", textZh: '咕噜看见了所有事情。椅子飞出去了。撞到了茶点桌。三个蛋糕没了。我们数过了。' },
      { type: 'npc', speaker: 'npc_a', text: "I would like to redirect attention to the performances. Several contestants were genuinely talented.", textZh: '我想把注意力重新引到表演上。有几位选手是真的有天赋的。' },
      { type: 'user_cue', speaker: 'npc_a', hint: "Gandalf, as the reporter here — can you walk me through what happened with the chair? Step by step?", hintZh: '甘道夫，作为记者——你能跟我说一下转椅那件事的经过吗？一步一步地说。' },
      { type: 'npc', speaker: 'npc_b', text: "Gollum's song was the best. Precious, precious melody. The judges did not appreciate it. Unfair. Unfair.", textZh: '咕噜的歌是最好的。宝贝一般的旋律。评委们不欣赏。不公平。不公平。' },
      { type: 'npc', speaker: 'npc_a', text: "To be transparent: I pressed the button. The chair turned faster than expected. I may have gripped my staff.", textZh: '说实话：我按了那个按钮。椅子转得比预期快。我可能抓了一下我的法杖。' },
      { type: 'npc', speaker: 'npc_b', text: "May have. May have! The staff GLOWED. We all saw it. Gollum has witnesses.", textZh: '"可能"。"可能"！法杖发光了。大家都看见了。咕噜有目击证人。' },
      { type: 'user_cue', speaker: 'npc_b', hint: "Gollum, your performance got a lot of attention tonight. How do you think you did?", hintZh: '咕噜，你今晚的表演引起了很多关注。你觉得自己发挥得怎么样？' },
      { type: 'npc', speaker: 'npc_a', text: "The judging criteria were clear. Stage presence, vocal technique, and audience connection.", textZh: '评判标准是明确的。舞台表现力、演唱技巧和观众连接。' },
      { type: 'npc', speaker: 'npc_b', text: "Gollum had all three. Gollum connected with audience. They screamed. Screaming means connection.", textZh: '咕噜三项都有。咕噜和观众有连接。他们尖叫了。尖叫代表连接。' },
      { type: 'npc', speaker: 'npc_a', text: "Some of those screams were from the chair collision. I want that noted for the record.", textZh: '其中一些尖叫声是因为椅子撞到了东西。我希望这一点被记录在案。' },
      { type: 'user_cue', speaker: 'npc_a', hint: "Final question for both of you — what do you think makes a truly great performance?", hintZh: '最后一个问题问你们两位——你们觉得什么是真正出色的表演？' },
      { type: 'npc', speaker: 'npc_b', text: "Heart. Gollum sings from deep inside. From the place where precious things live.", textZh: '心。咕噜从内心深处唱出来。从珍贵的东西居住的那个地方。' },
      { type: 'npc', speaker: 'npc_a', text: "Authenticity. And a functioning chair. Both matter more than people realize.", textZh: '真诚。还有一把能正常使用的椅子。两者都比人们意识到的更重要。' },
    ]),
    bg_color: '#F5ECF7',
    likes: 5600,
    comment_count: 342,
    settlement_template: JSON.stringify({
      type: 'moments',
      event_result: '经节目组调查，甘道夫确认为转椅事故责任方，被要求录制道歉视频。咕噜获得"最具个性奖"特别奖项。总决赛最终收视率创节目历史新高。',
      structured_result: {
        character: '咕噜',
        avatarId: 'npc_b',
        post: '虽然没有拿到冠军，但宝贝们的支持让我感动。明年再来！冠军终究是我们的，precious。🏆',
        likers: ['甘道夫', '精灵王', 'Bilbo', '你', '弗罗多', '萨鲁曼'],
        likeCount: 6,
      },
      absurd_attributes_pool: [
        { name: '转椅操控力', delta: -3 },
        { name: '综艺感', delta: 5 },
        { name: '蛋糕挽救率', delta: -2 },
        { name: '咕噜好感度', delta: 3 },
        { name: '采访专业度', delta: 4 },
      ],
      expression_hints: [
        { slot: 1, context: '当你采访某人请他们解释发生了什么时', example: "Can you walk me through exactly what happened?" },
        { slot: 2, context: '当你对某人的解释表示怀疑时', example: "That's interesting — but it sounds a bit like..." },
        { slot: 3, context: '当你总结一个混乱局面时', example: "So if I understand correctly, what happened was..." },
      ],
    }),
    tags: JSON.stringify(['指环王', '综艺', '跨IP', '选秀']),
    difficulty: 'B1',
    sort_order: 10,
    news_title_en: 'The Voice of Middle-Earth Grand Finale: Gandalf\'s Chair Comes Off the Rails. Literally.',
    npc_a_reaction_en: '"There is a perfectly logical explanation for the chair. It was a magical interference. Not operator error."',
    npc_b_reaction_en: '"It\'s ours, precious. The trophy is OURS. The judges are biased. We appeal!"',
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
    UPDATE v2_rooms SET bg_color = ?, settlement_template = ?
    WHERE id = ?
  `);
  const initRunningData = db.prepare(`
    UPDATE v2_rooms SET likes = ?, comment_count = ?
    WHERE id = ? AND likes = 0 AND comment_count = 0
  `);
  for (const room of SEED_ROOMS) {
    updateCodeFields.run(room.bg_color || '#F7F2EC', room.settlement_template, room.id);
    initRunningData.run(room.likes || 0, room.comment_count || 0, room.id);
  }
  console.log('[Seed] 已更新种子房间的新字段（bg_color/settlement_template，likes/comment_count 仅初始化）');
}

module.exports = { seedRooms };
