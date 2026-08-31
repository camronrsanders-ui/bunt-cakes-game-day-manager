# Rules & Calls Engine — Implementation Guardrails

These decisions resolve the final blocking review before Phase 1 code/migration work.

## 1. Vercel function budget

The production project currently has 12 deployable `/api/*.js` endpoints and runs on the Vercel Hobby plan. We will not add a 13th deployable API file in Phase 1.

Rules & Calls functionality will reuse an existing deployable endpoint and may use non-deployable helper modules outside the API surface. If the hosting plan/function budget changes later, the rules API can be split without changing the data model.

## 2. Status separation

Publication state and rule verification are separate concepts.

- `ruleset_versions.status`: `draft | review | active | superseded`
- `rules.verification_status`: `draft | review | verified`
- `rule_sources.verification_status`: `draft | review | verified`

Live retrieval requires the resolved ruleset version to be `active` and the returned rule/source content to be `verified`.

## 3. No circular current-version foreign key

`rulesets` is a stable logical identity only and has no `current_version_id`.

- current team/season resolution: `team_ruleset_bindings.active_ruleset_version_id`
- historical game resolution: `game_ruleset_bindings.ruleset_version_id`

## 4. Indexed deterministic search

`ruling_scenarios.search_text` will be a stored generated `tsvector` with a GIN index.

Search input rules:

- trim whitespace
- empty query => no results
- maximum 120 characters
- parameterized query only
- explicit PostgreSQL casts where inference may be ambiguous
- scope to exact resolved team + active ruleset version
- only rules with `verification_status = 'verified'`

Phase 1 does not need generative AI to decide calls.

## 5. Shared count normalization

The existing `team_states.state` remains the live source of truth.

All Captain and Player response paths must normalize counts to:

```json
{
  "balls": 0,
  "strikes": 0,
  "fouls": 0,
  "outs": 0
}
```

Missing `strikes` is treated as `0` without destructively rewriting historical state.

## 6. PostgreSQL casts

New rules queries must use explicit casts for UUID/text/jsonb parameters when ambiguity is possible. Do not rely on server inference in complex CTE, JSON, `unnest`, or search queries.

## 7. Stable game binding

`game_ruleset_bindings` uses a stable internal event/game identifier and `team_id`.

Primary key:

```sql
PRIMARY KEY (team_id, game_id)
```

Do not bind using event title, opponent name, date display text, or team slug.

## 8. Version immutability

Stonewall Boston Fall 2026 is version 1 seed/configuration data. Once active, version 1 content is immutable. Later material changes create v2+.

Draft versions may be edited before activation. Activation is transactional and freezes the version. No previously active child rows are updated in-place.

## 9. Visual safety

Visuals are typed JSON only. No stored raw HTML or executable SVG strings.

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

The application renderer owns DOM/SVG creation.

## 10. Migration safety

Migration dependency order:

1. leagues
2. seasons
3. rulesets
4. ruleset_versions
5. rule_categories
6. rules
7. ruling_scenarios
8. rule_visuals
9. umpire_signals
10. rule_sources
11. rule_values
12. team_ruleset_bindings
13. game_ruleset_bindings

No migration rewrites `team_states.state`; strike compatibility remains application-side.

## Phase 1 gate

Migration SQL may be committed for review, but it must not be applied to production Neon until schema/type compatibility and the full seed are reviewed by both engineers.
