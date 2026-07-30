import { createClient } from '@libsql/client';
import { POCKET_3_MIGRATIONS } from '../src/infrastructure/yie/persistence/migrations';
import { runYieMigrations } from '../src/infrastructure/yie/persistence/migration-runner';
import { seedPocket3 } from '../src/infrastructure/yie/seeding/pocket-3-seed';

async function main() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url) throw new Error('TURSO_DATABASE_URL is required.');
  const client = createClient(authToken ? { url, authToken } : { url });
  try {
    const dryRun = process.argv.includes('--dry-run');
    const migration = await runYieMigrations(client, POCKET_3_MIGRATIONS, { dryRun });
    if (dryRun && migration.plan.some((item) => item.status === 'PENDING')) {
      throw new Error('Pocket 3 migrations are pending. Apply `npm run yie:migrate` before previewing the seed.');
    }
    const report = await seedPocket3(client, { dryRun });
    console.log(JSON.stringify(report, null, 2));
    if (report.conflicting.length) process.exitCode = 2;
  } finally {
    client.close();
  }
}

void main();
