# CLAUDE.md

# ChronoLoom — AI Alternate-Life Simulator

## 1. Purpose
This is the short operating guide for Claude Code and future coding agents.

ChronoLoom is an AI-native alternate-life simulator: a player enters a historical or future era, takes on a concrete identity, makes meaningful choices, and watches an AI-driven world infer the next stage of that life.

At the start of every session:
1. Read `CLAUDE.md`.
2. Read `PROJECT.md` for full product context.
3. Read `ROADMAP.md` if it exists.
4. Inspect the repository before making implementation decisions.

Keep this file concise. Put detailed context in `PROJECT.md` and task history in `ROADMAP.md`.

## 2. Product Promise
ChronoLoom succeeds if a user can say:

> I did not just answer a test. I lived another life for a while, and the path felt like it belonged to my choices.

Protect this promise above all stack or feature decisions.

## 3. Core Experience Loop
Every feature should serve this loop:
1. Enter an era.
2. Choose or receive a concrete identity.
3. Arrive in a visually memorable scene.
4. Take an action.
5. Simulate consequences.
6. Generate the next stage from updated state.
7. Record the life trajectory.

The product should not feel like a static quiz, fixed branching novel, or plain chatbot.

## 4. First Prototype Goal
Build a playable public vertical slice, not a full historical open-world game.

A strong first prototype should include:
- One era or compact district
- Three to five playable identities
- A visual 3D or pseudo-3D scene layer
- Structured player/world/NPC state
- Meaningful choices with visible consequences
- At least one recurring NPC or relationship
- Timeline of major life events
- Final life report based on actual choices
- Clear local run path and basic deployment path

The first prototype must prove that user action changes the simulated life path.

## 5. Scope Boundaries
Do not start with:
- Huge multi-era universe
- Complete historical encyclopedia
- Perfect autonomous NPC society
- Complex RPG combat/inventory/economy
- Multiplayer
- Heavy account systems unless required
- Pure text adventure with no visual identity
- Beautiful 3D scene with no simulation loop

Balance world, choice, consequence, and visual immersion.

## 6. Recommended System Concepts
Keep implementation simple, but design around these concepts:
- **Era Bible:** structured rules and texture for time, location, classes, institutions, roles, constraints, opportunities, dangers, tone, visual motifs, and plausibility boundaries.
- **Player State:** identity, role, status, resources, skills, health, reputation, relationships, location, life stage, major decisions, and inferred tendencies.
- **World State:** date/chapter, public mood, faction tensions, economy, rumors, active events, opportunities, threats, and institutional pressure.
- **NPC State:** name, role, motivation, relationship to player, trust/attitude, memory of interactions, and possible future actions.
- **Event Queue:** upcoming events triggered by player choices, world state, NPC actions, time passing, bounded randomness, and narrative pacing.
- **Causal Ledger:** cause-effect links showing what the player did, what changed, why it changed, and what opened or closed next.
- **Narrative Director:** AI layer that turns structured state into concise immersive scenes and meaningful next actions.
- **Simulation Director:** stricter logic layer that updates player, world, NPC, event, and causal state.
- **Visual Director:** presentation layer for 3D/pseudo-3D scenes, maps, cards, portraits, lighting, camera mood, timeline, and result visuals.

## 7. AI Generation Rules
Generate from state, not from nothing.

Preferred flow:
1. Read structured state.
2. Read player action.
3. Apply plausibility and safety boundaries.
4. Update structured state.
5. Produce a concise immersive scene.
6. Offer meaningful next actions.
7. Save all important changes.

Avoid unbounded freeform generation, random twists with no causal basis, generic fantasy content, inconsistent history, excessive prose, hidden prompt-only state, fake branch complexity, and cosmetic choices with no consequence.

## 8. Design Principles
- **Plausibility Over Total Freedom:** the world must have limits; constraints make identity meaningful.
- **Consequences Over Branch Count:** do not chase huge hand-written branch trees; track consequences well.
- **World Before Plot:** build a world with tensions; let player choices activate paths.
- **Specificity Over Generic History:** concrete details matter: food, clothing, etiquette, money, work, class, institutions, transport, technology, and danger.
- **Reflection Without Preaching:** final reflection should be grounded in actual choices, not generic personality-test language.

## 9. Implementation Guidance
No fixed stack is mandated. Inspect the repo and choose pragmatically.

Likely useful direction:
- Browser-first prototype
- Lightweight real-time 3D or pseudo-3D if feasible
- Structured state in JSON, SQLite, or another simple persistence layer
- AI provider/service abstraction
- Separation between UI, state, simulation, narrative generation, visual presentation, and persistence
- Small working slices over large rewrites

Keep the app runnable at all times.

## 10. Claude Code Operating Rules
When working on this project:
1. Use plan mode for broad or ambiguous tasks.
2. Do not assume a stack before inspecting the repo.
3. Make small, coherent changes.
4. Keep primary flows working.
5. Prefer structured state over hidden prompt-only memory.
6. Run relevant verification before reporting completion.
7. Include preview notes or screenshots for UI/3D changes.
8. Record unresolved questions instead of silently guessing.
9. Do not turn the product into a pure chatbot.
10. Do not pursue full open-world scope before the vertical slice works.

## 11. Subagent Suggestions
For complex tasks, use subagents or agent teams where available. Useful roles include Product Architect, Simulation Engine Designer, 3D/Visual Experience Engineer, Narrative Systems Designer, Historical Researcher, Frontend Engineer, State/Persistence Engineer, QA/Verification Agent, and Deployment Agent.

One main agent should maintain final design coherence.

## 12. ROADMAP.md Protocol
Create `ROADMAP.md` in the project root if it does not exist.

Use it as the cross-session memory bridge. After every meaningful task, append:
- Goal
- Changes made
- Files touched
- Verification
- Decisions
- Known issues
- Next steps

Recommended entry format:

```md
## Task Log: YYYY-MM-DD — Short Task Name
### Goal
...
### Changes Made
- ...
### Files Touched
- ...
### Verification
- ...
### Decisions
- ...
### Issues / Follow-ups
- ...
```

## 13. Minimum Demo-Ready Bar
Before calling the prototype demo-ready, verify:
- User can start a new alternate-life session.
- User can choose or receive a concrete identity.
- User can enter at least one visual scene.
- User can make meaningful choices.
- Structured state changes after choices.
- Next scene reflects previous choices.
- At least one relationship changes over time.
- Timeline records major events.
- Final report reflects actual life path.
- App can be run locally with clear instructions.
- Main flow is not obviously broken.
- Visual presentation is atmospheric enough to share.
