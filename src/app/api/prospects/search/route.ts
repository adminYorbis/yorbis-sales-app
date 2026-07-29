import { NextRequest, NextResponse } from 'next/server';
import { geminiService, Candidate } from '@/lib/gemini';
import { dbService } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');

    if (!query) {
      return NextResponse.json(
        { success: false, error: 'Query parameter "q" is required' },
        { status: 400 }
      );
    }

    let candidates: Candidate[] = [];

    if (typeof geminiService.searchProspects === 'function') {
      candidates = await geminiService.searchProspects(query);
    } else if (typeof geminiService.findDecisionMakers === 'function') {
      const dmList = await geminiService.findDecisionMakers(query);
      candidates = dmList.map((dm) => ({
        name: dm.name,
        email: dm.email,
        company: query,
        role: dm.role,
        phone: dm.phone,
      }));
    }

    return NextResponse.json({
      success: true,
      candidates,
    });
  } catch (error: any) {
    console.error('Error searching prospects:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}