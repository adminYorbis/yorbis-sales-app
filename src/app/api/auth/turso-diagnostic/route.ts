import { createClient } from '@libsql/client';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const databaseUrl = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  let hostname: string | null = null;

  if (databaseUrl) {
    try {
      hostname = new URL(databaseUrl).hostname;
    } catch {
      hostname = 'invalid-url';
    }
  }

  const diagnostic = {
    databaseHostname: hostname,
    databaseUrlDefined: Boolean(databaseUrl),
    authTokenDefined: Boolean(authToken),
    authTokenLength: authToken?.length || 0,
    select1: { success: false, errorCode: null as string | null },
    sqliteSchema: { success: false, errorCode: null as string | null },
  };

  if (!databaseUrl || !authToken) {
    return NextResponse.json(diagnostic, {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  const client = createClient({ url: databaseUrl, authToken });

  try {
    await client.execute('SELECT 1');
    diagnostic.select1.success = true;
  } catch (error) {
    diagnostic.select1.errorCode = typeof error === 'object' && error && 'code' in error
      ? String(error.code)
      : 'UNKNOWN';
  }

  try {
    await client.execute("SELECT name FROM sqlite_schema WHERE type = 'table' LIMIT 1");
    diagnostic.sqliteSchema.success = true;
  } catch (error) {
    diagnostic.sqliteSchema.errorCode = typeof error === 'object' && error && 'code' in error
      ? String(error.code)
      : 'UNKNOWN';
  }

  return NextResponse.json(diagnostic, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
