import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { auth } from '@/auth';
import { dbService } from '@/lib/db';
import { calculateFitScore, type SearchIntent } from '@/lib/prospect-scoring';

const apiKey = process.env.GEMINI_API_KEY;

type Signal = { label: string; status: 'VERIFIED' | 'INFERRED' | 'UNKNOWN'; category?: string; evidence_index?: number };
type Evidence = { claim: string; source_name: string; source_url: string; summary: string };
type Candidate = {
  company_name: string;
  website: string;
  location?: string;
  industry?: string;
  employee_count?: string;
  revenue_range?: string;
  company_description?: string;
  confidence?: string;
  why_yorbis?: string;
  signals?: Signal[];
  evidence?: Evidence[];
  likely_use_case?: string;
  recommended_approach?: string;
  contact_name?: string | null;
  contact_title?: string | null;
  contact_email?: string | null;
  contact_profile_url?: string | null;
  contact_source_url?: string | null;
  contact_reason?: string | null;
  outreach_subject?: string;
  outreach_body?: string;
};

function cleanJson(value: string) {
  return value.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    const userEmail = session?.user?.email;
    if (!userEmail) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

    const { query } = await request.json();
    if (!query?.trim()) return NextResponse.json({ error: 'Describe the prospects you want to find.' }, { status: 400 });
    if (!apiKey) return NextResponse.json({ error: 'Prospect research is not configured.' }, { status: 503 });

    const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({
      model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
      tools: [{ googleSearch: {} }] as never,
    });

    const prompt = `You are Yorbis's evidence-first B2B prospect researcher.
Yorbis helps SMBs collect customer payments and pay vendors, suppliers, and contractors globally.

USER SEARCH:
${query}

First interpret only the constraints explicitly present. Then use Google Search to identify real matching companies.
Never invent facts, employee counts, revenue, contacts, emails, supplier relationships, or URLs.
Use "Unknown" or null when unsupported.
Every VERIFIED signal must reference an evidence item with a real supporting URL.
INFERRED signals must be conservative and clearly labeled.
Public email means an email visibly published by a reliable public source; never infer an email pattern.

Return only valid JSON:
{
  "intent": {
    "companyType": "string or empty",
    "geography": "string or empty",
    "employeeMin": number or null,
    "employeeMax": number or null,
    "revenueRange": "string or empty",
    "internationalMarkets": ["explicit markets"],
    "requiresImportExport": boolean or null,
    "supplierSignals": ["explicit requirements"],
    "paymentSignals": ["explicit requirements"],
    "desiredCount": number,
    "otherConstraints": ["other explicit constraints"]
  },
  "prospects": [{
    "company_name": "real company",
    "website": "official URL",
    "location": "supported location or Unknown",
    "industry": "supported industry or Unknown",
    "employee_count": "supported estimate/range or Unknown",
    "revenue_range": "supported range or Unknown",
    "company_description": "one factual sentence",
    "confidence": "HIGH, MEDIUM, or LOW",
    "why_yorbis": "maximum three careful sentences",
    "signals": [{"label":"concise signal","status":"VERIFIED|INFERRED|UNKNOWN","category":"supplier|cross-border|import-export|payout|pay-in|size|geography","evidence_index":0}],
    "evidence": [{"claim":"specific claim","source_name":"publisher/domain","source_url":"actual URL","summary":"short supporting excerpt paraphrase"}],
    "likely_use_case": "short Yorbis angle",
    "recommended_approach": "one question the CEO should ask",
    "contact_name": "publicly verified person or null",
    "contact_title": "verified title or null",
    "contact_email": "verified public business email or null",
    "contact_profile_url": "public professional profile or null",
    "contact_source_url": "source verifying role/email or null",
    "contact_reason": "why this role is appropriate",
    "outreach_subject": "short subject",
    "outreach_body": "short evidence-based draft signed Anant"
  }]
}

Return up to the requested count, with quality and evidence more important than quantity.`;

    const result = await model.generateContent(prompt);
    const output = JSON.parse(cleanJson(result.response.text())) as { intent?: SearchIntent; prospects?: Candidate[] };
    const intent: SearchIntent = output.intent || {};
    const runId = crypto.randomUUID();
    const candidates = Array.isArray(output.prospects) ? output.prospects : [];
    const saved = [];

    for (const candidate of candidates) {
      if (!candidate.company_name || !candidate.website) continue;
      const signals = Array.isArray(candidate.signals) ? candidate.signals : [];
      const evidence = Array.isArray(candidate.evidence)
        ? candidate.evidence.filter((item) => item?.claim && item?.source_url)
        : [];
      const scoring = calculateFitScore({ location: candidate.location, employee_count: candidate.employee_count, signals, evidence }, intent);
      const sources = [...new Set(evidence.map((item) => item.source_url))];
      const prospect = await dbService.addProspect({
        company_name: candidate.company_name,
        website: candidate.website,
        location: candidate.location || 'Unknown',
        industry: candidate.industry || 'Unknown',
        employee_count: candidate.employee_count || 'Unknown',
        revenue_range: candidate.revenue_range || 'Unknown',
        company_description: candidate.company_description || '',
        confidence: candidate.confidence || 'LOW',
        icp_score: scoring.score,
        icp_reasoning: candidate.why_yorbis || '',
        contract_intel: signals.map((signal) => signal.label).join('; '),
        signals_json: JSON.stringify(signals),
        evidence_json: JSON.stringify(evidence),
        score_breakdown: JSON.stringify(scoring.breakdown),
        source_urls: JSON.stringify(sources),
        recommended_approach: candidate.recommended_approach || '',
        outreach_angle: JSON.stringify({ subject: candidate.outreach_subject || 'A quick question', body: candidate.outreach_body || '' }),
        contact_name: candidate.contact_name || undefined,
        contact_title: candidate.contact_title || undefined,
        contact_email: candidate.contact_email || undefined,
        contact_profile_url: candidate.contact_profile_url || undefined,
        contact_source_url: candidate.contact_source_url || undefined,
        contact_reason: candidate.contact_reason || undefined,
        research_brief: candidate.likely_use_case || '',
        search_run_id: runId,
        stage: 'NEW',
      });
      saved.push(prospect);
    }

    await dbService.addSearchRun({
      id: runId,
      user_email: userEmail,
      query: query.trim(),
      intent_json: JSON.stringify(intent),
      result_count: saved.length,
    });

    return NextResponse.json({ success: true, prospects: saved, count: saved.length, intent, searchRunId: runId });
  } catch (error) {
    console.error('Prospect discovery failed:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Prospect search failed.' }, { status: 500 });
  }
}
