import { createClient } from '@libsql/client';

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url || !authToken) {
  throw new Error('TURSO_DATABASE_URL and TURSO_AUTH_TOKEN are required.');
}

const client = createClient({ url, authToken });
const hostname = url.startsWith('file:')
  ? 'local-file-database'
  : new URL(url.replace('libsql://', 'https://')).hostname;
const existingTables = await client.execute(
  "SELECT name FROM sqlite_schema WHERE type = 'table' ORDER BY name"
);
const existingColumns = await client.execute('PRAGMA table_info("prospects")');
const columnNames = new Set(existingColumns.rows.map((column) => String(column.name)));

await client.execute(`
  CREATE TABLE IF NOT EXISTS search_runs (
    id TEXT PRIMARY KEY,
    user_email TEXT NOT NULL,
    query TEXT NOT NULL,
    intent_json TEXT NOT NULL,
    result_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);
await client.execute(
  'CREATE INDEX IF NOT EXISTS search_runs_user_created_idx ON search_runs(user_email, created_at DESC)'
);
await client.execute(`
  CREATE TABLE IF NOT EXISTS search_run_results (
    run_id TEXT NOT NULL,
    prospect_id TEXT NOT NULL,
    rank INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (run_id, prospect_id),
    FOREIGN KEY (run_id) REFERENCES search_runs(id) ON DELETE CASCADE,
    FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE CASCADE
  )
`);

const additions = [
  ['domain', 'TEXT'],
  ['website', 'TEXT'],
  ['contact_name', 'TEXT'],
  ['contact_title', 'TEXT'],
  ['contact_email', 'TEXT'],
  ['location', 'TEXT'],
  ['industry', 'TEXT'],
  ['contract_intel', 'TEXT'],
  ['icp_score', 'INTEGER DEFAULT 0'],
  ['icp_reasoning', 'TEXT'],
  ['outreach_angle', 'TEXT'],
  ['source_urls', 'TEXT'],
  ['research_brief', 'TEXT'],
  ['research_status', "TEXT DEFAULT 'PENDING'"],
  ['status', "TEXT DEFAULT 'NEW'"],
  ['stage', "TEXT DEFAULT 'NEW'"],
  ['notes', 'TEXT'],
  ['created_at', 'TEXT'],
  ['updated_at', 'TEXT'],
  ['employee_count', 'TEXT'],
  ['revenue_range', 'TEXT'],
  ['company_description', 'TEXT'],
  ['confidence', 'TEXT'],
  ['signals_json', 'TEXT'],
  ['evidence_json', 'TEXT'],
  ['score_breakdown', 'TEXT'],
  ['contact_profile_url', 'TEXT'],
  ['contact_source_url', 'TEXT'],
  ['contact_reason', 'TEXT'],
  ['recommended_approach', 'TEXT'],
  ['search_run_id', 'TEXT'],
  ['unknown_signals_json', 'TEXT'],
  ['why_now_json', 'TEXT'],
  ['recommended_conversation', 'TEXT'],
  ['best_opportunity', 'TEXT'],
  ['constraint_evaluations_json', 'TEXT'],
];

const addedColumns = [];
for (const [name, type] of additions) {
  if (!columnNames.has(name)) {
    await client.execute(`ALTER TABLE prospects ADD COLUMN ${name} ${type}`);
    addedColumns.push(name);
  }
}
await client.execute('CREATE UNIQUE INDEX IF NOT EXISTS prospects_domain_unique_idx ON prospects(domain)');

const searchColumnResult = await client.execute('PRAGMA table_info("search_runs")');
const searchColumnNames = new Set(searchColumnResult.rows.map((column) => String(column.name)));
const searchAdditions = [
  ['parent_run_id', 'TEXT'],
  ['discovery_session_id', 'TEXT'],
  ['request_type', "TEXT DEFAULT 'NEW_DISCOVERY_REQUEST'"],
  ['status', "TEXT DEFAULT 'COMPLETED'"],
];
const addedSearchColumns = [];
for (const [name, type] of searchAdditions) {
  if (!searchColumnNames.has(name)) {
    await client.execute(`ALTER TABLE search_runs ADD COLUMN ${name} ${type}`);
    addedSearchColumns.push(name);
  }
}
await client.execute(`
  INSERT OR IGNORE INTO search_run_results (run_id, prospect_id, rank)
  SELECT search_run_id, id, 0 FROM prospects WHERE search_run_id IS NOT NULL
`);

const finalTables = await client.execute(
  "SELECT name FROM sqlite_schema WHERE type = 'table' ORDER BY name"
);
const prospectCount = await client.execute('SELECT COUNT(*) AS count FROM prospects');

console.log({
  databaseHostname: hostname,
  tablesBefore: existingTables.rows.map((row) => String(row.name)),
  tablesAfter: finalTables.rows.map((row) => String(row.name)),
  addedColumns,
  addedSearchColumns,
  existingProspectsPreserved: Number(prospectCount.rows[0].count),
});
