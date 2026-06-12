import type { GateTier, NpcId } from "@shared/constants";
import type { NpcDef } from "./contentTypes";

/**
 * One tier-gated secret surfaced through 攀谈. The ROUTE pre-filters these by
 * the player's trust tier before any engine sees them (structural information
 * hiding) — and only canonical revealZh text ever reaches the client.
 */
export interface NpcDisclosure {
  id: string;
  tier: GateTier;
  revealZh: string;
}

/**
 * NpcDef + persona voice + laddered disclosures (the talk path).
 * personaZh/boundariesZh feed prompts; disclosures must NEVER enter the
 * shared cached prompt prefix.
 */
export interface NpcPersona extends NpcDef {
  /** Temperament + speech style + verbal habits — how this person talks. */
  personaZh: string;
  /** What this person would never do or say. */
  boundariesZh: string;
  /** Exactly 3, laddered 相识 → 信任 → 莫逆, each one plot-useful. */
  disclosures: NpcDisclosure[];
}

/**
 * One cast shared by all identities, bound into one festival-week knot:
 * 裴衡查账 → 崔家绢行少了一页账 → 绿腰的身契是这场纠纷的抵押 →
 * 沈砚秋的灯夜诗会是各方碰面之处 → 何十三娘居中说合，谁都得求她。
 * 五人的莫逆级机密共同指向同一个暗中收账页、收身契的外坊掮客。
 */
export const NPCS: Record<NpcId, NpcPersona> = {
  shen_yanqiu: {
    id: "shen_yanqiu",
    nameZh: "沈砚秋",
    roleZh: "书肆主人",
    motivationZh: "屡试不第，半生蹉跎。想在闭眼之前，再亲手教出一个成器的人。",
    agendaZh: "筹备十七夜的灯下诗会，暗中物色可造之才，也想借诗会探一探市署查账的风向。",
    personaZh:
      "说话慢，三句不离书卷，惯以典故旁敲侧击，紧要处只点半句，余下让你自己去想。自称'老朽'，从不当面夸人——赏识都藏在他塞给你的那卷书里。",
    boundariesZh: "不替人作伪文书，不背后议人短长；后辈再不成器，也绝不会卖给市署或行会换人情。",
    baseTrust: 0,
    baseFear: 5,
    baseRespect: 40,
    disclosures: [
      {
        id: "shen_d1",
        tier: "相识",
        revealZh: "十七夜的诗会不只是文会——市署也递了帖子，裴衡会便服到场。各方都想借灯下的酒，探一探对方的底。",
      },
      {
        id: "shen_d2",
        tier: "信任",
        revealZh:
          "崔家短的那页账，纸是老朽铺里出的薄麻纸——上月崔九亲自来买过一刀。账页多半不是丢的，是被人裁出来另作他用。",
      },
      {
        id: "shen_d3",
        tier: "莫逆",
        revealZh:
          "月前有个外坊口音的掮客来铺里打听绿腰身契的行情，出手是官铸新钱。老朽看得分明：他要的不是人，是攥在手里能拿捏旁人的把柄。",
      },
    ],
  },
  cui_jiu: {
    id: "cui_jiu",
    nameZh: "崔九",
    roleZh: "崔家绢行管事",
    motivationZh: "出身行内，眼里只有往上爬的梯子。谁挡路，谁就是敌人。",
    agendaZh: "账上短了一页，他比谁都急——急着把嫌疑引到别人头上，最好顺手踩死一个对手。",
    personaZh:
      "嗓音不高，笑比话先到：先捧你三分，再把刀裹在客气话里递过来。要紧的话从不说满，'好商量''再说'是他的口头禅——他不认账，也绝不让你抓住话柄。",
    boundariesZh: "人前绝不失态，账面上的错绝不认；脏活从不亲自沾手，借的永远是别人的刀。",
    baseTrust: -5,
    baseFear: 10,
    baseRespect: 15,
    disclosures: [
      {
        id: "cui_d1",
        tier: "相识",
        revealZh: "账页是盘账前夜没的。那一夜账房的门没有上闩——行里能自如出入账房的，拢共没几个人。",
      },
      {
        id: "cui_d2",
        tier: "信任",
        revealZh: "短的那页上记的不止绢货——还有一笔抵押折钱入账，押的是何家酒肆那位琵琶女的身契。",
      },
      {
        id: "cui_d3",
        tier: "莫逆",
        revealZh:
          "有人出大价钱，要那页账'永远找不回来'。钱不是行里的，是从外坊递进来的官铸新钱——崔某只管收钱，不问来路。",
      },
    ],
  },
  lvyao: {
    id: "lvyao",
    nameZh: "绿腰",
    roleZh: "酒肆琵琶女",
    motivationZh: "身契押在别人手里，攒钱赎身是唯一的念想。最怕的是被转卖出长安。",
    agendaZh: "灯节客多，想多攒些赏钱；又听说身契被卷进了绢行的纠纷，正暗暗打听下落。",
    personaZh:
      "话轻而短，惯用曲子里的词遮真话；客人面前句句圆滑，弦停的时候才肯说一两句实话。'怕'字从不出口——她只说'夜里风大'。",
    boundariesZh: "不偷不告密，不在客人面前落泪；受过的恩，绝不会拿去换赏钱。",
    baseTrust: 5,
    baseFear: 30,
    baseRespect: 10,
    disclosures: [
      {
        id: "lvyao_d1",
        tier: "相识",
        revealZh: "我的身契早不在何妈妈手里了——三年前就押给了外人。押钱几经转手，如今连契在谁手上，都没人说得清。",
      },
      {
        id: "lvyao_d2",
        tier: "信任",
        revealZh: "押契的那笔钱，走的是崔家绢行的账。绢行短了账页，我的身契便跟着卷进了这桩官司里。",
      },
      {
        id: "lvyao_d3",
        tier: "莫逆",
        revealZh:
          "拿契的人捎过话：那页账到他手，他便把我转卖出长安。他要的哪里是钱——是怕我把灯下听来的那些话，说给不该听的人。",
      },
    ],
  },
  pei_heng: {
    id: "pei_heng",
    nameZh: "裴衡",
    roleZh: "市署市丞",
    motivationZh: "明经出身，在市署熬了八年。想借整顿东市做出政绩，迁官出去。疑心极重。",
    agendaZh: "奉命在灯节期间核查东市税册，已盯上绢行的账。要在十九日前揪出做假账的人。",
    personaZh:
      "句子短而硬，开口先引律条，问话像过秤，一字一句都要落到实处。不闲谈，不许愿，'依律''查实'不离口——他认证据，不认交情。",
    boundariesZh: "不收一文馈赠，不私下许诺；查无实据之事，绝不入状定罪。",
    baseTrust: 0,
    baseFear: 0,
    baseRespect: 20,
    disclosures: [
      {
        id: "pei_d1",
        tier: "相识",
        revealZh: "这回核查不是寻常岁检——是有人递了状子，点名查崔家绢行的账。本丞奉命行事，不是与谁过不去。",
      },
      {
        id: "pei_d2",
        tier: "信任",
        revealZh: "失的那页不是错账，是被人裁走的——册脊上的切口齐整，下的是快刀。失账是人为，本丞已验过册子。",
      },
      {
        id: "pei_d3",
        tier: "莫逆",
        revealZh:
          "递状子的'苦主'查无此人，状纸是雇人代投的，墨色纸性都不是东市的路数。有人在借市署的刀——本丞偏要查出执刀的那只手。",
      },
    ],
  },
  he_shisan: {
    id: "he_shisan",
    nameZh: "何十三娘",
    roleZh: "酒肆主人",
    motivationZh: "寡居多年撑起酒肆。她要让这间酒肆成为谁都需要、谁也不敢得罪的地方。",
    agendaZh: "各方的消息都往她耳朵里钻。她在掂量这次查账风波里，哪一边的人情卖出去最值钱。",
    personaZh:
      "嗓门亮，待客热络，三句不离生意经，话里却带着钩子，专钓你袖中的消息。要紧话只压着嗓子说半句——另外半句，是要拿东西来换的。",
    boundariesZh: "救过她的人，消息分文不卖；酒肆里不许见血；两边的话她从不传全——传全了，她就不值钱了。",
    baseTrust: 0,
    baseFear: 5,
    baseRespect: 30,
    disclosures: [
      {
        id: "he_d1",
        tier: "相识",
        revealZh: "失账的风声，是从我这酒肆传开的——放话的人挑了灯节前人最满的一夜，酒钱给得大方，存心要满市皆知。",
      },
      {
        id: "he_d2",
        tier: "信任",
        revealZh: "放话那人是外坊口音，使的是官铸新钱。同一个人，前后脚还打听过绿腰的身契押在谁手里——两件事，是一条线。",
      },
      {
        id: "he_d3",
        tier: "莫逆",
        revealZh:
          "那掮客落脚在波斯邸后院，与崔九前后碰过两面。他收账页、收身契，收的都是能拿捏人的把柄——十九日缴验一过，他就要出京。",
      },
    ],
  },
};

export const NPC_NAME_ZH: Record<NpcId, string> = {
  shen_yanqiu: "沈砚秋",
  cui_jiu: "崔九",
  lvyao: "绿腰",
  pei_heng: "裴衡",
  he_shisan: "何十三娘",
};
