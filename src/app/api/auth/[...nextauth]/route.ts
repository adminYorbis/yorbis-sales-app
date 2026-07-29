import { handlers } from '@/auth';
import { ensureAuthSchema } from '@/lib/auth-migration';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  await ensureAuthSchema();
  return handlers.GET(request);
}

export async function POST(request: NextRequest) {
  await ensureAuthSchema();
  return handlers.POST(request);
}
