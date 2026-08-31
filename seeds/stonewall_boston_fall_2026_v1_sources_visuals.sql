-- Stonewall Sports Boston Fall 2026 v1 source references + app-owned structured visuals
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

-- App-owned structured visuals. Coordinates are normalized 0..100 so the client
-- can render the same definition at any screen size. Elements intentionally use
-- generic primitives (runner, fielder, ball, path, zone, label, award) so future
-- leagues/rulesets can reuse the renderer without Stonewall-specific drawing code.
WITH v AS (
  SELECT rv.id FROM ruleset_versions rv
  JOIN rulesets r ON r.id=rv.ruleset_id
  JOIN leagues l ON l.id=r.league_id
  WHERE l.slug='stonewall-sports-boston' AND rv.version=1
  LIMIT 1
), visual_data(scenario_key,definition_json,alt_text) AS (VALUES
  ('overthrow-left-game-area',
   '{"field":"kickball_standard","orientation":"defense","steps":[{"phase":"before","caption":"Runner is advancing while the defense throws across the field.","elements":[{"type":"runner","x":50,"y":50,"label":"R"},{"type":"fielder","x":72,"y":70,"label":"F"},{"type":"ball","x":72,"y":68}]},{"phase":"play","caption":"The overthrow leaves the designated game area.","elements":[{"type":"runner","x":50,"y":50,"label":"R"},{"type":"path","from":[72,68],"to":[98,42],"kind":"throw"},{"type":"ball","x":98,"y":42},{"type":"zone","shape":"edge","side":"right","label":"OUT OF BOUNDS"}]},{"phase":"call","caption":"Dead ball. Award the target base plus one additional base.","elements":[{"type":"award","base":"next","amount":1,"label":"TARGET +1"},{"type":"label","x":50,"y":18,"text":"DEAD BALL"}]}]}'::jsonb,
   'Three-step field diagram showing an overthrow leaving the game area and the target-base-plus-one award.'),

  ('overthrow-unsafe-area',
   '{"field":"kickball_standard","orientation":"defense","steps":[{"phase":"before","caption":"A runner advances while a throw remains inside the game area.","elements":[{"type":"runner","x":50,"y":50,"label":"R"},{"type":"fielder","x":72,"y":70,"label":"F"},{"type":"ball","x":72,"y":68}]},{"phase":"play","caption":"The ball enters an unsafe or unplayable area.","elements":[{"type":"path","from":[72,68],"to":[88,58],"kind":"throw"},{"type":"ball","x":88,"y":58},{"type":"zone","shape":"circle","x":88,"y":58,"radius":9,"label":"UNSAFE"}]},{"phase":"call","caption":"Dead ball. Place each runner at the base they were on or headed toward; no extra base.","elements":[{"type":"award","base":"target","amount":0,"label":"TARGET ONLY"},{"type":"label","x":50,"y":18,"text":"DEAD BALL"}]}]}'::jsonb,
   'Three-step field diagram showing an overthrow entering an unsafe area and the target-base-only award.'),

  ('overthrow-past-first',
   '{"field":"kickball_standard","orientation":"defense","steps":[{"phase":"before","caption":"The defense throws toward first as the kicker-runner approaches the base.","elements":[{"type":"runner","x":66,"y":72,"label":"K"},{"type":"fielder","x":73,"y":70,"label":"1B"},{"type":"ball","x":62,"y":62}]},{"phase":"play","caption":"The throw gets past first but stays playable inside the game area.","elements":[{"type":"path","from":[62,62],"to":[86,78],"kind":"throw"},{"type":"ball","x":86,"y":78},{"type":"path","from":[73,70],"to":[50,45],"kind":"runner"},{"type":"runner","x":56,"y":51,"label":"K"}]},{"phase":"call","caption":"Play stays live. The kicker may advance to second at risk; other runners may continue.","elements":[{"type":"label","x":50,"y":18,"text":"PLAY CONTINUES"},{"type":"award","base":"second","amount":0,"label":"2B AT RISK"}]}]}'::jsonb,
   'Three-step field diagram showing a playable overthrow past first with play continuing and the kicker advancing toward second at risk.'),

  ('ball-adjacent-infield',
   '{"field":"kickball_standard","orientation":"defense","steps":[{"phase":"before","caption":"A live throw travels toward the edge of the playing field.","elements":[{"type":"runner","x":50,"y":50,"label":"R"},{"type":"ball","x":72,"y":62}]},{"phase":"play","caption":"The ball enters the infield of an adjacent field.","elements":[{"type":"path","from":[72,62],"to":[98,35],"kind":"throw"},{"type":"ball","x":98,"y":35},{"type":"zone","shape":"rect","x":84,"y":20,"width":16,"height":30,"label":"ADJACENT INFIELD"}]},{"phase":"call","caption":"Dead ball. Award the target base plus two additional bases.","elements":[{"type":"award","base":"next","amount":2,"label":"TARGET +2"},{"type":"label","x":50,"y":18,"text":"DEAD BALL"}]}]}'::jsonb,
   'Three-step field diagram showing a ball entering an adjacent infield and the target-base-plus-two award.'),

  ('fielder-crossed-early',
   '{"field":"kickball_standard","orientation":"offense","steps":[{"phase":"before","caption":"Restricted fielders remain behind the first-to-third restriction line before the kick.","elements":[{"type":"zone","shape":"line","from":[28,69],"to":[72,69],"label":"RESTRICTION LINE"},{"type":"fielder","x":43,"y":61,"label":"F"},{"type":"runner","x":50,"y":88,"label":"K"}]},{"phase":"play","caption":"A restricted fielder crosses the line before the kicker touches the ball.","elements":[{"type":"zone","shape":"line","from":[28,69],"to":[72,69],"label":"RESTRICTION LINE"},{"type":"path","from":[43,61],"to":[43,76],"kind":"fielder"},{"type":"fielder","x":43,"y":76,"label":"F"},{"type":"runner","x":50,"y":88,"label":"K"}]},{"phase":"call","caption":"Call encroachment and apply the league warning/do-over or award sequence.","elements":[{"type":"label","x":50,"y":18,"text":"ENCROACHMENT"},{"type":"zone","shape":"line","from":[28,69],"to":[72,69],"label":"CROSSED EARLY"}]}]}'::jsonb,
   'Three-step field diagram showing a restricted fielder crossing the first-to-third line before the kick.'),

  ('runner-left-early-fly',
   '{"field":"kickball_standard","orientation":"offense","steps":[{"phase":"before","caption":"The runner begins on the starting base while the kicked ball is in the air.","elements":[{"type":"runner","x":74,"y":70,"label":"R"},{"type":"ball","x":50,"y":35},{"type":"fielder","x":50,"y":28,"label":"F"}]},{"phase":"play","caption":"The runner leaves the starting base before satisfying the tag-up requirement on the caught fly.","elements":[{"type":"path","from":[74,70],"to":[50,45],"kind":"runner"},{"type":"runner","x":59,"y":53,"label":"R"},{"type":"ball","x":50,"y":28},{"type":"fielder","x":50,"y":28,"label":"F"}]},{"phase":"call","caption":"Enforce the tag-up rule. The runner must remain on or retouch the starting base before legal advancement.","elements":[{"type":"label","x":50,"y":18,"text":"TAG-UP VIOLATION"},{"type":"path","from":[59,53],"to":[74,70],"kind":"return"},{"type":"award","base":"return","amount":0,"label":"RETOUCH BASE"}]}]}'::jsonb,
   'Three-step field diagram showing a runner leaving early on a caught fly and the required retouch.'),

  ('force-base-touch',
   '{"field":"kickball_standard","orientation":"offense","steps":[{"phase":"before","caption":"The runner is forced to advance because the kicker becomes a runner.","elements":[{"type":"runner","x":50,"y":86,"label":"K"},{"type":"runner","x":73,"y":70,"label":"R"},{"type":"fielder","x":50,"y":48,"label":"F"}]},{"phase":"play","caption":"The defender gains possession and touches the forced base before the runner arrives.","elements":[{"type":"path","from":[73,70],"to":[50,48],"kind":"runner"},{"type":"fielder","x":50,"y":48,"label":"F"},{"type":"ball","x":50,"y":48},{"type":"runner","x":57,"y":54,"label":"R"}]},{"phase":"call","caption":"Call the forced runner out. A body tag is not required.","elements":[{"type":"label","x":50,"y":18,"text":"OUT"},{"type":"award","base":"force","amount":0,"label":"BASE TOUCHED WITH POSSESSION"}]}]}'::jsonb,
   'Three-step field diagram showing a force play completed by possession and touching the forced base before the runner.')
), scenarios AS (
  SELECT s.id,s.scenario_key,s.title,v.id AS ruleset_version_id
  FROM ruling_scenarios s
  JOIN v ON v.id=s.ruleset_version_id
  JOIN visual_data d ON d.scenario_key=s.scenario_key
)
INSERT INTO rule_visuals(
  ruleset_version_id,scenario_id,visual_key,title,visual_type,definition_json,alt_text
)
SELECT s.ruleset_version_id,s.id,'visual-'||s.scenario_key,s.title,'stepped',d.definition_json,d.alt_text
FROM scenarios s
JOIN visual_data d ON d.scenario_key=s.scenario_key
ON CONFLICT (ruleset_version_id,visual_key) DO NOTHING;
