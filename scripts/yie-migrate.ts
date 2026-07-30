import { createClient } from '@libsql/client';
import { POCKET_3_MIGRATIONS } from '../src/infrastructure/yie/persistence/migrations';
import { runYieMigrations } from '../src/infrastructure/yie/persistence/migration-runner';

async function main() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url) throw new Error('TURSO_DATABASE_URL is required.');
  const client = createClient(authToken ? { url, authToken } : { url });
  try {
    const dryRun = process.argv.includes('--dry-run');
    const result = await runYieMigrations(client, POCKET_3_MIGRATIONS, { dryRun });
    console.log(JSON.stringify({ dryRun, plan: result.plan, applied: result.applied }, null, 2));
  } finally {
    client.close();
  }
}

void main();
