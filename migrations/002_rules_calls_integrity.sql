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
  ON DELETE SET NULL (rule_id);

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
  ON DELETE SET NULL (category_id);

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
  ON DELETE SET NULL (category_id);

-- Once a ruleset version is active, all version-owned content is immutable.
CREATE OR REPLACE FUNCTION rules_calls_reject_active_child_mutation()
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
    WHERE rv.id=target_version AND rv.status='active'
  ) THEN
    RAISE EXCEPTION 'active ruleset version content is immutable'
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
    EXECUTE format('DROP TRIGGER IF EXISTS rules_calls_immutable_active ON %I',table_name);
    EXECUTE format(
      'CREATE TRIGGER rules_calls_immutable_active BEFORE INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION rules_calls_reject_active_child_mutation()',
      table_name
    );
  END LOOP;
END;
$$;

-- Source links must connect a rule and source from the same version and cannot be
-- changed once that version is active.
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
    IF EXISTS (SELECT 1 FROM ruleset_versions WHERE id=old_rule_version AND status='active') THEN
      RAISE EXCEPTION 'active ruleset version content is immutable' USING ERRCODE='55000';
    END IF;
    RETURN OLD;
  END IF;

  SELECT ruleset_version_id INTO rule_version FROM rules WHERE id=NEW.rule_id;
  SELECT ruleset_version_id INTO source_version FROM rule_sources WHERE id=NEW.source_id;

  IF rule_version IS NULL OR source_version IS NULL OR rule_version<>source_version THEN
    RAISE EXCEPTION 'rule source link must stay within one ruleset version'
      USING ERRCODE='23514';
  END IF;

  IF EXISTS (SELECT 1 FROM ruleset_versions WHERE id=rule_version AND status='active') THEN
    RAISE EXCEPTION 'active ruleset version content is immutable' USING ERRCODE='55000';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rules_calls_source_link_integrity ON rule_source_links;
CREATE TRIGGER rules_calls_source_link_integrity
BEFORE INSERT OR UPDATE OR DELETE ON rule_source_links
FOR EACH ROW EXECUTE FUNCTION rules_calls_validate_source_link();
