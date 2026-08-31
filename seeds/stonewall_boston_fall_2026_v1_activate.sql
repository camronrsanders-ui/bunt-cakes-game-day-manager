-- Stonewall Sports Boston Fall 2026 v1 final publication step
-- REVIEW ONLY. Run LAST after all v1 content/source/visual/signal seeds pass review.
-- This transaction makes v1 active only after required verified content is present.

BEGIN;

DO $$
DECLARE
  target_version_id uuid;
  target_ruleset_id uuid;
  verified_rules integer;
  verified_scenarios integer;
  visuals integer;
  verified_sources integer;
  signals integer;
  uncited_verified_rules integer;
BEGIN
  SELECT rv.id,rv.ruleset_id
    INTO target_version_id,target_ruleset_id
  FROM ruleset_versions rv
  JOIN rulesets rs ON rs.id=rv.ruleset_id
  JOIN leagues l ON l.id=rs.league_id
  WHERE l.slug='stonewall-sports-boston'
    AND rs.name='Stonewall Boston Kickball Rules'
    AND rv.version=1
  LIMIT 1;

  IF target_version_id IS NULL THEN
    RAISE EXCEPTION 'Stonewall Boston v1 does not exist';
  END IF;

  SELECT count(*) INTO verified_rules
  FROM rules
  WHERE ruleset_version_id=target_version_id AND verification_status='verified';

  SELECT count(*) INTO verified_scenarios
  FROM ruling_scenarios s
  JOIN rules r ON r.id=s.rule_id AND r.ruleset_version_id=s.ruleset_version_id
  WHERE s.ruleset_version_id=target_version_id AND r.verification_status='verified';

  SELECT count(*) INTO visuals
  FROM rule_visuals
  WHERE ruleset_version_id=target_version_id;

  SELECT count(*) INTO verified_sources
  FROM rule_sources
  WHERE ruleset_version_id=target_version_id AND verification_status='verified';

  SELECT count(*) INTO signals
  FROM umpire_signals s
  JOIN rule_sources src ON src.id=s.source_id AND src.ruleset_version_id=s.ruleset_version_id
  WHERE s.ruleset_version_id=target_version_id AND src.verification_status='verified';

  SELECT count(*) INTO uncited_verified_rules
  FROM rules r
  WHERE r.ruleset_version_id=target_version_id
    AND r.verification_status='verified'
    AND NOT EXISTS (
      SELECT 1
      FROM rule_source_links lnk
      JOIN rule_sources src ON src.id=lnk.source_id
      WHERE lnk.rule_id=r.id
        AND src.ruleset_version_id=target_version_id
        AND src.verification_status='verified'
    );

  IF verified_rules < 12 THEN RAISE EXCEPTION 'v1 requires at least 12 verified rules, found %',verified_rules; END IF;
  IF verified_scenarios < 13 THEN RAISE EXCEPTION 'v1 requires at least 13 verified scenarios, found %',verified_scenarios; END IF;
  IF visuals < 9 THEN RAISE EXCEPTION 'v1 requires at least 9 play visuals, found %',visuals; END IF;
  IF verified_sources < 3 THEN RAISE EXCEPTION 'v1 requires at least 3 verified sources, found %',verified_sources; END IF;
  IF signals <> 7 THEN RAISE EXCEPTION 'v1 requires exactly 7 verified umpire signals, found %',signals; END IF;
  IF uncited_verified_rules <> 0 THEN RAISE EXCEPTION 'v1 has % verified rules without a verified source',uncited_verified_rules; END IF;

  -- Future-safe: if another version of this logical ruleset were active, retire it
  -- before activating this reviewed version. This does not mutate its child content.
  UPDATE ruleset_versions rv
  SET status='superseded',effective_to=COALESCE(rv.effective_to,now())
  WHERE rv.ruleset_id=target_ruleset_id
    AND rv.id<>target_version_id
    AND rv.status='active';

  UPDATE ruleset_versions rv
  SET status='active',
      effective_from=COALESCE(rv.effective_from,now()),
      effective_to=NULL,
      published_at=COALESCE(rv.published_at,now())
  WHERE rv.id=target_version_id
    AND rv.status IN ('review','active');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'v1 must be in review or already active before publication';
  END IF;
END;
$$;

COMMIT;
