import type { LocationId } from "@shared/constants";
import type { LocationDef } from "./contentTypes";

export const LOCATIONS: Record<LocationId, LocationDef> = {
  market_cross: {
    id: "market_cross",
    nameZh: "市楼十字",
    descZh: "东市正中的市楼之下，悬鼓张榜之处。开市的鼓声、官府的告示、看热闹的人群，都聚在这里。",
    visualPresetId: "market_street",
    requiresOfficeAccess: false,
    dangerLevel: 1,
  },
  silk_row: {
    id: "silk_row",
    nameZh: "绢行街",
    descZh: "崔家绢行领头的绸缎街市，幡子层层叠叠。行会的规矩比官法更近身。",
    visualPresetId: "stall_row",
    requiresOfficeAccess: false,
    dangerLevel: 0,
  },
  wine_house: {
    id: "wine_house",
    nameZh: "何家酒肆",
    descZh: "何十三娘的酒肆，胡汉商客与坊间闲人混坐。在这里，消息比酒更醉人。",
    visualPresetId: "teahouse_porch",
    requiresOfficeAccess: false,
    dangerLevel: 0,
  },
  persian_lodge: {
    id: "persian_lodge",
    nameZh: "波斯邸",
    descZh: "胡商聚居的邸店，驼铃与香料气息不断。货款、行情与远方的传闻在此流通。",
    visualPresetId: "gate_plaza",
    requiresOfficeAccess: false,
    dangerLevel: 1,
  },
  bookshop: {
    id: "bookshop",
    nameZh: "沈记书肆",
    descZh: "沈砚秋的书肆，纸墨气息安静。落第的文人在此饮茶论诗，等待一个迟来的机会。",
    visualPresetId: "back_alley",
    requiresOfficeAccess: false,
    dangerLevel: 0,
  },
  temple_hall: {
    id: "temple_hall",
    nameZh: "兴善寺别院",
    descZh: "寺院在东市旁的别院，抄经与法会之所。香火安稳，墙外灯市喧嚣恍如另一个世界。",
    visualPresetId: "back_alley",
    requiresOfficeAccess: false,
    dangerLevel: 0,
  },
  market_office: {
    id: "market_office",
    nameZh: "市署",
    descZh: "市丞裴衡治事之所，度量衡与账册俱在于此。寻常人等，无事不得擅入。",
    visualPresetId: "gate_plaza",
    requiresOfficeAccess: true,
    dangerLevel: 2,
  },
  gate_lane: {
    id: "gate_lane",
    nameZh: "春明门夹道",
    descZh: "靠着春明门的窄巷，白日里走货，入夜后走一些不见光的事。",
    visualPresetId: "back_alley",
    requiresOfficeAccess: false,
    dangerLevel: 2,
  },
};

export function locationName(id: LocationId): string {
  return LOCATIONS[id].nameZh;
}
