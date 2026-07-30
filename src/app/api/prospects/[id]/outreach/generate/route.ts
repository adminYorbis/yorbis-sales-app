import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { dbService } from '@/lib/db';

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const prospect = await dbService.getProspectById(id);
  if (!prospect) return NextResponse.json({ error: 'Prospect not found.' }, { status: 404 });
  if (!process.env.GEMINI_API_KEY) return NextResponse.json({ error: 'Outreach generation is not configured.' }, { status: 503 });

  const model = new GoogleGenerativeAI(process.env.GEMINI_API_KEY).getGenerativeModel({
    model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
  });
  const prompt = `Write a concise cold email for Yorbis.
Use only this verified prospect context:
Company: ${prospect.company_name}
Contact: ${prospect.contact_name || 'Unknown'} (${prospect.contact_title || 'Unknown role'})
Why Yorbis: ${prospect.icp_reasoning || 'Unknown'}
Evidence: ${prospect.evidence_json || '[]'}
Recommended approach: ${prospect.recommended_approach || ''}

Never add unsupported facts. If the contact name is unknown, use "Hi there".
Position Yorbis as helping growing businesses collect payments and pay vendors globally.
End with a low-friction question. Sign "Anant".
Return only JSON: {"subject":"...","body":"..."}`;

  const result = await model.generateContent(prompt);
  const clean = result.response.text().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
  const draft = JSON.parse(clean) as { subject: string; body: string };
  await dbService.updateProspect(id, { outreach_angle: JSON.stringify(draft) });
  return NextResponse.json({ draft });
}
