/** Static content definition shapes (authored, typechecked — no Zod needed). */
import type {
  AccessTag,
  IdentityId,
  LocationId,
  NpcId,
  PresetId,
  SkillId,
  StatusId,
  TensionId,
} from "@shared/constants";

export interface LocationDef {
  id: LocationId;
  nameZh: string;
  descZh: string;
  visualPresetId: PresetId;
  /** Only market_office gates access. */
  requiresOfficeAccess: boolean;
  dangerLevel: 0 | 1 | 2;
}

export interface NpcDef {
  id: NpcId;
  nameZh: string;
  roleZh: string;
  /** Hidden from the client; visible to the Director. */
  motivationZh: string;
  /** Initial hidden agenda. */
  agendaZh: string;
  baseTrust: number;
  baseFear: number;
  baseRespect: number;
}

export interface IdentityDef {
  id: IdentityId;
  nameZh: string;
  /** Single kaiti glyph for the identity card. */
  glyphZh: string;
  cardLineZh: string;
  /** Default player name (player can override at session creation). */
  defaultNameZh: string;
  age: number;
  openingHookZh: string;
  start: {
    location: LocationId;
    money: number;
    health: number;
    reputation: number;
    skills: Partial<Record<SkillId, number>>;
    accessTags: AccessTag[];
    statuses: StatusId[];
  };
  npcPriors: Record<NpcId, { trust: number; noteZh: string }>;
  tensionBias: Partial<Record<TensionId, number>>;
  /** Identity-specific plausibility lines, injected verbatim into the prompt. */
  forbiddenZh: string[];
  /** Grounds the report's "what success could have meant". */
  goalSeedsZh: string[];
}

export interface EraBible {
  id: string;
  titleZh: string;
  subtitleZh: string;
  periodZh: string;
  premiseZh: string;
  introZh: string;
  factionsZh: { nameZh: string; agendaZh: string; tensionWithZh: string }[];
  institutionsZh: string[];
  dangersZh: string[];
  opportunitiesZh: string[];
  plausibilityRulesZh: string[];
  toneZh: string;
  visualMotifsZh: string[];
  /** Four seed rumors shown on the era intro screen and woven into play. */
  seedRumorsZh: string[];
}
