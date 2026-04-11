/**
 * 角色池静态数据文件
 * 包含 7 个世界分类、50-70 个角色，以及热门 IP 关键词映射
 */

/**
 * 完整角色池
 * 按世界分类存储，每个世界 8-10 个角色
 */
const CHARACTER_POOL = {
  // 中国古典文学
  'chinese-classic': [
    { id: 'sun-wukong', name: '孙悟空', world: 'chinese-classic', worldLabel: '中国古典', persona: '天生反骨，不服管教，武力第一', source: '《西游记》' },
    { id: 'zhu-bajie', name: '猪八戒', world: 'chinese-classic', worldLabel: '中国古典', persona: '贪吃好色，偷懒耍滑，关键时刻总出幺蛾子', source: '《西游记》' },
    { id: 'tang-seng', name: '唐僧', world: 'chinese-classic', worldLabel: '中国古典', persona: '迂腐执念，原则至上，被欺负也坚持不打妖怪', source: '《西游记》' },
    { id: 'sha-wujing', name: '沙悟净', world: 'chinese-classic', worldLabel: '中国古典', persona: '沉默勤恳，任劳任怨，默默担责从不邀功', source: '《西游记》' },
    { id: 'lin-daiyu', name: '林黛玉', world: 'chinese-classic', worldLabel: '中国古典', persona: '多愁善感，诗意敏锐，极度敏感爱哭', source: '《红楼梦》' },
    { id: 'jia-baoyu', name: '贾宝玉', world: 'chinese-classic', worldLabel: '中国古典', persona: '痴情率真，厌恶功名，活在自己的世界', source: '《红楼梦》' },
    { id: 'wang-xifeng', name: '王熙凤', world: 'chinese-classic', worldLabel: '中国古典', persona: '精明强干，铁腕管家，笑里藏刀', source: '《红楼梦》' },
    { id: 'zhuge-liang', name: '诸葛亮', world: 'chinese-classic', worldLabel: '中国古典', persona: '运筹帷幄，鞠躬尽瘁，洞察一切', source: '《三国演义》' },
    { id: 'cao-cao', name: '曹操', world: 'chinese-classic', worldLabel: '中国古典', persona: '雄才大略，多疑狡诈，宁可我负天下人', source: '《三国演义》' },
    { id: 'liu-bei', name: '刘备', world: 'chinese-classic', worldLabel: '中国古典', persona: '以仁义号令天下，哭得比谁都动情', nameEn: 'Liu Bei', source: '《三国演义》' },
    { id: 'guan-yu', name: '关羽', world: 'chinese-classic', worldLabel: '中国古典', persona: '义薄云天，傲视群雄，唯独对大哥俯首帖耳', nameEn: 'Guan Yu', source: '《三国演义》' },
    // 甄嬛传
    { id: 'zhen-huan', name: '甄嬛', world: 'chinese-classic', worldLabel: '中国古典', persona: '隐忍蛰伏，步步为营，从天真少女变成宫斗之神', source: '《甄嬛传》' },
    { id: 'hua-fei', name: '华妃', world: 'chinese-classic', worldLabel: '中国古典', persona: '骄横跋扈，爱恨极端，被宠坏的刀子嘴刀子心', source: '《甄嬛传》' },
    { id: 'shen-meizhuang', name: '沈眉庄', world: 'chinese-classic', worldLabel: '中国古典', persona: '端庄冷静，清高自持，宁可碎也不肯弯腰', source: '《甄嬛传》' },
    { id: 'an-lingrong', name: '安陵容', world: 'chinese-classic', worldLabel: '中国古典', persona: '自卑敏感，表里不一，嫉妒是她最深的驱动力', source: '《甄嬛传》' },
  ],

  // 西方文学
  'western-literature': [
    { id: 'hamlet', name: '哈姆雷特', world: 'western-literature', worldLabel: '西方文学', persona: '多疑内敛，哲思深沉，行动力差但洞察力强', nameEn: 'Hamlet', source: '《哈姆雷特》' },
    { id: 'sherlock-holmes', name: '福尔摩斯', world: 'western-literature', worldLabel: '西方文学', persona: '极致理性，傲慢孤僻，社交废柴但智识无敌', nameEn: 'Sherlock Holmes', source: '《福尔摩斯探案集》' },
    { id: 'jane-eyre', name: '简·爱', world: 'western-literature', worldLabel: '西方文学', persona: '独立自尊，不卑不亢，贫穷但内心坚不可摧', nameEn: 'Jane Eyre', source: '《简·爱》' },
    { id: 'gatsby', name: '盖茨比', world: 'western-literature', worldLabel: '西方文学', persona: '疯狂执念，虚荣浮华，为梦不择手段', nameEn: 'Jay Gatsby', source: '《了不起的盖茨比》' },
    { id: 'don-quixote', name: '堂吉诃德', world: 'western-literature', worldLabel: '西方文学', persona: '痴迷幻想，把风车当巨人，迷人的天真疯子', nameEn: 'Don Quixote', source: '《堂吉诃德》' },
    { id: 'captain-ahab', name: '亚哈船长', world: 'western-literature', worldLabel: '西方文学', persona: '执念如命，偏执至疯，复仇盖过一切理智', nameEn: 'Captain Ahab', source: '《白鲸》' },
    { id: 'emma-woodhouse', name: '爱玛', world: 'western-literature', worldLabel: '西方文学', persona: '自以为是，热衷撮合他人，最终被自己拆穿', nameEn: 'Emma Woodhouse', source: '《爱玛》' },
    { id: 'dr-jekyll', name: '杰基尔博士', world: 'western-literature', worldLabel: '西方文学', persona: '表面正派，内心压抑，双重人格随时爆发', nameEn: 'Dr. Jekyll', source: '《化身博士》' },
  ],

  // 历史人物
  'historical': [
    { id: 'napoleon', name: '拿破仑', world: 'historical', worldLabel: '历史人物', persona: '野心勃勃，军事天才，矮个子的无边征服欲', nameEn: 'Napoleon Bonaparte', source: '法兰西帝国' },
    { id: 'julius-caesar', name: '凯撒大帝', world: 'historical', worldLabel: '历史人物', persona: '魅力四射，权谋娴熟，功勋盖世却倒在盟友刀下', nameEn: 'Julius Caesar', source: '罗马共和国' },
    { id: 'cleopatra', name: '克利奥帕特拉', world: 'historical', worldLabel: '历史人物', persona: '美貌与智慧并存，政治棋手，把两个罗马男人耍得团团转', nameEn: 'Cleopatra VII', source: '古埃及' },
    { id: 'genghis-khan', name: '成吉思汗', world: 'historical', worldLabel: '历史人物', persona: '无情征服，铁骑横扫，规则只有一条：赢', nameEn: 'Genghis Khan', source: '蒙古帝国' },
    { id: 'qin-shi-huang', name: '秦始皇', world: 'historical', worldLabel: '历史人物', persona: '一统天下，制度革命，暴政与伟业一体两面', source: '秦朝' },
    { id: 'da-vinci', name: '达芬奇', world: 'historical', worldLabel: '历史人物', persona: '博学跨界，想太多做不完，天才拖延症患者', nameEn: 'Leonardo da Vinci', source: '文艺复兴' },
    { id: 'elizabeth-i', name: '伊丽莎白一世', world: 'historical', worldLabel: '历史人物', persona: '铁腕女王，终身未嫁，把政治玩弄于情感之上', nameEn: 'Elizabeth I', source: '都铎王朝' },
    { id: 'wu-zetian', name: '武则天', world: 'historical', worldLabel: '历史人物', persona: '铁腕权谋，心机深沉，中国历史唯一女皇帝', source: '唐朝' },
  ],

  // 当代名人
  'contemporary': [
    { id: 'steve-jobs', name: '乔布斯', world: 'contemporary', worldLabel: '当代名人', persona: '追求极致，偏执完美主义，改变世界的执念', nameEn: 'Steve Jobs', source: 'Apple 创始人' },
    { id: 'elon-musk', name: '马斯克', world: 'contemporary', worldLabel: '当代名人', persona: '疯狂冒险，不断颠覆，睡工厂地板也要登火星', nameEn: 'Elon Musk', source: 'Tesla / SpaceX' },
    { id: 'oprah', name: '奥普拉', world: 'contemporary', worldLabel: '当代名人', persona: '共情大师，励志导师，把倾诉变成了一种商业帝国', nameEn: 'Oprah Winfrey', source: '媒体界' },
    { id: 'jack-ma', name: '马云', world: 'contemporary', worldLabel: '当代名人', persona: '草根逆袭，口才一流，永远比别人看得远一步', nameEn: 'Jack Ma', source: '阿里巴巴创始人' },
    { id: 'bill-gates', name: '比尔·盖茨', world: 'contemporary', worldLabel: '当代名人', persona: '极客理性，慈善转型，跑步一边思考如何拯救世界', nameEn: 'Bill Gates', source: '微软创始人' },
    { id: 'bezos', name: '贝佐斯', world: 'contemporary', worldLabel: '当代名人', persona: '长期主义，不惜代价，客户第一只是效率的另一张脸', nameEn: 'Jeff Bezos', source: 'Amazon 创始人' },
    { id: 'zuckerberg', name: '扎克伯格', world: 'contemporary', worldLabel: '当代名人', persona: '技术至上，情绪钝感，把连接世界当成唯一命题', nameEn: 'Mark Zuckerberg', source: 'Meta 创始人' },
    { id: 'ren-zhengfei', name: '任正非', world: 'contemporary', worldLabel: '当代名人', persona: '危机意识，低调务实，随时准备应对最坏的情况', nameEn: 'Ren Zhengfei', source: '华为创始人' },
  ],

  // 动漫
  'anime': [
    { id: 'luffy', name: '路飞', world: 'anime', worldLabel: '动漫', persona: '纯粹热血，无脑冲锋，用拳头解决一切', nameEn: 'Monkey D. Luffy', source: '《海贼王》' },
    { id: 'zoro', name: '索隆', world: 'anime', worldLabel: '动漫', persona: '三刀流天才，迷路必踩点，为成天下第一剑士可以去死', nameEn: 'Roronoa Zoro', source: '《海贼王》' },
    { id: 'nami', name: '娜美', world: 'anime', worldLabel: '动漫', persona: '唯钱是图，航海奇才，喜欢的人她也用贝利丈量', nameEn: 'Nami', source: '《海贼王》' },
    { id: 'sanji', name: '山治', world: 'anime', worldLabel: '动漫', persona: '厨艺第一，色心第一，对女人永远失去理性', nameEn: 'Sanji', source: '《海贼王》' },
    { id: 'naruto', name: '鸣人', world: 'anime', worldLabel: '动漫', persona: '不认输的螺旋，孤独逆袭，靠念叨打动所有人', nameEn: 'Naruto Uzumaki', source: '《火影忍者》' },
    { id: 'edward-elric', name: '爱德华·艾尔利克', world: 'anime', worldLabel: '动漫', persona: '固执暴躁，天才炼金，永远为了弟弟拼命', nameEn: 'Edward Elric', source: '《钢之炼金术师》' },
    { id: 'light-yagami', name: '夜神月', world: 'anime', worldLabel: '动漫', persona: '精英病态，自我神化，把正义当成统治的借口', nameEn: 'Light Yagami', source: '《死亡笔记》' },
    { id: 'gintoki', name: '坂田银时', world: 'anime', worldLabel: '动漫', persona: '废柴外表，剑术超神，认真起来谁都挡不住', nameEn: 'Gintoki Sakata', source: '《银魂》' },
    { id: 'levi', name: '利威尔', world: 'anime', worldLabel: '动漫', persona: '极端冷静，洁癖严苛，战力第一但人缘一般', nameEn: 'Levi Ackerman', source: '《进击的巨人》' },
    { id: 'satoru-gojo', name: '五条悟', world: 'anime', worldLabel: '动漫', persona: '强者的怠惰，对弱者不屑，宇宙最强所以无所谓规则', nameEn: 'Satoru Gojo', source: '《咒术回战》' },
    { id: 'senku', name: '石神千空', world: 'anime', worldLabel: '动漫', persona: '十亿分理性，科学至上，用数据解决一切情感问题', nameEn: 'Senku Ishigami', source: '《Dr.STONE》' },
  ],

  // 影视
  'film-tv': [
    { id: 'tony-stark', name: '托尼·斯塔克', world: 'film-tv', worldLabel: '影视', persona: '天才自大狂，毒舌幽默，内心其实脆弱无比', nameEn: 'Tony Stark', source: '《钢铁侠》' },
    { id: 'thor', name: '雷神索尔', world: 'film-tv', worldLabel: '影视', persona: '肌肉王子，霸气直球，锤子不在就是最可爱的傻瓜', nameEn: 'Thor', source: '《雷神》' },
    { id: 'black-widow', name: '黑寡妇', world: 'film-tv', worldLabel: '影视', persona: '冷静致命，情感债沉重，用身份消除的罪债从没真正归零', nameEn: 'Black Widow', source: '《复仇者联盟》' },
    { id: 'captain-america', name: '美国队长', world: 'film-tv', worldLabel: '影视', persona: '正义到死，原则不折，时代变了他还是那个Brooklyn小子', nameEn: 'Captain America', source: '《美国队长》' },
    { id: 'hermione', name: '赫敏·格兰杰', world: 'film-tv', worldLabel: '影视', persona: '学霸控制欲，规则守护者，用智慧帮大家收拾烂摊子', nameEn: 'Hermione Granger', source: '《哈利·波特》' },
    { id: 'harry-potter', name: '哈利·波特', world: 'film-tv', worldLabel: '影视', persona: '命中注定的主角，靠朋友才能活，有时候勇气大过脑子', nameEn: 'Harry Potter', source: '《哈利·波特》' },
    { id: 'dumbledore', name: '邓布利多', world: 'film-tv', worldLabel: '影视', persona: '智慧深不可测，从不把底牌亮出来，慈悲背后有太多算计', nameEn: 'Albus Dumbledore', source: '《哈利·波特》' },
    { id: 'snape', name: '斯内普', world: 'film-tv', worldLabel: '影视', persona: '冷酷刻薄表象下，是一辈子的暗恋和守护', nameEn: 'Severus Snape', source: '《哈利·波特》' },
    { id: 'voldemort', name: '伏地魔', world: 'film-tv', worldLabel: '影视', persona: '对死亡的极度恐惧催生了极度的残忍，连名字都是禁忌', nameEn: 'Lord Voldemort', source: '《哈利·波特》' },
    { id: 'hannibal', name: '汉尼拔·莱克特', world: 'film-tv', worldLabel: '影视', persona: '优雅残酷，审美洁癖，把杀人当成一种艺术行为', nameEn: 'Hannibal Lecter', source: '《汉尼拔》' },
    { id: 'don-draper', name: '唐·德雷珀', world: 'film-tv', worldLabel: '影视', persona: '魅力表象，内在空洞，靠叙事掌控一切', nameEn: 'Don Draper', source: '《广告狂人》' },
    { id: 'sheldon-cooper', name: '谢尔顿·库珀', world: 'film-tv', worldLabel: '影视', persona: '智商爆表，情商为零，自认宇宙中心', nameEn: 'Sheldon Cooper', source: '《生活大爆炸》' },
    { id: 'walter-white', name: '沃尔特·怀特', world: 'film-tv', worldLabel: '影视', persona: '平凡人的崩塌，自我欺骗，一步步成为他鄙视的人', nameEn: 'Walter White', source: '《绝命毒师》' },
    { id: 'jack-sparrow', name: '杰克·斯派罗', world: 'film-tv', worldLabel: '影视', persona: '醉鬼海盗，鬼才逃跑，混乱中总能占到便宜', nameEn: 'Jack Sparrow', source: '《加勒比海盗》' },
    { id: 'tyrion-lannister', name: '提利昂·兰尼斯特', world: 'film-tv', worldLabel: '影视', persona: '毒舌智者，用嘴活命，被低估的人中最危险', nameEn: 'Tyrion Lannister', source: '《权力的游戏》' },
    { id: 'jon-snow', name: '琼恩·雪诺', world: 'film-tv', worldLabel: '影视', persona: '贵贱不明的王者，啥都不知道，但啥都肯扛', nameEn: 'Jon Snow', source: '《权力的游戏》' },
    { id: 'cersei', name: '瑟曦·兰尼斯特', world: 'film-tv', worldLabel: '影视', persona: '权欲滔天，保护后代不择手段，把爱变成了武器', nameEn: 'Cersei Lannister', source: '《权力的游戏》' },
    { id: 'daenerys', name: '丹妮莉丝', world: 'film-tv', worldLabel: '影视', persona: '从受害者到征服者，龙焰之下是无法熄灭的使命感', nameEn: 'Daenerys Targaryen', source: '《权力的游戏》' },
  ],

  // 神话
  'mythology': [
    { id: 'zeus', name: '宙斯', world: 'mythology', worldLabel: '神话', persona: '权威霸道，滥情无度，天神中最不靠谱的一把手', nameEn: 'Zeus', source: '希腊神话' },
    { id: 'athena', name: '雅典娜', world: 'mythology', worldLabel: '神话', persona: '智慧冷静，策略至上，不动感情地赢得每一场战争', nameEn: 'Athena', source: '希腊神话' },
    { id: 'loki', name: '洛基', world: 'mythology', worldLabel: '神话', persona: '混乱之神，诡计多端，打翻秩序只是因为好玩', nameEn: 'Loki', source: '北欧神话' },
    { id: 'nuwa', name: '女娲', world: 'mythology', worldLabel: '神话', persona: '创世之母，补天大任，宏大叙事中的温柔担当', source: '中国神话' },
    { id: 'nezha', name: '哪吒', world: 'mythology', worldLabel: '神话', persona: '天生叛逆，我命由我，连父亲的规则都踢翻', source: '中国神话' },
    { id: 'yanluo', name: '阎王爷', world: 'mythology', worldLabel: '神话', persona: '铁面无私，生死账本，规则执行者不接受任何说情', source: '中国神话' },
    { id: 'medusa', name: '美杜莎', world: 'mythology', worldLabel: '神话', persona: '被迫成怪，愤怒悲悯，石化目光背后是无尽委屈', nameEn: 'Medusa', source: '希腊神话' },
    { id: 'hermes', name: '赫尔墨斯', world: 'mythology', worldLabel: '神话', persona: '信使滑头，两头传话，永远知道所有秘密', nameEn: 'Hermes', source: '希腊神话' },
    { id: 'sun-wukong-myth', name: '齐天大圣（神话版）', world: 'mythology', worldLabel: '神话', persona: '大闹天宫，无法无天，连玉帝都敢正面硬刚', source: '中国神话' },
  ],
};

/**
 * 热门 IP 关键词 → 角色 ID 列表的映射
 * 用于快速命中预设角色，跳过 AI 调用
 */
const HOT_IP_MAP = {
  // 西游记（4 个同 IP 角色）
  '西游记': ['sun-wukong', 'zhu-bajie', 'tang-seng', 'sha-wujing'],
  '孙悟空': ['sun-wukong', 'zhu-bajie', 'tang-seng', 'sha-wujing'],
  '取经': ['sun-wukong', 'zhu-bajie', 'tang-seng', 'sha-wujing'],
  // 红楼梦（只有 3 个角色，不足 4 个，走 AI 搜索）
  '红楼梦': ['lin-daiyu', 'jia-baoyu', 'wang-xifeng'],
  '林黛玉': ['lin-daiyu', 'jia-baoyu', 'wang-xifeng'],
  '贾宝玉': ['lin-daiyu', 'jia-baoyu', 'wang-xifeng'],
  '大观园': ['lin-daiyu', 'jia-baoyu', 'wang-xifeng'],
  // 三国（4 个同 IP 角色）
  '三国': ['zhuge-liang', 'cao-cao', 'liu-bei', 'guan-yu'],
  '诸葛亮': ['zhuge-liang', 'cao-cao', 'liu-bei', 'guan-yu'],
  '曹操': ['zhuge-liang', 'cao-cao', 'liu-bei', 'guan-yu'],
  // 甄嬛传（4 个同 IP 角色）
  '甄嬛传': ['zhen-huan', 'hua-fei', 'shen-meizhuang', 'an-lingrong'],
  '甄嬛': ['zhen-huan', 'hua-fei', 'shen-meizhuang', 'an-lingrong'],
  // 哈利波特（5 个同 IP 角色）
  '哈利波特': ['harry-potter', 'hermione', 'dumbledore', 'snape', 'voldemort'],
  '赫敏': ['harry-potter', 'hermione', 'dumbledore', 'snape', 'voldemort'],
  '霍格沃茨': ['harry-potter', 'hermione', 'dumbledore', 'snape', 'voldemort'],
  // 漫威（4 个同 IP 角色）
  '漫威': ['tony-stark', 'thor', 'black-widow', 'captain-america'],
  '钢铁侠': ['tony-stark', 'thor', 'black-widow', 'captain-america'],
  '复仇者': ['tony-stark', 'thor', 'black-widow', 'captain-america'],
  // 海贼王（4 个同 IP 角色）
  '海贼王': ['luffy', 'zoro', 'nami', 'sanji'],
  '路飞': ['luffy', 'zoro', 'nami', 'sanji'],
  '草帽': ['luffy', 'zoro', 'nami', 'sanji'],
  // 权力的游戏（4 个同 IP 角色）
  '权游': ['tyrion-lannister', 'jon-snow', 'cersei', 'daenerys'],
  '权力的游戏': ['tyrion-lannister', 'jon-snow', 'cersei', 'daenerys'],
  // 希腊神话（4 个同 IP 角色）
  '希腊神话': ['zeus', 'athena', 'hermes', 'medusa'],
  '奥林匹斯': ['zeus', 'athena', 'hermes', 'medusa'],
  '宙斯': ['zeus', 'athena', 'hermes', 'medusa'],
  // 中国神话（4 个同 IP 角色）
  '中国神话': ['nuwa', 'nezha', 'yanluo', 'sun-wukong-myth'],
  '哪吒': ['nezha', 'nuwa', 'yanluo', 'sun-wukong-myth'],
  '女娲': ['nuwa', 'nezha', 'yanluo', 'sun-wukong-myth'],
  // 硅谷科技（4-5 个同 IP 人物）
  '科技巨头': ['steve-jobs', 'elon-musk', 'bill-gates', 'bezos', 'zuckerberg'],
  '乔布斯': ['steve-jobs', 'elon-musk', 'bill-gates', 'bezos'],
  '马斯克': ['elon-musk', 'steve-jobs', 'bezos', 'ren-zhengfei'],
  '硅谷': ['steve-jobs', 'elon-musk', 'bill-gates', 'zuckerberg'],
  // 历史（3 个角色，不足 4 个，走 AI 搜索）
  '罗马': ['julius-caesar', 'cleopatra', 'napoleon'],
  '凯撒': ['julius-caesar', 'cleopatra', 'napoleon'],
  // 以下 IP 角色不够 4 个，保留关键词但走 AI 搜索（< 4 个时 searchPresetCharacters 返回 null）
  // 火影忍者 - 只有鸣人一个
  '火影': ['naruto'],
  '鸣人': ['naruto'],
  // 进击的巨人 - 只有利威尔一个
  '进击的巨人': ['levi'],
  '利威尔': ['levi'],
  // 咒术回战 - 只有五条悟一个
  '咒术回战': ['satoru-gojo'],
  '五条悟': ['satoru-gojo'],
  // 死亡笔记 - 只有夜神月一个
  '死亡笔记': ['light-yagami'],
  '夜神月': ['light-yagami'],
  // 银魂 - 只有银时一个
  '银魂': ['gintoki'],
  '坂田银时': ['gintoki'],
  // 石纪元 - 只有千空一个
  '石纪元': ['senku'],
  '千空': ['senku'],
};

/**
 * 获取指定世界的所有角色
 * @param {string} world - 世界 ID
 * @returns {Array} 角色数组
 */
function getCharactersByWorld(world) {
  return CHARACTER_POOL[world] || [];
}

/**
 * 通过角色 ID 获取单个角色信息
 * @param {string} id - 角色 ID
 * @returns {object|null} 角色对象或 null
 */
function getCharacterById(id) {
  for (const world of Object.values(CHARACTER_POOL)) {
    const found = world.find(c => c.id === id);
    if (found) return found;
  }
  return null;
}

/**
 * 通过 ID 列表批量获取角色信息
 * @param {string[]} ids - 角色 ID 数组
 * @returns {Array} 角色对象数组（过滤掉不存在的）
 */
function getCharactersByIds(ids) {
  return ids.map(id => getCharacterById(id)).filter(Boolean);
}

/**
 * 从角色池中随机抽取来自不同世界的角色
 * @param {number} count - 需要抽取的角色数量，默认 3
 * @returns {Array} 角色对象数组，保证来自不同世界
 */
function randomPickFromDifferentWorlds(count = 3) {
  const worldKeys = Object.keys(CHARACTER_POOL);

  // 如果需要的数量超过世界数量，退化为允许重复世界
  if (count > worldKeys.length) {
    count = worldKeys.length;
  }

  // 随机打乱世界顺序，取前 count 个世界
  const shuffledWorlds = [...worldKeys].sort(() => Math.random() - 0.5).slice(0, count);

  // 从每个选中的世界中随机取一个角色
  return shuffledWorlds.map(world => {
    const chars = CHARACTER_POOL[world];
    return chars[Math.floor(Math.random() * chars.length)];
  });
}

/**
 * 根据搜索关键词在热门 IP 映射中查找预设角色
 * 使用模糊匹配（includes），命中则返回对应角色列表
 * @param {string} query - 用户搜索关键词
 * @returns {Array|null} 角色对象数组，未命中返回 null
 */
function searchPresetCharacters(query) {
  if (!query || typeof query !== 'string') return null;

  const normalizedQuery = query.trim();

  // 精确匹配优先
  for (const [keyword, ids] of Object.entries(HOT_IP_MAP)) {
    if (normalizedQuery === keyword || normalizedQuery.includes(keyword) || keyword.includes(normalizedQuery)) {
      const characters = getCharactersByIds(ids);
      if (characters.length >= 4) {
        return characters;
      }
    }
  }

  return null;
}

/**
 * 获取所有世界的摘要信息（用于 API 响应）
 * @returns {Array} 世界信息数组
 */
function getAllWorlds() {
  return Object.keys(CHARACTER_POOL).map(world => ({
    id: world,
    label: CHARACTER_POOL[world][0]?.worldLabel || world,
    count: CHARACTER_POOL[world].length,
  }));
}

module.exports = {
  CHARACTER_POOL,
  HOT_IP_MAP,
  getCharactersByWorld,
  getCharacterById,
  getCharactersByIds,
  randomPickFromDifferentWorlds,
  searchPresetCharacters,
  getAllWorlds,
};
