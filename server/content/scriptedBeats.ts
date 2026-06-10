/**
 * Offline content pack for the ScriptedDirector.
 *
 * Structure (deliberately O(chapters × actionTags) + O(turns), not O(beats)):
 *  - SPINE_SCENES[turn 0..10]: the authored festival-week spine every life walks
 *    through, with identity-specific fragments. Scenes at turns 2/3/4/6/7/8/10
 *    realize the seeded events from sim/pacing.ts one-to-one.
 *  - OUTCOMES[chapter][actionTag]: what the chosen action did — state deltas,
 *    NPC effects, a timeline event and a causal entry. Money scales by identity.
 */
import type {
  ActionTag,
  IdentityId,
  LocationId,
  NpcId,
  SkillId,
  StatusId,
  TimelineKind,
} from "@shared/constants";
import type { Choice, SceneDirective } from "@shared/types";

// ---------------------------------------------------------------------------
// Spine scenes
// ---------------------------------------------------------------------------

export interface SpineScene {
  titleZh: string;
  /** Default scene location; per-identity override possible. */
  location: LocationId;
  locationByIdentity?: Partial<Record<IdentityId, LocationId>>;
  directive: Omit<SceneDirective, "locationId">;
  /** How far time advances entering this scene. */
  timeAdvance: 0 | 1 | 2;
  proseZh: string;
  identityProseZh?: Partial<Record<IdentityId, string>>;
  choices: Choice[];
}

const c = (
  id: Choice["id"],
  labelZh: string,
  hintZh: string,
  actionTag: ActionTag,
  risk: Choice["risk"],
): Choice => ({ id, labelZh, hintZh, actionTag, risk });

export const SPINE_SCENES: SpineScene[] = [
  // ---- T0 · 试灯 · 初至 ----
  {
    titleZh: "灯市初至",
    location: "market_cross",
    locationByIdentity: {
      scholar: "bookshop",
      apprentice: "silk_row",
      interpreter: "persian_lodge",
      copyist: "temple_hall",
    },
    directive: {
      timeOfDay: "dusk",
      weather: "clear",
      mood: "festive",
      crowd: "busy",
      lanterns: "bright",
      focusNpcIds: [],
    },
    timeAdvance: 0,
    proseZh:
      "正月十三，东市的灯轮立起来了。匠人们攀在架上挂灯，绢幡在暮色里一层层亮开。开市的鼓声还没散尽，人潮已经从四面坊门涌来。灯节七日，这座市要把一年的悲欢都烧成灯火。",
    identityProseZh: {
      scholar: "沈先生把书肆偏房的钥匙交给你时只说了一句：灯会上人多，眼睛要亮。",
      apprentice: "崔九倚在绢行门口剥着橘子，看你的眼神像在看一页对不上的账。",
      interpreter: "波斯邸的老胡商攥着你译的那份契书，指节都泛了白：货款一日不结，谁都别想安生。",
      copyist: "监院嘱咐你灯节期间莫要荒了功课，可墙外的灯光，正一寸寸漫过院墙。",
    },
    choices: [
      c("c1", "专心本业，先把眼前的活计做好", "稳妥，攒几个铜钱", "pursue_money", "low"),
      c("c2", "往市楼十字看官府的告示", "看清风向再动", "observe_wait", "low"),
      c("c3", "去何家酒肆结识些有用的人", "人脉即门路", "seek_patronage", "medium"),
      c("c4", "循着失账的传闻暗暗打听", "祸福难料", "take_risk", "medium"),
    ],
  },
  // ---- T1 · 市楼鼓声 ----
  {
    titleZh: "市楼鼓声",
    location: "market_cross",
    directive: {
      timeOfDay: "morning",
      weather: "clear",
      mood: "tense",
      crowd: "packed",
      lanterns: "dim",
      focusNpcIds: ["pei_heng"],
    },
    timeAdvance: 2,
    proseZh:
      "翌日清晨，市楼下围满了人。市丞裴衡立在榜前，青袍纤尘不染：灯节七日，核查各行税册，丁是丁，卯是卯。有摊贩低声抱怨灯节查账不近人情，立刻被小吏厉声喝住。人群里，你听见'绢行''失账'两个词压着嗓子传来传去。",
    choices: [
      c("c1", "在人群里安静听完，不出头", "记下每一张脸", "observe_wait", "low"),
      c("c2", "替被喝斥的摊贩说句公道话", "众目睽睽之下", "protect_someone", "medium"),
      c("c3", "上前与市署小吏攀谈，混个脸熟", "官面上的人情", "seek_patronage", "medium"),
      c("c4", "把听来的风声拿去卖给何十三娘", "消息也是货", "pursue_money", "medium"),
    ],
  },
  // ---- T2 · 风声渐紧 (seed_ledger_rumor) ----
  {
    titleZh: "风声渐紧",
    location: "wine_house",
    directive: {
      timeOfDay: "noon",
      weather: "overcast",
      mood: "tense",
      crowd: "busy",
      lanterns: "dim",
      focusNpcIds: ["he_shisan", "lvyao"],
    },
    timeAdvance: 1,
    proseZh:
      "何家酒肆里人声比往日低。绿腰的琵琶弹到一半停了弦——失账的传闻已经追到了你身上。何十三娘亲自给你斟了一盏，声音压得只有你能听见：风声不是空穴来风，有人在背后推。你最好想清楚，自己站在哪一边。",
    identityProseZh: {
      scholar: "有人在席间冷笑：书生替人代写文书，谁知道写过些什么。",
      apprentice: "短的那页账记的是你经手的货——这话已经有人说到了东家耳朵里。",
      interpreter: "胡商的货款、你译的契书、失踪的账页，三件事被人串成了一条线。",
      copyist: "捎话的人就坐在角落里，远远向你举了举杯——他还在等你点头藏那页'账'。",
    },
    choices: [
      c("c1", "与崔九当面对质，把话挑开", "撕破脸皮", "reveal_info", "high"),
      c("c2", "不动声色，自己暗中查证", "袖里藏针", "conceal_info", "medium"),
      c("c3", "奉上谢礼，请何十三娘居中打探", "人情有价", "seek_patronage", "medium"),
      c("c4", "置身事外，只顾自己的营生", "明哲保身", "preserve_reputation", "low"),
    ],
  },
  // ---- T3 · 告示与冷眼 (seed_audit_notice) ----
  {
    titleZh: "告示与冷眼",
    location: "market_cross",
    locationByIdentity: { apprentice: "silk_row" },
    directive: {
      timeOfDay: "dusk",
      weather: "overcast",
      mood: "tense",
      crowd: "busy",
      lanterns: "bright",
      focusNpcIds: ["cui_jiu"],
    },
    timeAdvance: 1,
    proseZh:
      "暮色里，市署的告示贴满了各行的门柱：税册十九日前缴验，匿账者依律论处。崔九带着两个行里的伙计'恰好'从你身边经过，扬声笑道：有些人来历不明，行里诸位还是把货看紧些。周围的目光像细针一样落在你背上。",
    choices: [
      c("c1", "当场回敬，叫他把话说明白", "针尖对麦芒", "reveal_info", "high"),
      c("c2", "先去求一位长者替你作保", "找棵大树", "seek_patronage", "medium"),
      c("c3", "拿出积蓄打点，把流言压下去", "破财消灾", "preserve_reputation", "medium"),
      c("c4", "暗中收集对自己有利的凭据", "以备不时", "conceal_info", "medium"),
    ],
  },
  // ---- T4 · 查到头上 (seed_audit_personal) ----
  {
    titleZh: "查到头上",
    location: "market_cross",
    directive: {
      timeOfDay: "morning",
      weather: "clear",
      mood: "tense",
      crowd: "busy",
      lanterns: "dim",
      focusNpcIds: ["pei_heng"],
    },
    timeAdvance: 2,
    proseZh:
      "十五将至，灯轮试了第一回火。可清晨来寻你的不是灯匠，是市署的差役——裴衡要当面问你的话。市楼下设了张案，裴衡的目光像秤一样把你从头到脚称了一遍：失账一事，与你有关的几处，本丞要听你亲口说。",
    choices: [
      c("c1", "据实以告，连对自己不利的也不瞒", "坦荡有险", "reveal_info", "high"),
      c("c2", "避重就轻，先把自己摘出去", "言多必失", "conceal_info", "medium"),
      c("c3", "借机点出崔九近日行迹可疑", "祸水东引", "take_risk", "high"),
      c("c4", "恭谨应对，礼数滴水不漏", "不功不过", "preserve_reputation", "low"),
    ],
  },
  // ---- T5 · 灯下生意 ----
  {
    titleZh: "灯下生意",
    location: "silk_row",
    locationByIdentity: { interpreter: "persian_lodge", copyist: "temple_hall" },
    directive: {
      timeOfDay: "noon",
      weather: "clear",
      mood: "festive",
      crowd: "packed",
      lanterns: "bright",
      focusNpcIds: ["he_shisan"],
    },
    timeAdvance: 1,
    proseZh:
      "正灯之日，金吾不禁，长安倾城而出。东市的行情一日三变：绢价因灯幡涨了三成，胡商的香料被抢购一空，连寺院的抄经酬金都翻了倍。乱世藏祸，盛世藏金——这样的日子，七年难遇一回。",
    choices: [
      c("c1", "抓住灯节行情，放手做一笔", "盛市之利", "pursue_money", "medium"),
      c("c2", "把工夫花在结交贵人上", "灯下识人", "pursue_status", "medium"),
      c("c3", "帮绿腰多攒些赎身的赏钱", "雪中送炭", "protect_someone", "low"),
      c("c4", "静观市面，留意人潮里的异动", "灯下黑", "observe_wait", "low"),
    ],
  },
  // ---- T6 · 身契风波 (seed_lvyao_crisis) ----
  {
    titleZh: "身契风波",
    location: "wine_house",
    directive: {
      timeOfDay: "night",
      weather: "clear",
      mood: "melancholy",
      crowd: "busy",
      lanterns: "festival",
      focusNpcIds: ["lvyao", "he_shisan"],
    },
    timeAdvance: 2,
    proseZh:
      "上元正夜，满城灯如白昼。酒肆里却出了事：绢行的人拿着文书上门，说绿腰的身契押在那桩账目纠纷里，今夜就要带人走。琵琶横在她膝上，弦断了一根。她没有哭，只是看了你一眼——满座宾客，她只看了你一眼。",
    choices: [
      c("c1", "倾囊相助，替她把这笔押钱垫上", "千金一诺", "protect_someone", "high"),
      c("c2", "求何十三娘出面转圜", "借她的脸面", "seek_patronage", "medium"),
      c("c3", "劝她暂且忍耐，莫在风口生事", "留得青山", "observe_wait", "low"),
      c("c4", "把身契背后的隐情当众捅出去", "鱼死网破", "reveal_info", "high"),
    ],
  },
  // ---- T7 · 灯夜诗会 (seed_poetry_night) ----
  {
    titleZh: "灯夜诗会",
    location: "bookshop",
    directive: {
      timeOfDay: "night",
      weather: "snow",
      mood: "festive",
      crowd: "packed",
      lanterns: "festival",
      focusNpcIds: ["shen_yanqiu", "pei_heng", "cui_jiu"],
    },
    timeAdvance: 0,
    proseZh:
      "十七夜，雪后初霁，沈记书肆的灯下诗会开了席。檐下灯影映着薄雪，满座有青衫的举子、便服的官人、装作风雅的商贾。沈砚秋立在灯下环视一周，朗声道：灯下无尊卑，一句好诗，胜过十年寒暄。你看见裴衡也在,崔九也在——这一夜，各方的眼睛都聚在一处。",
    choices: [
      c("c1", "献上一首用心之作", "以文会友", "pursue_art", "medium"),
      c("c2", "借诗会向在座的贵人自荐", "毛遂自荐", "pursue_status", "medium"),
      c("c3", "当众点破账册疑云，语惊四座", "石破天惊", "take_risk", "high"),
      c("c4", "退居一隅，冷眼看各方神色", "壁上观", "observe_wait", "low"),
    ],
  },
  // ---- T8 · 收灯前夜 (seed_harvest) ----
  {
    titleZh: "收灯前夜",
    location: "market_cross",
    directive: {
      timeOfDay: "noon",
      weather: "clear",
      mood: "tense",
      crowd: "busy",
      lanterns: "bright",
      focusNpcIds: ["pei_heng", "cui_jiu"],
    },
    timeAdvance: 2,
    proseZh:
      "十八，灯火渐收，账却要见底了。这些天你布下的线、结下的情、得罪的人，一齐找上门来。失账一案到了图穷匕见的时候：那页要命的账，下落隐隐指向你能够到的地方。谁先拿到它，谁就握住了所有人的命门。",
    choices: [
      c("c1", "把查到的凭据交给裴衡", "交给官法", "reveal_info", "high"),
      c("c2", "拿凭据与崔九做一笔交换", "与虎谋皮", "pursue_money", "high"),
      c("c3", "把凭据毁掉，谁也别想拿它害人", "一了百了", "conceal_info", "medium"),
      c("c4", "先把绿腰和身边的人护周全", "人比账重", "protect_someone", "medium"),
    ],
  },
  // ---- T9 · 图穷匕见 ----
  {
    titleZh: "图穷匕见",
    location: "gate_lane",
    directive: {
      timeOfDay: "night",
      weather: "windy",
      mood: "ominous",
      crowd: "sparse",
      lanterns: "dim",
      focusNpcIds: ["cui_jiu"],
    },
    timeAdvance: 2,
    proseZh:
      "夜风穿过春明门夹道，吹得孤灯明明灭灭。崔九派人递了话：亥时，夹道一叙，账页的事'好商量'。墙影深处似乎不止一个人影。长安的灯节再亮，也照不进这条巷子。",
    choices: [
      c("c1", "赴约，亲手了断这件事", "深入虎穴", "take_risk", "high"),
      c("c2", "请何十三娘设局，借力打力", "四两千斤", "seek_patronage", "medium"),
      c("c3", "守在明处，绝不踏进暗巷", "君子不立危墙", "preserve_reputation", "low"),
      c("c4", "抢先一步，把约谈之事告到市署", "先发制人", "reveal_info", "high"),
    ],
  },
  // ---- T10 · 灯落之时 (seed_finale) ----
  {
    titleZh: "灯落之时",
    location: "market_cross",
    directive: {
      timeOfDay: "night",
      weather: "clear",
      mood: "melancholy",
      crowd: "sparse",
      lanterns: "dim",
      focusNpcIds: [],
    },
    timeAdvance: 0,
    proseZh:
      "正月十九，收灯。匠人们把灯轮一盏一盏摘下来，东市恢复了平日的鼓声与钲声。失账一案尘埃落定，七日灯火里你走过的每一步，都已刻进这座市的人情账册。灯会散了，长安还长——而你已经不是七日前走进灯市的那个人。",
    choices: [],
  },
];

// ---------------------------------------------------------------------------
// Outcome tables — what the chosen action did (applied entering the next scene)
// ---------------------------------------------------------------------------

export interface OutcomeDef {
  moneyDelta: number;
  reputationDelta: number;
  healthDelta: number;
  skillUp?: SkillId;
  statusAdd?: StatusId[];
  statusRemove?: StatusId[];
  npcEffects: {
    npcId: NpcId;
    trustDelta: number;
    fearDelta?: number;
    respectDelta?: number;
    memoryZh?: string;
  }[];
  tensionDeltas?: Partial<Record<"official_scrutiny" | "guild_dispute" | "festival_fervor" | "street_danger", number>>;
  rumorAddZh?: string;
  timeline: { kind: TimelineKind; titleZh: string; descZh: string; importance: 1 | 2 | 3 };
  causal: { textZh: string; effectsZh: string[]; openedZh: string[]; closedZh: string[] };
}

/** Money deltas scale by identity so a bribe that pinches the interpreter ruins the copyist. */
export const MONEY_SCALE: Record<IdentityId, number> = {
  scholar: 1,
  apprentice: 0.6,
  interpreter: 1.5,
  copyist: 0.5,
};

export const OUTCOMES: Record<1 | 2 | 3, Record<ActionTag, OutcomeDef>> = {
  // ============ 第一章 · 试灯 ============
  1: {
    seek_patronage: {
      moneyDelta: -50, reputationDelta: 2, healthDelta: 0,
      npcEffects: [
        { npcId: "he_shisan", trustDelta: 8, memoryZh: "你识礼数，递人情递得体面" },
        { npcId: "shen_yanqiu", trustDelta: 4 },
      ],
      timeline: { kind: "opportunity", titleZh: "结下门路", descZh: "在酒肆递出的人情有了回音，何十三娘记下了你。", importance: 1 },
      causal: { textZh: "你主动结交，把自己放进了消息的网里。", effectsZh: ["何十三娘对你另眼相看"], openedZh: ["酒肆的门路"], closedZh: [] },
    },
    protect_someone: {
      moneyDelta: -30, reputationDelta: 4, healthDelta: 0,
      npcEffects: [
        { npcId: "lvyao", trustDelta: 10, memoryZh: "众人冷眼时，你肯出头" },
        { npcId: "cui_jiu", trustDelta: -4 },
      ],
      timeline: { kind: "relationship", titleZh: "出头之恩", descZh: "你在人前替弱者撑了一回腰，市井都看在眼里。", importance: 2 },
      causal: { textZh: "你出手相护，善名传开，也挡了某些人的路。", effectsZh: ["绿腰记下了这份情", "崔九觉得你碍事"], openedZh: ["弱者的信任"], closedZh: [] },
    },
    conceal_info: {
      moneyDelta: 0, reputationDelta: 0, healthDelta: 0, skillUp: "streetwise",
      npcEffects: [{ npcId: "he_shisan", trustDelta: 3, memoryZh: "你嘴严，是个能存住话的人" }],
      tensionDeltas: { official_scrutiny: 1 },
      timeline: { kind: "decision", titleZh: "把话咽下", descZh: "你把听来的东西收进了袖中，没有声张。", importance: 1 },
      causal: { textZh: "你按下了不该出口的话。", effectsZh: ["没人知道你知道什么"], openedZh: ["将来讨价的本钱"], closedZh: ["即刻表态的机会"] },
    },
    reveal_info: {
      moneyDelta: 0, reputationDelta: 3, healthDelta: 0,
      npcEffects: [
        { npcId: "pei_heng", trustDelta: 6, respectDelta: 4, memoryZh: "此人肯当众说实话" },
        { npcId: "cui_jiu", trustDelta: -8, fearDelta: 4 },
      ],
      tensionDeltas: { official_scrutiny: 1 },
      timeline: { kind: "decision", titleZh: "当众挑明", descZh: "你把知道的事说了出来，市楼下一片哗然。", importance: 2 },
      causal: { textZh: "你把话挑明，官府记住了你的坦白，对头记住了你的多嘴。", effectsZh: ["裴衡对你的话上了心", "崔九视你为眼中钉"], openedZh: ["官面上的信用"], closedZh: [] },
    },
    take_risk: {
      moneyDelta: 120, reputationDelta: 0, healthDelta: -4,
      npcEffects: [
        { npcId: "he_shisan", trustDelta: 4, memoryZh: "胆子不小，是个可用之人" },
        { npcId: "cui_jiu", trustDelta: -3 },
      ],
      tensionDeltas: { street_danger: 1 },
      timeline: { kind: "decision", titleZh: "初涉险水", descZh: "你顺着失账的传闻摸了一段暗线，沾了点利,也沾了点灰。", importance: 2 },
      causal: { textZh: "你行了一步险棋。", effectsZh: ["摸到了暗线的一角", "进账百余文"], openedZh: ["更深的水"], closedZh: [] },
    },
    preserve_reputation: {
      moneyDelta: -40, reputationDelta: 3, healthDelta: 0,
      npcEffects: [{ npcId: "shen_yanqiu", trustDelta: 3 }],
      timeline: { kind: "decision", titleZh: "守住体面", descZh: "你处处求稳，把名声看得比眼前利重。", importance: 1 },
      causal: { textZh: "你谨守分寸，不结仇,也不冒进。", effectsZh: ["名声稳了几分"], openedZh: [], closedZh: ["几桩来钱快的门路"] },
    },
    pursue_money: {
      moneyDelta: 150, reputationDelta: -1, healthDelta: 0, skillUp: "bargaining",
      npcEffects: [{ npcId: "cui_jiu", trustDelta: -2 }],
      timeline: { kind: "decision", titleZh: "攒下铜钱", descZh: "灯节的市口好，你埋头做事，攒下了一小笔。", importance: 1 },
      causal: { textZh: "你把心思放在了生计上。", effectsZh: ["进账一百五十文上下"], openedZh: [], closedZh: [] },
    },
    pursue_status: {
      moneyDelta: -60, reputationDelta: 4, healthDelta: 0,
      npcEffects: [
        { npcId: "pei_heng", trustDelta: 3 },
        { npcId: "shen_yanqiu", trustDelta: 2 },
      ],
      timeline: { kind: "decision", titleZh: "人前露脸", descZh: "你在该出现的场合出现，让该记住你的人记住了你。", importance: 1 },
      causal: { textZh: "你向上走的心思摆在了明处。", effectsZh: ["几位体面人物记下了你的名字"], openedZh: ["更高处的台阶"], closedZh: [] },
    },
    pursue_art: {
      moneyDelta: -10, reputationDelta: 3, healthDelta: 0, skillUp: "letters",
      npcEffects: [{ npcId: "shen_yanqiu", trustDelta: 8, respectDelta: 5, memoryZh: "笔下见心性，是块料" }],
      timeline: { kind: "decision", titleZh: "笔下功夫", descZh: "你在纸墨上花的心思，被懂行的人看见了。", importance: 1 },
      causal: { textZh: "你以文墨立身。", effectsZh: ["沈砚秋对你刮目相看"], openedZh: ["诗会的请柬"], closedZh: [] },
    },
    observe_wait: {
      moneyDelta: 20, reputationDelta: 0, healthDelta: 2, skillUp: "streetwise",
      npcEffects: [],
      timeline: { kind: "decision", titleZh: "按兵不动", descZh: "你没有出手，只是把每一张脸都记在了心里。", importance: 1 },
      causal: { textZh: "你选择先看清局势。", effectsZh: ["看清了几方人马的来路"], openedZh: [], closedZh: [] },
    },
  },
  // ============ 第二章 · 正灯 ============
  2: {
    seek_patronage: {
      moneyDelta: -150, reputationDelta: 3, healthDelta: 0,
      npcEffects: [
        { npcId: "he_shisan", trustDelta: 10, memoryZh: "关键时刻肯下本钱求人，懂规矩" },
        { npcId: "shen_yanqiu", trustDelta: 5 },
      ],
      timeline: { kind: "opportunity", titleZh: "贵人之缘", descZh: "你递出去的人情在正灯之夜结了果，有人愿意为你说话了。", importance: 2 },
      causal: { textZh: "你押在人情上的本钱开始生息。", effectsZh: ["有了肯替你转圜的人"], openedZh: ["危局中的退路"], closedZh: [] },
    },
    protect_someone: {
      moneyDelta: -200, reputationDelta: 4, healthDelta: 0, statusAdd: ["sheltering_friend"],
      npcEffects: [
        { npcId: "lvyao", trustDelta: 14, memoryZh: "灯夜里满座宾客，只有你站了出来" },
        { npcId: "he_shisan", trustDelta: 5 },
        { npcId: "pei_heng", trustDelta: -4, fearDelta: 0 },
      ],
      timeline: { kind: "relationship", titleZh: "灯下托付", descZh: "你在满城灯火里护住了一个走投无路的人。", importance: 3 },
      causal: { textZh: "你把别人的难处接到了自己肩上。", effectsZh: ["绿腰把后半生的指望放在了你身上", "官府觉得你多管闲事"], openedZh: ["一份以命相托的信任"], closedZh: ["独善其身的余地"] },
    },
    conceal_info: {
      moneyDelta: 0, reputationDelta: 0, healthDelta: 0, statusAdd: ["holds_ledger_page"],
      npcEffects: [{ npcId: "cui_jiu", trustDelta: 0, fearDelta: 6, memoryZh: "他似乎摸到了那页账的边" }],
      tensionDeltas: { official_scrutiny: 1 },
      timeline: { kind: "decision", titleZh: "袖中乾坤", descZh: "要紧的东西到了你手里，你把它收进了袖中。", importance: 2 },
      causal: { textZh: "你扣下了足以翻转局面的东西。", effectsZh: ["崔九开始忌惮你"], openedZh: ["与各方讨价的筹码"], closedZh: [] },
    },
    reveal_info: {
      moneyDelta: 0, reputationDelta: 4, healthDelta: 0,
      npcEffects: [
        { npcId: "pei_heng", trustDelta: 10, respectDelta: 6, memoryZh: "三番两次肯对官府交底，难得" },
        { npcId: "cui_jiu", trustDelta: -12, fearDelta: 6 },
      ],
      tensionDeltas: { official_scrutiny: 2, guild_dispute: 1 },
      timeline: { kind: "consequence", titleZh: "向官府交底", descZh: "你把掌握的情形报给了市署，查账的方向因你而变。", importance: 2 },
      causal: { textZh: "你的话改变了官府查账的方向。", effectsZh: ["裴衡把你当成了可用的耳目", "绢行有人恨你入骨"], openedZh: ["官府的庇护"], closedZh: ["与崔九转圜的余地"] },
    },
    take_risk: {
      moneyDelta: 400, reputationDelta: 0, healthDelta: -8,
      npcEffects: [
        { npcId: "he_shisan", trustDelta: 6, memoryZh: "火中取栗还能全身而退，是个人物" },
        { npcId: "cui_jiu", trustDelta: -6, fearDelta: 4 },
      ],
      tensionDeltas: { street_danger: 2 },
      rumorAddZh: "听说灯夜里有人做了一票不见光的买卖，手脚干净得很。",
      timeline: { kind: "decision", titleZh: "火中取栗", descZh: "你在正灯的人潮里行了步大险棋，得了厚利，也磨破了皮肉。", importance: 2 },
      causal: { textZh: "你赌了一把，赢了钱，输了些安稳。", effectsZh: ["进账数百文", "身上添了暗伤"], openedZh: ["刀口上的门路"], closedZh: [] },
    },
    preserve_reputation: {
      moneyDelta: -100, reputationDelta: 5, healthDelta: 2,
      npcEffects: [
        { npcId: "shen_yanqiu", trustDelta: 4 },
        { npcId: "pei_heng", trustDelta: 4, respectDelta: 3 },
      ],
      timeline: { kind: "decision", titleZh: "滴水不漏", descZh: "风口浪尖上，你把自己的言行修得一丝不苟。", importance: 1 },
      causal: { textZh: "你在风波里守住了一身干净。", effectsZh: ["没有人能从你身上挑出错处"], openedZh: [], closedZh: ["浑水里的横财"] },
    },
    pursue_money: {
      moneyDelta: 350, reputationDelta: -3, healthDelta: 0, skillUp: "bargaining",
      npcEffects: [
        { npcId: "lvyao", trustDelta: -4, memoryZh: "她有难处时，你在数钱" },
        { npcId: "cui_jiu", trustDelta: -4 },
      ],
      timeline: { kind: "decision", titleZh: "盛市厚利", descZh: "你抓住正灯的行情狠做了一笔，落袋为安。", importance: 2 },
      causal: { textZh: "你把灯节当成了生意场。", effectsZh: ["进账数百文", "有人觉得你薄情"], openedZh: [], closedZh: [] },
    },
    pursue_status: {
      moneyDelta: -150, reputationDelta: 6, healthDelta: 0,
      npcEffects: [
        { npcId: "pei_heng", trustDelta: 6, respectDelta: 4 },
        { npcId: "shen_yanqiu", trustDelta: -3, memoryZh: "他眼里的功名心，重了些" },
      ],
      timeline: { kind: "decision", titleZh: "更上层楼", descZh: "你在贵人云集的场合站稳了位置，名字开始被人提起。", importance: 2 },
      causal: { textZh: "你向上攀的路走得更急了。", effectsZh: ["官面上有了你的名字", "老儒觉得你心浮"], openedZh: ["仕途的缝隙"], closedZh: [] },
    },
    pursue_art: {
      moneyDelta: 100, reputationDelta: 6, healthDelta: 0, skillUp: "letters",
      npcEffects: [{ npcId: "shen_yanqiu", trustDelta: 12, respectDelta: 8, memoryZh: "灯下那一篇，他批了'可传'二字" }],
      rumorAddZh: "灯会上出了篇好文字，懂行的都在传抄。",
      timeline: { kind: "milestone", titleZh: "灯下一鸣", descZh: "你的文字在灯会上被人传抄，连不识字的都听过了你的名。", importance: 2 },
      causal: { textZh: "你的笔替你敲开了门。", effectsZh: ["文名渐起", "润笔进账百文"], openedZh: ["士林的目光"], closedZh: [] },
    },
    observe_wait: {
      moneyDelta: 30, reputationDelta: 0, healthDelta: 2, skillUp: "streetwise",
      npcEffects: [{ npcId: "pei_heng", trustDelta: 2 }],
      timeline: { kind: "decision", titleZh: "冷眼旁观", descZh: "满城喧腾里你按兵不动，看清了几张藏在灯影后的脸。", importance: 1 },
      causal: { textZh: "你退后一步，反而看见了全局。", effectsZh: ["认出了暗中往来的几方人马"], openedZh: ["先手"], closedZh: [] },
    },
  },
  // ============ 第三章 · 收灯 ============
  3: {
    seek_patronage: {
      moneyDelta: -200, reputationDelta: 2, healthDelta: 0,
      npcEffects: [
        { npcId: "he_shisan", trustDelta: 8, memoryZh: "最后关头还是来求她，她受用这个" },
      ],
      timeline: { kind: "opportunity", titleZh: "最后的人情", descZh: "收灯前夜，你把压箱底的人情都摆上了桌。", importance: 2 },
      causal: { textZh: "你借来的力替你挡了最险的一刀。", effectsZh: ["何十三娘替你设了局"], openedZh: ["体面收场的路"], closedZh: [] },
    },
    protect_someone: {
      moneyDelta: -300, reputationDelta: 5, healthDelta: -2,
      npcEffects: [
        { npcId: "lvyao", trustDelta: 15, memoryZh: "到了最后，你还是把她护在了身后" },
        { npcId: "pei_heng", trustDelta: -3 },
      ],
      timeline: { kind: "relationship", titleZh: "以身相护", descZh: "灯落之际，你拿自己的前程与钱财换了别人的安身。", importance: 3 },
      causal: { textZh: "你最后的筹码花在了别人身上。", effectsZh: ["绿腰的身契赎了出来", "你自己的路窄了一截"], openedZh: ["一生一诺的情义"], closedZh: ["独占的好处"] },
    },
    conceal_info: {
      moneyDelta: 200, reputationDelta: -2, healthDelta: 0,
      npcEffects: [
        { npcId: "cui_jiu", trustDelta: 6, memoryZh: "他与你之间有了见不得光的默契" },
        { npcId: "pei_heng", trustDelta: -8, fearDelta: 0 },
      ],
      tensionDeltas: { official_scrutiny: 2 },
      timeline: { kind: "decision", titleZh: "瞒天过海", descZh: "你把真相按进了水底，拿沉默换了实利。", importance: 3 },
      causal: { textZh: "你选择与秘密共存。", effectsZh: ["得了封口的好处", "官府的疑心埋进了土里，没有死"], openedZh: [], closedZh: ["把真相大白于市的机会"] },
    },
    reveal_info: {
      moneyDelta: 0, reputationDelta: 6, healthDelta: 0,
      npcEffects: [
        { npcId: "pei_heng", trustDelta: 12, respectDelta: 8, memoryZh: "结案的关键出自你手，他记你一功" },
        { npcId: "cui_jiu", trustDelta: -15, fearDelta: 8 },
      ],
      tensionDeltas: { guild_dispute: -2, official_scrutiny: -1 },
      timeline: { kind: "consequence", titleZh: "真相大白", descZh: "你把握着的凭据摆上了市署的案头，失账一案就此了结。", importance: 3 },
      causal: { textZh: "你把真相交给了官法。", effectsZh: ["失账案结了", "崔九的算计落了空"], openedZh: ["官府的赏识"], closedZh: ["崔九的算计"] },
    },
    take_risk: {
      moneyDelta: 600, reputationDelta: 0, healthDelta: -12,
      npcEffects: [
        { npcId: "cui_jiu", trustDelta: -8, fearDelta: 8, memoryZh: "夹道那一夜，他没能讨到便宜" },
        { npcId: "he_shisan", trustDelta: 4 },
      ],
      tensionDeltas: { street_danger: 2 },
      timeline: { kind: "decision", titleZh: "孤注一掷", descZh: "你只身赴了那场暗巷之约，赢下了最大的一注。", importance: 3 },
      causal: { textZh: "你把性命押上了桌面。", effectsZh: ["得了大注的钱财", "落下了不轻的伤"], openedZh: [], closedZh: ["回头的路"] },
    },
    preserve_reputation: {
      moneyDelta: 0, reputationDelta: 6, healthDelta: 3,
      npcEffects: [
        { npcId: "shen_yanqiu", trustDelta: 5 },
        { npcId: "pei_heng", trustDelta: 3, respectDelta: 4 },
      ],
      timeline: { kind: "decision", titleZh: "全身而退", descZh: "风波收束时，你周身上下没有沾一点泥。", importance: 2 },
      causal: { textZh: "你守住了最难守的东西——分寸。", effectsZh: ["满市说起你，都道一声'稳当'"], openedZh: [], closedZh: ["险中求来的富贵"] },
    },
    pursue_money: {
      moneyDelta: 500, reputationDelta: -4, healthDelta: 0,
      npcEffects: [
        { npcId: "lvyao", trustDelta: -5, memoryZh: "她终于明白你心里的秤往哪边沉" },
        { npcId: "he_shisan", trustDelta: 3 },
      ],
      timeline: { kind: "decision", titleZh: "落袋为安", descZh: "收灯之际你把每一文利都收进了囊中，一文不让。", importance: 2 },
      causal: { textZh: "你把这七日灯火换算成了铜钱。", effectsZh: ["囊中丰实", "有几双眼睛冷了下来"], openedZh: [], closedZh: [] },
    },
    pursue_status: {
      moneyDelta: -200, reputationDelta: 8, healthDelta: 0,
      npcEffects: [
        { npcId: "pei_heng", trustDelta: 8, respectDelta: 6, memoryZh: "他在上官面前提了你的名字" },
      ],
      timeline: { kind: "milestone", titleZh: "青云有路", descZh: "灯节收束时，你的名字已经写进了某份呈给上面的名单。", importance: 3 },
      causal: { textZh: "你把灯节走成了进身之阶。", effectsZh: ["官面上有了你的位置"], openedZh: ["更大的局"], closedZh: [] },
    },
    pursue_art: {
      moneyDelta: 50, reputationDelta: 7, healthDelta: 0, skillUp: "letters",
      npcEffects: [
        { npcId: "shen_yanqiu", trustDelta: 10, respectDelta: 6, memoryZh: "他说，这一篇他要留在书肆里" },
      ],
      timeline: { kind: "milestone", titleZh: "收灯之作", descZh: "你以一篇文字收束七日灯火，懂的人都说写尽了这一市悲欢。", importance: 3 },
      causal: { textZh: "你把这七日活成了一篇文章。", effectsZh: ["文字传出了东市"], openedZh: ["留名的可能"], closedZh: [] },
    },
    observe_wait: {
      moneyDelta: 50, reputationDelta: 0, healthDelta: 2,
      npcEffects: [],
      timeline: { kind: "decision", titleZh: "静水深流", descZh: "到最后你也没有亮出全部底牌，安静地看灯落了幕。", importance: 1 },
      causal: { textZh: "你选择把一些话带出灯节。", effectsZh: ["没人知道你究竟知道多少"], openedZh: [], closedZh: [] },
    },
  },
};

/** State-conditioned fragments appended to scene prose so offline play visibly reflects state. */
export interface ConditionalFragment {
  /** Returns the line, or null if the condition doesn't hold. */
  check: (s: {
    money: number;
    reputation: number;
    health: number;
    trust: Record<NpcId, number>;
    statuses: StatusId[];
  }) => string | null;
}

export const CONDITIONAL_FRAGMENTS: ConditionalFragment[] = [
  { check: (s) => (s.trust.pei_heng >= 15 ? "裴衡看你的眼神，已不似先前那般冷。" : null) },
  { check: (s) => (s.trust.lvyao >= 25 ? "绿腰远远望见你，眼里有了依靠之色。" : null) },
  { check: (s) => (s.trust.shen_yanqiu >= 35 ? "沈砚秋待你，已有了几分托付衣钵的意思。" : null) },
  { check: (s) => (s.trust.cui_jiu <= -25 ? "崔九看你的目光里，忌惮多过了轻蔑。" : null) },
  { check: (s) => (s.reputation <= -8 ? "市井间已有人对你指指点点。" : null) },
  { check: (s) => (s.reputation >= 15 ? "如今你走在市里，常有人主动与你见礼。" : null) },
  { check: (s) => (s.money <= 100 ? "你囊中所剩无几，连一碗汤饼都要掂量。" : null) },
  { check: (s) => (s.health <= 50 ? "伤处隐隐作痛，你撑着不让人看出来。" : null) },
  { check: (s) => (s.statuses.includes("holds_ledger_page") ? "袖中那页纸，贴着皮肉，烫得像一块炭。" : null) },
  { check: (s) => (s.statuses.includes("sheltering_friend") ? "你护着的人还藏在你的羽翼之下，一步不敢错。" : null) },
];
