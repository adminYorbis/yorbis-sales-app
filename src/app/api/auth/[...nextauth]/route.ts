import { handlers } from '@/auth';
import { ensureSchema } from '@/lib/db';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  await ensureSchema();
  return handlers.GET(request);
}

export async function POST(request: NextRequest) {
  await ensureSchema();
  return handlers.POST(request);
}
