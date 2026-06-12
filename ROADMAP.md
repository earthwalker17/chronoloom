# ROADMAP.md — ChronoLoom build log

Cross-session memory bridge. Newest entries last.

## Task Log: 2026-06-10 — First Playable Vertical Slice (Tang Chang'an · 上元灯节)

### Goal
Build the first playable public vertical slice proving the core loop: era → concrete identity → atmospheric 3D scene → meaningful choices → simulated consequences from structured state → timeline → grounded life report. Era: Tang Chang'an East Market, Lantern Festival week. Chinese content/UI, English code. Claude API as primary engine with a deterministic offline fallback.

### Changes Made
- **M1 Skeleton** — Vite 5 + React 18 + TS client, Node + Hono server (:8787, Vite proxy), single root package, Zod-validated env config, Windows-safe npm scripts, git repo initialized.
- **M2 State + scripted engine** — Zod single-source schemas (`shared/schemas.ts`): SessionState, DirectorTurn (the only engine output), LifeReport, redacted SessionView. Content: era bible, 8 locations, 4 identities (寒门书生/绢行学徒/译语人/抄经生), 5 NPCs (沈砚秋/崔九/绿腰/裴衡/何十三娘) bound into one festival-week knot (查账→失账页→身契→诗会→掮客). Simulation: `clamp.ts` (anti-drift: ±15 trust, ±2000文, access gates, choice diversity, causal-entry floor) → `applyTurn.ts` (pure reducer; server owns turn/chapter/day/tendencies) → atomic JSON store (validate-on-read AND write, per-id mutex, tmp+rename). ScriptedDirector: 11 authored spine scenes + 3×10 outcome tables, identity-scaled money, state-conditional prose fragments, deterministic (zero RNG). Offline 命书 from templates over real timeline/tendency/trust data. Endpoints: health/meta/create/get/turn (409 turn fence; choice-ids only — the anti-chatbot wall)/report (idempotent).
- **M3 React UI** — phase machine landing(入梦长安)→era intro→identity cards(书/商/译/经)→play→命书. Play: status strip (ink bars, not raw numbers), prose 纸卷 with typewriter + consequence recap, choice 纸签 with 「择」 stamp, 人缘 panel (tiers 冷淡/相识/信任/莫逆 + glyphs 亲敬疑敌 — raw trust never leaves the server), 浮生簿 timeline drawer, waiting overlay with rotating 占卜 lines, floating stat deltas, ink transition. `?session=<id>` resume links.
- **M4 Three.js diorama** — one procedural low-poly market street (~19 draw calls, no external assets): merged shop-houses, 春明门 gate tower in fog, 7 stalls, 60 instanced lanterns + 6 flickering PointLights, 8 wind-blown 绢幡, instanced crowd + 3 hero NPC figures with HTML nameplates, petals/dust/snow particles, per-timeOfDay lighting tables, 5 camera presets — location changes are camera+lighting changes. Single integration point `applyDirective(SceneDirective)`. Dev harness at `#/dev/scene` (all knobs, FPS/draw-call readout, screenshots). CSS gradient fallback if WebGL unavailable.
- **M5 ClaudeDirector** — one combined structured-output call per turn (`messages.parse` + `zodOutputFormat(DirectorTurnSchema)`, Opus 4.8 surface: adaptive thinking, no sampling params), byte-stable cached system prefix (rules + era bible + cast, `cache_control` on last block), volatile turn snapshot with last-5 causal/timeline + due events + seeded texture hint (mulberry32 — variety without temperature). Effort: medium for turns, high for climax turns (7, 10) and the report. Failure ladder: SDK retries → 1 app-level retry with correction → scripted fallback serves the turn (tagged in history) → player never stalls.
- **M6 Polish + verification** — Canvas2D share card (deterministic 1080×1440 PNG, 长安命书.png), README, .env precedence (file wins over inherited shell vars), screenshots.

### Files Touched
Everything is new this session. Key paths: `shared/{constants,schemas,types}.ts` · `server/{app,index,config,views}.ts` · `server/engine/{director,claudeDirector,scriptedDirector,prompts,select}.ts` · `server/sim/{newSession,applyTurn,clamp,pacing,recap,reportGuard}.ts` · `server/store/*` · `server/content/*` (all Chinese game content) · `server/routes/*` · `client/src/**` (App, 6 screens, 9 components, 18 scene modules) · `scripts/{e2e-playthrough,live-turn}.ts` · `tests/*` (4 suites).

### Verification
- `npm run typecheck` — clean (strict, noUncheckedIndexedAccess, whole repo).
- `npm run test` — 25/25 green: clamp math, access gating, reducer purity, day-floor pacing, ScriptedDirector determinism (byte-identical reruns) AND divergence, per-identity full-life invariants, store atomicity/corruption/locking.
- `npm run e2e` — 134/134 green: two full scholar lives via `app.request()` — turn counter, strictly-growing timeline, per-turn causal entries, visible recaps, persistence round-trip, grounded + idempotent report, **divergence between protect-leaning and money-leaning lives (reputation, 绿腰 trust, revealed values)**, 409/400/404/422 error paths.
- `npm run build` — clean; `npm start` serves API + built client on :8787 (verified).
- **Live failure ladder verified against the running server**: with a 403-ing key, session creation logged `claude failed → serving turn from fallback` and the player seamlessly got the scripted scene.
- Browser smoke via headless Edge: landing (night diorama + title), mid-game play screen (turn 7 诗会, snow + festival lanterns, full HUD), finished 命书 (仗义经生/灯下护人者 for a protect-leaning copyist), dev harness (~15 draw calls, ~56fps software rendering). Screenshots: `docs/screenshots/{landing,play,report,devscene}.png`.
- `npm run test:live` — **BLOCKED**: the only key available in this session's shell returns 403 `Request not allowed` for all models (key exists but isn't authorized for the Messages API). Script is ready and SKIPs cleanly without a key; needs a working `ANTHROPIC_API_KEY` in `.env`.

### Decisions
- One combined Director call per turn (deltas + scene + choices in one schema) over split sim/narrative calls — half the latency/cost, prose can't contradict its own deltas; PROJECT.md §11.8's "Simulation Director" lives in `clamp.ts`+`applyTurn.ts` as code.
- Tendencies are a server-computed histogram of chosen actionTags — zero drift, and the report's value chips are validated against it.
- JSON-file persistence over SQLite (no native deps on Windows; hand-editable saves are the debug loop).
- Choice-ids-only API (no free text) as the anti-chatbot wall; free-text 自定义行动 deferred to v1.1 through the same actionTag schema.
- `.env` overrides inherited shell vars (least surprise for a local game; Claude Code's own shell key was shadowing the user's intent).
- Zod v4 required by the SDK's `zodOutputFormat` (v3 lacks `z.toJSONSchema`) — upgraded, all suites re-verified.
- Plain POST + 占卜 waiting overlay instead of SSE streaming (v1.1 candidate).

### Issues / Follow-ups
- **Live Claude verification pending a working API key** — everything is wired (`npm run test:live` asserts parse validity, CJK prose, choice diversity, cache reads on call 2); the key in this session's environment 403s. Once a valid key is in `.env`: run `npm run test:live`, then a full browser playthrough on the live engine, and tune turn latency (per-chapter `effort`) if needed.
- Headless-Edge report screenshot shows a few box glyphs in dense prose (font fallback in headless mode); verify in a real browser session — likely a non-issue.
- Dev-harness triangle count reads ~72k vs the ~60k budget guideline (fps is fine at 56 even in software rendering); optional trim: reduce sky-dome/foliage segments.
- v1.1 candidates: SSE turn streaming, WebAudio ambience, free-text actions via actionTag schema, identity-specific scripted variants for turns 5/9.

### Next Steps (recommended)
1. ~~Put a working `ANTHROPIC_API_KEY` in `.env` → `npm run test:live` → full live browser playthrough~~ — done 2026-06-11, see next entry.
2. Play-test all four identities end-to-end in the browser; tighten any scripted copy that reads flat.
3. Share-card polish (richer Canvas composition, QR/link).
4. Deployment path (the server already serves `dist/client`; needs only a Node host + env vars).

## Task Log: 2026-06-11 — Live engine verified · proxy + grammar fixes · ARCHITECTURE.md · GitHub push

### Goal
Unblock and verify the live Claude engine end-to-end with the user's working API key; add ARCHITECTURE.md as the standing onboarding document and a CLAUDE.md rule to keep it updated; publish the repo to GitHub.

### Changes Made
- **Proxy support** (`server/engine/claudeDirector.ts`): Node's fetch ignores `HTTP(S)_PROXY`, and on this network direct calls to api.anthropic.com are region-blocked (403 "Request not allowed" — affected BOTH keys; it was never a key problem). The client now detects proxy env vars and routes through undici's `EnvHttpProxyAgent` using **undici's own fetch** (mixing an npm-undici dispatcher into Node's built-in fetch produced opaque connection errors). New dep: `undici`.
- **Wire schema** (`shared/schemas.ts` + `server/engine/wire.ts`): the strict DirectorTurn schema exceeded the structured-outputs grammar limit ("compiled grammar too large", 400). Added `DirectorTurnWireSchema` (repeated enum-arrays/literal-unions relaxed; choice ids assigned by position; eventOps dropped from the wire) + a sanitizer that coerces wire output back into the strict `DirectorTurn` before clamp. Server-side strictness unchanged.
- **ARCHITECTURE.md** created (repo map, runtime topology, turn pipeline, AI flow, decisions, gotchas, lessons); **CLAUDE.md §12** now requires updating it after structurally-meaningful tasks; session-start reading list now includes it.
- Pushed to https://github.com/earthwalker17/chronoloom.git.

### Files Touched
`server/engine/{claudeDirector,wire}.ts` · `shared/schemas.ts` · `ARCHITECTURE.md` (new) · `CLAUDE.md` · `ROADMAP.md` · `package.json` (undici) · `docs/screenshots/play-live.png` (new)

### Verification
- `npm run test:live` — **13/13 green**: arrival 276-char zh prose, 4 choices ≥3 tags, zero clamp corrections, turn 2 read **9,320 tokens from prompt cache** (~85% of input).
- Live server playthrough (interpreter, 4 live turns): the Director chained real consequences across turns (self-report to 市署 → 裴衡 refuses a warrant, counter-offers 底本换清白 → rumor spreads via new market notice). Screenshot `docs/screenshots/play-live.png`.
- Full regression after changes: typecheck clean · 25 unit tests · 134 e2e assertions · prod build.

### Decisions
- Keep strict schemas as the single source of truth; the wire schema is explicitly a transport relaxation with a sanitizer, not a second truth.
- Director-scheduled `eventOps` left out of the live wire (seeded spine drives events); revisit only with evidence the model needs them.

### Issues / Follow-ups
- Any growth of the wire schema risks re-hitting the grammar ceiling — test `npm run test:live` after schema changes.
- PROJECT.md §24 demo-ready checklist: all items pass (start session ✓ identity ✓ visual scene ✓ meaningful choices ✓ state updates ✓ next scene reflects actions ✓ recurring relationship ✓ timeline ✓ grounded report ✓ local run docs ✓ main flow stable ✓ screenshot-worthy ✓).

## Task Log: 2026-06-12 — Scene-Native Upgrade (v1.2): living NPCs, stats that bite, 镜中人, providers

### Goal
Evolve the slice from "text-choice 命数推演 with a 3D backdrop" into a scene-native 3D life simulator: interaction moves into the scene (clickable humanoid NPCs, in-scene speech, bounded 攀谈), stats become real game state (costs/gates), the 命书 gains a real-player 镜中人 reflection with a staged-generation UX, and the engine gains a minimal Claude/GPT/DeepSeek provider layer.

### Changes Made
- **M1 Contract trunk** — Choice += anchorNpcId/moneyCost/staminaCost/minReputation/minTrust gates (flat, sentinel-style); DirectorTurn/Scene += npcLines; TalkBody/TalkExchange/TalkResponse + Mirror schemas; SessionState += talkedNpcIds, npc.revealed; engine enum widens to claude|openai|deepseek|scripted; affordability floor in clamp (≥2 pickable, judged against the projected post-apply state); costs deducted before outcome deltas; `/turn` 422 choice_locked re-check; DI becomes a directors map with per-session engine pinning; migrate-on-read shim backfills old saves (incl. synthesized mirror); scripted beats authored with costs/anchors/npcLines.
- **M2 Talk + personas** — all 5 NPCs gain personaZh/boundariesZh + 3 tier-laddered disclosures pointing at one hidden broker plot (查账→失账页→身契→掮客); DIRECTOR_RULES v2 (in-fiction pricing, npcLines, voice-distinct dialogue); TALK_RULES + buildTalkPrompt; **POST /sessions/:id/talk**: sub-turn, once-per-NPC-per-turn persisted fence, route pre-filters disclosures by trust tier (structural secret hiding — unqualified secrets never enter any model context), canonical-reveal-only, ±3 trust clamp, memory/ledger writes, post-talk affordability re-floor; mirror guard rebuilds hollow mirrors from the lived record.
- **M3 Providers** — StructuredModelClient seam; AnthropicClient (verbatim move of the verified path); OpenAICompatClient (GPT json_schema strict / DeepSeek json_object + schema-in-prompt, one repair retry, proxy-aware); ModelDirector hosts all prompt/wire logic; ClaudeDirector is a thin subclass (lastUsage preserved); config gains OPENAI/DEEPSEEK keys + models with a claude>openai>deepseek>scripted default ladder; /health exposes a providers array; landing page 执笔者 chips (unavailable = visible, disabled); per-session provider pinning.
- **M4 Scene layer** — figures.ts (merged-body + arm-pivot low-poly humanoids: 5 distinct NPC costumes + 4 protagonist identities, gendered silhouettes, <400 tris each); heroes.ts (steering walk-in/out on focus change, idle breath/head-turns, talk gesture, highlight pulse, protagonist approach-walk); picking.ts (drag-guarded raycast on fat hit proxies, hover brighten); instanced humanoid crowd (standing + walking variants); DioramaHandle v2 fully wired (onPick/setHighlights/setTalking/setProtagonist/protagonistApproach); DevScene knobs.
- **M5 Client integration** — SpeechBubbles + NpcPopover ride the nameplate projection through a 60fps-isolated plates store; click-figure = anchored choice or 攀谈; ChoiceList cost chips + locked slips with reasons; report prefetched the moment a life ends + 命书生成 staged forging overlay + staged section reveal + 镜中人 section; share card decision-style line.
- **M6 Verification tooling** — scripts/screenshot.ts (CDP-driven headless Edge with nameplate-relative + button-text clicks); scripts/grammar-probe.ts (wire-schema grammar-ceiling bisection); scripts/live-openai.ts (GPT/DeepSeek live smoke); live-turn.ts extended (npcLines, costs, live talk, live report+mirror grammar).

### Files Touched
shared/{constants,schemas,types}.ts · server/sim/{clamp,applyTurn,newSession,reportGuard}.ts · server/store/{migrate(new),sessionStore}.ts · server/engine/{director,wire,prompts,select,claudeDirector,modelDirector(new)}.ts · server/engine/providers/{types,anthropicClient,openaiCompatClient}(new) · server/routes/{meta,sessions}.ts · server/app.ts · server/config.ts · server/content/{npcs,scriptedBeats,reportTemplates,talkTemplates(new)}.ts · client/src/scene/{figures(new),heroes(new),picking(new),crowd,diorama,directiveMapper,index}.ts · client/src/{App,api,affordance(new),platesStore(new)}.ts(x) · client/src/components/{ChoiceList,SceneCanvas,ShareCard,SpeechBubbles(new),NpcPopover(new),ReportForging(new)}.tsx · client/src/screens/{Landing,Play,Report,DevScene}.tsx · styles · scripts/{e2e-playthrough,live-turn,screenshot(new),grammar-probe(new),live-openai(new)}.ts · tests/{helpers,clampCosts,migrate,talk,reportGuard,providers,openaiCompat}(new) + applyTurn updated · .env.example

### Verification
- `npm run typecheck` clean · `npm run test` **60/60** (clampCosts, migrate-with-real-fixtures, talk fences + structural tier filtering, mirror guard, provider config matrix, OpenAICompat mock parse/repair) · `npm run e2e` **172 assertions** (talk flow, locked-choice 422, ≥2-affordable floor per turn, mirror presence, divergence, error paths) · `npm run build` + `npm start` serve clean.
- **`npm run test:live` 25/25 on claude-opus-4-8**: wire grammar compiles, npcLines in persona voice, costs sane, cache reads 10.3k tokens on call 2, live 攀谈 in-voice, live report with 3 evidence-backed mirror themes (guard clean).
- **Live GPT smoke passed against gpt-5.1** (json_schema strict through OpenAICompatClient, zero clamp corrections). DeepSeek remains mock-tested only (no key).
- Browser verification (headless Edge via CDP, prod build): humanoid NPCs with nameplates + in-scene speech bubbles; click-figure popover (anchored choice + 攀谈); live talk exchange showing the canonical reveal + fence; protagonist approach-walk; cost chips + locked slips; staged 镜中人 report; landing provider chips. Screenshots: `docs/screenshots/{devscene-humanoids,play-street-heroes,play-npc-popover,play-talk-exchange,play-live-scene-native,report-mirror,landing-providers}.png`. drawCalls 21 / tris 16k (budget ≤40/≤60k).
- Live server playthrough on the real engine: arrival npcLine + live talk where 何十三娘 addressed the interpreter by name, referenced his contract trouble, and revealed her 相识-tier disclosure verbatim.

### Decisions
- **Grammar ceiling round 2**: the grown wire schema re-hit "compiled grammar too large". Probing (scripts/grammar-probe.ts) showed each addition fit alone but not together → costs/anchor pack into ONE `extra` string per choice ("money=200 stamina=8 anchor=he_shisan"), npcLines ship as "npcId|台词" strings, causalEntries' three string-arrays + timeline npcIds pack into ；-joined strings, in-choice enums relax to strings. wire.ts parses everything back; strict schemas unchanged.
- Trust-tier gates are NOT on the live wire (scripted beats only) — the model prices with money/stamina/reputation.
- Talk is sub-turn by construction (no turn/tendency/timeline mutation) and the route — not the engine — owns secrets: disclosures are tier-filtered before any prompt is built, and only canonical disclosure text reaches the client.
- Click-a-figure opens an action popover (anchored choice + 攀谈) instead of submitting instantly — misclick safety beats the one-click spec.
- schemaVersion stays 1 with migrate-on-read; report prefetch starts the moment finished=true (the idempotent route makes this free).

### Issues / Follow-ups
- **DeepSeek unverified live** (no key in this environment) — first user with a key should run `npx tsx scripts/live-openai.ts deepseek`.
- `CHRONOLOOM_OPENAI_MODEL` defaults to gpt-5.1 (live-verified); revisit as models rotate.
- Wire schema is now AT the grammar ceiling — any future field must displace something; run `scripts/grammar-probe.ts` before `npm run test:live` when touching it.
- Hero slot layout is shared across camera presets; at teahouse_porch the slot-0 hero stands near the lens (bubble visible, figure partly out of frame) — consider per-preset slot tables in a polish pass.
- Buildings believability pass (curved Tang roofs, lattice windows) was the planned lowest-priority cut and did not ship this session.
- Talk depth is one exchange per NPC per turn (followUpZh = second line); multi-beat conversations deferred.

### Next Steps (recommended)
1. Full in-browser playthrough of all four identities on the live engine; tune hero slot placement per camera preset.
2. Buildings polish pass + WebAudio ambience.
3. DeepSeek live verification; consider exposing provider choice on the share card.
