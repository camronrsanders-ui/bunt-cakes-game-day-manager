# Rules & Calls Engine Architecture

## Product Goal

Build a configurable, commercial-ready kickball officiating system. Stonewall Sports Boston Fall 2026 is the first production ruleset, but the engine must support other teams, leagues, seasons, and rule variants without hard-coding Stonewall behavior into the core app.

## Core Principle

Natural-language search may help an umpire find a scenario, but live rulings must resolve to structured, versioned, verified rules — never free-form AI-generated decisions.

Flow:

`Umpire question -> scenario match -> verified ruling -> visual explanation -> official source`

## Existing Application Constraints

The current app is team-workspace based and stores live game state in the shared `team_states.state` JSON document. The Rules & Calls Engine must extend that architecture without breaking existing Captain/Player live sync or legacy founder-workspace fallback behavior.

Existing game state remains the authority for live counts and game context. Rules data is relational and versioned in PostgreSQL.

## Tenant Model

Existing team workspaces remain isolated. Rulesets sit above/beside team state so multiple teams may share a league ruleset while every request remains scoped through an exact team workspace.

Proposed hierarchy:

- League
- Season
- Ruleset identity
- Immutable Ruleset Version
- Rule Categories
- Rules
- Scenarios / Quick Calls
- Visual Diagrams
- Umpire Signals
- Source References

Teams associate to leagues/seasons through explicit bindings. A game binds to the exact immutable ruleset version used when play begins. Historical games never resolve through a mutable "current ruleset" pointer.

All live rules queries must resolve the requested team first. Captain/admin mutations must additionally pass the existing team-membership authorization path. Public/live umpire reads must never be able to cross tenant boundaries through a supplied ruleset ID.

## Versioning Principle

`rulesets` is only the stable logical identity of a rulebook. All rule content belongs to `ruleset_versions`.

A published/active version is immutable. Draft edits occur only on a draft version. Publishing never mutates the previously active version.

Material change flow:

`Active v1 -> create Draft v2 snapshot -> edit v2 -> Review -> Verified -> Active v2`

Historical games remain bound to v1.

## Proposed Data Model

### leagues
- id uuid
- name
- slug unique
- branding_json jsonb
- created_at
- updated_at

### seasons
- id uuid
- league_id fk
- name
- starts_on
- ends_on
- status
- created_at

### rulesets
Stable logical identity only.

- id uuid
- league_id fk
- name
- created_at
- updated_at

### ruleset_versions
Immutable after activation.

- id uuid
- ruleset_id fk
- season_id nullable fk
- version integer
- status: draft | review | verified | active | superseded
- effective_from nullable
- effective_to nullable
- published_at nullable
- verified_at nullable
- created_at
- unique(ruleset_id, version)

### team_ruleset_bindings
Explicit tenant/season association.

- team_id fk
- league_id fk nullable
- season_id fk nullable
- active_ruleset_version_id fk
- active_from
- active_to nullable

### game_ruleset_bindings
Historical immutable binding.

- game_id
- team_id fk
- ruleset_version_id fk
- bound_at
- primary key(game_id, team_id)

### rule_categories
- id uuid
- ruleset_version_id fk
- slug
- name
- display_order

### rules
- id uuid
- ruleset_version_id fk
- category_id fk nullable
- rule_key
- title
- official_text
- quick_summary
- source_section nullable
- verification_status: draft | review | verified
- created_at
- unique(ruleset_version_id, rule_key)

### ruling_scenarios
- id uuid
- ruleset_version_id fk
- rule_id fk
- category_id fk nullable
- scenario_key
- title
- question_prompt nullable
- call_label
- call_type
- what_happened
- what_to_do
- why
- search_terms text[]
- decision_tree_json jsonb nullable
- display_priority
- created_at

Search indexing should use deterministic PostgreSQL full-text search and/or trigram matching, with parameterized queries and exact active `ruleset_version_id` scoping. Live search returns only verified content.

### rule_visuals
- id uuid
- ruleset_version_id fk
- scenario_id fk nullable
- visual_key
- title
- visual_type: static | stepped | animated
- definition_json jsonb
- alt_text
- attribution nullable

Visual definitions must be structured data, not executable/user-supplied HTML. The renderer owns the DOM/SVG construction. Original app-owned field geometry and symbols should be used rather than redistributing third-party training graphics.

Example visual shape:

```json
{
  "field": "kickball_standard",
  "orientation": "defense",
  "steps": [
    {"phase":"before","elements":[]},
    {"phase":"play","elements":[]},
    {"phase":"call","elements":[]}
  ]
}
```

### umpire_signals
- id uuid
- ruleset_version_id fk
- rule_id fk nullable
- signal_key
- title
- verbal_call
- instructions
- visual_steps jsonb
- created_at

### rule_sources
- id uuid
- ruleset_version_id fk
- name
- publisher
- url nullable
- citation nullable
- verification_status: draft | review | verified
- verified_by nullable
- verified_at nullable

Published live rulings must resolve to at least one verified source reference.

### rule_values
Ruleset-configurable mechanics rather than Stonewall constants.

- id uuid
- ruleset_version_id fk
- key
- value jsonb
- unique(ruleset_version_id, key)

Examples:

- balls_for_walk
- strikes_for_out
- fouls_for_out
- outs_per_half_inning
- innings
- mercy_rule
- pitch_constraints
- field_constraints

## Umpire Console

Add a persistent `RULES & CALLS` entry that opens as an overlay / bottom sheet so live game state remains visible and intact.

Primary navigation:

- Search: `What happened?`
- Pitch / Strike Zone
- Fair or Foul
- Base Running
- Overthrows
- Fielding
- Umpire Signals
- Common Calls

Each verified ruling card displays:

1. CALL — immediate decision
2. WHAT HAPPENED — plain-language scenario
3. WHAT TO DO — enforcement / runner placement / play status
4. WHY — concise explanation
5. VISUAL — original field diagram or stepped play
6. OFFICIAL RULE — exact ruleset source link/section
7. RELATED CALLS
8. Verification badge

## Search Behavior

Search should support synonyms and natural phrases, for example:

- `runner left early`
- `ball behind first`
- `fielder blocking base`
- `pitch bounced twice`
- `caught foul fly`

Phase 1 uses deterministic verified-scenario search. PostgreSQL full-text search is preferred, with optional trigram support for typo tolerance. Queries must be parameterized, length bounded, and scoped to the active ruleset version resolved through the requested team.

AI-assisted semantic retrieval may be added later, but it may only select among verified scenarios and may not invent a ruling.

## Game Count Model

The existing shared `team_states.state` remains the authority for live Umpire/Captain/Player count synchronization.

`state.counts` must explicitly normalize to:

```json
{
  "balls": 0,
  "strikes": 0,
  "fouls": 0,
  "outs": 0
}
```

Old state documents without `strikes` must lazily/default-migrate to `strikes: 0` without destructive state replacement.

Thresholds are ruleset-configurable. The UI must not assume Stonewall defaults.

## Stonewall Sports Boston Fall 2026 Seed Scope

Stonewall is seed/configuration data only — never a core code path.

Initial verified scenario groups:

### Pitch / Strike Zone
- one-foot strike-zone boundary around sides/back of home plate
- front-of-plate exclusion
- two-or-more bounce / rolling pitch handling from training material

### Overthrows
- out-of-bounds overthrow
- dead-ball overthrow
- general overthrow
- adjacent-infield overthrow

### Fair / Foul
- ground ball entering foul territory before first/third without touch
- airborne kick determined by first touch/landing location

### Encroachment
- first-to-third imaginary restriction line through pitcher area
- release when kicker touches the ball

### Tagging Up
- fair caught fly: runner release timing tied to first fielder touch as described in training
- foul caught fly: runner waits until full catch as described in training

### Force Outs
- forced advancement caused by kicker becoming runner
- base touch with possession; no runner tag required

### Umpire Signals
- Stonewall Boston call-sign training is a source reference while the product uses its own UI and visual treatment

## Verification and Publishing

Workflow:

`Draft -> Review -> Verified -> Active -> Superseded`

Ruleset publishing must be transactional. Activation of a new version must not mutate prior version content. A live game can only bind to an approved version. Draft/Review content may appear only in authorized admin preview surfaces.

## API Boundaries

Prefer a dedicated rules endpoint/module rather than continuously expanding the already-large generic team-state handler, unless deployment constraints require consolidation.

Expected read capabilities:

- resolve active ruleset metadata for team/game
- search verified scenarios within resolved ruleset version
- fetch complete verified ruling card
- fetch related calls
- fetch umpire signals

Expected admin capabilities:

- create draft version from active snapshot
- edit draft content
- move draft through review/verification
- transactionally publish/activate version
- bind team/season

Expected game capability:

- bind game to exact active ruleset version at game start

Never trust a client-supplied ruleset ID by itself; resolve/validate it through team/league/game bindings.

## Query Safety

- Use Neon tagged-template parameterization for all user-controlled values.
- Explicitly cast ambiguous UUID/text parameters where PostgreSQL inference could fail.
- Bound search query length and result count.
- Never concatenate raw search strings into SQL.
- Live result queries include the resolved `ruleset_version_id` and verified status predicates.

## Commercial Readiness

The engine must never assume one league name, one logo, one count structure, or one rulebook. League branding, rule text, counts, scenarios, sources, visuals, and enforcement configuration must be data-driven.

Potential product packaging:

- Team Game Day
- Umpire Console
- Rules & Calls Assistant
- Visual Umpire Training
- League Administration / Ruleset Publishing

## Implementation Phases

### Phase 1 — Foundation
- inspect current production schema/migration conventions before running SQL
- add immutable ruleset schema
- add safe `strikes: 0` compatibility normalization to existing live state
- seed Stonewall Fall 2026 version 1 as data
- team/season and game-to-version binding
- ruleset count configuration

### Phase 2 — Rules API
- exact-team-scoped active ruleset resolver
- deterministic verified search
- verified ruling retrieval
- related calls/source retrieval
- authorization tests

### Phase 3 — Umpire UX
- persistent Rules & Calls overlay
- Balls / Strikes / Fouls / Outs controls
- category navigation
- verified ruling card
- source links

### Phase 4 — Visual Plays
- reusable kickball field diagram renderer
- stepped scenarios
- strike zone, overthrow, fair/foul, encroachment, tagging-up, force-out visuals
- umpire signal reference

### Phase 5 — League Admin
- ruleset creation/editing
- verification workflow
- transactional version publishing
- branding and licensing support

## Acceptance Criteria for First Production Slice

- No Stonewall-only logic is hard-coded into the generic engine.
- Ruleset identity and ruleset version are separate concepts.
- Active/published content is immutable by version.
- A game resolves and preserves its exact ruleset version.
- All rules queries remain scoped to the resolved team/game tenant.
- Umpire can open Rules & Calls without losing live game context.
- Search returns only verified scenarios in live mode.
- Every displayed live call has a verified source reference.
- Balls, strikes, fouls, and outs are distinct values in existing shared game state.
- Old team state without strikes remains compatible.
- Visual definitions are structured/safe and usable on a phone.
- Existing founder Bunt Cakes workspace and legacy team state continue to function.
