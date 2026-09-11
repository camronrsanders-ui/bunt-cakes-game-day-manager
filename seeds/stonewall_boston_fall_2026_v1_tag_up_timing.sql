-- Stonewall Sports Boston Fall 2026 v1 tag-up timing clarification
-- Source basis: official Rule 7.9 in SSB Kickball Rules updated 3/17/26.
-- REVIEW ONLY. Run before final activation while v1 is still editable.

WITH v AS (
  SELECT rv.id
  FROM ruleset_versions rv
  JOIN rulesets rs ON rs.id=rv.ruleset_id
  JOIN leagues l ON l.id=rs.league_id
  WHERE l.slug='stonewall-sports-boston' AND rv.version=1 AND rv.status='review'
  LIMIT 1
)
UPDATE rules r
SET official_text='To tag up, a runner must retouch or remain on the starting base until or after the kicked ball either lands or is first touched within fair territory, or is caught in flight within foul territory. When a fly ball is caught, runners must satisfy this tag-up requirement before advancing at their own risk.',
    quick_summary='Fair territory: release after the ball lands or is first touched. Foul flight: wait until the ball is caught.',
    source_section='7.9'
FROM v
WHERE r.ruleset_version_id=v.id AND r.rule_key='tag-up';

WITH v AS (
  SELECT rv.id
  FROM ruleset_versions rv
  JOIN rulesets rs ON rs.id=rv.ruleset_id
  JOIN leagues l ON l.id=rs.league_id
  WHERE l.slug='stonewall-sports-boston' AND rv.version=1 AND rv.status='review'
  LIMIT 1
)
UPDATE ruling_scenarios s
SET what_happened='A runner leaves the starting base before satisfying the league tag-up timing for a kicked fly ball.',
    what_to_do='For a fair ball, require the runner to remain on or retouch the starting base until the ball lands or is first touched in fair territory. For a ball caught in flight in foul territory, require the runner to remain on or retouch until the catch is completed. A runner who leaves early is out under the tag-up rule.',
    why='Rule 7.9 uses different release points: first touch or landing in fair territory, but a completed catch for a foul ball in flight.',
    search_terms=ARRAY['tag up','runner left early','caught fly','fair fly','foul fly','first touch','caught foul','retouch']::text[]
FROM v
WHERE s.ruleset_version_id=v.id AND s.scenario_key='runner-left-early-fly';
