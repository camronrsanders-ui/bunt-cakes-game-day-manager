-- Stonewall Sports Boston Fall 2026 v1 searchable ruling scenarios
-- REVIEW ONLY.

WITH v AS (
  SELECT rv.id FROM ruleset_versions rv
  JOIN rulesets rs ON rs.id=rv.ruleset_id
  JOIN leagues l ON l.id=rs.league_id
  WHERE l.slug='stonewall-sports-boston' AND rv.version=1
  LIMIT 1
), r AS (
  SELECT rules.id,rules.rule_key,rules.category_id
  FROM rules JOIN v ON v.id=rules.ruleset_version_id
), x(rule_key,scenario_key,title,call_label,call_type,what_happened,what_to_do,why,terms,priority) AS (VALUES
 ('overthrow-out-of-bounds','overthrow-left-game-area','Ball left the designated game area','DEAD BALL — AWARD +1','dead_ball','A thrown ball leaves the designated game area.','Stop play. Award each runner the base they were on or headed toward plus one additional base.','This is the out-of-bounds overthrow award.','{"overthrow","out of bounds","left turf","left game area","plus one"}'::text[],100),
 ('overthrow-dead-ball','overthrow-unsafe-area','Ball entered an unsafe or unplayable area','DEAD BALL — TARGET BASE ONLY','dead_ball','The ball enters an unsafe or unplayable area while still inside the designated game area.','Stop play. Place runners at the base they were on or headed toward, with no extra base.','The dead-ball overthrow award stops at the target base.','{"dead ball","unsafe area","unplayable","soccer net","equipment"}'::text[],100),
 ('overthrow-general','overthrow-past-first','Playable overthrow past first','PLAY CONTINUES','live_ball','The ball remains playable in the game area and travels beyond the first-base foul-line area described by the league.','Keep the play live. The kicker may advance to second at risk; other runners may continue. If the defense returns the ball and makes a new play, the kicker may continue beyond second.','A general overthrow does not automatically end play or guarantee a base.','{"general overthrow","past first","15 feet","play continues","second base"}'::text[],100),
 ('overthrow-adjacent-infield','ball-adjacent-infield','Ball entered an adjacent infield','DEAD BALL — AWARD +2','dead_ball','The ball enters the infield of an adjacent field.','Stop play. Award each runner the base they were moving toward plus two additional bases.','Adjacent-infield interference uses a separate two-base award.','{"adjacent field","adjacent infield","plus two","other field"}'::text[],95),
 ('encroachment','fielder-crossed-early','Fielder crossed the restriction line early','ENCROACHMENT','warning_or_award','A restricted fielder crosses the first-to-third restriction line before the kicker touches the ball.','Apply the league encroachment sequence: first team violation is a warning/do-over when the defense benefited; later violations award first base.','Fielders are restricted until the kick.','{"encroachment","crossed early","fielder line","before kick","first third line"}'::text[],95),
 ('tag-up','runner-left-early-fly','Runner left before satisfying tag-up','TAG-UP VIOLATION','out','A runner advances from the starting base without satisfying the tag-up requirement on a caught fly.','Enforce the tag-up rule. Use the league timing distinction for fair and caught foul balls.','The runner must remain on or retouch the starting base before legal advancement.','{"tag up","runner left early","caught fly","fair fly","foul fly"}'::text[],100),
 ('force-outs','force-base-touch','Defender touched the forced base with possession','OUT','out','A runner is required to advance because the kicker became a runner, and a defender with possession touches the forced base first.','Call the forced runner out. A body tag is not required.','A force is completed by possession plus touching the forced base before the runner.','{"force out","touch base","no tag","runner forced"}'::text[],95),
 ('three-strikes','three-strikes-kicker','Kicker reached three strikes','OUT','out','The kicker has accumulated three strikes.','Call the kicker out and end the at-bat. Reset the at-bat counts for the next kicker.','Stonewall uses three strikes for an out and tracks fouls separately.','{"three strikes","3 strikes","strikeout","strikes"}'::text[],90),
 ('four-balls','four-balls-walk','Kicker reached four balls','WALK','base_award','The kicker has accumulated four balls.','Award first base unless the special intentional-walk condition applies.','Stonewall uses four balls for a walk.','{"four balls","4 balls","walk","base on balls"}'::text[],90),
 ('four-balls','intentional-walk-4-0-0','Four consecutive balls at 4-0-0','AWARD SECOND BASE','base_award','The pitcher throws four consecutive balls from the beginning of the count while clearly avoiding the strike zone.','Award the kicker second base. Other runners advance only when forced.','Stonewall has a special intentional-walk award for this exact beginning-count sequence.','{"intentional walk","4-0-0","four straight balls","second base"}'::text[],95),
 ('four-fouls','four-fouls-kicker','Kicker reached four fouls','OUT','out','The kicker has accumulated four fouls.','Call the kicker out and reset the at-bat counts for the next kicker.','Fouls are independent from strikes and four fouls retire the kicker.','{"four fouls","4 fouls","foul out","fouls"}'::text[],90)
)
INSERT INTO ruling_scenarios(
  ruleset_version_id,rule_id,category_id,scenario_key,title,call_label,call_type,
  what_happened,what_to_do,why,search_terms,display_priority
)
SELECT v.id,r.id,r.category_id,x.scenario_key,x.title,x.call_label,x.call_type,
       x.what_happened,x.what_to_do,x.why,x.terms,x.priority
FROM v JOIN x ON true JOIN r ON r.rule_key=x.rule_key
ON CONFLICT (ruleset_version_id,scenario_key) DO NOTHING;
