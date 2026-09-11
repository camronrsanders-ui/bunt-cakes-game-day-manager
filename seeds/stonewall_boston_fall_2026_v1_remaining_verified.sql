-- Stonewall Sports Boston Fall 2026 v1 remaining verified rulings
-- Source basis: official SSB Kickball Rules updated 3/17/26.
-- REVIEW ONLY. Run after core + source seed and before final activation.

WITH v AS (
  SELECT rv.id
  FROM ruleset_versions rv
  JOIN rulesets rs ON rs.id=rv.ruleset_id
  JOIN leagues l ON l.id=rs.league_id
  WHERE l.slug='stonewall-sports-boston' AND rv.version=1
  LIMIT 1
), c AS (
  SELECT id,slug FROM rule_categories WHERE ruleset_version_id=(SELECT id FROM v)
), x(rule_key,cat,title,official_text,quick_summary,section) AS (VALUES
  ('strike-zone','pitching','Strike Zone and Pitch Strike','The strike zone is the three-dimensional zone based on home plate, extending one foot to either side and one foot high. An un-kicked pitch is a strike when any part of the ball enters the strike zone; a missed attempted kick is also a strike. Pitch requirements can separately make a pitch a ball when it does not meet the league bounce or rolling requirement before reaching the plate.','Any part of the ball entering the strike zone can be a strike; missed kick attempts are strikes, while pitch-shape requirements are evaluated separately.','1.6; 8.2; 9.2'),
  ('fair-foul-location','fair-foul','Fair and Foul Ball Location','Fair or foul status depends on where the ball lands, is touched, or travels relative to fair territory and the foul lines. A ball that moves from fair into foul territory before first or third base is foul; after passing first or third base, later movement into foul territory does not by itself make it foul. The foul lines are part of fair territory.','Judge fair/foul from the ball location and first qualifying touch/landing under the league rules; foul lines are fair.','10.2-10.4')
)
INSERT INTO rules(ruleset_version_id,category_id,rule_key,title,official_text,quick_summary,source_section,verification_status)
SELECT v.id,c.id,x.rule_key,x.title,x.official_text,x.quick_summary,x.section,'verified'
FROM v JOIN x ON true JOIN c ON c.slug=x.cat
ON CONFLICT (ruleset_version_id,rule_key) DO NOTHING;

WITH v AS (
  SELECT rv.id
  FROM ruleset_versions rv
  JOIN rulesets rs ON rs.id=rv.ruleset_id
  JOIN leagues l ON l.id=rs.league_id
  WHERE l.slug='stonewall-sports-boston' AND rv.version=1
  LIMIT 1
), r AS (
  SELECT id,rule_key,category_id FROM rules WHERE ruleset_version_id=(SELECT id FROM v)
), x(rule_key,scenario_key,title,call_label,call_type,what_happened,what_to_do,why,terms,priority) AS (VALUES
  ('strike-zone','pitch-enters-strike-zone','Pitch reaches the strike zone','STRIKE','strike','An un-kicked pitch has any part of the ball enter the defined strike zone, or the kicker swings and misses.','Call a strike. Continue tracking balls, strikes, and fouls independently for the at-bat.','The official rules define the strike zone and state that any part of the ball entering it is enough for a strike; an attempted kick that misses is also a strike.','{"strike zone","edge of zone","one foot","pitch strike","swung and missed","missed kick","bounce","rolling pitch"}'::text[],100),
  ('fair-foul-location','fair-foul-location-touch','Ball near a foul line or changes territory','FAIR / FOUL — USE LOCATION','fair_or_foul','A kicked ball lands, is touched, or moves near a foul line, including a ball that changes from fair to foul territory.','Judge the ball using the official fair/foul location rules. Before first or third base, a fair ball that goes foul is foul; after passing first or third, later movement into foul territory does not by itself change a fair ball to foul. Treat the foul line itself as fair territory.','The official rules define fair and foul from the ball location, touch/landing, and whether it has passed first or third base.','{"fair foul","foul line","first touch","lands foul","lands fair","before first","before third","past first","past third","line is fair"}'::text[],100)
)
INSERT INTO ruling_scenarios(
  ruleset_version_id,rule_id,category_id,scenario_key,title,call_label,call_type,
  what_happened,what_to_do,why,search_terms,display_priority
)
SELECT v.id,r.id,r.category_id,x.scenario_key,x.title,x.call_label,x.call_type,
       x.what_happened,x.what_to_do,x.why,x.terms,x.priority
FROM v JOIN x ON true JOIN r ON r.rule_key=x.rule_key
ON CONFLICT (ruleset_version_id,scenario_key) DO NOTHING;

-- Link both new verified rules to the verified official rulebook source.
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
    AND name='SSB Kickball Rules - Updated 3/17/26'
    AND verification_status='verified'
  LIMIT 1
)
INSERT INTO rule_source_links(rule_id,source_id)
SELECT r.id,src.id
FROM rules r CROSS JOIN src
WHERE r.ruleset_version_id=(SELECT id FROM v)
  AND r.rule_key IN ('strike-zone','fair-foul-location')
  AND r.verification_status='verified'
ON CONFLICT DO NOTHING;

-- Original app-owned visuals using the generic renderer primitives.
WITH v AS (
  SELECT rv.id
  FROM ruleset_versions rv
  JOIN rulesets rs ON rs.id=rv.ruleset_id
  JOIN leagues l ON l.id=rs.league_id
  WHERE l.slug='stonewall-sports-boston' AND rv.version=1
  LIMIT 1
), visual_data(scenario_key,definition_json,alt_text) AS (VALUES
  ('pitch-enters-strike-zone',
   '{"field":"kickball_standard","orientation":"offense","steps":[{"phase":"before","caption":"The pitch approaches home plate and the defined strike zone.","elements":[{"type":"runner","x":50,"y":91,"label":"K"},{"type":"ball","x":50,"y":61},{"type":"zone","shape":"rect","x":37,"y":76,"width":26,"height":12,"label":"STRIKE ZONE"}]},{"phase":"play","caption":"Any part of the un-kicked ball enters the strike zone.","elements":[{"type":"path","from":[50,61],"to":[50,82],"kind":"throw"},{"type":"ball","x":50,"y":82},{"type":"zone","shape":"rect","x":37,"y":76,"width":26,"height":12,"label":"ANY PART ENTERS"}]},{"phase":"call","caption":"Call strike. A missed attempted kick is also a strike.","elements":[{"type":"label","x":50,"y":18,"text":"STRIKE"},{"type":"zone","shape":"rect","x":37,"y":76,"width":26,"height":12,"label":"1 FT SIDE / 1 FT HIGH"}]}]}'::jsonb,
   'Three-step diagram showing a pitch entering the strike zone and the strike call.'),
  ('fair-foul-location-touch',
   '{"field":"kickball_standard","orientation":"offense","steps":[{"phase":"before","caption":"A kicked ball travels close to the first-base foul line.","elements":[{"type":"runner","x":50,"y":90,"label":"K"},{"type":"ball","x":58,"y":78},{"type":"zone","shape":"line","from":[50,88],"to":[95,43],"label":"FOUL LINE = FAIR"}]},{"phase":"play","caption":"Before first base, the ball moves from fair territory across the line into foul territory.","elements":[{"type":"path","from":[58,78],"to":[79,82],"kind":"throw"},{"type":"ball","x":79,"y":82},{"type":"zone","shape":"line","from":[50,88],"to":[95,43],"label":"BEFORE 1B / 3B"}]},{"phase":"call","caption":"Before first or third, fair-to-foul is foul. Once a fair ball has passed first or third, later movement foul does not by itself change the call.","elements":[{"type":"label","x":50,"y":18,"text":"FAIR / FOUL — LOCATION"},{"type":"award","base":"rule","amount":0,"label":"LINE ITSELF IS FAIR"}]}]}'::jsonb,
   'Three-step diagram showing fair/foul judgment near the foul line and the first-or-third-base timing distinction.')
), scenarios AS (
  SELECT s.id,s.scenario_key,s.title,v.id AS ruleset_version_id
  FROM ruling_scenarios s
  JOIN v ON v.id=s.ruleset_version_id
  JOIN visual_data d ON d.scenario_key=s.scenario_key
)
INSERT INTO rule_visuals(ruleset_version_id,scenario_id,visual_key,title,visual_type,definition_json,alt_text)
SELECT s.ruleset_version_id,s.id,'visual-'||s.scenario_key,s.title,'stepped',d.definition_json,d.alt_text
FROM scenarios s JOIN visual_data d ON d.scenario_key=s.scenario_key
ON CONFLICT (ruleset_version_id,visual_key) DO NOTHING;
