import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { dbService } from '@/lib/db';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const prospect = await dbService.getProspectById(id);
  if (!prospect) return NextResponse.json({ error: 'Prospect not found.' }, { status: 404 });
  if (!process.env.GEMINI_API_KEY) return NextResponse.json({ error: 'Outreach generation is not configured.' }, { status: 503 });

  const model = new GoogleGenerativeAI(process.env.GEMINI_API_KEY).getGenerativeModel({
    model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
  });
  const { channel = 'email' } = await request.json().catch(() => ({})) as { channel?: 'email' | 'linkedin' | 'call_notes' };
  const prompt = `Create ${channel === 'email' ? 'a concise cold email' : channel === 'linkedin' ? 'a short LinkedIn connection or direct message' : 'internal sales call notes'} for Yorbis.
Use only this verified prospect context:
Company: ${prospect.company_name}
Contact: ${prospect.contact_name || 'Unknown'} (${prospect.contact_title || 'Unknown role'})
Why Yorbis: ${prospect.icp_reasoning || 'Unknown'}
Evidence: ${prospect.evidence_json || '[]'}
Recommended approach: ${prospect.recommended_approach || ''}

Never add unsupported facts. If the contact name is unknown, use "Hi there".
Position Yorbis as helping growing businesses collect payments and pay vendors globally.
${channel === 'email' ? 'Include an evidence-based opening and one discovery question. Sign "Anant".' : ''}
${channel === 'linkedin' ? 'Do not repeat a full email. Keep it natural, brief, and centered on one discovery question.' : ''}
${channel === 'call_notes' ? 'Include: Why this company; Why this contact; Opening line; Three discovery questions; Likely Yorbis value proposition; Relevant evidence; Risks or unknowns.' : ''}
Return only JSON: {"subject":"${channel === 'call_notes' ? 'Call Notes' : channel === 'linkedin' ? 'LinkedIn' : 'email subject'}","body":"..."}`;

  const result = await model.generateContent(prompt);
  const clean = result.response.text().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
  const draft = JSON.parse(clean) as { subject: string; body: string };
  await dbService.addOutreachMessage(id, { subject: draft.subject, body: draft.body, channel, status: 'DRAFT' });
  return NextResponse.json({ draft: { ...draft, channel } });
}
