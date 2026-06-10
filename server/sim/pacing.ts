import { DAY_FLOORS, MAX_TURN, TIMES_OF_DAY, type IdentityId, type TimeOfDay } from "@shared/constants";
import type { QueuedEvent } from "@shared/types";

export { MAX_TURN };

/**
 * Festival-week spine, seeded into the event queue at session start.
 * These guarantee the demo bar (recurring NPC arc, visible consequence chain)
 * regardless of engine variance — the Director weaves them, it doesn't invent them.
 */
export function seedEvents(identityId: IdentityId): QueuedEvent[] {
  const angle: Record<IdentityId, string> = {
    scholar: "有人在书肆里议论：绢行那页失账，怕要牵连无辜之人。",
    apprentice: "行里传开了：短的那页账，记的正是你经手的几笔货。",
    interpreter: "胡商间风传：失账与波斯邸悬着的货款有关，译契之人难脱干系。",
    copyist: "捎话的人又来了：那页'要紧的账'，愿出重金藏进经卷。",
  };
  const mk = (id: string, dueTurn: number, hintZh: string): QueuedEvent => ({
    id,
    hintZh,
    dueTurn,
    status: "pending",
    source: "seed",
  });
  return [
    mk("seed_ledger_rumor", 2, angle[identityId]),
    mk("seed_audit_notice", 3, "市署在市楼张榜：灯节期间核查各行税册，市丞裴衡亲自坐镇。"),
    mk("seed_audit_personal", 4, "查账的目光落到了你身上——裴衡的人点名要问你的话。"),
    mk("seed_lvyao_crisis", 6, "绿腰的身契被人当作绢行纠纷的抵押要走了——她今夜可能被带离酒肆。"),
    mk("seed_poetry_night", 7, "沈砚秋的灯下诗会就在今夜，各方人物都会到场。"),
    mk("seed_harvest", 8, "灯节将尽，你此前的所作所为开始结出果实——该来的人和事都找上门了。"),
    mk("seed_finale", 10, "正月十九，收灯。失账风波必须在今日了结，每个人都要付出代价或得到报偿。"),
  ];
}

/** Advance timeOfDay by `steps`, returning the new time and how many day boundaries were crossed. */
export function advanceTime(current: TimeOfDay, steps: 0 | 1 | 2): { timeOfDay: TimeOfDay; daysCrossed: number } {
  const idx = TIMES_OF_DAY.indexOf(current);
  const raw = idx + steps;
  return {
    timeOfDay: TIMES_OF_DAY[raw % TIMES_OF_DAY.length] as TimeOfDay,
    daysCrossed: Math.floor(raw / TIMES_OF_DAY.length),
  };
}

/** Apply the day floor for a turn: the festival must reach 正月十九 by turn 10. */
export function floorDay(day: number, turn: number): number {
  const floor = DAY_FLOORS[Math.min(turn, DAY_FLOORS.length - 1)] ?? 1;
  return Math.min(7, Math.max(day, floor));
}
