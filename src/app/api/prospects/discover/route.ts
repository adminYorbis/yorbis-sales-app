import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { auth } from '@/auth';
import { dbService } from '@/lib/db';
import { normalizeCandidate, normalizeIntent, type DiscoveryIntent, type RequestType } from '@/lib/discovery-contract';
import { candidateRecords, DiscoveryError, extractJson, safeDiscoveryError } from '@/lib/discovery-response';
import { calculateFitScore } from '@/lib/prospect-scoring';

const apiKey = process.env.GEMINI_API_KEY;
const defaultModel = 'gemini-3.1-flash-lite';
const configuredModel = process.env.GEMINI_MODEL?.trim();
const selectedModel = !configuredModel || configuredModel.startsWith('gemini-2.0')
  ? defaultModel
  : configuredModel;
const requestTypes: RequestType[] = ['NEW_DISCOVERY_REQUEST', 'REFINE_CURRENT_RESULTS', 'EXPAND_CURRENT_RESULTS', 'EXCLUDE_RESULTS', 'CHANGE_PRIORITY'];

export const maxDuration = 60;

function generate(contents: string, withSearch = false) {
  return new GoogleGenAI({ apiKey }).models.generateContent({
    model: selectedModel,
    contents,
    config: {
      ...(withSearch ? { tools: [{ googleSearch: {} }] } : {}),
      maxOutputTokens: 16384,
      temperature: 0.2,
    },
  });
}

function log(requestId: string, stage: string, details: Record<string, unknown> = {}) {
  console.info(JSON.stringify({ scope: 'yorbis_discovery', requestId, stage, ...details }));
}

function errorResponse(requestId: string, error: unknown) {
  const safe = safeDiscoveryError(error);
  log(requestId, 'response_failed', { code: safe.code, status: safe.status });
  return NextResponse.json({
    ok: false,
    error: { code: safe.code, message: safe.message, requestId },
    previousResultsAvailable: true,
  }, { status: safe.status });
}

function interpretationPrompt(query: string, previousIntent?: DiscoveryIntent) {
  return `Interpret a CEO's B2B company discovery request.
Current structured request: ${JSON.stringify(previousIntent || {})}
Latest user message: ${query}

Classify the latest message as NEW_DISCOVERY_REQUEST, REFINE_CURRENT_RESULTS, EXPAND_CURRENT_RESULTS, EXCLUDE_RESULTS, or CHANGE_PRIORITY.
For a refinement, preserve every prior constraint unless the user explicitly changes it.
Never invent a missing constraint. Omit it or leave it empty.
Return only JSON:
{"requestType":"...","intent":{"companyType":"","industry":"","geography":"","employeeMin":null,"employeeMax":null,"revenueRange":"","internationalMarkets":[],"requiresImportExport":null,"supplierSignals":[],"paymentSignals":[],"excludedIndustries":[],"verifiedEvidenceRequired":null,"desiredCount":null,"otherConstraints":[]}}`;
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    const session = await auth();
    const userEmail = session?.user?.email;
    if (!userEmail) return errorResponse(requestId, new DiscoveryError('DISCOVERY_REQUEST_INVALID', 'Authentication required.', 401));
    if (!apiKey) return errorResponse(requestId, new DiscoveryError('GEMINI_REQUEST_FAILED', 'Company discovery is not configured.', 503));

    const body = await request.json() as {
      action?: 'interpret' | 'discover';
      query?: string;
      intent?: DiscoveryIntent;
      previousIntent?: DiscoveryIntent;
      parentRunId?: string;
      discoverySessionId?: string;
      requestType?: RequestType;
      excludeDomains?: string[];
    };
    const query = body.query?.trim();
    if (!query) return errorResponse(requestId, new DiscoveryError('DISCOVERY_REQUEST_INVALID', 'Describe the companies you want Yorbis to discover.', 400));
    log(requestId, 'request_received', {
      action: body.action || 'discover',
      queryLength: query.length,
      hasPreviousIntent: Boolean(body.previousIntent),
      requestedCount: body.intent?.desiredCount,
    });

    if (body.action === 'interpret') {
      try {
        log(requestId, 'interpretation_started');
        const result = await generate(interpretationPrompt(query, body.previousIntent));
        const text = result.text || '';
        const parsed = extractJson(text) as { intent?: unknown; requestType?: string };
        const normalizedIntent = normalizeIntent(parsed.intent);
        log(requestId, 'interpretation_completed', {
          responseLength: text.length,
          fields: Object.keys(normalizedIntent).filter((key) => normalizedIntent[key as keyof DiscoveryIntent] !== undefined),
        });
        return NextResponse.json({
          ok: true,
          requestId,
          intent: normalizedIntent,
          requestType: requestTypes.includes(parsed.requestType as RequestType) ? parsed.requestType : 'NEW_DISCOVERY_REQUEST',
        });
      } catch (error) {
        const safe = safeDiscoveryError(error);
        return errorResponse(requestId, new DiscoveryError('DISCOVERY_INTERPRETATION_FAILED', safe.message, safe.status));
      }
    }

    const intent = normalizeIntent(body.intent);
    const requestType = requestTypes.includes(body.requestType as RequestType) ? body.requestType! : 'NEW_DISCOVERY_REQUEST';
    const excludeDomains = Array.isArray(body.excludeDomains) ? body.excludeDomains.slice(0, 200) : [];
    log(requestId, 'interpretation_accepted', {
      requestType,
      desiredCount: intent.desiredCount,
      geography: intent.geography || 'not_specified',
      companyType: intent.companyType || 'not_specified',
      excludedIndustryCount: intent.excludedIndustries?.length || 0,
    });
    try {
      await dbService.ensureDiscoveryReady();
      log(requestId, 'persistence_preflight_succeeded');
    } catch (error) {
      log(requestId, 'persistence_preflight_failed', {
        databaseCode: typeof error === 'object' && error && 'code' in error ? String(error.code) : 'unknown',
        databaseMessage: error instanceof Error ? error.message.slice(0, 240) : 'Unknown database error',
      });
      throw new DiscoveryError('DISCOVERY_PERSISTENCE_FAILED', 'The discovery database is not ready for new results.');
    }
    const prompt = `You are Yorbis's evidence-first company discovery analyst.
Yorbis helps SMBs collect customer payments and pay vendors, suppliers, and contractors globally.

CONFIRMED REQUEST:
${JSON.stringify(intent)}

LATEST REQUEST:
${query}

REQUEST TYPE: ${requestType}
DO NOT RETURN THESE EXISTING DOMAINS: ${JSON.stringify(excludeDomains)}

Use Google Search to identify real companies. Quality is more important than count.
Do not invent companies, people, facts, employee counts, emails, dates, or URLs.
Use Unknown when public evidence is insufficient.
Every VERIFIED signal must cite one or more sourceIds from the sources array.
INFERRED items must explain the inference and must never claim payment volume, provider, fees, internal pain, or purchase intent.
Why Now items require a credible dated business event and a sourceId. Omit weak routine social posts.
Only return an email when it is explicitly published by a reliable source; otherwise return null and not_found.

Return only valid JSON:
{"companies":[{
"company_name":"real company","website":"official https URL","location":"supported location or Unknown",
"industry":"supported industry or Unknown","employee_count":"supported estimate/range or Unknown",
"revenue_range":"supported range or Unknown","company_description":"one factual sentence",
"confidence":"HIGH|MEDIUM|LOW","recommendation_summary":"maximum three careful sentences including uncertainty",
"best_opportunity":"short Yorbis use case",
"sources":[{"id":"s1","title":"source title","url":"actual grounded URL","publishedDate":"YYYY-MM-DD if known","evidenceSummary":"what this source supports"}],
"signals":[{"label":"concise label","description":"specific factual or careful inferred explanation","status":"VERIFIED|INFERRED|UNKNOWN","category":"supplier|cross-border|import-export|vendor-payment|pay-in|payout|size|geography|multi-country","sourceIds":["s1"]}],
"why_now":[{"label":"credible recent signal","description":"why it matters commercially","date":"YYYY-MM-DD if known","sourceIds":["s1"]}],
"recommended_conversation":"one discovery-oriented first conversation based on verified characteristics",
"contact_name":"verified person or null","contact_title":"verified title or null",
"contact_email":"public verified business email or null","contact_email_status":"verified|not_found",
"contact_profile_url":"public professional profile or null","contact_source_url":"source verifying role/email or null",
"contact_reason":"why this role is appropriate for the company size and use case"
}]}`;

    log(requestId, 'gemini_request_started', { model: selectedModel });
    const result = await generate(prompt, true);
    const text = result.text || '';
    const groundingMetadata = result.candidates?.[0]?.groundingMetadata;
    log(requestId, 'gemini_request_completed', {
      responseType: typeof text,
      responseLength: text.length,
      groundingSourceCount: groundingMetadata?.groundingChunks?.length || 0,
      groundingQueryCount: groundingMetadata?.webSearchQueries?.length || 0,
      ...(process.env.NODE_ENV === 'development' ? { preview: text.slice(0, 160) } : {}),
    });
    let parsed: unknown;
    try {
      parsed = extractJson(text);
      log(requestId, 'json_extraction_succeeded');
    } catch (error) {
      log(requestId, 'json_extraction_failed', { code: safeDiscoveryError(error).code });
      throw error;
    }
    const rawCandidates = candidateRecords(parsed);
    const candidates = rawCandidates.map(normalizeCandidate).filter((item) => item !== null);
    log(requestId, 'validation_completed', {
      received: rawCandidates.length,
      valid: candidates.length,
      rejected: rawCandidates.length - candidates.length,
    });
    if (!candidates.length && rawCandidates.length) {
      throw new DiscoveryError('DISCOVERY_RESPONSE_INVALID', 'The research response did not contain a usable company record.');
    }
    const runId = crypto.randomUUID();
    const discoverySessionId = body.discoverySessionId || crypto.randomUUID();
    const saved = [];

    for (const candidate of candidates) {
      const verified = candidate.signals?.filter((signal) => signal.status === 'VERIFIED') || [];
      const inferred = candidate.signals?.filter((signal) => signal.status === 'INFERRED') || [];
      const unknown = candidate.signals?.filter((signal) => signal.status === 'UNKNOWN') || [];
      const evidence = (candidate.sources || []).map((source) => ({
        claim: source.evidenceSummary,
        source_name: source.domain,
        source_url: source.url,
        summary: source.evidenceSummary,
        source_id: source.id,
        published_date: source.publishedDate,
      }));
      let scoring;
      try {
        scoring = calculateFitScore({
          location: candidate.location,
          employee_count: candidate.employee_count,
          signals: candidate.signals,
          evidence,
          whyNowCount: candidate.why_now?.length || 0,
        }, intent);
      } catch {
        throw new DiscoveryError('DISCOVERY_SCORING_FAILED', 'Opportunity scoring could not be completed.');
      }
      let prospect;
      try {
        prospect = await dbService.addProspect({
        company_name: candidate.company_name,
        website: candidate.website,
        location: candidate.location,
        industry: candidate.industry,
        employee_count: candidate.employee_count,
        revenue_range: candidate.revenue_range,
        company_description: candidate.company_description,
        confidence: candidate.confidence,
        icp_score: scoring.score,
        icp_reasoning: candidate.recommendation_summary,
        contract_intel: [...verified, ...inferred].map((signal) => signal.label).join('; '),
        signals_json: JSON.stringify([...verified, ...inferred]),
        unknown_signals_json: JSON.stringify(unknown),
        evidence_json: JSON.stringify(evidence),
        why_now_json: JSON.stringify(candidate.why_now || []),
        score_breakdown: JSON.stringify(scoring.breakdown),
        source_urls: JSON.stringify(candidate.sources?.map((source) => source.url) || []),
        best_opportunity: candidate.best_opportunity,
        research_brief: candidate.best_opportunity,
        recommended_conversation: candidate.recommended_conversation,
        recommended_approach: candidate.recommended_conversation,
        contact_name: candidate.contact_name || undefined,
        contact_title: candidate.contact_title || undefined,
        contact_email: candidate.contact_email || undefined,
        contact_profile_url: candidate.contact_profile_url || undefined,
        contact_source_url: candidate.contact_source_url || undefined,
        contact_reason: candidate.contact_reason || undefined,
        search_run_id: runId,
        stage: 'NEW',
        });
      } catch (error) {
        log(requestId, 'prospect_persistence_failed', {
          databaseCode: typeof error === 'object' && error && 'code' in error ? String(error.code) : 'unknown',
          databaseMessage: error instanceof Error ? error.message.slice(0, 240) : 'Unknown database error',
        });
        throw new DiscoveryError('DISCOVERY_PERSISTENCE_FAILED', 'The discovery was generated but could not be saved.');
      }
      saved.push(prospect);
    }
    log(requestId, 'scoring_and_persistence_completed', { saved: saved.length });

    try {
      await dbService.addSearchRun({
      id: runId,
      user_email: userEmail,
      query,
      intent_json: JSON.stringify(intent),
      result_count: saved.length,
      parent_run_id: body.parentRunId,
      discovery_session_id: discoverySessionId,
      request_type: requestType,
      status: 'COMPLETED',
      });
      for (const [index, prospect] of saved.entries()) {
        await dbService.linkProspectToSearchRun(runId, prospect.id, index + 1);
      }
    } catch (error) {
      log(requestId, 'search_history_persistence_failed', {
        databaseCode: typeof error === 'object' && error && 'code' in error ? String(error.code) : 'unknown',
        databaseMessage: error instanceof Error ? error.message.slice(0, 240) : 'Unknown database error',
      });
      throw new DiscoveryError('DISCOVERY_PERSISTENCE_FAILED', 'The discovery was generated but its search history could not be saved.');
    }

    log(requestId, 'response_succeeded', { status: 200, count: saved.length });
    return NextResponse.json({
      ok: true,
      requestId,
      success: true,
      prospects: saved,
      count: saved.length,
      intent,
      requestType,
      searchRunId: runId,
      discoverySessionId,
      message: `I searched public business sources and found ${saved.length} ${saved.length === 1 ? 'company' : 'companies'} that appear to match your request.`,
    });
  } catch (error) {
    return errorResponse(requestId, error);
  }
}
