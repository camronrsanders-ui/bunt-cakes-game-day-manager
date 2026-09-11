-- Bind the founder Bunt Cakes workspace to Stonewall Sports Boston Fall 2026 v1.
-- REVIEW ONLY. Run only after v1 activation has passed on the test branch.
-- Uses the existing team slug and casts the existing team ID to text, matching
-- the Phase 1 binding schema without assuming the physical teams.id type.

DO $$
DECLARE
  target_team_id text;
  version_id uuid;
  league_id uuid;
  season_id uuid;
  existing_version uuid;
BEGIN
  SELECT t.id::text INTO target_team_id
  FROM teams t
  WHERE t.slug='those-dirty-bunt-cakes' AND t.active=true
  LIMIT 1;

  IF target_team_id IS NULL THEN
    RAISE EXCEPTION 'Founder Bunt Cakes team was not found';
  END IF;

  SELECT rv.id,l.id,s.id
    INTO version_id,league_id,season_id
  FROM ruleset_versions rv
  JOIN rulesets rs ON rs.id=rv.ruleset_id
  JOIN leagues l ON l.id=rs.league_id
  LEFT JOIN seasons s ON s.id=rv.season_id
  WHERE l.slug='stonewall-sports-boston'
    AND rs.name='Stonewall Boston Kickball Rules'
    AND rv.version=1
    AND rv.status='active'
  LIMIT 1;

  IF version_id IS NULL THEN
    RAISE EXCEPTION 'Stonewall Boston v1 is not active';
  END IF;

  SELECT active_ruleset_version_id INTO existing_version
  FROM team_ruleset_bindings
  WHERE team_id=target_team_id AND active_to IS NULL
  LIMIT 1;

  IF existing_version IS NOT NULL AND existing_version<>version_id THEN
    RAISE EXCEPTION 'Team already has a different current ruleset binding';
  END IF;

  IF existing_version IS NULL THEN
    INSERT INTO team_ruleset_bindings(team_id,league_id,season_id,active_ruleset_version_id)
    VALUES(target_team_id,league_id,season_id,version_id);
  END IF;
END;
$$;
