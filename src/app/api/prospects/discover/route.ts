import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { auth } from '@/auth';
import { dbService } from '@/lib/db';
import {
  applyDiscoveryIntentPatch,
  createEmptyDiscoveryIntent,
  normalizeCandidate,
  normalizeIntent,
  normalizePatch,
  type DiscoveryIntent,
  type DiscoveryMode,
  type RequestType,
} from '@/lib/discovery-contract';
import { candidateRecords, DiscoveryError, extractJson, safeDiscoveryError } from '@/lib/discovery-response';
import { evaluateRequiredConstraints } from '@/lib/discovery-constraints';
import { calculateFitScore } from '@/lib/prospect-scoring';

const apiKey = process.env.GEMINI_API_KEY;
const defaultModel = 'gemini-3.1-flash-lite';
const configuredModel = process.env.GEMINI_MODEL?.trim();
const selectedModel = !configuredModel || configuredModel.startsWith('gemini-2.0')
  ? defaultModel
  : configuredModel;

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

function interpretationPrompt(query: string, mode: DiscoveryMode, previousIntent?: DiscoveryIntent) {
  if (mode === 'new') {
    return `Parse this independent B2B company discovery request into a clean intent.
Start from an empty intent. Do not use or infer any prior search.
User request: ${query}
Never invent a missing constraint. Arrays must be empty and missing scalar fields must be null.
Return only JSON:
{"intent":{"companyType":null,"industry":null,"geography":null,"employeeMin":null,"employeeMax":null,"revenueRange":null,"internationalMarkets":[],"requiresImportExport":null,"supplierSignals":[],"paymentSignals":[],"excludedIndustries":[],"verifiedEvidenceRequired":null,"desiredCount":null,"otherConstraints":[],"priorityMarkets":[]}}`;
  }
  return `Create an explicit patch for an active B2B discovery.
Mode: ${mode}
Prior normalized intent: ${JSON.stringify(previousIntent || createEmptyDiscoveryIntent())}
User instruction: ${query}
Do not return a complete intent. Return only fields the user changes.
Use clear to remove a constraint, add/remove for array changes, and set for scalar replacement.
For reprioritize, set priorityMarkets without removing internationalMarkets.
Return only JSON:
{"patch":{"set":{},"clear":[],"add":{},"remove":{}}}`;
}

const modeToRequestType: Record<Exclude<DiscoveryMode, 'restore'>, RequestType> = {
  new: 'NEW_DISCOVERY_REQUEST',
  refine: 'REFINE_CURRENT_RESULTS',
  expand: 'EXPAND_CURRENT_RESULTS',
  exclude: 'EXCLUDE_RESULTS',
  reprioritize: 'CHANGE_PRIORITY',
};

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    const session = await auth();
    const userEmail = session?.user?.email;
    if (!userEmail) return errorResponse(requestId, new DiscoveryError('DISCOVERY_REQUEST_INVALID', 'Authentication required.', 401));
    if (!apiKey) return errorResponse(requestId, new DiscoveryError('GEMINI_REQUEST_FAILED', 'Company discovery is not configured.', 503));

    const body = await request.json() as {
      action?: 'interpret' | 'discover';
      mode?: DiscoveryMode;
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
      mode: body.mode || 'new',
      queryLength: query.length,
      query: query.slice(0, 300),
      hasPreviousIntent: Boolean(body.previousIntent),
      requestedCount: body.intent?.desiredCount,
    });

    if (body.action === 'interpret') {
      try {
        const mode: DiscoveryMode = ['new', 'refine', 'expand', 'exclude', 'reprioritize'].includes(String(body.mode))
          ? body.mode as DiscoveryMode
          : 'new';
        log(requestId, 'interpretation_started');
        const priorIntent = mode === 'new' ? undefined : normalizeIntent(body.previousIntent);
        const result = await generate(interpretationPrompt(query, mode, priorIntent));
        const text = result.text || '';
        const parsed = extractJson(text) as { intent?: unknown; patch?: unknown };
        const modelOutput = mode === 'new' ? normalizeIntent(parsed.intent) : normalizePatch(parsed.patch);
        const normalizedIntent = mode === 'new'
          ? { ...createEmptyDiscoveryIntent(), ...normalizeIntent(parsed.intent) }
          : applyDiscoveryIntentPatch(priorIntent || createEmptyDiscoveryIntent(), normalizePatch(parsed.patch));
        log(requestId, 'interpretation_completed', {
          mode,
          priorIntent: priorIntent || null,
          modelOutput,
          finalIntent: normalizedIntent,
          responseLength: text.length,
          fields: Object.keys(normalizedIntent).filter((key) => normalizedIntent[key as keyof DiscoveryIntent] !== undefined),
        });
        return NextResponse.json({
          ok: true,
          requestId,
          intent: normalizedIntent,
          mode,
          requestType: modeToRequestType[mode as Exclude<DiscoveryMode, 'restore'>],
        });
      } catch (error) {
        const safe = safeDiscoveryError(error);
        return errorResponse(requestId, new DiscoveryError('DISCOVERY_INTERPRETATION_FAILED', safe.message, safe.status));
      }
    }

    const mode: Exclude<DiscoveryMode, 'restore'> = ['new', 'refine', 'expand', 'exclude', 'reprioritize'].includes(String(body.mode))
      ? body.mode as Exclude<DiscoveryMode, 'restore'>
      : 'new';
    const intent = normalizeIntent(body.intent);
    const requestType = modeToRequestType[mode];
    const excludeDomains = Array.isArray(body.excludeDomains) ? body.excludeDomains.slice(0, 200) : [];
    log(requestId, 'interpretation_accepted', {
      requestType,
      mode,
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
    const userHash = crypto.createHash('sha256').update(userEmail.toLowerCase()).digest('hex').slice(0, 12);
    const cacheKey = crypto.createHash('sha256').update(JSON.stringify(intent)).digest('hex').slice(0, 16);
    log(requestId, 'normalized_request_ready', {
      userHash,
      mode,
      activeSessionId: mode === 'new' ? null : body.discoverySessionId || null,
      finalIntent: intent,
      cacheKey,
    });
    const planResult = await generate(`Create 4 to 8 targeted public web search queries for this normalized B2B discovery intent:
${JSON.stringify(intent)}
Use variations for company type, location, international markets, suppliers, contractors, and payment relevance.
Return only JSON: {"queries":["query"]}`);
    const plan = extractJson(planResult.text || '') as { queries?: unknown[] };
    const searchQueries = Array.isArray(plan.queries)
      ? plan.queries.filter((item): item is string => typeof item === 'string').slice(0, 8)
      : [];
    log(requestId, 'search_plan_completed', { searchQueries });
    const prompt = `You are Yorbis's evidence-first company discovery analyst.
Yorbis helps SMBs collect customer payments and pay vendors, suppliers, and contractors globally.

CONFIRMED REQUEST:
${JSON.stringify(intent)}

LATEST REQUEST:
${query}

REQUEST TYPE: ${requestType}
DO NOT RETURN THESE EXISTING DOMAINS: ${JSON.stringify(excludeDomains)}
TARGETED SEARCH QUERIES TO USE: ${JSON.stringify(searchQueries)}

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
      parsed = {};
    }
    const rawCandidates = candidateRecords(parsed);
    const normalizedCandidates = rawCandidates.map(normalizeCandidate).filter((item) => item !== null);
    const deduplicated = new Map<string, (typeof normalizedCandidates)[number]>();
    let duplicateCount = 0;
    for (const candidate of normalizedCandidates) {
      let domain = '';
      try {
        domain = new URL(candidate.website).hostname.replace(/^www\./, '').toLowerCase();
      } catch {
        domain = '';
      }
      if (deduplicated.has(domain)) duplicateCount += 1;
      else deduplicated.set(domain, candidate);
    }
    const candidates = [...deduplicated.values()];
    log(requestId, 'validation_completed', {
      received: rawCandidates.length,
      valid: candidates.length,
      rejected: rawCandidates.length - candidates.length,
      duplicateCount,
    });
    if (!candidates.length && rawCandidates.length) {
      throw new DiscoveryError('DISCOVERY_RESPONSE_INVALID', 'The research response did not contain a usable company record.');
    }
    const runId = crypto.randomUUID();
    const discoverySessionId = body.discoverySessionId || crypto.randomUUID();
    const saved = [];
    const hardRejected: Array<{ company: string; reasons: string[] }> = [];

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
      const constraintEvaluations = evaluateRequiredConstraints({
        location: candidate.location,
        industry: candidate.industry,
        company_description: candidate.company_description,
        employee_count: candidate.employee_count,
        signals: candidate.signals,
      }, intent);
      const failedConstraints = constraintEvaluations.filter((evaluation) => evaluation.status === 'failed');
      if (failedConstraints.length) {
        hardRejected.push({
          company: candidate.company_name,
          reasons: failedConstraints.map((evaluation) => evaluation.constraint),
        });
        continue;
      }
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
        // Skip this candidate if scoring fails; continue with remaining candidates
        continue;
      }
      let prospect = undefined;
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
          constraint_evaluations_json: JSON.stringify(constraintEvaluations),
          contact_name: candidate.contact_name || undefined,
          contact_title: candidate.contact_title || undefined,
          contact_email: candidate.contact_email || undefined,
          contact_profile_url: candidate.contact_profile_url || undefined,
          contact_source_url: candidate.contact_source_url || undefined,
          contact_reason: candidate.contact_reason || undefined,
          search_run_id: runId,
          stage: 'NEW',
        });
        saved.push(prospect);
      } catch (error) {
        log(requestId, 'prospect_persistence_failed_per_candidate', {
          databaseCode: typeof error === 'object' && error && 'code' in error ? String(error.code) : 'unknown',
          databaseMessage: error instanceof Error ? error.message.slice(0, 240) : 'Unknown database error',
          company: candidate.company_name,
        });
        // Skip this candidate; continue with remaining candidates
        continue;
      }
    }
    log(requestId, 'scoring_and_persistence_completed', {
      saved: saved.length,
      hardRejectedCount: hardRejected.length,
      hardRejected: hardRejected.slice(0, 20),
    });

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
        status: saved.length > 0 ? 'COMPLETED' : 'PARTIAL',
      });
      for (const [index, prospect] of saved.entries()) {
        await dbService.linkProspectToSearchRun(runId, prospect.id, index + 1);
      }
    } catch (error) {
      log(requestId, 'search_history_persistence_failed', {
        databaseCode: typeof error === 'object' && error && 'code' in error ? String(error.code) : 'unknown',
        databaseMessage: error instanceof Error ? error.message.slice(0, 240) : 'Unknown database error',
      });
      // Persist what we can - partial result is better than none
      if (saved.length > 0) {
        await dbService.addSearchRun({
          id: runId,
          user_email: userEmail,
          query,
          intent_json: JSON.stringify(intent),
          result_count: saved.length,
          parent_run_id: body.parentRunId,
          discovery_session_id: discoverySessionId,
          request_type: requestType,
          status: 'PARTIAL',
        });
        for (const [index, prospect] of saved.entries()) {
          await dbService.linkProspectToSearchRun(runId, prospect.id, index + 1);
        }
      }
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
