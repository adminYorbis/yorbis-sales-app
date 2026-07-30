import crypto from 'crypto';
import type { Client, InStatement } from '@libsql/client';
import type { YieMigration } from './migrations';

export const PROTECTED_TABLES = [
  'user', 'account', 'session', 'verificationToken', 'authenticator',
  'prospects', 'contacts', 'outreach', 'search_runs', 'search_run_results',
] as const;

export class YieMigrationError extends Error {
  constructor(
    message: string,
    public readonly version?: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'YieMigrationError';
  }
}

export type MigrationPlanItem = {
  version: string;
  name: string;
  checksum: string;
  status: 'PENDING' | 'APPLIED';
};

function checksum(sql: string) {
  return crypto.createHash('sha256').update(sql.trim()).digest('hex');
}

function assertAdditiveYieSql(sql: string) {
  if (/\b(DROP|DELETE|UPDATE|REPLACE|TRUNCATE|VACUUM)\b/i.test(sql)) {
    throw new YieMigrationError('Destructive or mutating SQL is not permitted in YIE migrations.');
  }
  for (const match of sql.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["`]?([A-Za-z0-9_]+)/gi)) {
    if (!match[1].startsWith('yie_')) throw new YieMigrationError(`YIE migration attempted to create non-YIE table ${match[1]}.`);
  }
  for (const match of sql.matchAll(/ALTER\s+TABLE\s+["`]?([A-Za-z0-9_]+)/gi)) {
    if (!match[1].startsWith('yie_')) throw new YieMigrationError(`YIE migration attempted to alter protected table ${match[1]}.`);
  }
}

async function tableSignature(client: Client, table: string) {
  const exists = await client.execute({
    sql: 'SELECT 1 FROM sqlite_schema WHERE type = ? AND name = ?',
    args: ['table', table],
  });
  if (!exists.rows.length) return null;
  const columns = await client.execute(`PRAGMA table_info("${table}")`);
  return columns.rows.map((column) => ({
    name: String(column.name),
    type: String(column.type),
    notnull: Number(column.notnull),
    pk: Number(column.pk),
  }));
}

export async function protectedTableSnapshot(client: Client) {
  const snapshot: Record<string, Awaited<ReturnType<typeof tableSignature>>> = {};
  for (const table of PROTECTED_TABLES) snapshot[table] = await tableSignature(client, table);
  return snapshot;
}

async function ensureLedger(client: Client) {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS yie_schema_migrations (
      version TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      checksum TEXT NOT NULL,
      applied_at TEXT NOT NULL,
      execution_ms INTEGER NOT NULL
    )
  `);
}

export async function planYieMigrations(client: Client, migrations: YieMigration[]): Promise<MigrationPlanItem[]> {
  await client.execute('SELECT 1');
  const ledgerExists = await client.execute({
    sql: 'SELECT 1 FROM sqlite_schema WHERE type = ? AND name = ?',
    args: ['table', 'yie_schema_migrations'],
  });
  const applied = ledgerExists.rows.length
    ? await client.execute('SELECT version, checksum FROM yie_schema_migrations')
    : { rows: [] };
  const byVersion = new Map(applied.rows.map((row) => [String(row.version), String(row.checksum)]));
  return migrations.map((migration) => {
    assertAdditiveYieSql(migration.sql);
    const hash = checksum(migration.sql);
    const existing = byVersion.get(migration.version);
    if (existing && existing !== hash) throw new YieMigrationError(`Checksum drift detected for migration ${migration.version}.`, migration.version);
    return { version: migration.version, name: migration.name, checksum: hash, status: existing ? 'APPLIED' : 'PENDING' };
  });
}

export async function runYieMigrations(
  client: Client,
  migrations: YieMigration[],
  options: { dryRun?: boolean } = {},
) {
  const before = await protectedTableSnapshot(client);
  if (!options.dryRun) await ensureLedger(client);
  const plan = await planYieMigrations(client, migrations);
  if (options.dryRun) return { plan, applied: [] as string[] };
  const applied: string[] = [];
  for (const item of plan.filter((entry) => entry.status === 'PENDING')) {
    const migration = migrations.find((entry) => entry.version === item.version)!;
    const started = Date.now();
    try {
      const statements: InStatement[] = migration.sql
        .split(';')
        .map((statement) => statement.trim())
        .filter(Boolean)
        .map((sql) => ({ sql, args: [] }));
      statements.push({
        sql: 'INSERT INTO yie_schema_migrations (version, name, checksum, applied_at, execution_ms) VALUES (?, ?, ?, ?, ?)',
        args: [item.version, item.name, item.checksum, new Date().toISOString(), Date.now() - started],
      });
      await client.batch(statements, 'write');
      applied.push(item.version);
    } catch (error) {
      throw new YieMigrationError(`YIE migration ${item.version} failed: ${error instanceof Error ? error.message : 'unknown error'}`, item.version, { cause: error });
    }
  }
  const after = await protectedTableSnapshot(client);
  if (JSON.stringify(before) !== JSON.stringify(after)) {
    throw new YieMigrationError('Protected Auth.js or sales/search table signature changed during YIE migration.');
  }
  return { plan, applied };
}
