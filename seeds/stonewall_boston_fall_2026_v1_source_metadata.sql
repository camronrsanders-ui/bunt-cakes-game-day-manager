-- Stonewall Sports Boston Fall 2026 v1 source metadata
-- REVIEW ONLY. Run after stonewall_boston_fall_2026_v1_sources_visuals.sql.

WITH v AS (
  SELECT rv.id
  FROM ruleset_versions rv
  JOIN rulesets rs ON rs.id=rv.ruleset_id
  JOIN leagues l ON l.id=rs.league_id
  WHERE l.slug='stonewall-sports-boston' AND rv.version=1
  LIMIT 1
)
UPDATE rule_sources src
SET url=CASE src.name
  WHEN 'SSB Kickball Rules - Updated 3/17/26' THEN 'https://docs.google.com/document/u/1/d/e/2PACX-1vQ9OBOHo_OxrX3U46sTHYxStc21qJearXIKuRpZ-FuEWlCXSyCg3nqs5co3zdjUKeVQ_7oELo7-nuKH/pub?pli=1'
  WHEN 'Stonewall Boston Fall 2026 Umpire Training' THEN 'https://drive.google.com/file/d/1r2O8EWHLNMwtCj0nzxbB7CVrTUMyggoO/view?usp=drivesdk'
  WHEN 'Overthrow Guide Final' THEN 'https://docs.google.com/document/d/1FLAogNU9MqUU7EYt2DeIAv7hJujot_U0wesQxWJcd5w/edit?usp=drivesdk'
  WHEN 'Stonewall Boston Umpire Call Signs' THEN 'https://drive.google.com/file/d/1L9KTT58ZPBS0crAA8qpNakbf33KbwneX/view?usp=drivesdk'
  ELSE src.url
END
FROM v
WHERE src.ruleset_version_id=v.id
  AND src.name IN (
    'SSB Kickball Rules - Updated 3/17/26',
    'Stonewall Boston Fall 2026 Umpire Training',
    'Overthrow Guide Final',
    'Stonewall Boston Umpire Call Signs'
  );

-- Overthrow rulings also cite the verified league overthrow guide in addition to
-- the official rulebook.
WITH v AS (
  SELECT rv.id
  FROM ruleset_versions rv
  JOIN rulesets rs ON rs.id=rv.ruleset_id
  JOIN leagues l ON l.id=rs.league_id
  WHERE l.slug='stonewall-sports-boston' AND rv.version=1
  LIMIT 1
), src AS (
  SELECT id FROM rule_sources
  WHERE ruleset_version_id=(SELECT id FROM v)
    AND name='Overthrow Guide Final'
    AND verification_status='verified'
  LIMIT 1
)
INSERT INTO rule_source_links(rule_id,source_id)
SELECT r.id,src.id
FROM rules r CROSS JOIN src
WHERE r.ruleset_version_id=(SELECT id FROM v)
  AND r.rule_key IN (
    'overthrow-out-of-bounds','overthrow-dead-ball',
    'overthrow-general','overthrow-adjacent-infield'
  )
  AND r.verification_status='verified'
ON CONFLICT DO NOTHING;
