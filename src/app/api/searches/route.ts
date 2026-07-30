import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { dbService } from '@/lib/db';

export async function GET() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  const searches = await dbService.getRecentSearches(email);
  return NextResponse.json({ searches });
}
