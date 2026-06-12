# ARCHITECTURE.md — ChronoLoom

Living architecture notes for future sessions. **Update this file whenever architecture, data flow, component behavior, build process, or load-bearing assumptions change** (see CLAUDE.md §12). Task history lives in ROADMAP.md; this file describes how things *are*, not how they got here.

Current slice: 唐·长安东市·上元灯节七日 (Tang Chang'an East Market, 7-day Lantern Festival), Chinese content/UI, English code. As of the 2026-06-12 scene-native upgrade, the scene itself is the primary interaction surface: humanoid NPCs speak in-scene, are clickable (anchored choices + bounded 攀谈), stats gate and price choices, the 命书 ends with a real-player 镜中人, and sessions can run on Claude (primary), GPT, or DeepSeek.

## 1. Repo map

```
shared/            THE CONTRACT. Zod schemas + enums; everything imports from here.
  constants.ts       enums (incl. EngineId), clamp/pacing tables, CAPS (talk/cost/npcLine
                     bounds), actionTag→value map, trust tiers + TIER_RANK/GATE_TIERS
  schemas.ts         SessionState, Choice (costs/gates/anchor), DirectorTurn (strict,
                     npcLines), DirectorTurnWireSchema (grammar-compacted — see §5),
                     Talk{Body,ExchangeWire,Response}, LifeReport (+mirror), API DTOs
  types.ts           z.infer re-exports only
server/
  index.ts           entry: dotenv(override) → config → engine select → serve :8787
  app.ts             createApp({config,directors,defaultEngine,fallback,store}) — DI seam
  config.ts          env → AppConfig; 3 provider keys + models; default engine ladder
                     claude > openai > deepseek > scripted (explicit override wins)
  routes/            meta.ts (health incl. providers[] / meta) ·
                     sessions.ts (create[provider]/get/turn/talk/report)
  engine/
    director.ts        Director interface: startLife/takeTurn/talk/writeReport;
                       TalkContext (route-built, tier-pre-filtered disclosures)
    modelDirector.ts   ALL prompt/wire logic, parameterized by StructuredModelClient
    claudeDirector.ts  = ModelDirector + AnthropicClient (thin, keeps lastUsage)
    providers/
      types.ts           StructuredModelClient interface + proxy-aware fetch
      anthropicClient.ts verified live path (cached prefix, adaptive thinking, retry)
      openaiCompatClient.ts GPT (json_schema strict) / DeepSeek (json_object) + repair
    scriptedDirector.ts deterministic offline engine (incl. scripted talk)
    wire.ts            wire→strict sanitizer: parses packed extra/npcLines/causal strings
    prompts.ts         DIRECTOR_RULES (pricing/npcLines/voice), cached static block
                       (personas, NEVER disclosures), TALK_RULES + talk prompt,
                       REPORT_RULES (+镜中人 laws)
    select.ts          builds the directors map (lazy SDK imports)
  sim/               THE SIMULATION (pure functions, fully unit-tested)
    newSession.ts      identity → initial SessionState (seeded festival events)
    clamp.ts           anti-drift validator + affordability floor (≥2 pickable choices,
                       judged against the PROJECTED post-apply state); exports
                       affordableChoice/lockReason/snapshotOf/enforceAffordabilityFloor
    applyTurn.ts       pure reducer; choice costs land FIRST as their own clamped step;
                       resets talkedNpcIds; owns turn/chapter/day/tendencies
    pacing.ts          seeded spine events, time advance, day floors
    recap.ts           offline consequence-recap renderer
    reportGuard.ts     grounding incl. mirror (evidence-free themes drop; hollow
                       mirrors rebuilt from the lived record)
  store/             whole-state JSON per session; validate-on-read AND write; atomic
                     tmp+rename; per-id mutex; migrate.ts = migrate-on-read for
                     pre-upgrade saves (schemaVersion stays 1)
  content/           ALL Chinese game content: eraBible, locations(8), identities(4),
                     npcs(5: + personaZh/boundariesZh/disclosures×3), scriptedBeats
                     (+costs/anchors/npcLines), talkTemplates (offline 攀谈),
                     reportTemplates (+deterministic 镜中人)
  views.ts           SessionState → redacted SessionView (+npc inScene/canTalk)
client/
  src/App.tsx        phase machine + scene-interaction channels + report prefetch
  src/api.ts         typed fetch wrappers (+talk, provider) + localStorage save
  src/affordance.ts  client-side choice lock/cost-chip derivation (view-only data)
  src/platesStore.ts 60fps nameplate projections, isolated from React tree
  src/screens/       Landing (provider chips), EraIntro, IdentitySelect, Play
                     (popover/talk/bubble orchestration), Report (+镜中人, staged
                     reveal), DevScene (interaction knobs)
  src/components/    StatusStrip, ProsePanel, ChoiceList (cost chips, locked slips),
                     SpeechBubbles, NpcPopover, ReportForging, RelationshipPanel,
                     TimelineDrawer, WaitingOverlay, ShareCard, SceneCanvas
  src/scene/         FRAMEWORK-FREE Three.js diorama; public API = initDiorama →
                     DioramaHandle v2; figures.ts (humanoid builder), heroes.ts
                     (rigs/walk/gestures/protagonist), picking.ts (raycast), crowd.ts
                     (instanced humanoids), + renderer/lighting/camera/etc.
scripts/           e2e-playthrough.ts (in-process) · live-turn.ts (real API, 25 asserts)
                   · live-openai.ts (GPT/DeepSeek smoke) · grammar-probe.ts (wire-schema
                   ceiling bisection) · screenshot.ts (CDP headless Edge + clicks)
tests/             10 vitest suites (60 tests): sim/clamps/costs, talk fences +
                   tier filtering, migration (real fixtures), mirror guard, provider
                   config, OpenAICompat mocks, determinism, store atomicity
data/sessions/     saved lives (gitignored)
docs/screenshots/  captured via scripts/screenshot.ts
```

## 2. Runtime topology

```
dev:   vite :5173 ──proxy /api──▶ tsx watch server :8787      (npm run dev)
prod:  node serves dist/client AND /api on :8787              (npm run build && npm start)
```

Single root package.json, no workspaces. `@shared/*` path alias works in tsc, vite and vitest (three configs, keep in sync). No shell-prefixed env vars in npm scripts (Windows). All config via `.env`, which **overrides inherited shell vars** (`dotenv.config({override:true})` — deliberate, see §8.6).

## 3. User flow

```
入梦长安 (landing, night diorama, 执笔者 provider chips) → era intro (4 seed rumors) →
择身入世 (4 identity cards: 书/商/译/经) → play loop ×10 turns → 命书 (staged forging
overlay → staged section reveal incl. 镜中人)
```

Play screen = full-bleed diorama + overlays: status strip, prose 纸卷, choice 纸签
(3-4, cost chips 费X文/耗体力/需声望, locked slips show the reason), 人缘 panel,
浮生簿 drawer, 占卜 overlay during turns. **The scene itself is an interaction
surface**: focus NPCs are humanoid figures with nameplates and speech bubbles
(scene.npcLines); anchored, affordable choices make their figure glow; clicking a
figure opens an action popover (the anchored choice + 攀谈) and walks the visible
protagonist over. 攀谈 is a sub-turn exchange — once per NPC per turn, persona-voiced,
and the only channel through which tier-gated secrets surface. `?session=<id>`
resumes any life directly (also how screenshots of deep states are taken).

## 4. Turn pipeline (the core loop)

```
POST /sessions/:id/turn {choiceId, turn}
  → zod body parse → load state (validate-on-read + migrate-on-read)
  → turn fence (409 if stale)
  → resolve choiceId against state.scene.choices   ← anti-chatbot wall: ids only
  → affordability re-check (422 choice_locked)     ← talk can shift trust gates
  → collect due seeded events
  → runEngine(state.engine, takeTurn)              ← session-pinned provider
      (on failure: retry once → serve turn from ScriptedDirector, tagged in history)
  → clamp.ts      bound every delta, gate movement, force ≥1 causal entry,
                  fix choice count/diversity, bound costs/gates, clear anchors
                  not in focusNpcIds, cap npcLines (3×40, focus only),
                  AFFORDABILITY FLOOR: ≥2 choices pickable against the
                  PROJECTED post-apply state (chosen costs + update deltas)
  → applyTurn.ts  pure reducer: chosen.moneyCost/staminaCost deducted FIRST
                  (own clamped step — positive deltas can't mask costs),
                  then deltas, statuses, NPC trust/memory, rumors,
                  timeline+ledger, tendencies[chosenTag]++, talkedNpcIds=[],
                  turn/chapter/day (server-owned), ending checks
  → full SessionStateSchema.parse → atomic write → redacted SessionView

POST /sessions/:id/talk {npcId, turn}              ← SUB-TURN: no turn/tendency/
  → fences: 409 stale · 422 finished/npc_absent/already_talked     timeline mutation
  → route computes tier + filters NPCS[npcId].disclosures to earned, unrevealed
    ones  ← STRUCTURAL secret hiding: unqualified secrets never reach any model
  → runEngine(state.engine, talk(state, ctx)) — scripted fallback works offline
  → clamp: trustDelta ±3, lines ≤60 chars, memory ≤80; revealZh is replaced by
    the CANONICAL disclosure text (model phrasing never carries secrets)
  → apply: trust, npc.memory, npc.revealed, ledger entry, talkedNpcIds.push,
    affordability re-floor (trust shifts can re-lock tier-gated choices)
  → TalkResponse {lines, revealZh, attitude(warmer/cooler/unchanged), NpcView}
```

Key invariants:
- **Server owns** turn counter, chapter, day, tendencies. The model can never write them.
- **Tendencies** = histogram of chosen actionTags — the report's ground truth.
- **Redaction**: NPC motives/agendas/memories, raw trust AND undisclosed secrets never reach the client; trust is shown as tiers (冷淡/相识/信任/莫逆) + glyphs (亲敬疑敌); `/talk` returns an attitude word, never the delta.
- **Stats bite**: choices carry moneyCost/staminaCost/minReputation (+ trust gates in scripted beats); `health > staminaCost` is strict so stamina can never kill; the floor guarantees the player is never soft-locked.
- **Pacing**: seeded events at turns 2/3/4/6/7/8/10 guarantee the festival spine regardless of engine variance. DAY_FLOORS force 正月十九 by turn 10.
- A finished life (turn 10 / health 0 / arrested / chapter-3 isEnding) gets choices=[]; `POST /report` is idempotent and cached — the client prefetches it the moment finished=true.

## 5. AI flow (ModelDirector + providers)

One combined structured-output call per turn returns scene + choices + npcLines + bounded state deltas in a single schema (half the latency/cost of split sim→narrative; prose can't contradict its own deltas).

```
ModelDirector(name, client: StructuredModelClient)   ← ALL prompt/wire logic
  ├─ AnthropicClient   claude (messages.parse + zodOutputFormat, cached prefix,
  │                    adaptive thinking, effort, zh-correction retry, proxy-aware)
  └─ OpenAICompatClient
       openai          json_schema strict (z.toJSONSchema + strict normalizer),
                       reasoning_effort, max_completion_tokens — LIVE-VERIFIED (gpt-5.1)
       deepseek        json_object + schema embedded in system text, max_tokens —
                       baseURL api.deepseek.com — MOCK-TESTED ONLY (no key here)
Both compat modes: manual JSON.parse + zod safeParse + ONE repair retry → EngineError.
ClaudeDirector = ModelDirector + AnthropicClient (name + lastUsage preserved for scripts).
select.ts builds Map<EngineId, Director>; sessions pin their engine at creation
(CreateSessionBody.provider, validated against available keys); /health lists
providers[] for the landing chips.
```

```
turn   system = [ DIRECTOR_RULES (zh) ] + [ era bible + identities + npcs (personas,
                 NEVER disclosures) + locations JSON, sorted keys, cache_control ]
       user   = <task> + <state snapshot> + <recent causal/timeline ×5> + <due_events>
                + <player_action> + <texture_hint (mulberry32-seeded motif)>
talk   system = [ TALK_RULES ] + [ TALK_STATIC_JSON: personas only ]
       user   = <task> + <npc live state> + <player snapshot> + <recent ledger>
                + <allowed_disclosures>  ← TIER-FILTERED BY THE ROUTE; secrets the
                                           player hasn't earned are never in context
```

- `effort: "medium"` ordinary turns, `"high"` climax (7, 10) + report, `"low"` talk.
- Cache economics re-verified after the provider refactor: turn 2 read 10.3K tokens from cache (~87% of input).
- **The grammar ceiling (round 2)**: the original wire schema sat just under the structured-outputs limit; adding npcLines + per-choice cost fields re-tripped "compiled grammar too large". The compaction that fits (probed empirically — `scripts/grammar-probe.ts` bisects variants against the live API):
  - per-choice costs/anchor pack into ONE `extra` string: `"money=200 stamina=8 rep=10 anchor=he_shisan"` ("" = free);
  - `npcLines` ship as `"npcId|台词"` strings;
  - `causalEntries.{effectsZh,openedZh,closedZh}` and `timelineEvents.npcIds` are ；/,-joined strings;
  - in-choice `actionTag`/`risk` enums relaxed to strings (fallbacks observe_wait/medium).
  `engine/wire.ts` parses everything back into the strict `DirectorTurn`; strict schemas and game state never see packed forms. Trust-tier gates are NOT on the wire at all — scripted beats only. **The wire schema is now AT the ceiling: any new field must displace something. Probe first, then `npm run test:live`.**
- Report call: `LifeReportSchema` straight (small enough, mirror included — live-verified); `reportGuard.ts` drops unknown turning points, ungrounded value chips, and evidence-free mirror themes (a hollow mirror is rebuilt from tendencies/history, never shown).
- Failure ladder (verified live): SDK transport retries → 1 app-level retry with a zh correction note → `refusal`/exhausted → routes serve the turn (and talk) from ScriptedDirector (`engineUsed: "scripted-fallback"`); state is written only after success.

**ScriptedDirector** mirrors the same Director interface: 11 authored spine scenes (now with costs/anchors/npcLines) + `(chapter × actionTag)` outcome tables + per-tier talk templates with the same disclosure laddering. Zero RNG → byte-identical reruns (tested). It is the test engine, the no-key mode, and the live fallback — **never cut it**.

## 6. Visual layer

`client/src/scene/` is plain Three.js, imports nothing from React; React's only touchpoint is `SceneCanvas.tsx` holding a `DioramaHandle`. One procedural market-street set (no external assets); **location changes are camera-preset + lighting changes, not geometry**.

**Figures are humanoid**: `figures.ts` builds each character as ONE merged vertex-colored body mesh (torso/robe/head/headgear/legs) + two arm meshes on shoulder pivots (the only animated geometry — pivot rotation, never per-vertex). 5 hero NPCs with distinct costumes/silhouettes + 4 protagonist identity variants, <400 tris each, ≤3 draw calls per visible figure. `heroes.ts` owns the rigs: focus changes make heroes WALK in/out of slot anchors (steering toward a destination — retarget-safe by construction), idle breath + seeded head turns, talk gesture while a bubble shows, highlight pulse/brighten for anchored choices, and the protagonist's approach-walk toward a clicked NPC. `crowd.ts` is two InstancedMeshes of cheap humanoid variants (standing/walking).

Two channels in, two out:
- in: `applyDirective(SceneDirective, ms)` (location→preset, timeOfDay→lighting, weather→fog/particles, mood→grade, crowd/lanterns→counts, focusNpcIds→heroes) and the interaction setters `setHighlights / setTalking / setProtagonist / protagonistApproach`.
- out: `onNameplates` (per-frame world→screen projections; React renders nameplates, speech bubbles AND the popover off these — bubbles are React/CSS, not scene objects) and `onPick` (drag-guarded raycast against invisible fat cylinder proxies; hover = cursor + brighten).

Per-frame projections flow through `client/src/platesStore.ts` so only the small bubble/popover components re-render at frame rate — never the App tree. Budget: 21 draw calls / 16k tris measured (≤40 / ≤60k budget). Dev harness: `#/dev/scene` (directive knobs + highlight/talk/protagonist/pick testers + stats + screenshot). If WebGL fails, SceneCanvas degrades to a CSS gradient card.

## 7. Build / run / verify

| Command | Notes |
|---|---|
| `npm run dev` | concurrently: tsx watch server + vite client |
| `npm run typecheck` | one tsconfig covers shared/server/client/scripts/tests |
| `npm run test` | 60 unit tests across 10 suites — all offline |
| `npm run e2e` | in-process via `createApp` + `app.request()`, no port; 172 assertions: two full lives, divergence, talk flow, locked-choice 422, per-turn affordability floor, mirror grounding, error paths |
| `npm run test:live` | 25 assertions on the real API: wire grammar, npcLines, costs, cache reads, live 攀谈, live report+mirror; SKIPs (exit 0) without a key |
| `npx tsx scripts/live-openai.ts [deepseek]` | GPT/DeepSeek live smoke through OpenAICompatClient; SKIPs without the key |
| `npx tsx scripts/grammar-probe.ts` | bisects wire-schema variants against the structured-outputs grammar ceiling — run BEFORE test:live when touching the wire schema |
| `npm run build && npm start` | prod bundle served same-origin on :8787 |

Screenshots/interaction smokes: `npx tsx scripts/screenshot.ts --url <url> --out <ABSOLUTE.png> [--wait ms] [--click-npc 裴衡,55] [--click-text 攀谈]` — CDP-driven headless Edge. (Plain `--virtual-time-budget` screenshots hang nondeterministically against this app's continuous RAF loop; the CDP path is reliable and can click into the scene.)

## 8. Key decisions (and why)

1. **One Director call per turn** returning deltas+scene+choices in one schema — latency/cost halved vs split calls; the "Simulation Director" of PROJECT.md §11.8 is `clamp.ts`+`applyTurn.ts` *in code*, not a second model call. The model proposes, the validator disposes.
2. **Choice-ids-only API + structured talk** (no free text anywhere) — the anti-chatbot wall (PROJECT.md §5). 攀谈 is a structured action (npcId from a fixed cast), not a chat box.
3. **Zod as single source of truth** — one schema feeds the API grammar, server validation, persistence guard and TS types. Zod **v4 required** (SDK's `zodOutputFormat` needs `z.toJSONSchema`; v3 throws).
4. **JSON-file persistence** over SQLite — zero native deps on Windows, hand-editable saves as the debug loop. Whole-state read/write is microseconds at this size.
5. **No z.record / no optionals in engine-facing schemas** — structured outputs require fixed-key objects with all fields required; sentinel values ("" / []) mean "no change".
6. **`.env` overrides shell env** — Claude Code injects its own `ANTHROPIC_API_KEY` (which 403s on the public API); without override the user's key in `.env` is silently shadowed.
7. **Proxy-aware SDK clients** — Node's fetch ignores `HTTP(S)_PROXY`; on this network direct API calls are region-blocked. `providers/types.ts#proxyAwareFetch` routes BOTH SDK clients through undici's `EnvHttpProxyAgent` **using undici's own fetch** — mixing an npm-undici dispatcher into Node's built-in fetch fails with opaque connection errors.
8. **Scenes ship as camera/light presets on one set** — the trick that made a one-session 3D layer feasible.
9. **Determinism discipline in ScriptedDirector** (no RNG; seeded fragments) — enables byte-identical replay tests, which is what makes "choices change the life" mechanically assertible.
10. **Secrets are route-owned, not prompt-owned** — NPC disclosures live outside every cached prefix; the talk route tier-filters them before any prompt is built and replaces the model's reveal phrasing with canonical text. Information hiding is structural, not behavioral.
11. **Talk is sub-turn** — it mutates trust/memory/ledger + a persisted once-per-NPC-per-turn fence, but never turn/chapter/tendencies/timeline. Cost stays bounded (≤3 low-effort calls per turn) and the 10-turn pacing spine is untouched.
12. **Affordability floor over hard failure** — clamp guarantees ≥2 pickable choices against the *projected* post-apply state, and both `/turn` and post-talk re-check; the player can be poor, tired and friendless, but never soft-locked.
13. **Click-a-figure opens a popover** (anchored choice + 攀谈) instead of submitting instantly — misclick safety for an irreversible turn.
14. **schemaVersion stays 1 + migrate-on-read** — additive fields get defaults on load (old finished saves get a synthesized 镜中人); validate-on-write self-heals files on first save; garbage still rejects.
15. **One ModelDirector, N clients** — prompts/wire logic exist once; a provider is just a `StructuredModelClient` (Anthropic native; GPT/DeepSeek via the OpenAI-compat surface with manual zod parse + one repair retry).

## 9. Known issues / gotchas

- **The wire schema is AT the grammar ceiling.** The 2026-06-12 upgrade fit npcLines + choice costs only by packing strings (§5); any further field must displace something. `scripts/grammar-probe.ts` first, then `npm run test:live` — the 400 is empirical, not computable offline.
- Director-scheduled `eventOps` are not in the live wire schema (grammar size) — the seeded spine drives the event queue; ScriptedDirector still supports them internally.
- **Trust-tier choice gates exist only in scripted beats** (not on the live wire); the live model prices with money/stamina/reputation.
- **DeepSeek is mock-tested only** — no key in this environment. First key-holder: `npx tsx scripts/live-openai.ts deepseek`. GPT is live-verified (gpt-5.1).
- Talk can re-lock a tier-gated choice between scene render and pick — that's why `/turn` 422s and the client resyncs on it; both sides re-floor affordability after talk.
- Hero slots are shared across camera presets; at `teahouse_porch` the slot-0 hero stands close to the lens (bubble visible, figure can sit half out of frame). Per-preset slot tables are the known fix.
- Edge `--virtual-time-budget` screenshots hang nondeterministically against the RAF loop — always use `scripts/screenshot.ts` (CDP).
- Headless software rendering reports low fps at 1600×900 (fill-rate bound) — judge performance in a real browser; geometry is 16k tris.
- The three vite/tsc/vitest configs each declare the `@shared` alias — keep them in sync.
- `npm run dev` leaves tsx/vite node processes if killed unusually; port 8787 conflicts mean a stale process.

## 10. Lessons worth keeping

- **Prove the loop before the paint**: the E2E (`app.request()`, no port, scripted engine) caught design issues while the UI was still a JSON response. Keep new features testable at that layer first.
- **Key-order ≠ data equality**: Zod parse reorders object keys to schema order; compare canonically (`stringifySorted`), never raw `JSON.stringify`, when diffing persisted vs in-memory state.
- **Bound the model, log the bounds**: every clamp correction goes to `validationLog`. Live Opus 4.8 turns ran with *zero* corrections — the log is how you'd notice prompt regressions.
- **Cache discipline pays immediately**: one byte-stable system prefix (sorted keys, no timestamps/ids/conditionals) gave ~85% cached input from turn 2 onward. Never interpolate volatile data into the system block.
- **Subagent file isolation works**: the diorama was built concurrently by an agent confined to `client/src/scene/` against a frozen interface contract (`initDiorama`/`applyDirective`) — zero merge conflicts. Freeze the contract before fanning out.
- **Probe the grammar ceiling, don't guess it**: ladder-stepping fields off the wire one live call at a time wasted three calls; a cheap bisection script (`grammar-probe.ts`) found "each addition fits alone, not together" in one pass and showed WHERE to reclaim. Packed strings ("k=v" / "a；b") parsed by the sanitizer are the escape hatch — primitives are cheap, repeated arrays/enums are not.
- **Frame-rate data must bypass React state at the root**: per-frame nameplate projections go through a tiny external store (`useSyncExternalStore`) so only the bubble/popover leaves re-render at 60fps. Lifting them into App state would re-render the world.
