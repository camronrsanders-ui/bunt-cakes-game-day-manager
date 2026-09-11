-- Rules & Calls Engine integrity hardening
-- REVIEW ONLY. Apply after 001 and before any ruleset seed data.

-- Composite uniqueness permits same-version foreign keys across child tables.
ALTER TABLE rule_sources
  ADD CONSTRAINT rule_sources_id_version_unique UNIQUE (id,ruleset_version_id);
ALTER TABLE rules
  ADD CONSTRAINT rules_id_version_unique UNIQUE (id,ruleset_version_id);
ALTER TABLE rule_categories
  ADD CONSTRAINT rule_categories_id_version_unique UNIQUE (id,ruleset_version_id);
ALTER TABLE ruling_scenarios
  ADD CONSTRAINT ruling_scenarios_id_version_unique UNIQUE (id,ruleset_version_id);

-- A published umpire signal must always remain tied to a source in the same version.
ALTER TABLE umpire_signals DROP CONSTRAINT IF EXISTS umpire_signals_source_id_fkey;
ALTER TABLE umpire_signals ALTER COLUMN source_id SET NOT NULL;
ALTER TABLE umpire_signals
  ADD CONSTRAINT umpire_signals_source_version_fkey
  FOREIGN KEY (source_id,ruleset_version_id)
  REFERENCES rule_sources(id,ruleset_version_id)
  ON DELETE RESTRICT;

-- Optional signal->rule relationship, when present, must stay inside the same version.
ALTER TABLE umpire_signals DROP CONSTRAINT IF EXISTS umpire_signals_rule_id_fkey;
ALTER TABLE umpire_signals
  ADD CONSTRAINT umpire_signals_rule_version_fkey
  FOREIGN KEY (rule_id,ruleset_version_id)
  REFERENCES rules(id,ruleset_version_id)
  ON DELETE RESTRICT;

-- Scenario rule/category references cannot cross ruleset versions.
ALTER TABLE ruling_scenarios DROP CONSTRAINT IF EXISTS ruling_scenarios_rule_id_fkey;
ALTER TABLE ruling_scenarios
  ADD CONSTRAINT ruling_scenarios_rule_version_fkey
  FOREIGN KEY (rule_id,ruleset_version_id)
  REFERENCES rules(id,ruleset_version_id)
  ON DELETE CASCADE;

ALTER TABLE ruling_scenarios DROP CONSTRAINT IF EXISTS ruling_scenarios_category_id_fkey;
ALTER TABLE ruling_scenarios
  ADD CONSTRAINT ruling_scenarios_category_version_fkey
  FOREIGN KEY (category_id,ruleset_version_id)
  REFERENCES rule_categories(id,ruleset_version_id)
  ON DELETE RESTRICT;

-- Visual scenario references cannot cross versions.
ALTER TABLE rule_visuals DROP CONSTRAINT IF EXISTS rule_visuals_scenario_id_fkey;
ALTER TABLE rule_visuals
  ADD CONSTRAINT rule_visuals_scenario_version_fkey
  FOREIGN KEY (scenario_id,ruleset_version_id)
  REFERENCES ruling_scenarios(id,ruleset_version_id)
  ON DELETE CASCADE;

-- Rule category references cannot cross versions.
ALTER TABLE rules DROP CONSTRAINT IF EXISTS rules_category_id_fkey;
ALTER TABLE rules
  ADD CONSTRAINT rules_category_version_fkey
  FOREIGN KEY (category_id,ruleset_version_id)
  REFERENCES rule_categories(id,ruleset_version_id)
  ON DELETE RESTRICT;

-- Once a version has been published, both active and superseded child content is immutable.
CREATE OR REPLACE FUNCTION rules_calls_reject_published_child_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  target_version uuid;
BEGIN
  IF TG_OP='DELETE' THEN
    target_version:=OLD.ruleset_version_id;
  ELSE
    target_version:=NEW.ruleset_version_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM ruleset_versions rv
    WHERE rv.id=target_version AND rv.status IN ('active','superseded')
  ) THEN
    RAISE EXCEPTION 'published ruleset version content is immutable'
      USING ERRCODE='55000';
  END IF;

  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'rule_categories','rules','ruling_scenarios','rule_visuals',
    'umpire_signals','rule_sources','rule_values'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS rules_calls_immutable_published ON %I',table_name);
    EXECUTE format(
      'CREATE TRIGGER rules_calls_immutable_published BEFORE INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION rules_calls_reject_published_child_mutation()',
      table_name
    );
  END LOOP;
END;
$$;

-- Source links must connect a rule and source from the same version and are frozen
-- for active and superseded versions.
CREATE OR REPLACE FUNCTION rules_calls_validate_source_link()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  rule_version uuid;
  source_version uuid;
  old_rule_version uuid;
BEGIN
  IF TG_OP='DELETE' THEN
    SELECT ruleset_version_id INTO old_rule_version FROM rules WHERE id=OLD.rule_id;
    IF EXISTS (SELECT 1 FROM ruleset_versions WHERE id=old_rule_version AND status IN ('active','superseded')) THEN
      RAISE EXCEPTION 'published ruleset version content is immutable' USING ERRCODE='55000';
    END IF;
    RETURN OLD;
  END IF;

  SELECT ruleset_version_id INTO rule_version FROM rules WHERE id=NEW.rule_id;
  SELECT ruleset_version_id INTO source_version FROM rule_sources WHERE id=NEW.source_id;

  IF rule_version IS NULL OR source_version IS NULL OR rule_version<>source_version THEN
    RAISE EXCEPTION 'rule source link must stay within one ruleset version'
      USING ERRCODE='23514';
  END IF;

  IF EXISTS (SELECT 1 FROM ruleset_versions WHERE id=rule_version AND status IN ('active','superseded')) THEN
    RAISE EXCEPTION 'published ruleset version content is immutable' USING ERRCODE='55000';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rules_calls_source_link_integrity ON rule_source_links;
CREATE TRIGGER rules_calls_source_link_integrity
BEFORE INSERT OR UPDATE OR DELETE ON rule_source_links
FOR EACH ROW EXECUTE FUNCTION rules_calls_validate_source_link();

-- Protect the published version identity/lifecycle itself. An active version may
-- transition only to superseded; a superseded version is permanently frozen.
CREATE OR REPLACE FUNCTION rules_calls_protect_published_version()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP='DELETE' AND OLD.status IN ('active','superseded') THEN
    RAISE EXCEPTION 'published ruleset versions cannot be deleted' USING ERRCODE='55000';
  END IF;

  IF TG_OP='UPDATE' AND OLD.status='superseded' THEN
    RAISE EXCEPTION 'superseded ruleset versions are immutable' USING ERRCODE='55000';
  END IF;

  IF TG_OP='UPDATE' AND OLD.status='active' THEN
    IF NEW.status NOT IN ('active','superseded') THEN
      RAISE EXCEPTION 'active ruleset version may only remain active or become superseded' USING ERRCODE='55000';
    END IF;
    IF NEW.ruleset_id IS DISTINCT FROM OLD.ruleset_id
       OR NEW.season_id IS DISTINCT FROM OLD.season_id
       OR NEW.version IS DISTINCT FROM OLD.version
       OR NEW.effective_from IS DISTINCT FROM OLD.effective_from
       OR NEW.published_at IS DISTINCT FROM OLD.published_at THEN
      RAISE EXCEPTION 'published ruleset version identity is immutable' USING ERRCODE='55000';
    END IF;
    IF NEW.status='active' AND NEW.effective_to IS DISTINCT FROM OLD.effective_to THEN
      RAISE EXCEPTION 'active ruleset effective_to cannot change before superseding' USING ERRCODE='55000';
    END IF;
  END IF;

  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rules_calls_protect_published_version ON ruleset_versions;
CREATE TRIGGER rules_calls_protect_published_version
BEFORE UPDATE OR DELETE ON ruleset_versions
FOR EACH ROW EXECUTE FUNCTION rules_calls_protect_published_version();

-- Historical game bindings are write-once and can only be created against the
-- version that is active at bind time. They remain valid when that version later
-- becomes superseded.
CREATE OR REPLACE FUNCTION rules_calls_protect_game_binding()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  target_status text;
BEGIN
  IF TG_OP<>'INSERT' THEN
    RAISE EXCEPTION 'historical game ruleset bindings are immutable' USING ERRCODE='55000';
  END IF;

  SELECT status INTO target_status
  FROM ruleset_versions
  WHERE id=NEW.ruleset_version_id;

  IF target_status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'game may only bind to an active ruleset version' USING ERRCODE='23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rules_calls_immutable_game_binding ON game_ruleset_bindings;
CREATE TRIGGER rules_calls_immutable_game_binding
BEFORE INSERT OR UPDATE OR DELETE ON game_ruleset_bindings
FOR EACH ROW EXECUTE FUNCTION rules_calls_protect_game_binding();
