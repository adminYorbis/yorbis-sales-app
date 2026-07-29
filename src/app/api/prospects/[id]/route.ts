import { NextRequest, NextResponse } from 'next/server';
import { dbService } from '@/lib/db';

// PATCH /api/prospects/[id] (Update stage, notes, etc.)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const updated = await dbService.updateProspect(id, body);

    return NextResponse.json({ success: true, updated });
  } catch (error: any) {
    console.error(`Error updating prospect ${params}:`, error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update prospect' },
      { status: 500 }
    );
  }
}

// DELETE /api/prospects/[id] (Delete single prospect)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await dbService.deleteProspect(id);

    return NextResponse.json({ success: true, deletedId: id });
  } catch (error: any) {
    console.error(`Error deleting prospect ${params}:`, error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete prospect' },
      { status: 500 }
    );
  }
}
