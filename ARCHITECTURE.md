# ARCHITECTURE.md — ChronoLoom

Living architecture notes for future sessions. **Update this file whenever architecture, data flow, component behavior, build process, or load-bearing assumptions change** (see CLAUDE.md §12). Task history lives in ROADMAP.md; this file describes how things *are*, not how they got here.

Current slice: 唐·长安东市·上元灯节七日 (Tang Chang'an East Market, 7-day Lantern Festival), Chinese content/UI, English code.

## 1. Repo map

```
shared/            THE CONTRACT. Zod schemas + enums; everything imports from here.
  constants.ts       enums, clamp/pacing tables, actionTag→value map, trust tiers
  schemas.ts         SessionState, DirectorTurn (strict), DirectorTurnWireSchema
                     (relaxed, for the API call), LifeReport, API DTOs
  types.ts           z.infer re-exports only
server/
  index.ts           entry: dotenv(override) → config → engine select → serve :8787
  app.ts             createApp({config,director,fallback,store}) — DI seam for tests
  config.ts          env → AppConfig (engine auto-select: claude if key, else scripted)
  routes/            meta.ts (health/meta) · sessions.ts (create/get/turn/report)
  engine/
    director.ts        Director interface: startLife / takeTurn / writeReport
    claudeDirector.ts  live engine (structured outputs, cached prefix, proxy-aware)
    scriptedDirector.ts deterministic offline engine
    wire.ts            wire→strict DirectorTurn sanitizer (see §5)
    prompts.ts         DIRECTOR_RULES, cached static block, turn snapshots, report prompt
    select.ts          engine selection (lazy-imports the SDK so offline never loads it)
  sim/               THE SIMULATION (pure functions, fully unit-tested)
    newSession.ts      identity → initial SessionState (seeded festival events)
    clamp.ts           anti-drift validator: caps deltas, gates movement, fixes choices
    applyTurn.ts       pure reducer; owns turn/chapter/day/tendencies — model never does
    pacing.ts          seeded spine events, time advance, day floors
    recap.ts           offline consequence-recap renderer
    reportGuard.ts     report grounding: drops claims not backed by the lived record
  store/             whole-state JSON per session; validate-on-read AND write;
                     atomic tmp+rename; per-id promise-chain mutex
  content/           ALL Chinese game content: eraBible, locations(8), identities(4),
                     npcs(5), scriptedBeats (spine scenes + outcome tables), reportTemplates
  views.ts           SessionState → redacted SessionView (см. §4 "redaction")
client/
  src/App.tsx        phase machine: landing→intro→identity→play→report (+#/dev/scene)
  src/api.ts         typed fetch wrappers + localStorage session save
  src/screens/       Landing, EraIntro, IdentitySelect, Play, Report, DevScene
  src/components/    StatusStrip, ProsePanel, ChoiceList, RelationshipPanel,
                     TimelineDrawer, WaitingOverlay, ShareCard (Canvas2D PNG), SceneCanvas
  src/scene/         FRAMEWORK-FREE Three.js diorama; only SceneCanvas touches it;
                     public API = initDiorama(canvas) → DioramaHandle
scripts/           e2e-playthrough.ts (in-process, no port) · live-turn.ts (real API)
tests/             4 vitest suites: reducer/clamps, determinism+divergence,
                   per-identity life snapshots, store atomicity
data/sessions/     saved lives (gitignored)
docs/screenshots/  captured by headless Edge
```

## 2. Runtime topology

```
dev:   vite :5173 ──proxy /api──▶ tsx watch server :8787      (npm run dev)
prod:  node serves dist/client AND /api on :8787              (npm run build && npm start)
```

Single root package.json, no workspaces. `@shared/*` path alias works in tsc, vite and vitest (three configs, keep in sync). No shell-prefixed env vars in npm scripts (Windows). All config via `.env`, which **overrides inherited shell vars** (`dotenv.config({override:true})` — deliberate, see §8.6).

## 3. User flow

```
入梦长安 (landing, night diorama behind) → era intro (4 seed rumors) →
择身入世 (4 identity cards: 书/商/译/经) → play loop ×10 turns → 命书 report
```

Play screen = full-bleed diorama + overlays: status strip (ink bars, not raw numbers), prose 纸卷 (typewriter + consequence recap), choice 纸签 (3-4, with 「择」 stamp), 人缘 panel, 浮生簿 timeline drawer, 占卜 waiting overlay during AI turns. `?session=<id>` resumes any life directly (also how headless screenshots of deep states are taken).

## 4. Turn pipeline (the core loop)

```
POST /sessions/:id/turn {choiceId, turn}
  → zod body parse → load state (validate-on-read) → turn fence (409 if stale)
  → resolve choiceId against state.scene.choices   ← anti-chatbot wall: ids only
  → collect due seeded events
  → director.takeTurn(state, chosen, dueEvents)    ← Claude or scripted
      (on failure: retry once → serve turn from ScriptedDirector, tagged in history)
  → clamp.ts      bound every delta, gate movement, force ≥1 causal entry,
                  fix choice count/diversity; violations → state.validationLog
  → applyTurn.ts  pure reducer: deltas, statuses, NPC trust/memory, rumors,
                  timeline+ledger append, tendencies[chosenTag]++,
                  turn/chapter/day (server-owned), ending checks
  → full SessionStateSchema.parse → atomic write → redacted SessionView
```

Key invariants:
- **Server owns** turn counter, chapter, day, tendencies. The model can never write them.
- **Tendencies** = histogram of chosen actionTags — the report's ground truth.
- **Redaction**: NPC motives/agendas/memories and raw trust never reach the client; trust is shown as tiers (冷淡/相识/信任/莫逆) + glyphs (亲敬疑敌).
- **Pacing**: seeded events at turns 2/3/4/6/7/8/10 guarantee the festival spine (audit → missing ledger page → 绿腰's indenture → poetry night → finale) regardless of engine variance. DAY_FLOORS force 正月十九 by turn 10.
- A finished life (turn 10 / health 0 / arrested / chapter-3 isEnding) gets choices=[]; `POST /report` is idempotent and cached on the session.

## 5. AI flow (ClaudeDirector)

One combined structured-output call per turn returns scene + choices + bounded state deltas in a single schema (half the latency/cost of split sim→narrative; prose can't contradict its own deltas).

```
system = [ DIRECTOR_RULES (zh) ] + [ era bible + identities + npcs + locations JSON,
           sorted keys, cache_control: ephemeral ]   ← byte-stable global prefix,
                                                       shared by ALL sessions/turns
user   = <task> + <state snapshot> + <recent causal/timeline ×5> + <due_events>
         + <player_action> + <texture_hint (mulberry32-seeded motif)>
```

- Model `claude-opus-4-8` (env `CHRONOLOOM_MODEL`), `messages.parse()` + `zodOutputFormat`, adaptive thinking, **no temperature/top_p (removed on Opus 4.8)** — variety comes from the seeded texture_hint.
- `effort: "medium"` for ordinary turns, `"high"` for climax turns (7, 10) and the report.
- Cache economics verified: turn 2+ reads ~9.3K tokens from cache (~85% of input). Cost ≈ $0.03–0.06/turn.
- **Wire schema vs strict schema**: the full `DirectorTurnSchema` exceeds the structured-outputs grammar-size limit ("compiled grammar too large"). The API call uses `DirectorTurnWireSchema` (repeated enum-arrays and literal-unions relaxed to strings/numbers; choice ids and eventOps dropped); `engine/wire.ts` coerces it back to a strict `DirectorTurn` (ids by position, invalid values filtered/defaulted) before clamp. **If you grow the wire schema, watch for that 400 again.**
- Report call: `LifeReportSchema` straight (small enough); `reportGuard.ts` then deletes turning points citing unknown timeline ids and value chips not matching lived tendencies.
- Failure ladder (verified live): SDK transport retries → 1 app-level retry with a zh correction note → `refusal`/exhausted → routes serve the turn from ScriptedDirector (`engineUsed: "scripted-fallback"`); state is written only after success, so retries are safe under the turn fence.

**ScriptedDirector** mirrors the same Director interface: 11 authored spine scenes + `(chapter × actionTag)` outcome tables, identity-scaled money, state-conditional prose fragments, recap rendered from the applied update. Zero RNG → byte-identical reruns (tested). It is the test engine, the no-key mode, and the live fallback — **never cut it**.

## 6. Visual layer

`client/src/scene/` is plain Three.js, imports nothing from React; React's only touchpoint is `SceneCanvas.tsx` holding a `DioramaHandle`. One procedural market-street set (~19 draw calls, no external assets); **location changes are camera-preset + lighting changes, not geometry**. Everything is driven through exactly one function: `applyDirective(SceneDirective, ms)` — location→preset, timeOfDay→lighting table, weather→fog/particles, mood→grade, crowd/lanterns→instance counts, focusNpcIds→hero figures (world positions → HTML nameplates each frame). Dev harness: `#/dev/scene` (all knobs + FPS/draw-call readout + screenshot). If WebGL/module load fails, SceneCanvas degrades to a CSS gradient card driven by the same directive.

## 7. Build / run / verify

| Command | Notes |
|---|---|
| `npm run dev` | concurrently: tsx watch server + vite client |
| `npm run typecheck` | one tsconfig covers shared/server/client/scripts/tests |
| `npm run test` | 25 unit tests (sim, determinism, store) — all offline |
| `npm run e2e` | in-process via `createApp` + `app.request()`, no port; two full lives; asserts divergence between protect- and money-leaning lives |
| `npm run test:live` | 1 real life-start + turn; asserts CJK, choice diversity, cache reads; SKIPs (exit 0) without a key |
| `npm run build && npm start` | prod bundle served same-origin on :8787 |

Headless screenshots: Edge `--headless=new --screenshot=<ABSOLUTE path> --virtual-time-budget=10000` (relative paths silently fail with access-denied; WebGL works headless).

## 8. Key decisions (and why)

1. **One Director call per turn** returning deltas+scene+choices in one schema — latency/cost halved vs split calls; the "Simulation Director" of PROJECT.md §11.8 is `clamp.ts`+`applyTurn.ts` *in code*, not a second model call. The model proposes, the validator disposes.
2. **Choice-ids-only API** (no free text) — the anti-chatbot wall (PROJECT.md §5). Free-text actions are a v1.1 candidate routed through the same actionTag taxonomy.
3. **Zod as single source of truth** — one schema feeds the API grammar, server validation, persistence guard and TS types. Zod **v4 required** (SDK's `zodOutputFormat` needs `z.toJSONSchema`; v3 throws).
4. **JSON-file persistence** over SQLite — zero native deps on Windows, hand-editable saves as the debug loop. Whole-state read/write is microseconds at this size.
5. **No z.record / no optionals in engine-facing schemas** — structured outputs require fixed-key objects with all fields required; sentinel values ("" / []) mean "no change".
6. **`.env` overrides shell env** — Claude Code injects its own `ANTHROPIC_API_KEY` (which 403s on the public API); without override the user's key in `.env` is silently shadowed.
7. **Proxy-aware SDK client** — Node's fetch ignores `HTTP(S)_PROXY`; on this network direct API calls are region-blocked (403 "Request not allowed"). `claudeDirector.ts` detects proxy env vars and routes through undici's `EnvHttpProxyAgent` **using undici's own fetch** — mixing an npm-undici dispatcher into Node's built-in fetch fails with opaque connection errors.
8. **Scenes ship as camera/light presets on one set** — the trick that made a one-session 3D layer feasible.
9. **Determinism discipline in ScriptedDirector** (no RNG; seeded fragments) — enables byte-identical replay tests, which is what makes "choices change the life" mechanically assertible.

## 9. Known issues / gotchas

- **Structured-outputs grammar ceiling**: the strict DirectorTurn schema 400s ("compiled grammar too large"). Any schema growth must go into the wire schema + sanitizer path (§5).
- Director-scheduled `eventOps` are not in the live wire schema (grammar size) — the seeded spine drives the event queue; ScriptedDirector still supports them internally.
- Headless-Edge `report.png` shows some box glyphs in dense prose — headless font fallback only; real browsers render fine.
- Dev-harness triangle count ~72k vs the ~60k guideline (fps 56 even in software rendering — acceptable; trim sky/foliage segments if it ever matters).
- The three vite/tsc/vitest configs each declare the `@shared` alias — keep them in sync.
- `npm run dev` leaves tsx/vite node processes if killed unusually; port 8787 conflicts mean a stale process.

## 10. Lessons worth keeping

- **Prove the loop before the paint**: the E2E (`app.request()`, no port, scripted engine) caught design issues while the UI was still a JSON response. Keep new features testable at that layer first.
- **Key-order ≠ data equality**: Zod parse reorders object keys to schema order; compare canonically (`stringifySorted`), never raw `JSON.stringify`, when diffing persisted vs in-memory state.
- **Bound the model, log the bounds**: every clamp correction goes to `validationLog`. Live Opus 4.8 turns ran with *zero* corrections — the log is how you'd notice prompt regressions.
- **Cache discipline pays immediately**: one byte-stable system prefix (sorted keys, no timestamps/ids/conditionals) gave ~85% cached input from turn 2 onward. Never interpolate volatile data into the system block.
- **Subagent file isolation works**: the diorama was built concurrently by an agent confined to `client/src/scene/` against a frozen interface contract (`initDiorama`/`applyDirective`) — zero merge conflicts. Freeze the contract before fanning out.
