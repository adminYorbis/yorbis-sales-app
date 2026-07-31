export type YieMigration = {
  version: string;
  name: string;
  sql: string;
};

export const POCKET_3_MIGRATIONS: YieMigration[] = [{
  version: '20260730_001',
  name: 'pocket_3_solution_knowledge_and_icp',
  sql: `
CREATE TABLE IF NOT EXISTS yie_knowledge_definitions (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('SOLUTION_PROFILE','CAPABILITY','PROBLEM_SOLVED','BUYER_PERSONA','BUYING_TRIGGER','NEGATIVE_FIT_SIGNAL')),
  normalized_name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(kind, normalized_name)
);
CREATE INDEX IF NOT EXISTS yie_knowledge_definitions_kind_idx ON yie_knowledge_definitions(kind);
CREATE INDEX IF NOT EXISTS yie_knowledge_definitions_name_idx ON yie_knowledge_definitions(normalized_name);

CREATE TABLE IF NOT EXISTS yie_knowledge_versions (
  definition_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('DRAFT','APPROVED','ACTIVE','RETIRED')),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  attributes_json TEXT NOT NULL DEFAULT '{}',
  effective_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  approved_at TEXT,
  approved_by TEXT,
  retired_at TEXT,
  provenance_json TEXT NOT NULL,
  change_summary TEXT NOT NULL,
  content_checksum TEXT NOT NULL,
  PRIMARY KEY(definition_id, version),
  FOREIGN KEY(definition_id) REFERENCES yie_knowledge_definitions(id)
);
CREATE INDEX IF NOT EXISTS yie_knowledge_versions_status_idx ON yie_knowledge_versions(status);
CREATE INDEX IF NOT EXISTS yie_knowledge_versions_active_idx ON yie_knowledge_versions(definition_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS yie_knowledge_versions_one_active_idx
  ON yie_knowledge_versions(definition_id) WHERE status = 'ACTIVE';

CREATE TABLE IF NOT EXISTS yie_solution_relationships (
  solution_definition_id TEXT NOT NULL,
  solution_version INTEGER NOT NULL,
  relation_type TEXT NOT NULL CHECK (relation_type IN ('CAPABILITY','PROBLEM','PERSONA','TRIGGER','NEGATIVE_SIGNAL')),
  target_definition_id TEXT NOT NULL,
  target_version INTEGER NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(solution_definition_id, solution_version, relation_type, target_definition_id, target_version),
  FOREIGN KEY(solution_definition_id, solution_version) REFERENCES yie_knowledge_versions(definition_id, version),
  FOREIGN KEY(target_definition_id, target_version) REFERENCES yie_knowledge_versions(definition_id, version)
);
CREATE INDEX IF NOT EXISTS yie_solution_relationship_target_idx ON yie_solution_relationships(target_definition_id, target_version);

CREATE TABLE IF NOT EXISTS yie_icp_profiles (
  id TEXT PRIMARY KEY,
  normalized_name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS yie_icp_profiles_name_idx ON yie_icp_profiles(normalized_name);

CREATE TABLE IF NOT EXISTS yie_icp_profile_versions (
  definition_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('DRAFT','APPROVED','ACTIVE','RETIRED')),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  target_problem TEXT NOT NULL,
  solution_definition_id TEXT NOT NULL,
  solution_version INTEGER NOT NULL,
  geography_definition TEXT NOT NULL,
  industry_definitions_json TEXT NOT NULL,
  business_model_definitions_json TEXT NOT NULL,
  company_size_definition TEXT NOT NULL,
  scoring_configuration_reference TEXT NOT NULL,
  effective_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  approved_at TEXT,
  approved_by TEXT,
  retired_at TEXT,
  provenance_json TEXT NOT NULL,
  change_summary TEXT NOT NULL,
  content_checksum TEXT NOT NULL,
  PRIMARY KEY(definition_id, version),
  FOREIGN KEY(definition_id) REFERENCES yie_icp_profiles(id),
  FOREIGN KEY(solution_definition_id, solution_version) REFERENCES yie_knowledge_versions(definition_id, version)
);
CREATE INDEX IF NOT EXISTS yie_icp_versions_status_idx ON yie_icp_profile_versions(status);
CREATE INDEX IF NOT EXISTS yie_icp_versions_solution_idx ON yie_icp_profile_versions(solution_definition_id, solution_version);
CREATE INDEX IF NOT EXISTS yie_icp_versions_geography_idx ON yie_icp_profile_versions(geography_definition);
CREATE UNIQUE INDEX IF NOT EXISTS yie_icp_versions_one_active_idx
  ON yie_icp_profile_versions(definition_id) WHERE status = 'ACTIVE';

CREATE TABLE IF NOT EXISTS yie_icp_criteria (
  id TEXT PRIMARY KEY,
  icp_definition_id TEXT NOT NULL,
  icp_version INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('REQUIRED','PREFERRED','EXCLUDED')),
  field TEXT NOT NULL,
  operator TEXT NOT NULL,
  value_json TEXT,
  unknown_handling TEXT NOT NULL CHECK (unknown_handling IN ('FAIL','ALLOW','REVIEW')),
  description TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY(icp_definition_id, icp_version) REFERENCES yie_icp_profile_versions(definition_id, version)
);
CREATE INDEX IF NOT EXISTS yie_icp_criteria_lookup_idx ON yie_icp_criteria(icp_definition_id, icp_version, kind);
CREATE INDEX IF NOT EXISTS yie_icp_criteria_field_idx ON yie_icp_criteria(field);

CREATE TABLE IF NOT EXISTS yie_icp_capabilities (
  icp_definition_id TEXT NOT NULL,
  icp_version INTEGER NOT NULL,
  definition_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(icp_definition_id, icp_version, definition_id, version),
  FOREIGN KEY(icp_definition_id, icp_version) REFERENCES yie_icp_profile_versions(definition_id, version),
  FOREIGN KEY(definition_id, version) REFERENCES yie_knowledge_versions(definition_id, version)
);
CREATE TABLE IF NOT EXISTS yie_icp_personas (
  icp_definition_id TEXT NOT NULL,
  icp_version INTEGER NOT NULL,
  definition_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(icp_definition_id, icp_version, definition_id, version),
  FOREIGN KEY(icp_definition_id, icp_version) REFERENCES yie_icp_profile_versions(definition_id, version),
  FOREIGN KEY(definition_id, version) REFERENCES yie_knowledge_versions(definition_id, version)
);
CREATE TABLE IF NOT EXISTS yie_icp_triggers (
  icp_definition_id TEXT NOT NULL,
  icp_version INTEGER NOT NULL,
  definition_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(icp_definition_id, icp_version, definition_id, version),
  FOREIGN KEY(icp_definition_id, icp_version) REFERENCES yie_icp_profile_versions(definition_id, version),
  FOREIGN KEY(definition_id, version) REFERENCES yie_knowledge_versions(definition_id, version)
);
CREATE TABLE IF NOT EXISTS yie_icp_pain_hypotheses (
  id TEXT PRIMARY KEY,
  icp_definition_id TEXT NOT NULL,
  icp_version INTEGER NOT NULL,
  value TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY(icp_definition_id, icp_version) REFERENCES yie_icp_profile_versions(definition_id, version)
);
CREATE TABLE IF NOT EXISTS yie_icp_source_recommendations (
  id TEXT PRIMARY KEY,
  icp_definition_id TEXT NOT NULL,
  icp_version INTEGER NOT NULL,
  value TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY(icp_definition_id, icp_version) REFERENCES yie_icp_profile_versions(definition_id, version)
);
CREATE INDEX IF NOT EXISTS yie_icp_capabilities_lookup_idx ON yie_icp_capabilities(icp_definition_id, icp_version);
CREATE INDEX IF NOT EXISTS yie_icp_personas_lookup_idx ON yie_icp_personas(icp_definition_id, icp_version);
CREATE INDEX IF NOT EXISTS yie_icp_triggers_lookup_idx ON yie_icp_triggers(icp_definition_id, icp_version);
`,
}];

export const POCKET_4_MIGRATION: YieMigration = {
  version: '20260730_002',
  name: 'pocket_4_discovery_sessions_and_planning',
  sql: `
CREATE TABLE IF NOT EXISTS yie_discovery_sessions (
  id TEXT PRIMARY KEY,
  external_correlation_id TEXT,
  actor_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('CREATED','INTERPRETING','PLANNED','FAILED','CANCELLED','SUPERSEDED')),
  lifecycle_mode TEXT NOT NULL CHECK (lifecycle_mode IN ('NEW','REFINE','EXPAND','EXCLUDE','RESTORE')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT,
  failed_at TEXT,
  failure_code TEXT,
  current_intent_version INTEGER NOT NULL DEFAULT 0,
  selected_solution_profile_id TEXT NOT NULL,
  selected_solution_profile_version INTEGER NOT NULL,
  selected_icp_id TEXT,
  selected_icp_version INTEGER,
  production_discovery_reference TEXT,
  shadow_only INTEGER NOT NULL CHECK (shadow_only = 1),
  provenance_json TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY(selected_solution_profile_id, selected_solution_profile_version)
    REFERENCES yie_knowledge_versions(definition_id, version),
  FOREIGN KEY(selected_icp_id, selected_icp_version)
    REFERENCES yie_icp_profile_versions(definition_id, version)
);
CREATE INDEX IF NOT EXISTS yie_discovery_sessions_actor_idx ON yie_discovery_sessions(actor_id, created_at);
CREATE INDEX IF NOT EXISTS yie_discovery_sessions_status_idx ON yie_discovery_sessions(status, created_at);
CREATE INDEX IF NOT EXISTS yie_discovery_sessions_solution_idx ON yie_discovery_sessions(selected_solution_profile_id, selected_solution_profile_version);
CREATE INDEX IF NOT EXISTS yie_discovery_sessions_icp_idx ON yie_discovery_sessions(selected_icp_id, selected_icp_version);
CREATE INDEX IF NOT EXISTS yie_discovery_sessions_production_idx ON yie_discovery_sessions(production_discovery_reference);

CREATE TABLE IF NOT EXISTS yie_discovery_intent_versions (
  session_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  parent_version INTEGER,
  mode TEXT NOT NULL CHECK (mode IN ('NEW','REFINE','EXPAND','EXCLUDE','RESTORE')),
  raw_user_input TEXT NOT NULL,
  normalized_intent_json TEXT NOT NULL,
  patch_json TEXT,
  explanation TEXT NOT NULL,
  selected_solution_profile_id TEXT NOT NULL,
  selected_solution_profile_version INTEGER NOT NULL,
  selected_icp_id TEXT,
  selected_icp_version INTEGER,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  provenance_json TEXT NOT NULL,
  proposal_metadata_json TEXT,
  validation_result_json TEXT NOT NULL,
  warnings_json TEXT NOT NULL,
  PRIMARY KEY(session_id, version),
  FOREIGN KEY(session_id) REFERENCES yie_discovery_sessions(id),
  FOREIGN KEY(session_id, parent_version) REFERENCES yie_discovery_intent_versions(session_id, version),
  FOREIGN KEY(selected_solution_profile_id, selected_solution_profile_version)
    REFERENCES yie_knowledge_versions(definition_id, version),
  FOREIGN KEY(selected_icp_id, selected_icp_version)
    REFERENCES yie_icp_profile_versions(definition_id, version)
);
CREATE INDEX IF NOT EXISTS yie_intent_versions_created_idx ON yie_discovery_intent_versions(created_at);
CREATE INDEX IF NOT EXISTS yie_intent_versions_icp_idx ON yie_discovery_intent_versions(selected_icp_id, selected_icp_version);

CREATE TABLE IF NOT EXISTS yie_discovery_session_events (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  sequence INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  UNIQUE(session_id, sequence),
  FOREIGN KEY(session_id) REFERENCES yie_discovery_sessions(id)
);
CREATE INDEX IF NOT EXISTS yie_session_events_lookup_idx ON yie_discovery_session_events(session_id, sequence);

CREATE TABLE IF NOT EXISTS yie_search_plans (
  session_id TEXT NOT NULL,
  intent_version INTEGER NOT NULL,
  plan_version INTEGER NOT NULL,
  solution_profile_id TEXT NOT NULL,
  solution_profile_version INTEGER NOT NULL,
  icp_id TEXT,
  icp_version INTEGER,
  plan_json TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY(session_id, plan_version),
  UNIQUE(session_id, intent_version),
  FOREIGN KEY(session_id, intent_version) REFERENCES yie_discovery_intent_versions(session_id, version)
);
CREATE INDEX IF NOT EXISTS yie_search_plans_fingerprint_idx ON yie_search_plans(fingerprint);
CREATE INDEX IF NOT EXISTS yie_search_plans_created_idx ON yie_search_plans(created_at);

CREATE TABLE IF NOT EXISTS yie_search_plan_queries (
  plan_session_id TEXT NOT NULL,
  plan_version INTEGER NOT NULL,
  query_id TEXT NOT NULL,
  query_text TEXT NOT NULL,
  source_category TEXT NOT NULL,
  priority INTEGER NOT NULL,
  status TEXT NOT NULL,
  query_json TEXT NOT NULL,
  PRIMARY KEY(plan_session_id, plan_version, query_id),
  FOREIGN KEY(plan_session_id, plan_version) REFERENCES yie_search_plans(session_id, plan_version)
);
CREATE INDEX IF NOT EXISTS yie_plan_queries_lookup_idx ON yie_search_plan_queries(plan_session_id, plan_version, priority);

CREATE TABLE IF NOT EXISTS yie_shadow_comparisons (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  production_reference TEXT,
  comparison_json TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(session_id) REFERENCES yie_discovery_sessions(id)
);
CREATE INDEX IF NOT EXISTS yie_shadow_comparisons_session_idx ON yie_shadow_comparisons(session_id, created_at);
CREATE INDEX IF NOT EXISTS yie_shadow_comparisons_fingerprint_idx ON yie_shadow_comparisons(fingerprint);
`,
};

export const POCKET_4_MIGRATIONS: YieMigration[] = [...POCKET_3_MIGRATIONS, POCKET_4_MIGRATION];
export const ALL_YIE_MIGRATIONS = POCKET_4_MIGRATIONS;
