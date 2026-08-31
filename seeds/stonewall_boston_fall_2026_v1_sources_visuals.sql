-- Stonewall Sports Boston Fall 2026 v1 source references + app-owned visual placeholders
-- REVIEW ONLY.

WITH v AS (
  SELECT rv.id FROM ruleset_versions rv
  JOIN rulesets r ON r.id=rv.ruleset_id
  JOIN leagues l ON l.id=r.league_id
  WHERE l.slug='stonewall-sports-boston' AND rv.version=1
  LIMIT 1
)
INSERT INTO rule_sources(ruleset_version_id,name,publisher,citation,verification_status,verified_at)
SELECT v.id,x.name,'Stonewall Sports Boston',x.citation,x.status,
       CASE WHEN x.status='verified' THEN now() ELSE NULL END
FROM v CROSS JOIN (VALUES
 ('SSB Kickball Rules - Updated 3/17/26','Official Stonewall Sports Boston kickball rules updated 3/17/26','verified'),
 ('Stonewall Boston Fall 2026 Umpire Training','League umpire training video summary supplied for Fall 2026','review'),
 ('Overthrow Guide Final','Stonewall Boston overthrow quick-reference guide','verified'),
 ('Stonewall Boston Umpire Call Signs','Stonewall Boston umpire signal reference','review')
) AS x(name,citation,status)
ON CONFLICT (ruleset_version_id,name) DO NOTHING;

-- Link all v1 verified rules to the official rulebook source.
WITH v AS (
  SELECT rv.id FROM ruleset_versions rv
  JOIN rulesets r ON r.id=rv.ruleset_id
  JOIN leagues l ON l.id=r.league_id
  WHERE l.slug='stonewall-sports-boston' AND rv.version=1
  LIMIT 1
), source AS (
  SELECT rs.id FROM rule_sources rs JOIN v ON v.id=rs.ruleset_version_id
  WHERE rs.name='SSB Kickball Rules - Updated 3/17/26' AND rs.verification_status='verified' LIMIT 1
)
INSERT INTO rule_source_links(rule_id,source_id)
SELECT r.id,s.id FROM rules r JOIN v ON v.id=r.ruleset_version_id CROSS JOIN source s
WHERE r.verification_status='verified'
ON CONFLICT DO NOTHING;

-- App-owned structured visual placeholders. No third-party image or raw SVG is stored.
WITH v AS (
  SELECT rv.id FROM ruleset_versions rv
  JOIN rulesets r ON r.id=rv.ruleset_id
  JOIN leagues l ON l.id=r.league_id
  WHERE l.slug='stonewall-sports-boston' AND rv.version=1
  LIMIT 1
), s AS (
  SELECT id,scenario_key,title FROM ruling_scenarios JOIN v ON v.id=ruling_scenarios.ruleset_version_id
  WHERE scenario_key IN (
    'overthrow-left-game-area','overthrow-unsafe-area','overthrow-past-first',
    'ball-adjacent-infield','fielder-crossed-early','runner-left-early-fly','force-base-touch'
  )
)
INSERT INTO rule_visuals(
  ruleset_version_id,scenario_id,visual_key,title,visual_type,definition_json,alt_text
)
SELECT v.id,s.id,'visual-'||s.scenario_key,s.title,'stepped',
  jsonb_build_object(
    'field','kickball_standard',
    'orientation','defense',
    'steps',jsonb_build_array(
      jsonb_build_object('phase','before','elements',jsonb_build_array()),
      jsonb_build_object('phase','play','elements',jsonb_build_array()),
      jsonb_build_object('phase','call','elements',jsonb_build_array())
    )
  ),
  'Three-step kickball field diagram for '||s.title
FROM v CROSS JOIN s
ON CONFLICT (ruleset_version_id,visual_key) DO NOTHING;
