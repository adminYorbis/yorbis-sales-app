import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { dbService } from '@/lib/db';

const apiKey = process.env.GEMINI_API_KEY;

export async function POST(request: Request) {
  try {
    const { query } = await request.json();
    if (!query?.trim()) return NextResponse.json({ error: 'Describe the prospects you want to find.' }, { status: 400 });
    if (!apiKey) return NextResponse.json({ error: 'Gemini is not connected. Add GEMINI_API_KEY to run grounded searches.' }, { status: 503 });

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
      tools: [{ googleSearch: {} }] as never,
    });

    const prompt = `You are the prospect research analyst for Yorbis, a fintech platform that helps SMBs get paid, pay vendors, and move money globally.

Search objective: "${query}"

Use Google Search to find up to 10 real companies that closely match this objective. Rank them by likely need for cross-border supplier payments, global vendor payouts, contractor payments, customer collections, or card processing.

Return ONLY a valid JSON array. Never invent a company, executive, email address, payment volume, supplier relationship, or URL. Use null when unknown. Each item must have:
{
  "company_name": "real legal or trading name",
  "website": "official company URL",
  "industry": "concise industry",
  "location": "headquarters or relevant location",
  "contact_name": "publicly verified finance/operations decision maker or null",
  "contact_title": "verified title or null",
  "contact_email": "publicly listed business email or null",
  "icp_score": 0-100,
  "icp_reasoning": "two concise sentences explaining likely Yorbis fit without asserting unverified facts",
  "contract_intel": "2-4 semicolon-separated, verifiable business signals",
  "outreach_angle": "short, natural cold email grounded only in verified signals",
  "source_urls": ["2-4 URLs supporting the company and signals"]
}`;

    const result = await model.generateContent(prompt);
    const clean = result.response.text().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
    const parsed = JSON.parse(clean);
    if (!Array.isArray(parsed)) throw new Error('Gemini returned an unexpected response format.');

    const saved = [];
    for (const candidate of parsed) {
      if (!candidate?.company_name || !candidate?.website) continue;
      const prospect = await dbService.addProspect({
        ...candidate,
        source_urls: JSON.stringify(candidate.source_urls || []),
        stage: 'NEW',
      });
      saved.push(prospect);
    }

    return NextResponse.json({ success: true, prospects: saved, count: saved.length });
  } catch (error) {
    console.error('Prospect discovery failed:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Prospect search failed.' }, { status: 500 });
  }
}
