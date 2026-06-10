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
1. Put a working `ANTHROPIC_API_KEY` in `.env` → `npm run test:live` → full live browser playthrough; tune prose length/latency via DIRECTOR_RULES and per-turn `effort`.
2. Play-test all four identities end-to-end in the browser; tighten any scripted copy that reads flat.
3. Share-card polish (richer Canvas composition, QR/link).
4. Deployment path (the server already serves `dist/client`; needs only a Node host + env vars).
