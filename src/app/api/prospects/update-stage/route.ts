import { NextRequest, NextResponse } from 'next/server';
import { updateProspectStage } from '@/lib/db';

export async function PATCH(req: NextRequest) {
  try {
    const { id, stage } = await req.json();
    if (!id || !stage) {
      return NextResponse.json({ success: false, error: 'Missing id or stage' }, { status: 400 });
    }
    updateProspectStage(id, stage);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
