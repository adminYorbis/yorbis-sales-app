import { NextRequest, NextResponse } from 'next/server';
import { dbService } from '@/lib/db';

export async function PATCH(req: NextRequest) {
  try {
    const { id, stage } = await req.json();
    if (!id || !stage) return NextResponse.json({ success: false, error: 'Missing id or stage' }, { status: 400 });
    await dbService.updateProspect(String(id), { stage });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Update failed' }, { status: 500 });
  }
}
