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
