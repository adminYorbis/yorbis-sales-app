import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import db from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey || '');

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { company_name, website } = body;

    if (!company_name) {
      return NextResponse.json(
        { error: 'Company name is required' },
        { status: 400 }
      );
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY is not configured in environment variables' },
        { status: 500 }
      );
    }

    // 1. Initialize Gemini model with Search Grounding tool
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      tools: [{ googleSearch: {} }] as any,
    });

    const prompt = `
You are an executive sales intelligence assistant for "Yorbis CRM".
Perform live web research on the following target company:
- Company Name: ${company_name}
- Website: ${website || 'N/A'}

Analyze their public tech stack, recent procurement news, executive leadership changes, and active growth signals.

IMPORTANT: Return your output STRICTLY as a raw JSON object. Do not wrap the output in markdown fences (like \`\`\`json).

Use exact JSON schema format:
{
  "company_name": "${company_name}",
  "website": "${website || ''}",
  "contact_name": "Name of VP/Director/C-Level decision maker if found, else null",
  "contact_title": "Title of key contact, else null",
  "contact_email": "Estimated or found public email, else null",
  "location": "Headquarters City, State/Country",
  "contract_intel": "Summary of active vendors, software tools used, active RFPs, or renewal intelligence",
  "icp_score": <Integer from 0 to 100 assessing fit for automated CRM prospecting engines>,
  "icp_reasoning": "1-2 sentence justification for the assigned ICP score",
  "outreach_angle": "Personalized 2-sentence cold message hook referencing recent developments"
}
`;

    // 2. Query Gemini
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // Clean standard markdown fences if present
    const cleanedJson = responseText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();

    let intelData;
    try {
      intelData = JSON.parse(cleanedJson);
    } catch (parseError) {
      console.error('JSON Parse Error:', parseError, 'Raw Text:', responseText);
      return NextResponse.json(
        { error: 'Failed to parse AI output into structured JSON' },
        { status: 500 }
      );
    }

    // 3. Persist to SQLite Database
    const id = uuidv4();
    const stmt = db.prepare(`
      INSERT INTO prospects (
        id, company_name, website, contact_name, contact_title, 
        contact_email, location, contract_intel, icp_score, 
        icp_reasoning, outreach_angle, status
      ) VALUES (
        ?, ?, ?, ?, ?, 
        ?, ?, ?, ?, 
        ?, ?, 'NEW'
      )
    `);

    stmt.run(
      id,
      intelData.company_name || company_name,
      intelData.website || website || '',
      intelData.contact_name || null,
      intelData.contact_title || null,
      intelData.contact_email || null,
      intelData.location || null,
      intelData.contract_intel || null,
      intelData.icp_score || 0,
      intelData.icp_reasoning || null,
      intelData.outreach_angle || null
    );

    return NextResponse.json({
      success: true,
      prospect: { id, ...intelData, status: 'NEW' },
    });
  } catch (error: any) {
    console.error('Error during prospect discovery:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}