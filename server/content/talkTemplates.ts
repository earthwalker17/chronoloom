/**
 * Deterministic 攀谈 replies for the ScriptedDirector (offline mode AND the
 * live-engine fallback). One authored line per NPC per trust tier, in voice;
 * the first tier-qualified, not-yet-revealed disclosure rides along as
 * revealZh. Zero RNG — same state, same exchange.
 */
import type { NpcId, TrustTier } from "@shared/constants";
import type { SessionState } from "@shared/types";
import type { TalkContext, TalkResult } from "../engine/director";

const TALK_LINES: Record<NpcId, Record<TrustTier, string>> = {
  shen_yanqiu: {
    冷淡: "老朽眼拙，足下是……？灯市人杂，恕不多陪。",
    相识: "又见面了。灯下读书人少，肯驻足说话的更少。",
    信任: "你来得正好，方才还想起你。近日市中不太平，凡事多个心眼。",
    莫逆: "坐。听老朽一句——你走的路，比你自己以为的更远。",
  },
  cui_jiu: {
    冷淡: "哟，什么风把你吹来了？无事献殷勤……呵。",
    相识: "有话快说，行里正忙。",
    信任: "你倒是个明白人。明白人，崔某向来不亏待。",
    莫逆: "进来说。外头耳目多。",
  },
  lvyao: {
    冷淡: "客官想听什么曲子？……只是听曲，旁的莫问。",
    相识: "是你呀。今夜的弦有些哑，将就着听罢。",
    信任: "灯下人来人往，肯真心说话的没几个——你算一个。",
    莫逆: "我把不敢同旁人说的都同你说了，你可莫负我。",
  },
  pei_heng: {
    冷淡: "市署重地，闲人莫近。有状投状，无状退下。",
    相识: "是你。何事？长话短说。",
    信任: "近来市中的风向，你比许多人看得清。说罢。",
    莫逆: "此话出我口，入你耳，再无第三人知。",
  },
  he_shisan: {
    冷淡: "客官面生得很。先吃酒，吃好了再说话。",
    相识: "又来啦？老位子。今日有新到的烧春。",
    信任: "坐近些，有几句话，旁的桌子听不得。",
    莫逆: "这酒肆的门，往后夜里也为你开着。",
  },
};

const TALK_MEMORY: Record<TrustTier, string> = {
  冷淡: "同你搭过几句话，不咸不淡",
  相识: "与你攀谈了几句，多了几分眼熟",
  信任: "灯下与你交了几句心",
  莫逆: "又同你说了些掏心窝的话",
};

export function scriptedTalk(_state: SessionState, ctx: TalkContext): TalkResult {
  const reveal = ctx.allowedDisclosures.find((d) => !ctx.alreadyRevealedIds.includes(d.id));
  return {
    lineZh: TALK_LINES[ctx.npcId][ctx.tier],
    followUpZh: "",
    revealZh: reveal?.revealZh ?? "",
    trustDelta: reveal ? 2 : 1,
    memoryZh: TALK_MEMORY[ctx.tier],
  };
}
