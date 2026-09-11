# Rules & Calls Engine — Neon Temporary Branch Rollout Runbook

This runbook is the connector-independent path to finish Phase 1 safely.

## Safety rule

Run every step below on a **temporary Neon branch cloned from production**. Do **not** run these files on the production branch until all validation queries pass and production approval is explicit.

Database: `neondb`

## Execute in this exact order

1. `migrations/001_rules_calls_foundation.sql`
2. `migrations/002_rules_calls_integrity.sql`
3. `seeds/stonewall_boston_fall_2026_v1_core.sql`
4. `seeds/stonewall_boston_fall_2026_v1_scenarios.sql`
5. `seeds/stonewall_boston_fall_2026_v1_sources_visuals.sql`
6. `seeds/stonewall_boston_fall_2026_v1_source_metadata.sql`
7. `seeds/stonewall_boston_fall_2026_v1_signals.sql`
8. `seeds/stonewall_boston_fall_2026_v1_remaining_verified.sql`
9. `seeds/stonewall_boston_fall_2026_v1_tag_up_timing.sql`
10. `seeds/stonewall_boston_fall_2026_v1_activate.sql`
11. `seeds/stonewall_boston_fall_2026_v1_bind_bunt_cakes.sql`

Do not reorder the files. Version v1 stays in review until step 10. Step 11 binds only the founder Bunt Cakes test workspace after activation.

## Validation queries

Run these after step 11.

```sql
SELECT rv.id, rv.version, rv.status, rv.published_at,
       r.name AS ruleset_name, s.name AS season_name, l.name AS league_name
FROM ruleset_versions rv
JOIN rulesets r ON r.id = rv.ruleset_id
JOIN leagues l ON l.id = r.league_id
LEFT JOIN seasons s ON s.id = rv.season_id
WHERE l.name = 'Stonewall Sports Boston'
  AND s.name = 'Fall 2026'
  AND rv.version = 1;
```

Expected: exactly one v1 row with status `active`.

```sql
SELECT
  COUNT(*) FILTER (WHERE verification_status='verified') AS verified_rules
FROM rules
WHERE ruleset_version_id = (
  SELECT rv.id
  FROM ruleset_versions rv
  JOIN rulesets r ON r.id=rv.ruleset_id
  JOIN leagues l ON l.id=r.league_id
  JOIN seasons s ON s.id=rv.season_id
  WHERE l.name='Stonewall Sports Boston' AND s.name='Fall 2026' AND rv.version=1
);
```

Expected: at least 12 verified rules.

```sql
SELECT COUNT(*) AS scenarios
FROM ruling_scenarios
WHERE ruleset_version_id = (
  SELECT rv.id
  FROM ruleset_versions rv
  JOIN rulesets r ON r.id=rv.ruleset_id
  JOIN leagues l ON l.id=r.league_id
  JOIN seasons s ON s.id=rv.season_id
  WHERE l.name='Stonewall Sports Boston' AND s.name='Fall 2026' AND rv.version=1
);
```

Expected: at least 13 scenarios.

```sql
SELECT COUNT(*) AS visuals
FROM rule_visuals
WHERE ruleset_version_id = (
  SELECT rv.id
  FROM ruleset_versions rv
  JOIN rulesets r ON r.id=rv.ruleset_id
  JOIN leagues l ON l.id=r.league_id
  JOIN seasons s ON s.id=rv.season_id
  WHERE l.name='Stonewall Sports Boston' AND s.name='Fall 2026' AND rv.version=1
);
```

Expected: at least 9 visuals.

```sql
SELECT COUNT(*) AS signals
FROM umpire_signals
WHERE ruleset_version_id = (
  SELECT rv.id
  FROM ruleset_versions rv
  JOIN rulesets r ON r.id=rv.ruleset_id
  JOIN leagues l ON l.id=r.league_id
  JOIN seasons s ON s.id=rv.season_id
  WHERE l.name='Stonewall Sports Boston' AND s.name='Fall 2026' AND rv.version=1
);
```

Expected: exactly 7 signals.

```sql
SELECT COUNT(*) AS uncited_verified_rules
FROM rules r
WHERE r.ruleset_version_id = (
  SELECT rv.id
  FROM ruleset_versions rv
  JOIN rulesets rs ON rs.id=rv.ruleset_id
  JOIN leagues l ON l.id=rs.league_id
  JOIN seasons s ON s.id=rv.season_id
  WHERE l.name='Stonewall Sports Boston' AND s.name='Fall 2026' AND rv.version=1
)
AND r.verification_status='verified'
AND NOT EXISTS (
  SELECT 1
  FROM rule_source_links rsl
  JOIN rule_sources src ON src.id=rsl.source_id
  WHERE rsl.rule_id=r.id AND src.verification_status='verified'
);
```

Expected: `0`.

```sql
SELECT t.slug, b.active_ruleset_version_id, b.active_from, b.active_to
FROM team_ruleset_bindings b
JOIN teams t ON t.id::text=b.team_id
WHERE t.slug='those-dirty-bunt-cakes' AND b.active_to IS NULL;
```

Expected: exactly one current founder-team binding.

## Immutability checks

Use the v1 id from the first validation query.

Attempting to edit an active rules row should fail:

```sql
BEGIN;
UPDATE rules SET quick_summary=quick_summary WHERE ruleset_version_id='<V1_ID>';
ROLLBACK;
```

Expected: failure indicating published ruleset content is immutable.

Attempting to update/delete a historical game binding after one exists should fail. Do this only after the application has created a game binding on the temporary branch.

## Application checks

After the database validations pass, point a preview/test deployment at the temporary branch and verify:

- Rules & Calls opens inside the Umpire Console.
- Search returns verified Stonewall scenarios.
- A ruling shows call, explanation, visual, official source, and related calls.
- Umpire Signals returns exactly seven verified signals.
- Balls/strikes/fouls/outs use the ruleset-configured limits.
- A stable game ID creates a write-once game ruleset binding.
- A bound game continues resolving its historical version after that version is later superseded.
- Legacy fallback event keys do not create historical bindings.
- Unauthorized users cannot query another team's rules context.

## Production gate

Do not apply to production until all SQL checks and application checks pass. Production application should use the same ordered files and the same validation queries.