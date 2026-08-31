# Rules & Calls Engine Architecture

## Product Goal

Build a configurable, commercial-ready kickball officiating system. Stonewall Sports Boston Fall 2026 is the first production ruleset, but the engine must support other teams, leagues, seasons, and rule variants without hard-coding Stonewall behavior into the core app.

## Core Principle

Natural-language search may help an umpire find a scenario, but live rulings must resolve to structured, versioned, verified rules — never free-form AI-generated decisions.

Flow:

`Umpire question -> scenario match -> verified ruling -> visual explanation -> official source`

## Tenant Model

Existing team workspaces remain isolated. Rulesets are introduced above/beside team state so multiple teams may share a league ruleset.

Proposed hierarchy:

- Organization / League
- Season
- Ruleset Version
- Rule Categories
- Rules
- Scenarios / Quick Calls
- Visual Diagrams
- Umpire Signals
- Source References

A team/game points to the ruleset version active for that game. Historical games retain the ruleset version they were played under.

## Proposed Data Model

### leagues
- id
- name
- slug
- branding_json
- created_at
- updated_at

### seasons
- id
- league_id
- name
- starts_at
- ends_at
- status

### rulesets
- id
- league_id
- season_id nullable
- name
- version
- status: draft | verified | retired
- effective_from
- effective_to nullable
- source_title
- source_url nullable
- verified_at nullable
- created_at
- updated_at

### rule_categories
- id
- ruleset_id
- slug
- name
- display_order

### rules
- id
- ruleset_id
- category_id
- rule_key
- title
- official_text
- quick_summary
- source_section nullable
- source_url nullable
- keywords_json
- active

### ruling_scenarios
- id
- ruleset_id
- category_id
- scenario_key
- title
- question_prompt nullable
- call_label
- call_type
- explanation
- next_action
- search_phrases_json
- decision_tree_json nullable
- related_rule_ids_json
- visual_id nullable
- verified
- display_priority

### rule_visuals
- id
- ruleset_id
- visual_key
- title
- visual_type: static | stepped | animated
- definition_json
- alt_text
- attribution nullable

Visual definitions should be original app-owned field geometry and symbols where possible, rather than redistributing third-party training assets.

### umpire_signals
- id
- ruleset_id
- signal_key
- title
- verbal_call
- instructions
- visual_id nullable
- source_reference nullable

### game_ruleset_bindings
- game_id
- ruleset_id
- bound_at

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

Phase 1 uses deterministic keyword/phrase matching with ranked aliases. AI-assisted semantic retrieval may be added later, but it may only select among verified scenarios and may not invent a ruling.

## Game Count Model

Umpire game state must explicitly track:

- balls
- strikes
- fouls
- outs

Counts are ruleset-configurable. Stonewall Boston Fall 2026 should be represented through configuration rather than constants in the UI.

Proposed ruleset game configuration includes:

- balls_for_walk
- strikes_for_out
- fouls_for_out
- innings
- mercy rules
- pitch constraints
- field constraints
- other league-specific enforcement options

## Stonewall Sports Boston Fall 2026 Seed Scope

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
- use Stonewall Boston call-sign training as source reference while creating app-owned presentation/visual treatment

## Verification and Publishing

Ruleset changes use a publish workflow:

`Draft -> Review -> Verified -> Active`

A verified ruleset cannot be silently edited. Material changes create a new version. This preserves historical game accuracy and supports commercial league licensing.

## Commercial Readiness

The engine must never assume one league name, one logo, or one rulebook. League branding, rule text, counts, scenarios, sources, and visuals must be configurable.

Potential product packaging:

- Team Game Day
- Umpire Console
- Rules & Calls Assistant
- Visual Umpire Training
- League Administration / Ruleset Publishing

## Implementation Phases

### Phase 1 — Foundation
- ruleset schema and migration
- Stonewall Fall 2026 seed data
- game-to-ruleset binding
- Balls / Strikes / Fouls / Outs configuration

### Phase 2 — Umpire UX
- Rules & Calls overlay
- deterministic search
- category navigation
- verified ruling card
- source links

### Phase 3 — Visual Plays
- reusable kickball field diagram component
- stepped scenarios
- strike zone, overthrow, fair/foul, encroachment, tagging-up, force-out visuals
- umpire signal reference

### Phase 4 — League Admin
- ruleset creation/editing
- verification workflow
- version publishing
- branding and licensing support

## Acceptance Criteria for First Production Slice

- No Stonewall-only logic is hard-coded into the generic engine.
- A game resolves its active ruleset explicitly.
- Umpire can open Rules & Calls without losing live game context.
- Search returns only verified scenarios.
- Every displayed call has a source reference.
- Balls, strikes, fouls, and outs are distinct game-state values.
- Core Stonewall Fall 2026 training scenarios are available.
- Rule visuals are accessible and usable on a phone in active game conditions.
- Existing founder Bunt Cakes workspace and legacy team state continue to function.