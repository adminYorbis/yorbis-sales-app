import { getTursoClient } from './db';

const AUTH_MIGRATION_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "user" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" INTEGER,
    "image" TEXT,
    CONSTRAINT "user_email_unique" UNIQUE ("email")
  )`,

  `CREATE TABLE IF NOT EXISTS "account" (
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    CONSTRAINT "account_provider_providerAccountId_pk" PRIMARY KEY ("provider", "providerAccountId"),
    CONSTRAINT "account_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE
  )`,

  `CREATE TABLE IF NOT EXISTS "session" (
    "sessionToken" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "expires" INTEGER NOT NULL,
    CONSTRAINT "session_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE
  )`,

  `CREATE TABLE IF NOT EXISTS "verificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" INTEGER NOT NULL,
    CONSTRAINT "verificationToken_identifier_token_pk" PRIMARY KEY ("identifier", "token")
  )`,

  `CREATE TABLE IF NOT EXISTS "authenticator" (
    "credentialID" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "credentialPublicKey" TEXT NOT NULL,
    "counter" INTEGER NOT NULL,
    "credentialDeviceType" TEXT NOT NULL,
    "credentialBackedUp" INTEGER NOT NULL,
    "transports" TEXT,
    CONSTRAINT "authenticator_userId_credentialID_pk" PRIMARY KEY ("userId", "credentialID"),
    CONSTRAINT "authenticator_credentialID_unique" UNIQUE ("credentialID"),
    CONSTRAINT "authenticator_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS "account_userId_idx" ON "account" ("userId")`,
  `CREATE INDEX IF NOT EXISTS "session_userId_idx" ON "session" ("userId")`,
  `CREATE INDEX IF NOT EXISTS "session_expires_idx" ON "session" ("expires")`,
  `CREATE INDEX IF NOT EXISTS "verificationToken_expires_idx" ON "verificationToken" ("expires")`,
  `CREATE INDEX IF NOT EXISTS "authenticator_userId_idx" ON "authenticator" ("userId")`,
] as const;

const AUTH_MIGRATION_SQL = AUTH_MIGRATION_STATEMENTS.map((statement) => `${statement};`).join('\n\n');

const AUTH_TABLES = ['user', 'account', 'session', 'verificationToken', 'authenticator'] as const;
let authMigrationPromise: Promise<void> | undefined;

export class AuthMigrationError extends Error {
  constructor(
    public readonly step: number,
    public readonly code: string,
    options?: { cause?: unknown },
  ) {
    super(`Auth schema migration failed at additive statement ${step}.`, options);
    this.name = 'AuthMigrationError';
  }
}

export function productionDatabaseIdentity() {
  const rawUrl = process.env.TURSO_DATABASE_URL;
  if (!rawUrl) throw new Error('TURSO_DATABASE_URL is required.');
  const parsed = new URL(rawUrl);
  if (parsed.protocol === 'file:') throw new Error('Refusing to run the production Auth.js migration against a local file database.');
  return parsed.hostname;
}

export async function ensureAuthSchema() {
  if (!authMigrationPromise) {
    authMigrationPromise = (async () => {
      const db = getTursoClient();
      for (const [index, statement] of AUTH_MIGRATION_STATEMENTS.entries()) {
        try {
          await db.execute(statement);
        } catch (error) {
          const code = typeof error === 'object' && error && 'code' in error
            ? String(error.code)
            : 'UNKNOWN';
          throw new AuthMigrationError(index + 1, code, { cause: error });
        }
      }
      await verifyAuthSchema();
    })().catch((error) => {
      authMigrationPromise = undefined;
      throw error;
    });
  }
  return authMigrationPromise;
}

export async function verifyAuthSchema() {
  const db = getTursoClient();
  const requiredColumns: Record<(typeof AUTH_TABLES)[number], string[]> = {
    user: ['id', 'name', 'email', 'emailVerified', 'image'],
    account: ['userId', 'type', 'provider', 'providerAccountId', 'refresh_token', 'access_token', 'expires_at', 'token_type', 'scope', 'id_token', 'session_state'],
    session: ['sessionToken', 'userId', 'expires'],
    verificationToken: ['identifier', 'token', 'expires'],
    authenticator: ['credentialID', 'userId', 'providerAccountId', 'credentialPublicKey', 'counter', 'credentialDeviceType', 'credentialBackedUp', 'transports'],
  };

  for (const table of AUTH_TABLES) {
    const result = await db.execute(`PRAGMA table_info("${table}")`);
    const actual = new Set(result.rows.map((row) => String(row.name)));
    const missing = requiredColumns[table].filter((column) => !actual.has(column));
    if (missing.length) throw new Error(`Auth.js schema verification failed: "${table}" is missing ${missing.join(', ')}.`);
  }
}

export async function salesTableSnapshot() {
  const db = getTursoClient();
  const tables = ['settings', 'prospects', 'outreach', 'contacts'];
  const snapshot: Record<string, number> = {};
  for (const table of tables) {
    const exists = await db.execute({ sql: 'SELECT 1 FROM sqlite_schema WHERE type = ? AND name = ?', args: ['table', table] });
    if (!exists.rows.length) continue;
    const count = await db.execute(`SELECT COUNT(*) AS count FROM "${table}"`);
    snapshot[table] = Number(count.rows[0]?.count || 0);
  }
  return snapshot;
}

export { AUTH_MIGRATION_SQL };
