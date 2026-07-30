import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { dbService } from '@/lib/db';

export async function GET(request: NextRequest) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  const id = request.nextUrl.searchParams.get('id');
  if (id) {
    const restored = await dbService.getSearchRun(email, id);
    if (!restored) return NextResponse.json({ error: 'Discovery not found.' }, { status: 404 });
    return NextResponse.json(restored);
  }
  const searches = await dbService.getRecentSearches(email);
  return NextResponse.json({ searches });
}
