/**
 * Client-side mirror of the server's choice affordability rule, derived from
 * the redacted SessionView only (raw trust never reaches the client — tier
 * gates compare presentation tiers). The server re-checks at pick time; this
 * exists so locked slips render locked instead of bouncing off a 422.
 */
import { TIER_RANK, type TrustTier } from "@shared/constants";
import type { Choice, SessionView } from "@shared/types";

export interface CostChip {
  text: string;
  kind: "money" | "stamina" | "gate";
}

export interface ChoiceAffordance {
  locked: boolean;
  /** "" when not locked. */
  reasonZh: string;
  chips: CostChip[];
}

export function choiceAffordance(view: SessionView, c: Choice): ChoiceAffordance {
  const chips: CostChip[] = [];
  if (c.moneyCost > 0) chips.push({ text: `费${c.moneyCost}文`, kind: "money" });
  if (c.staminaCost > 0) chips.push({ text: "耗体力", kind: "stamina" });
  if (c.minReputation > -100) chips.push({ text: "需声望", kind: "gate" });

  let gateNpcName = "";
  if (c.minTrustNpcId !== "" && c.minTrustTier !== "") {
    const npc = view.npcs.find((n) => n.id === c.minTrustNpcId);
    gateNpcName = npc?.nameZh ?? "";
    chips.push({ text: `需${c.minTrustTier}·${gateNpcName}`, kind: "gate" });
  }

  let reasonZh = "";
  if (view.player.money < c.moneyCost) reasonZh = "盘缠不够";
  else if (c.staminaCost > 0 && view.player.health <= c.staminaCost) reasonZh = "体力不支";
  else if (view.player.reputation < c.minReputation) reasonZh = "声望不足";
  else if (c.minTrustNpcId !== "" && c.minTrustTier !== "") {
    const npc = view.npcs.find((n) => n.id === c.minTrustNpcId);
    const tier: TrustTier = npc?.tier ?? "冷淡";
    if (TIER_RANK[tier] < TIER_RANK[c.minTrustTier]) reasonZh = "交情未到";
  }

  return { locked: reasonZh !== "", reasonZh, chips };
}
