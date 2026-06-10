/**
 * Renders a visible-consequence line (consequenceRecapZh) from a sanitized
 * update — the offline engine's guarantee that every turn shows "because you
 * did X, Y changed", even with no model in the loop.
 */
import type { ActionTag } from "@shared/constants";
import { NPC_NAME_ZH } from "../content/npcs";
import type { TurnUpdate } from "@shared/types";

const TAG_OPENERS: Record<ActionTag, string> = {
  seek_patronage: "你昨日攀的关系起了作用",
  protect_someone: "你出手相护的事已经传开",
  conceal_info: "你按下不表的那件事暂时无人知晓",
  reveal_info: "你说出口的话已经传到了该听的人耳中",
  take_risk: "你昨日行的险棋有了动静",
  preserve_reputation: "你处处求稳的做派被人看在眼里",
  pursue_money: "你昨日的盘算见了真章",
  pursue_status: "你向上走的心思有人注意到了",
  pursue_art: "你笔下的心血开始替你说话",
  observe_wait: "你按兵不动，局面却没有停",
};

export function renderRecap(prevTag: ActionTag, update: TurnUpdate): string {
  const parts: string[] = [];
  if (update.moneyDelta >= 100) parts.push(`进账${update.moneyDelta}文`);
  else if (update.moneyDelta <= -100) parts.push(`破费了${-update.moneyDelta}文`);
  if (update.reputationDelta >= 3) parts.push("名声涨了几分");
  else if (update.reputationDelta <= -3) parts.push("名声折损了几分");
  if (update.healthDelta <= -8) parts.push("身上添了伤病");

  let biggest: { name: string; delta: number } | null = null;
  for (const n of update.npcUpdates) {
    if (!biggest || Math.abs(n.trustDelta) > Math.abs(biggest.delta)) {
      biggest = { name: NPC_NAME_ZH[n.npcId], delta: n.trustDelta };
    }
  }
  if (biggest && Math.abs(biggest.delta) >= 5) {
    parts.push(biggest.delta > 0 ? `${biggest.name}待你近了几分` : `${biggest.name}对你冷了几分`);
  }

  const opener = TAG_OPENERS[prevTag];
  return parts.length ? `${opener}：${parts.join("，")}。` : `${opener}，只是回响还在路上。`;
}
