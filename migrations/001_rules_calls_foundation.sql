-- Rules & Calls Engine foundation migration
-- REVIEW ONLY: do not apply to production until FK type compatibility is confirmed.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS leagues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  branding_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS seasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  name text NOT NULL,
  starts_on date,
  ends_on date,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('draft','active','completed','archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (league_id, name)
);

CREATE TABLE IF NOT EXISTS rulesets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (league_id, name)
);

CREATE TABLE IF NOT EXISTS ruleset_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ruleset_id uuid NOT NULL REFERENCES rulesets(id) ON DELETE CASCADE,
  season_id uuid REFERENCES seasons(id) ON DELETE SET NULL,
  version integer NOT NULL CHECK (version > 0),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','review','active','superseded')),
  effective_from timestamptz,
  effective_to timestamptz,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ruleset_id, version)
);

CREATE INDEX IF NOT EXISTS idx_ruleset_versions_ruleset_status
  ON ruleset_versions (ruleset_id, status);

CREATE TABLE IF NOT EXISTS rule_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ruleset_version_id uuid NOT NULL REFERENCES ruleset_versions(id) ON DELETE CASCADE,
  slug text NOT NULL,
  name text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  UNIQUE (ruleset_version_id, slug)
);

CREATE TABLE IF NOT EXISTS rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ruleset_version_id uuid NOT NULL REFERENCES ruleset_versions(id) ON DELETE CASCADE,
  category_id uuid REFERENCES rule_categories(id) ON DELETE SET NULL,
  rule_key text NOT NULL,
  title text NOT NULL,
  official_text text NOT NULL,
  quick_summary text NOT NULL DEFAULT '',
  source_section text,
  verification_status text NOT NULL DEFAULT 'draft' CHECK (verification_status IN ('draft','review','verified')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ruleset_version_id, rule_key)
);

CREATE INDEX IF NOT EXISTS idx_rules_verified_version
  ON rules (ruleset_version_id, verification_status);

CREATE TABLE IF NOT EXISTS ruling_scenarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ruleset_version_id uuid NOT NULL REFERENCES ruleset_versions(id) ON DELETE CASCADE,
  rule_id uuid NOT NULL REFERENCES rules(id) ON DELETE CASCADE,
  category_id uuid REFERENCES rule_categories(id) ON DELETE SET NULL,
  scenario_key text NOT NULL,
  title text NOT NULL,
  question_prompt text,
  call_label text NOT NULL,
  call_type text NOT NULL,
  what_happened text NOT NULL,
  what_to_do text NOT NULL,
  why text NOT NULL,
  search_terms text[] NOT NULL DEFAULT '{}'::text[],
  decision_tree_json jsonb,
  display_priority integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  search_text tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title,'')), 'A') ||
    setweight(to_tsvector('english', coalesce(question_prompt,'')), 'A') ||
    setweight(to_tsvector('english', coalesce(array_to_string(search_terms,' '),'')), 'A') ||
    setweight(to_tsvector('english', coalesce(what_happened,'')), 'B') ||
    setweight(to_tsvector('english', coalesce(what_to_do,'')), 'B') ||
    setweight(to_tsvector('english', coalesce(why,'')), 'C')
  ) STORED,
  UNIQUE (ruleset_version_id, scenario_key)
);

CREATE INDEX IF NOT EXISTS idx_ruling_scenarios_search
  ON ruling_scenarios USING GIN (search_text);
CREATE INDEX IF NOT EXISTS idx_ruling_scenarios_version_priority
  ON ruling_scenarios (ruleset_version_id, display_priority DESC);

CREATE TABLE IF NOT EXISTS rule_visuals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ruleset_version_id uuid NOT NULL REFERENCES ruleset_versions(id) ON DELETE CASCADE,
  scenario_id uuid REFERENCES ruling_scenarios(id) ON DELETE CASCADE,
  visual_key text NOT NULL,
  title text NOT NULL,
  visual_type text NOT NULL DEFAULT 'stepped' CHECK (visual_type IN ('static','stepped','animated')),
  definition_json jsonb NOT NULL,
  alt_text text NOT NULL DEFAULT '',
  attribution text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ruleset_version_id, visual_key),
  CHECK (jsonb_typeof(definition_json) = 'object')
);

CREATE TABLE IF NOT EXISTS umpire_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ruleset_version_id uuid NOT NULL REFERENCES ruleset_versions(id) ON DELETE CASCADE,
  rule_id uuid REFERENCES rules(id) ON DELETE SET NULL,
  signal_key text NOT NULL,
  title text NOT NULL,
  verbal_call text NOT NULL DEFAULT '',
  instructions text NOT NULL,
  visual_steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ruleset_version_id, signal_key),
  CHECK (jsonb_typeof(visual_steps) = 'array')
);

CREATE TABLE IF NOT EXISTS rule_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ruleset_version_id uuid NOT NULL REFERENCES ruleset_versions(id) ON DELETE CASCADE,
  name text NOT NULL,
  publisher text,
  url text,
  citation text,
  verification_status text NOT NULL DEFAULT 'draft' CHECK (verification_status IN ('draft','review','verified')),
  verified_by text,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ruleset_version_id, name)
);

CREATE TABLE IF NOT EXISTS rule_source_links (
  rule_id uuid NOT NULL REFERENCES rules(id) ON DELETE CASCADE,
  source_id uuid NOT NULL REFERENCES rule_sources(id) ON DELETE CASCADE,
  PRIMARY KEY (rule_id, source_id)
);

CREATE TABLE IF NOT EXISTS rule_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ruleset_version_id uuid NOT NULL REFERENCES ruleset_versions(id) ON DELETE CASCADE,
  key text NOT NULL,
  value jsonb NOT NULL,
  UNIQUE (ruleset_version_id, key)
);

-- Existing umpire_game_states stores team_id/event_key as text.
-- Keep these bindings text-compatible for the first review pass; confirm teams.id
-- production type before adding a FK to teams(id).
CREATE TABLE IF NOT EXISTS team_ruleset_bindings (
  team_id text NOT NULL,
  league_id uuid REFERENCES leagues(id) ON DELETE SET NULL,
  season_id uuid REFERENCES seasons(id) ON DELETE SET NULL,
  active_ruleset_version_id uuid NOT NULL REFERENCES ruleset_versions(id) ON DELETE RESTRICT,
  active_from timestamptz NOT NULL DEFAULT now(),
  active_to timestamptz,
  PRIMARY KEY (team_id, active_from)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_team_ruleset_one_current
  ON team_ruleset_bindings (team_id)
  WHERE active_to IS NULL;

CREATE TABLE IF NOT EXISTS game_ruleset_bindings (
  team_id text NOT NULL,
  game_id text NOT NULL,
  ruleset_version_id uuid NOT NULL REFERENCES ruleset_versions(id) ON DELETE RESTRICT,
  bound_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, game_id),
  CHECK (length(game_id) BETWEEN 1 AND 180)
);

CREATE INDEX IF NOT EXISTS idx_game_ruleset_version
  ON game_ruleset_bindings (ruleset_version_id);

-- Activation invariant: one active version per logical ruleset.
CREATE UNIQUE INDEX IF NOT EXISTS idx_ruleset_one_active_version
  ON ruleset_versions (ruleset_id)
  WHERE status = 'active';
