-- Stonewall Sports Boston Fall 2026 v1 core seed
-- REVIEW ONLY. Do not apply until migration is approved.
-- Version 1 is assembled in review state; the final activation seed publishes it only after validation.

WITH league_row AS (
  INSERT INTO leagues(name,slug)
  VALUES ('Stonewall Sports Boston','stonewall-sports-boston')
  ON CONFLICT (slug) DO UPDATE SET name=EXCLUDED.name
  RETURNING id
), league_id AS (
  SELECT id FROM league_row
  UNION ALL SELECT id FROM leagues WHERE slug='stonewall-sports-boston' LIMIT 1
), season_row AS (
  INSERT INTO seasons(league_id,name,status)
  SELECT id,'Fall 2026','active' FROM league_id LIMIT 1
  ON CONFLICT (league_id,name) DO UPDATE SET status=EXCLUDED.status
  RETURNING id,league_id
), season_id AS (
  SELECT id,league_id FROM season_row
  UNION ALL SELECT s.id,s.league_id FROM seasons s JOIN league_id l ON l.id=s.league_id WHERE s.name='Fall 2026' LIMIT 1
), ruleset_row AS (
  INSERT INTO rulesets(league_id,name)
  SELECT league_id,'Stonewall Boston Kickball Rules' FROM season_id LIMIT 1
  ON CONFLICT (league_id,name) DO UPDATE SET name=EXCLUDED.name
  RETURNING id
), ruleset_id AS (
  SELECT id FROM ruleset_row
  UNION ALL SELECT r.id FROM rulesets r JOIN league_id l ON l.id=r.league_id WHERE r.name='Stonewall Boston Kickball Rules' LIMIT 1
), version_row AS (
  INSERT INTO ruleset_versions(ruleset_id,season_id,version,status,published_at)
  SELECT r.id,s.id,1,'review',NULL FROM ruleset_id r CROSS JOIN season_id s LIMIT 1
  ON CONFLICT (ruleset_id,version) DO NOTHING
  RETURNING id
), version_id AS (
  SELECT id FROM version_row
  UNION ALL SELECT rv.id FROM ruleset_versions rv JOIN ruleset_id r ON r.id=rv.ruleset_id WHERE rv.version=1 LIMIT 1
)
INSERT INTO rule_values(ruleset_version_id,key,value)
SELECT v.id,x.key,x.value::jsonb
FROM version_id v CROSS JOIN (VALUES
 ('balls_for_walk','4'),
 ('strikes_for_out','3'),
 ('fouls_for_out','4'),
 ('outs_per_half_inning','3'),
 ('innings','5'),
 ('regulation_minutes','40')
) AS x(key,value)
ON CONFLICT (ruleset_version_id,key) DO NOTHING;

WITH v AS (
  SELECT rv.id FROM ruleset_versions rv JOIN rulesets r ON r.id=rv.ruleset_id JOIN leagues l ON l.id=r.league_id
  WHERE l.slug='stonewall-sports-boston' AND rv.version=1 LIMIT 1
)
INSERT INTO rule_categories(ruleset_version_id,slug,name,display_order)
SELECT v.id,x.slug,x.name,x.ord FROM v CROSS JOIN (VALUES
 ('pitching','Pitch / Strike Zone',10),
 ('fair-foul','Fair or Foul',20),
 ('base-running','Base Running',30),
 ('overthrows','Overthrows',40),
 ('fielding','Fielding',50),
 ('scoring','Scoring',60),
 ('signals','Umpire Signals',70)
) AS x(slug,name,ord)
ON CONFLICT (ruleset_version_id,slug) DO NOTHING;

WITH v AS (
  SELECT rv.id FROM ruleset_versions rv JOIN rulesets r ON r.id=rv.ruleset_id JOIN leagues l ON l.id=r.league_id
  WHERE l.slug='stonewall-sports-boston' AND rv.version=1 LIMIT 1
), c AS (
  SELECT id,slug FROM rule_categories WHERE ruleset_version_id=(SELECT id FROM v)
), x(rule_key,cat,title,official_text,quick_summary,section) AS (VALUES
 ('three-strikes','pitching','Three Strikes','Three strikes retire the kicker. Fouls are tracked separately and are not strikes.','3 strikes equals an out; fouls do not add strikes.','8.1'),
 ('four-balls','pitching','Four Balls','Four balls award first base. A four-pitch intentional walk at the beginning count has the special second-base award described by the league.','4 balls equals a walk; intentional 4-0-0 walk has a special award.','9.1-9.1.1'),
 ('four-fouls','fair-foul','Four Fouls','Four fouls retire the kicker and are counted independently from strikes.','4 fouls equals an out.','10.1'),
 ('encroachment','fielding','Encroachment','Restricted fielders remain behind the first-to-third line until the kicker touches the ball.','Fielders cannot cross early.','5.2-5.2.4'),
 ('tag-up','base-running','Tagging Up','A runner must remain on or retouch the starting base before legally advancing on a caught fly.','Retouch before advancing on a caught fly.','7.9'),
 ('force-outs','base-running','Force Outs','A force exists when a runner must advance because the kicker becomes a runner. Possession plus touching the forced base can record the out.','Touch the forced base with possession; no body tag is required.','7.7; 11.2'),
 ('overthrow-out-of-bounds','overthrows','Out-of-Bounds Overthrow','If an overthrow leaves the designated game area, play ends and runners receive the base they were on or headed toward plus one additional base.','Dead ball; target base plus one.','7.11.1'),
 ('overthrow-dead-ball','overthrows','Dead-Ball Overthrow','If an overthrow enters an unsafe or unplayable area inside the designated game area, play ends and runners receive only the base they were on or headed toward.','Dead ball; target base only.','7.11.2'),
 ('overthrow-general','overthrows','General Overthrow','A playable overthrow that stays in the game area remains live. On a throw toward first, the kicker may initially advance only to second while other runners may continue at risk.','Play continues; kicker initially capped at second on first-base overthrow.','7.11.3'),
 ('overthrow-adjacent-infield','overthrows','Adjacent Infield','When the ball enters an adjacent infield, play ends and runners receive the base they were moving toward plus two additional bases.','Dead ball; target base plus two.','12.4')
)
INSERT INTO rules(ruleset_version_id,category_id,rule_key,title,official_text,quick_summary,source_section,verification_status)
SELECT v.id,c.id,x.rule_key,x.title,x.official_text,x.quick_summary,x.section,'verified'
FROM v JOIN x ON true JOIN c ON c.slug=x.cat
ON CONFLICT (ruleset_version_id,rule_key) DO NOTHING;
