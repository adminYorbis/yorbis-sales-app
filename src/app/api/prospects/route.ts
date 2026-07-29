import { NextRequest, NextResponse } from 'next/server';
import { dbService } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/prospects (or /api/prospects?stage=NEW)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const stage = searchParams.get('stage');

    // Fetch prospects using dbService or fallback
    const prospects = await dbService.getAllProspects(stage && stage !== 'ALL' ? stage : undefined);

    return NextResponse.json({ success: true, prospects: prospects || [] });
  } catch (error) {
    console.error('Database Error:', error);
    return NextResponse.json(
      { success: false, prospects: [], error: 'Failed to fetch prospects' },
      { status: 500 }
    );
  }
}

// POST /api/prospects
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, company, notes, stage = 'NEW' } = body;

    if (!name || !email) {
      return NextResponse.json(
        { success: false, error: 'Name and email are required' },
        { status: 400 }
      );
    }

    const prospect = await dbService.addProspect({
      name,
      email,
      company: company || '',
      notes: notes || '',
      stage,
    });

    return NextResponse.json({ success: true, prospect });
  } catch (error: any) {
    console.error('Error adding prospect:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to add prospect' },
      { status: 500 }
    );
  }
}

// PATCH /api/prospects
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Prospect ID is required' },
        { status: 400 }
      );
    }

    const updatedProspect = await dbService.updateProspect(id, updates);
    if (!updatedProspect) {
      return NextResponse.json(
        { success: false, error: 'Prospect not found or no updates provided' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, prospect: updatedProspect });
  } catch (error: any) {
    console.error('Error updating prospect:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update prospect' },
      { status: 500 }
    );
  }
}

// DELETE /api/prospects
export async function DELETE() {
  try {
    await dbService.clearAllProspects();
    return NextResponse.json({ success: true, message: 'All prospects cleared successfully' });
  } catch (error: any) {
    console.error('Error clearing prospects:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to clear prospects' },
      { status: 500 }
    );
  }
}