import { NextResponse } from 'next/server';
import { dbService } from '@/lib/db';
import { geminiService } from '@/lib/gemini';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const prospectId = parseInt(id, 10);

    const prospect = dbService.getProspectById(prospectId);

    if (!prospect) {
      return NextResponse.json(
        { success: false, error: 'Prospect not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      research_brief: prospect.research_brief || null,
      research_status: prospect.research_status || 'PENDING',
    });
  } catch (error: any) {
    console.error('Error fetching research brief:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const prospectId = parseInt(id, 10);

    const prospect = dbService.getProspectById(prospectId);

    if (!prospect) {
      return NextResponse.json(
        { success: false, error: 'Prospect not found' },
        { status: 404 }
      );
    }

    const companyOrName = prospect.company || prospect.name;
    const website = prospect.website || undefined;

    // Call Gemini using the correct import
    const brief = await geminiService.generateResearchBrief(companyOrName, website);

    // Save research brief to SQLite
    dbService.updateProspect(prospectId, {
      research_brief: brief,
      research_status: 'COMPLETED',
    });

    return NextResponse.json({
      success: true,
      research_brief: brief,
      research_status: 'COMPLETED',
    });
  } catch (error: any) {
    console.error('Error generating research brief:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to generate research' },
      { status: 500 }
    );
  }
}