import { createClient } from '@libsql/client';

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url || !authToken) {
  throw new Error('TURSO_DATABASE_URL and TURSO_AUTH_TOKEN are required.');
}

const client = createClient({ url, authToken });
const hostname = new URL(url.replace('libsql://', 'https://')).hostname;
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

const additions = [
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
];

const addedColumns = [];
for (const [name, type] of additions) {
  if (!columnNames.has(name)) {
    await client.execute(`ALTER TABLE prospects ADD COLUMN ${name} ${type}`);
    addedColumns.push(name);
  }
}

const finalTables = await client.execute(
  "SELECT name FROM sqlite_schema WHERE type = 'table' ORDER BY name"
);
const prospectCount = await client.execute('SELECT COUNT(*) AS count FROM prospects');

console.log({
  databaseHostname: hostname,
  tablesBefore: existingTables.rows.map((row) => String(row.name)),
  tablesAfter: finalTables.rows.map((row) => String(row.name)),
  addedColumns,
  existingProspectsPreserved: Number(prospectCount.rows[0].count),
});
