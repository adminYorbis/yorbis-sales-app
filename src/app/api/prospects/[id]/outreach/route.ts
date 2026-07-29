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

    const messages = dbService.getOutreachForProspect(prospectId);
    return NextResponse.json({ success: true, messages });
  } catch (error: any) {
    console.error('Error fetching outreach messages:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch outreach' },
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
    const body = await request.json();

    if (!body.body) {
      return NextResponse.json(
        { success: false, error: 'Message body is required' },
        { status: 400 }
      );
    }

    const message = dbService.addOutreachMessage(prospectId, {
      body: body.body,
      subject: body.subject,
      channel: body.channel || 'email',
      status: body.status || 'DRAFT',
    });

    return NextResponse.json({ success: true, message });
  } catch (error: any) {
    console.error('Error creating outreach message:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to save outreach' },
      { status: 500 }
    );
  }
}