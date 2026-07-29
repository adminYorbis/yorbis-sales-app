import { NextRequest, NextResponse } from 'next/server';
import { getAllProspects, getProspectsByStage } from '@/lib/db';
import { dbService } from '@/lib/db';

export const dynamic = 'force-dynamic';



// GET /api/prospects?stage=NEW
export async function GET(req: NextRequest) {
  try {
    const stage = req.nextUrl.searchParams.get('stage');

    // Query SQLite directly via db.ts helpers
    const prospects = (stage && stage !== 'ALL')
      ? getProspectsByStage(stage)
      : getAllProspects();

    return NextResponse.json({ success: true, prospects });
  } catch (error: any) {
    console.error('Error fetching prospects:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch prospects' },
      { status: 500 }
    );
  }
}

// POST /api/prospects (Add single prospect manually)
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

    // Save prospect using dbService
    const prospect = dbService.addProspect({
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

// DELETE /api/prospects (Clears all prospects)
export async function DELETE() {
  try {
    dbService.clearAllProspects();
    return NextResponse.json({ success: true, message: 'All prospects cleared successfully' });
  } catch (error: any) {
    console.error('Error clearing prospects:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to clear prospects' },
      { status: 500 }
    );
  }
}