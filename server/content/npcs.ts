import type { NpcId } from "@shared/constants";
import type { NpcDef } from "./contentTypes";

/**
 * One cast shared by all identities, bound into one festival-week knot:
 * 裴衡查账 → 崔家绢行少了一页账 → 绿腰的身契是这场纠纷的抵押 →
 * 沈砚秋的灯夜诗会是各方碰面之处 → 何十三娘居中说合，谁都得求她。
 */
export const NPCS: Record<NpcId, NpcDef> = {
  shen_yanqiu: {
    id: "shen_yanqiu",
    nameZh: "沈砚秋",
    roleZh: "书肆主人",
    motivationZh: "屡试不第，半生蹉跎。想在闭眼之前，再亲手教出一个成器的人。",
    agendaZh: "筹备十七夜的灯下诗会，暗中物色可造之才，也想借诗会探一探市署查账的风向。",
    baseTrust: 0,
    baseFear: 5,
    baseRespect: 40,
  },
  cui_jiu: {
    id: "cui_jiu",
    nameZh: "崔九",
    roleZh: "崔家绢行学徒",
    motivationZh: "出身行内，眼里只有往上爬的梯子。谁挡路，谁就是敌人。",
    agendaZh: "账上短了一页，他比谁都急——急着把嫌疑引到别人头上，最好顺手踩死一个对手。",
    baseTrust: -5,
    baseFear: 10,
    baseRespect: 15,
  },
  lvyao: {
    id: "lvyao",
    nameZh: "绿腰",
    roleZh: "酒肆琵琶女",
    motivationZh: "身契押在别人手里，攒钱赎身是唯一的念想。最怕的是被转卖出长安。",
    agendaZh: "灯节客多，想多攒些赏钱；又听说身契被卷进了绢行的纠纷，正暗暗打听下落。",
    baseTrust: 5,
    baseFear: 30,
    baseRespect: 10,
  },
  pei_heng: {
    id: "pei_heng",
    nameZh: "裴衡",
    roleZh: "市署市丞",
    motivationZh: "明经出身，在市署熬了八年。想借整顿东市做出政绩，迁官出去。疑心极重。",
    agendaZh: "奉命在灯节期间核查东市税册，已盯上绢行的账。要在十九日前揪出做假账的人。",
    baseTrust: 0,
    baseFear: 0,
    baseRespect: 20,
  },
  he_shisan: {
    id: "he_shisan",
    nameZh: "何十三娘",
    roleZh: "酒肆主人",
    motivationZh: "寡居多年撑起酒肆。她要让这间酒肆成为谁都需要、谁也不敢得罪的地方。",
    agendaZh: "各方的消息都往她耳朵里钻。她在掂量这次查账风波里，哪一边的人情卖出去最值钱。",
    baseTrust: 0,
    baseFear: 5,
    baseRespect: 30,
  },
};

export const NPC_NAME_ZH: Record<NpcId, string> = {
  shen_yanqiu: "沈砚秋",
  cui_jiu: "崔九",
  lvyao: "绿腰",
  pei_heng: "裴衡",
  he_shisan: "何十三娘",
};
