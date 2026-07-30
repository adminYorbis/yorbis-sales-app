import assert from 'node:assert/strict';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createClient } from '@libsql/client';

async function main() {
const path = join(tmpdir(), `yorbis-persistence-${crypto.randomUUID()}.db`);
const url = `file:${path.replaceAll('\\', '/')}`;
process.env.TURSO_DATABASE_URL = url;
delete process.env.TURSO_AUTH_TOKEN;

const baseline = createClient({ url });
await baseline.execute(`
  CREATE TABLE prospects (
    id TEXT PRIMARY KEY,
    company_name TEXT NOT NULL,
    website TEXT,
    contact_name TEXT,
    contact_title TEXT,
    contact_email TEXT,
    location TEXT,
    contract_intel TEXT,
    icp_score INTEGER,
    icp_reasoning TEXT,
    outreach_angle TEXT,
    status TEXT DEFAULT 'NEW',
    created_at TEXT
  )
`);
await baseline.execute({
  sql: 'INSERT INTO prospects (id, company_name, website) VALUES (?, ?, ?)',
  args: ['legacy-1', 'Existing Company', 'https://existing.example'],
});

const { dbService } = await import('../src/lib/db');
assert.equal(await dbService.ensureDiscoveryReady(), true);
const saved = await dbService.addProspect({
  company_name: 'New Distributor',
  website: 'https://new-distributor.example',
  industry: 'Distribution',
  signals_json: '[]',
  evidence_json: '[]',
  search_run_id: 'test-run',
});
assert.equal(saved.company_name, 'New Distributor');

const count = await baseline.execute('SELECT COUNT(*) AS count FROM prospects');
assert.equal(Number(count.rows[0].count), 2);
const columns = await baseline.execute('PRAGMA table_info("prospects")');
const names = new Set(columns.rows.map((column) => String(column.name)));
for (const required of ['domain', 'industry', 'source_urls', 'research_brief', 'stage', 'notes', 'updated_at', 'signals_json', 'constraint_evaluations_json']) {
  assert.equal(names.has(required), true, `${required} should be added`);
}
const indexes = await baseline.execute('PRAGMA index_list("prospects")');
assert.equal(indexes.rows.some((index) => String(index.name) === 'prospects_domain_unique_idx' && Number(index.unique) === 1), true);

baseline.close();
console.log('Legacy prospect schema migration and persistence test passed.');
}

void main();
