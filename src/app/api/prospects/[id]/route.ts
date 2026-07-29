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

    // Convert string ID to number if SQLite uses numeric IDs
    const prospectId = Number(id);

    // Call your dbService update method
    const updated = dbService.updateProspect(prospectId, body);

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
    const prospectId = Number(id);

    dbService.deleteProspect(prospectId);

    return NextResponse.json({ success: true, deletedId: prospectId });
  } catch (error: any) {
    console.error(`Error deleting prospect ${params}:`, error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete prospect' },
      { status: 500 }
    );
  }
}