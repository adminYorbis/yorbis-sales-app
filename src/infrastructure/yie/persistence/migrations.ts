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

export const POCKET_5_MIGRATION: YieMigration = {
  version: '20260730_003',
  name: 'pocket_5_evidence_first_candidate_discovery',
  sql: `
CREATE TABLE IF NOT EXISTS yie_discovery_runs (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  intent_version INTEGER NOT NULL,
  search_plan_id TEXT NOT NULL,
  search_plan_version INTEGER NOT NULL,
  run_version INTEGER NOT NULL,
  status TEXT NOT NULL,
  shadow_only INTEGER NOT NULL CHECK (shadow_only = 1),
  execution_mode TEXT NOT NULL,
  provider_key TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT,
  failed_at TEXT,
  cancelled_at TEXT,
  resumed_from_run_id TEXT,
  correlation_id TEXT NOT NULL,
  actor_provenance TEXT NOT NULL,
  query_budget INTEGER NOT NULL,
  source_budget INTEGER NOT NULL,
  candidate_budget INTEGER NOT NULL,
  provider_request_count INTEGER NOT NULL DEFAULT 0,
  provider_retry_count INTEGER NOT NULL DEFAULT 0,
  total_provider_latency_ms INTEGER NOT NULL DEFAULT 0,
  estimated_provider_cost REAL,
  failure_code TEXT,
  failure_message_summary TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(search_plan_id, search_plan_version, run_version),
  FOREIGN KEY(session_id, intent_version) REFERENCES yie_discovery_intent_versions(session_id, version),
  FOREIGN KEY(search_plan_id, search_plan_version) REFERENCES yie_search_plans(session_id, plan_version)
);
CREATE INDEX IF NOT EXISTS yie_runs_session_idx ON yie_discovery_runs(session_id, created_at);
CREATE INDEX IF NOT EXISTS yie_runs_plan_idx ON yie_discovery_runs(search_plan_id, search_plan_version);
CREATE INDEX IF NOT EXISTS yie_runs_status_idx ON yie_discovery_runs(status, created_at);

CREATE TABLE IF NOT EXISTS yie_search_execution_plans (
  run_id TEXT NOT NULL,
  execution_plan_version INTEGER NOT NULL,
  search_plan_id TEXT NOT NULL,
  search_plan_version INTEGER NOT NULL,
  fingerprint TEXT NOT NULL,
  plan_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY(run_id, execution_plan_version),
  UNIQUE(run_id, fingerprint),
  FOREIGN KEY(run_id) REFERENCES yie_discovery_runs(id)
);
CREATE INDEX IF NOT EXISTS yie_execution_plans_fingerprint_idx ON yie_search_execution_plans(fingerprint);

CREATE TABLE IF NOT EXISTS yie_search_execution_steps (
  run_id TEXT NOT NULL,
  execution_plan_version INTEGER NOT NULL,
  step_id TEXT NOT NULL,
  search_plan_query_id TEXT NOT NULL,
  query_text TEXT NOT NULL,
  source_category TEXT NOT NULL,
  priority INTEGER NOT NULL,
  execution_order INTEGER NOT NULL,
  status TEXT NOT NULL,
  skip_reason TEXT,
  step_json TEXT NOT NULL,
  PRIMARY KEY(run_id, execution_plan_version, step_id),
  FOREIGN KEY(run_id, execution_plan_version) REFERENCES yie_search_execution_plans(run_id, execution_plan_version)
);
CREATE INDEX IF NOT EXISTS yie_execution_steps_order_idx ON yie_search_execution_steps(run_id, execution_plan_version, execution_order);

CREATE TABLE IF NOT EXISTS yie_search_attempts (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  execution_step_id TEXT NOT NULL,
  search_plan_query_id TEXT NOT NULL,
  attempt_number INTEGER NOT NULL,
  provider_key TEXT NOT NULL,
  query_text TEXT NOT NULL,
  source_category TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  result_count INTEGER NOT NULL DEFAULT 0,
  retryable INTEGER NOT NULL DEFAULT 0,
  error_code TEXT,
  error_summary TEXT,
  provider_request_metadata_json TEXT NOT NULL DEFAULT '{}',
  estimated_cost REAL,
  UNIQUE(run_id, execution_step_id, attempt_number),
  FOREIGN KEY(run_id) REFERENCES yie_discovery_runs(id)
);
CREATE INDEX IF NOT EXISTS yie_attempts_run_status_idx ON yie_search_attempts(run_id, status);

CREATE TABLE IF NOT EXISTS yie_sources (
  id TEXT PRIMARY KEY,
  canonical_url TEXT NOT NULL UNIQUE,
  normalized_url TEXT NOT NULL,
  original_url TEXT NOT NULL,
  domain TEXT NOT NULL,
  registrable_domain TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_category TEXT NOT NULL,
  title TEXT,
  publisher TEXT,
  published_at TEXT,
  retrieved_at TEXT NOT NULL,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  content_hash TEXT,
  excerpt_hash TEXT,
  language TEXT,
  http_status INTEGER,
  retrieval_status TEXT NOT NULL,
  robots_or_access_note TEXT,
  provenance_json TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS yie_sources_normalized_url_idx ON yie_sources(normalized_url);
CREATE INDEX IF NOT EXISTS yie_sources_domain_idx ON yie_sources(domain);
CREATE INDEX IF NOT EXISTS yie_sources_content_hash_idx ON yie_sources(content_hash);

CREATE TABLE IF NOT EXISTS yie_source_observations (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  search_attempt_id TEXT NOT NULL,
  search_plan_query_id TEXT NOT NULL,
  execution_step_id TEXT NOT NULL,
  rank INTEGER NOT NULL,
  provider_result_id TEXT,
  provider_snippet TEXT NOT NULL,
  retrieved_excerpt TEXT,
  matched_terms_json TEXT NOT NULL DEFAULT '[]',
  discovered_at TEXT NOT NULL,
  retrieval_method TEXT NOT NULL,
  relevance_proposal REAL,
  provenance_json TEXT NOT NULL,
  fingerprint TEXT NOT NULL UNIQUE,
  FOREIGN KEY(run_id) REFERENCES yie_discovery_runs(id),
  FOREIGN KEY(source_id) REFERENCES yie_sources(id),
  FOREIGN KEY(search_attempt_id) REFERENCES yie_search_attempts(id)
);
CREATE INDEX IF NOT EXISTS yie_observations_run_idx ON yie_source_observations(run_id, search_plan_query_id);
CREATE INDEX IF NOT EXISTS yie_observations_source_idx ON yie_source_observations(source_id);

CREATE TABLE IF NOT EXISTS yie_source_excerpts (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  run_id TEXT NOT NULL,
  excerpt_type TEXT NOT NULL,
  excerpt_text TEXT NOT NULL,
  character_start INTEGER,
  character_end INTEGER,
  section_heading TEXT,
  extractor TEXT NOT NULL,
  created_at TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  provenance_json TEXT NOT NULL,
  UNIQUE(source_id, run_id, content_hash),
  FOREIGN KEY(source_id) REFERENCES yie_sources(id),
  FOREIGN KEY(run_id) REFERENCES yie_discovery_runs(id)
);
CREATE INDEX IF NOT EXISTS yie_excerpts_run_idx ON yie_source_excerpts(run_id, source_id);

CREATE TABLE IF NOT EXISTS yie_candidate_mentions (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  source_excerpt_id TEXT,
  raw_name TEXT NOT NULL,
  normalized_name_proposal TEXT NOT NULL,
  legal_name_proposal TEXT,
  brand_name_proposal TEXT,
  website_proposal TEXT,
  location_proposal TEXT,
  industry_proposal TEXT,
  business_model_proposal TEXT,
  mention_context TEXT NOT NULL,
  extraction_method TEXT NOT NULL,
  extraction_confidence REAL NOT NULL,
  validation_status TEXT NOT NULL,
  rejection_reason TEXT,
  entity_type TEXT NOT NULL,
  created_at TEXT NOT NULL,
  provenance_json TEXT NOT NULL,
  fingerprint TEXT NOT NULL UNIQUE,
  FOREIGN KEY(run_id) REFERENCES yie_discovery_runs(id),
  FOREIGN KEY(source_id) REFERENCES yie_sources(id),
  FOREIGN KEY(source_excerpt_id) REFERENCES yie_source_excerpts(id)
);
CREATE INDEX IF NOT EXISTS yie_mentions_run_idx ON yie_candidate_mentions(run_id, validation_status);
CREATE INDEX IF NOT EXISTS yie_mentions_source_idx ON yie_candidate_mentions(source_id);
CREATE INDEX IF NOT EXISTS yie_mentions_name_idx ON yie_candidate_mentions(normalized_name_proposal);

CREATE TABLE IF NOT EXISTS yie_candidate_companies (
  id TEXT PRIMARY KEY,
  canonical_name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  legal_name TEXT,
  brand_names_json TEXT NOT NULL DEFAULT '[]',
  canonical_domain TEXT,
  canonical_website TEXT,
  headquarters_geography_proposal TEXT,
  operating_geographies_json TEXT NOT NULL DEFAULT '[]',
  industry_proposals_json TEXT NOT NULL DEFAULT '[]',
  business_model_proposals_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL CHECK (status <> 'VERIFIED'),
  merge_confidence REAL NOT NULL,
  first_seen_run_id TEXT NOT NULL,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  provenance_json TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY(first_seen_run_id) REFERENCES yie_discovery_runs(id)
);
CREATE INDEX IF NOT EXISTS yie_candidates_name_idx ON yie_candidate_companies(normalized_name);
CREATE INDEX IF NOT EXISTS yie_candidates_domain_idx ON yie_candidate_companies(canonical_domain);

CREATE TABLE IF NOT EXISTS yie_candidate_company_aliases (
  id TEXT PRIMARY KEY,
  candidate_company_id TEXT NOT NULL,
  alias TEXT NOT NULL,
  normalized_alias TEXT NOT NULL,
  alias_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(candidate_company_id, normalized_alias, source_id),
  FOREIGN KEY(candidate_company_id) REFERENCES yie_candidate_companies(id),
  FOREIGN KEY(source_id) REFERENCES yie_sources(id)
);

CREATE TABLE IF NOT EXISTS yie_candidate_mention_links (
  id TEXT PRIMARY KEY,
  candidate_company_id TEXT NOT NULL,
  candidate_mention_id TEXT NOT NULL UNIQUE,
  source_id TEXT NOT NULL,
  run_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(candidate_company_id) REFERENCES yie_candidate_companies(id),
  FOREIGN KEY(candidate_mention_id) REFERENCES yie_candidate_mentions(id),
  FOREIGN KEY(source_id) REFERENCES yie_sources(id),
  FOREIGN KEY(run_id) REFERENCES yie_discovery_runs(id)
);

CREATE TABLE IF NOT EXISTS yie_identity_resolution_decisions (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  action TEXT NOT NULL,
  source_candidate_id TEXT,
  target_candidate_id TEXT,
  mention_id TEXT NOT NULL,
  confidence REAL NOT NULL,
  matched_signals_json TEXT NOT NULL,
  conflicting_signals_json TEXT NOT NULL,
  explanation TEXT NOT NULL,
  review_required INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  provenance_json TEXT NOT NULL,
  FOREIGN KEY(run_id) REFERENCES yie_discovery_runs(id),
  FOREIGN KEY(target_candidate_id) REFERENCES yie_candidate_companies(id),
  FOREIGN KEY(mention_id) REFERENCES yie_candidate_mentions(id)
);
CREATE INDEX IF NOT EXISTS yie_identity_decisions_run_idx ON yie_identity_resolution_decisions(run_id, action);

CREATE TABLE IF NOT EXISTS yie_proposed_claims (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  candidate_company_id TEXT NOT NULL,
  claim_type TEXT NOT NULL,
  normalized_value_json TEXT NOT NULL,
  raw_value_json TEXT NOT NULL,
  claim_status TEXT NOT NULL CHECK (claim_status <> 'VERIFIED'),
  extraction_confidence REAL NOT NULL,
  source_count INTEGER NOT NULL CHECK (source_count > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  provenance_json TEXT NOT NULL,
  fingerprint TEXT NOT NULL UNIQUE,
  FOREIGN KEY(run_id) REFERENCES yie_discovery_runs(id),
  FOREIGN KEY(candidate_company_id) REFERENCES yie_candidate_companies(id)
);
CREATE INDEX IF NOT EXISTS yie_claims_candidate_idx ON yie_proposed_claims(candidate_company_id, claim_type);
CREATE INDEX IF NOT EXISTS yie_claims_run_idx ON yie_proposed_claims(run_id, claim_status);

CREATE TABLE IF NOT EXISTS yie_claim_evidence_links (
  id TEXT PRIMARY KEY,
  claim_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  source_excerpt_id TEXT,
  source_observation_id TEXT,
  support_type TEXT NOT NULL,
  extracted_text TEXT NOT NULL,
  relevance_confidence REAL NOT NULL,
  created_at TEXT NOT NULL,
  provenance_json TEXT NOT NULL,
  fingerprint TEXT NOT NULL UNIQUE,
  FOREIGN KEY(claim_id) REFERENCES yie_proposed_claims(id),
  FOREIGN KEY(source_id) REFERENCES yie_sources(id),
  FOREIGN KEY(source_excerpt_id) REFERENCES yie_source_excerpts(id),
  FOREIGN KEY(source_observation_id) REFERENCES yie_source_observations(id)
);
CREATE INDEX IF NOT EXISTS yie_evidence_source_idx ON yie_claim_evidence_links(source_id);

CREATE TABLE IF NOT EXISTS yie_discovery_checkpoints (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  checkpoint_type TEXT NOT NULL,
  sequence INTEGER NOT NULL,
  status TEXT NOT NULL,
  reference_id TEXT,
  created_at TEXT NOT NULL,
  payload_summary TEXT NOT NULL,
  fingerprint TEXT NOT NULL UNIQUE,
  provenance_json TEXT NOT NULL,
  UNIQUE(run_id, sequence),
  FOREIGN KEY(run_id) REFERENCES yie_discovery_runs(id)
);
CREATE INDEX IF NOT EXISTS yie_checkpoints_run_idx ON yie_discovery_checkpoints(run_id, sequence);
`,
};

export const POCKET_5_MIGRATIONS: YieMigration[] = [...POCKET_4_MIGRATIONS, POCKET_5_MIGRATION];
export const ALL_YIE_MIGRATIONS = POCKET_5_MIGRATIONS;
