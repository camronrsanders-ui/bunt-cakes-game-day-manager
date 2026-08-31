-- Stonewall Sports Boston Fall 2026 v1 verified umpire signals
-- Source inspected directly: Stonewall Boston Umpire Call Signs.pdf
-- REVIEW ONLY. Do not apply until foundation migration is approved.

WITH v AS (
  SELECT rv.id
  FROM ruleset_versions rv
  JOIN rulesets r ON r.id=rv.ruleset_id
  JOIN leagues l ON l.id=r.league_id
  WHERE l.slug='stonewall-sports-boston' AND rv.version=1
  LIMIT 1
)
UPDATE rule_sources rs
SET url='https://drive.google.com/file/d/1L9KTT58ZPBS0crAA8qpNakbf33KbwneX/view?usp=drivesdk',
    verification_status='verified',
    verified_at=COALESCE(rs.verified_at,now())
FROM v
WHERE rs.ruleset_version_id=v.id
  AND rs.name='Stonewall Boston Umpire Call Signs';

WITH v AS (
  SELECT rv.id
  FROM ruleset_versions rv
  JOIN rulesets r ON r.id=rv.ruleset_id
  JOIN leagues l ON l.id=r.league_id
  WHERE l.slug='stonewall-sports-boston' AND rv.version=1
  LIMIT 1
), source AS (
  SELECT rs.id
  FROM rule_sources rs
  JOIN v ON v.id=rs.ruleset_version_id
  WHERE rs.name='Stonewall Boston Umpire Call Signs'
    AND rs.verification_status='verified'
  LIMIT 1
), x(signal_key,title,instructions,use_when,visual_steps) AS (VALUES
  ('ball','Ball',
   'Cross your thumb in front of your palm or make a ball shape with your hands.',
   'When a pitched ball is called “ball”.',
   '[{"step":1,"action":"Cross your thumb in front of your palm"},{"step":2,"action":"Or make a ball shape with your hands"}]'::jsonb),
  ('strike','Strike',
   'Make a closed fist in front of you as if knocking on a door.',
   'When a pitched ball is called “strike”.',
   '[{"step":1,"action":"Make a closed fist"},{"step":2,"action":"Hold it in front of you as if knocking on a door"}]'::jsonb),
  ('foul','Foul',
   'Raise a closed fist above your head.',
   'When a ball is called “foul”.',
   '[{"step":1,"action":"Make a closed fist"},{"step":2,"action":"Raise the closed fist above your head"}]'::jsonb),
  ('fair','Fair',
   'Extend your arm out to the side at shoulder height with your palm down. Point your hand towards fair territory.',
   'When a ball is called “fair”.',
   '[{"step":1,"action":"Extend your arm to the side at shoulder height with palm down"},{"step":2,"action":"Point your hand toward fair territory"}]'::jsonb),
  ('out','Out',
   'Make a closed fist in front of you as if knocking on a door.',
   'When a player is called “out”.',
   '[{"step":1,"action":"Make a closed fist"},{"step":2,"action":"Hold it in front of you as if knocking on a door"}]'::jsonb),
  ('safe','Safe',
   'Sweep your arms out to your sides at shoulder height with palms down.',
   'When a player is called “safe”.',
   '[{"step":1,"action":"Raise both arms to shoulder height"},{"step":2,"action":"Sweep your arms out to your sides with palms down"}]'::jsonb),
  ('dead-ball-play-ends','Dead Ball / Play Ends',
   'Raise both open hands above your head. Walk into the field of play.',
   'When calling a time out, a ball goes out of bounds or becomes a dead ball, or the play otherwise suddenly ends.',
   '[{"step":1,"action":"Raise both open hands above your head"},{"step":2,"action":"Walk into the field of play"}]'::jsonb)
)
INSERT INTO umpire_signals(
  ruleset_version_id,source_id,signal_key,title,verbal_call,instructions,use_when,visual_steps
)
SELECT v.id,source.id,x.signal_key,x.title,'',x.instructions,x.use_when,x.visual_steps
FROM v CROSS JOIN source CROSS JOIN x
ON CONFLICT (ruleset_version_id,signal_key) DO NOTHING;
