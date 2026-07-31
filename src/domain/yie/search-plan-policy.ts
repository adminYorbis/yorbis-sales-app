import type { SearchPlanProposal } from './contracts';
import type { ICPAggregate } from './icp-schemas';
import { deterministicFingerprint } from './planning-policies';
import {
  SearchPlanQuerySchema,
  SearchPlanSchema,
  type PlanningIntent,
  type SearchPlan,
  type SearchPlanQuery,
} from './planning-schemas';

export const MAX_PLAN_QUERIES = 20;
const PROHIBITED = [
  /\bdefinitely\b/i, /\bguaranteed\b/i, /\bconfirmed need\b/i,
  /\bcompanies needing yorbis\b/i, /\bsave \d+%/i, /\blicensed in\b/i,
];
function normalized(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
function title(values: string[], fallback: string) {
  return values.length ? values.join(' ') : fallback;
}
function query(input: Partial<SearchPlanQuery> & Pick<SearchPlanQuery, 'id' | 'queryText' | 'queryPurpose' | 'targetConstraint' | 'sourceCategory' | 'priority' | 'rationale'>): SearchPlanQuery {
  return SearchPlanQuerySchema.parse({
    expectedYield: 'MEDIUM', requiredEvidenceType: 'Public evidence supporting company qualification',
    geographicQualifier: null, industryQualifier: null, triggerQualifier: null, personaQualifier: null,
    status: 'ACCEPTED', ...input,
  });
}
export function validateSearchQueries(
  proposals: SearchPlanQuery[],
  intent: PlanningIntent,
): { accepted: SearchPlanQuery[]; rejected: Array<{ query: SearchPlanQuery; reason: string }>; warnings: string[] } {
  const accepted: SearchPlanQuery[] = [];
  const rejected: Array<{ query: SearchPlanQuery; reason: string }> = [];
  const seen = new Set<string>();
  for (const raw of proposals.slice(0, MAX_PLAN_QUERIES * 2)) {
    const parsed = SearchPlanQuerySchema.parse(raw);
    const key = normalized(parsed.queryText);
    let reason = '';
    if (key.length < 12) reason = 'Query is overly broad.';
    else if (seen.has(key)) reason = 'Duplicate normalized query.';
    else if (PROHIBITED.some((pattern) => pattern.test(parsed.queryText))) reason = 'Unsupported claim or fabricated conclusion.';
    else if (intent.exclusions.some((item) =>
      typeof item.value === 'string' && key.includes(normalized(item.value))
    )) reason = 'Query contradicts a hard exclusion.';
    if (reason) rejected.push({ query: { ...parsed, status: 'REJECTED' }, reason });
    else {
      seen.add(key);
      accepted.push({ ...parsed, status: 'ACCEPTED' });
    }
    if (accepted.length === MAX_PLAN_QUERIES) break;
  }
  const families = new Set(accepted.map((item) => item.sourceCategory));
  const warnings: string[] = [];
  if (accepted.length < 3) warnings.push('Plan requires at least three accepted query families.');
  if (families.size < 2) warnings.push('Plan has insufficient source-category diversity.');
  return { accepted, rejected, warnings };
}

export function proposalToQueries(proposal: SearchPlanProposal | null): SearchPlanQuery[] {
  return (proposal?.strategies ?? []).map((item, index) => query({
    id: `ai-${index + 1}`, queryText: item.query, queryPurpose: item.purpose,
    targetConstraint: item.expectedSignals[0] ?? 'AI-proposed planning theme',
    sourceCategory: item.type === 'DIRECTORY_SEARCH' ? 'INDUSTRY_DIRECTORY'
      : item.type === 'COMPANY_SITE_SEARCH' ? 'COMPANY_WEBSITE' : 'GENERAL_WEB',
    priority: item.priority, rationale: `AI proposal: ${item.purpose}`, status: 'PROPOSED',
  }));
}

export function buildSearchPlan(input: {
  sessionId: string; intentVersion: number; planVersion: number;
  solutionProfileId: string; solutionProfileVersion: number;
  icp: ICPAggregate | null; intent: PlanningIntent; createdAt: string;
  aiProposal?: SearchPlanProposal | null;
}): SearchPlan {
  const geography = title(input.intent.targetGeographies, 'United States');
  const industry = title(input.intent.targetIndustries, 'business');
  const models = title(input.intent.targetBusinessModels, 'company');
  const base: SearchPlanQuery[] = [
    query({ id: 'q-industry-geography', queryText: `${geography} ${industry} ${models}`,
      queryPurpose: 'Find companies matching target industry and geography.', targetConstraint: 'industry+geography',
      sourceCategory: 'GENERAL_WEB', priority: 10, rationale: 'Derived from explicit intent and pinned ICP target fields.',
      geographicQualifier: geography, industryQualifier: industry }),
    query({ id: 'q-company-sites', queryText: `site:com "${industry}" "${geography}" about sourcing distribution`,
      queryPurpose: 'Locate official company operating descriptions.', targetConstraint: 'operating activity',
      sourceCategory: 'COMPANY_WEBSITE', priority: 20, rationale: 'Official sites can support operating and business-model research.',
      geographicQualifier: geography, industryQualifier: industry }),
    query({ id: 'q-directory', queryText: `${geography} ${industry} trade association directory ${models}`,
      queryPurpose: 'Find relevant industry directories.', targetConstraint: 'industry membership',
      sourceCategory: 'TRADE_ASSOCIATION', priority: 30, rationale: 'Pinned ICP recommends public trade sources.',
      geographicQualifier: geography, industryQualifier: industry }),
  ];
  if (input.intent.importingActivity !== 'UNSPECIFIED') base.push(query({
    id: 'q-import', queryText: `${geography} ${industry} importer foreign suppliers wholesale distributor`,
    queryPurpose: 'Find public import or international-sourcing language.', targetConstraint: 'importing_activity',
    sourceCategory: 'INDUSTRY_DIRECTORY', priority: 15, rationale: 'Intent requests importing or sourcing activity.',
    geographicQualifier: geography, industryQualifier: industry,
  }));
  if (input.intent.exportingActivity !== 'UNSPECIFIED') base.push(query({
    id: 'q-export', queryText: `${geography} ${industry} exporter international customers`,
    queryPurpose: 'Find public export language.', targetConstraint: 'exporting_activity',
    sourceCategory: 'GENERAL_WEB', priority: 16, rationale: 'Intent requests exporting activity.',
    geographicQualifier: geography, industryQualifier: industry,
  }));
  if (input.intent.buyingTriggers.length) base.push(query({
    id: 'q-triggers', queryText: `${industry} ${geography} expansion hiring ERP warehouse`,
    queryPurpose: 'Research public expansion and finance-transformation triggers.', targetConstraint: 'buying_triggers',
    sourceCategory: 'BUSINESS_PUBLICATION', priority: 40, rationale: 'Derived from pinned trigger priorities.',
    geographicQualifier: geography, industryQualifier: industry, triggerQualifier: input.intent.buyingTriggers[0],
  }));
  const validation = validateSearchQueries([...base, ...proposalToQueries(input.aiProposal ?? null)], input.intent);
  if (validation.accepted.length < 3) throw new Error('Validated Search Plan requires at least three accepted queries.');
  const withoutFingerprint = {
    sessionId: input.sessionId, intentVersion: input.intentVersion, planVersion: input.planVersion,
    solutionProfileId: input.solutionProfileId, solutionProfileVersion: input.solutionProfileVersion,
    icpId: input.icp?.definition.id ?? null, icpVersion: input.icp?.version.version ?? null,
    objective: `Identify—not verify—potential ${industry} ${models} organizations for later research.`,
    qualificationStrategy: 'Use structured required constraints as future evidence requirements; do not assert they are satisfied.',
    disqualificationStrategy: 'Carry hard exclusions into every later evaluation and treat unknowns according to explicit policy.',
    searchThemes: ['industry and geography', 'business model', 'public operating activity'],
    sourceCategories: [...new Set(validation.accepted.map((item) => item.sourceCategory))],
    sourceRecommendations: input.intent.sourcePreferences,
    evidenceRequirements: input.intent.requiredConstraints.map((item) => item.description),
    expectedCandidateVolume: input.intent.resultCountPreference > 50 ? 'HIGH' as const : input.intent.resultCountPreference < 15 ? 'LOW' as const : 'MEDIUM' as const,
    resultLimit: input.intent.resultCountPreference,
    freshnessPolicy: input.intent.freshnessPreferenceDays ? `Prefer sources from the last ${input.intent.freshnessPreferenceDays} days.` : 'Use current public sources where available.',
    geographicStrategy: geography, industryStrategy: industry,
    companySizeStrategy: input.intent.employeeSize ? JSON.stringify(input.intent.employeeSize) : 'No explicit employee-size range.',
    buyerPersonaStrategy: input.intent.relevantBuyerPersonas.join(', ') || 'Use pinned ICP persona priorities.',
    triggerStrategy: input.intent.buyingTriggers.join(', ') || 'No trigger-specific query required.',
    ambiguityHandlingRules: ['Never convert unknown evidence into a match.', 'Surface conflicting user and ICP constraints.'],
    stoppingRules: [`Stop after ${input.intent.resultCountPreference} candidate proposals.`, 'Do not execute research in Pocket 4.'],
    planWarnings: [...validation.warnings, ...validation.rejected.map((item) => `${item.query.id}: ${item.reason}`)],
    provenance: { source: 'deterministic_planner', method: input.aiProposal ? 'validated_ai_assisted' : 'deterministic' },
    createdAt: input.createdAt, queries: validation.accepted.sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id)),
  };
  const fingerprintContent = Object.fromEntries(
    Object.entries(withoutFingerprint).filter(([key]) => !['sessionId', 'planVersion', 'createdAt'].includes(key)),
  );
  return SearchPlanSchema.parse({ ...withoutFingerprint, fingerprint: deterministicFingerprint(fingerprintContent) });
}
