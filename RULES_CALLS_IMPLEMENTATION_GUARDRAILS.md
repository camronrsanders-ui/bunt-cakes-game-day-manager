# Rules & Calls Engine — Implementation Guardrails

These decisions describe the current Phase 1 implementation and supersede older architecture examples where they conflict.

## 1. Vercel function budget

The production project has 12 deployable `/api/*.js` endpoints and runs on the Vercel Hobby plan. Phase 1 does not add another deployable API file.

Rules & Calls reuses `/api/team-state/umpire` through the existing account rewrite and keeps reusable logic in non-deployable helper modules.

## 2. Status separation

Publication state and rule/source verification are separate concepts.

- `ruleset_versions.status`: `draft | review | active | superseded`
- `rules.verification_status`: `draft | review | verified`
- `rule_sources.verification_status`: `draft | review | verified`

There is no `verified` ruleset-version status. Live team resolution uses `active`; a historical game may continue resolving its immutable `superseded` version. Displayed rules and sources remain verified-only.

## 3. No circular current-version foreign key

`rulesets` is a stable logical identity only and has no `current_version_id`.

- current team/season resolution: `team_ruleset_bindings.active_ruleset_version_id`
- historical game resolution: `game_ruleset_bindings.ruleset_version_id`

## 4. Indexed deterministic search

`ruling_scenarios.search_text` is a stored generated `tsvector` with a GIN index.

Search input rules:

- trim whitespace
- empty query => no results
- maximum 120 characters
- parameterized query only
- explicit PostgreSQL casts where inference may be ambiguous
- exact resolved ruleset version
- only rules with `verification_status = 'verified'`

Phase 1 does not use generative AI to decide calls.

## 5. Shared count normalization and configurable limits

The existing live game-state stores remain the source of truth for game counts.

All Captain and Player response paths normalize counts to:

```json
{
  "balls": 0,
  "strikes": 0,
  "fouls": 0,
  "outs": 0
}
```

Missing `strikes` is treated as `0` without rewriting old JSON rows.

Umpire Console count limits resolve from `rule_values` for the game/team ruleset. Stonewall defaults are used only as a compatibility fallback when the Rules schema has not been migrated yet.

## 6. PostgreSQL casts

New rules queries use explicit casts for UUID/text/jsonb parameters where ambiguity is possible. User-controlled search text is never concatenated into SQL.

## 7. Stable game binding

`game_ruleset_bindings` uses `(team_id, game_id)` and the game ID comes only from a real event `id` or `sourceUid`.

The legacy Umpire state can still use the old date/time/title fallback for backward compatibility, but that fallback is never used to create a historical rules binding.

On the first game mutation or first game-scoped Rules & Calls read, the stable game is bound to the then-active ruleset. Future reads use that exact version even after it becomes `superseded`.

## 8. Version immutability and publication

Stonewall Boston Fall 2026 version 1 is assembled in `review` state. Child seed data, sources, signals and visuals are loaded before publication.

`stonewall_boston_fall_2026_v1_activate.sql` validates the required verified content and then activates v1 transactionally.

`002_rules_calls_integrity.sql` prevents inserts/updates/deletes of version-owned child content after a version becomes active. Material changes therefore require v2+ rather than editing v1 in place.

## 9. Cross-version integrity

The hardening migration adds same-version relationships so scenario rules/categories, visuals, and umpire signal sources cannot point across ruleset versions.

`rule_source_links` is also validated by a trigger to ensure its rule and source belong to the same version.

Every published umpire signal requires a source. The official Stonewall call-sign source remains directly attached to all seven seeded signals.

## 10. Visual safety

Visuals are structured JSON only. No stored raw HTML or executable SVG strings.

Minimum stepped structure:

```json
{
  "steps": [
    {"phase":"before","elements":[]},
    {"phase":"play","elements":[]},
    {"phase":"call","elements":[]}
  ]
}
```

The generic application renderer owns DOM/SVG creation.

Phase 1 includes original app-owned diagrams for overthrows, encroachment, tag-up, force out, strike zone and fair/foul.

## 11. Umpire signals

The official Stonewall Boston Umpire Call Signs PDF was inspected directly before signal seeding.

The seven source-backed signals are Ball, Strike, Foul, Fair, Out, Safe, and Dead Ball / Play Ends. The source does not define separate required spoken wording, so `verbal_call` remains empty rather than invented.

## 12. Migration and seed order

Schema order in `001_rules_calls_foundation.sql` creates dependencies before dependents, including `rule_sources` before `umpire_signals`.

Review/test execution order:

1. `migrations/001_rules_calls_foundation.sql`
2. `migrations/002_rules_calls_integrity.sql`
3. `seeds/stonewall_boston_fall_2026_v1_core.sql`
4. `seeds/stonewall_boston_fall_2026_v1_scenarios.sql`
5. `seeds/stonewall_boston_fall_2026_v1_sources_visuals.sql`
6. `seeds/stonewall_boston_fall_2026_v1_signals.sql`
7. `seeds/stonewall_boston_fall_2026_v1_remaining_verified.sql`
8. `seeds/stonewall_boston_fall_2026_v1_activate.sql`
9. create/verify the intended `team_ruleset_bindings` row for the target test workspace
10. exercise active/search/ruling/signals and game binding end to end

No migration rewrites `team_states.state`.

## 13. Production gate

Production Neon remains untouched until all of the following are true:

- the migration package executes successfully on a temporary Neon branch
- schema integrity queries pass
- all seed validation/activation checks pass
- game binding and historical-version behavior pass
- Captain and assigned-umpire authorization pass
- mobile Rules & Calls UX passes
- both engineering reviews have no blocking findings
- the user explicitly approves production migration

Current external blocker: the Neon migration connector exposes camelCase arguments but its backend rejects them in favor of a different snake_case schema, so it cannot currently create the required temporary branch. This is a tooling block, not permission to bypass the temporary-branch gate.
