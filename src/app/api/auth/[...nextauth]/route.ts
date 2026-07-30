import { handlers } from '@/auth';
import { AuthMigrationError, ensureAuthSchema } from '@/lib/auth-migration';
import { NextRequest, NextResponse } from 'next/server';

async function migrateOrError() {
  try {
    await ensureAuthSchema();
    return null;
  } catch (error) {
    console.error('Auth schema migration failed:', error);
    return NextResponse.json({
      error: 'auth_schema_migration_failed',
      step: error instanceof AuthMigrationError ? error.step : null,
      code: error instanceof AuthMigrationError ? error.code : 'UNKNOWN',
      detail: error instanceof AuthMigrationError ? error.detail : 'Unknown migration failure',
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const migrationError = await migrateOrError();
  if (migrationError) return migrationError;
  return handlers.GET(request);
}

export async function POST(request: NextRequest) {
  const migrationError = await migrateOrError();
  if (migrationError) return migrationError;
  return handlers.POST(request);
}
