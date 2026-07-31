import { deterministicFingerprint } from './planning-policies';
import {
  SearchExecutionPlanSchema, SearchExecutionStepSchema, type SearchExecutionPlan,
} from './evidence-schemas';
import type { SearchPlan } from './planning-schemas';

export type ExecutionLimits = {
  maxQueries?: number; maxSourcesPerQuery?: number; maxTotalSources?: number;
  maxCandidateMentions?: number; maxCanonicalCandidates?: number;
  timeoutMsPerQuery?: number; maxRetriesPerQuery?: number;
};
const HARD = {
  maxQueries: 12, maxSourcesPerQuery: 20, maxTotalSources: 100,
  maxCandidateMentions: 100, maxCanonicalCandidates: 50,
  timeoutMsPerQuery: 30_000, maxRetriesPerQuery: 2,
};
const DEFAULT = {
  maxQueries: 8, maxSourcesPerQuery: 10, maxTotalSources: 50,
  maxCandidateMentions: 60, maxCanonicalCandidates: 25,
  timeoutMsPerQuery: 10_000, maxRetriesPerQuery: 1,
};
function bounded(key: keyof typeof HARD, proposed?: number) {
  return Math.min(HARD[key], Math.max(0, proposed ?? DEFAULT[key]));
}
function normalizeQuery(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
export function buildSearchExecutionPlan(input: {
  runId: string; searchPlan: SearchPlan; executionPlanVersion?: number;
  limits?: ExecutionLimits; createdAt: string;
}): SearchExecutionPlan {
  const maxQueries = bounded('maxQueries', input.limits?.maxQueries);
  const maxSourcesPerQuery = Math.max(1, bounded('maxSourcesPerQuery', input.limits?.maxSourcesPerQuery));
  const seen = new Map<string, string>();
  const accepted: typeof input.searchPlan.queries = [];
  const skipped: Array<{ id: string; reason: string; query: typeof input.searchPlan.queries[number] }> = [];
  for (const item of [...input.searchPlan.queries].sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id))) {
    if (item.status !== 'ACCEPTED') {
      skipped.push({ id: item.id, reason: 'Pocket 4 query is not ACCEPTED.', query: item });
      continue;
    }
    const key = normalizeQuery(item.queryText);
    if (seen.has(key)) {
      skipped.push({ id: item.id, reason: `Execution-equivalent to ${seen.get(key)}.`, query: item });
      continue;
    }
    if (accepted.length >= maxQueries) {
      skipped.push({ id: item.id, reason: 'Execution query budget reached.', query: item });
      continue;
    }
    seen.set(key, item.id);
    accepted.push(item);
  }
  const timeoutMs = Math.max(100, bounded('timeoutMsPerQuery', input.limits?.timeoutMsPerQuery));
  const retryLimit = bounded('maxRetriesPerQuery', input.limits?.maxRetriesPerQuery);
  const steps = [
    ...accepted.map((item, index) => SearchExecutionStepSchema.parse({
      stepId: `step-${index + 1}-${item.id}`, searchPlanQueryId: item.id,
      queryText: item.queryText, sourceCategory: item.sourceCategory, priority: item.priority,
      executionOrder: index + 1, maximumResults: maxSourcesPerQuery, timeoutMs,
      retryLimit, status: 'PENDING', skipReason: null,
    })),
    ...skipped.map((item, index) => SearchExecutionStepSchema.parse({
      stepId: `step-skipped-${index + 1}-${item.id}`, searchPlanQueryId: item.id,
      queryText: item.query.queryText, sourceCategory: item.query.sourceCategory,
      priority: item.query.priority, executionOrder: accepted.length + index + 1,
      maximumResults: maxSourcesPerQuery, timeoutMs, retryLimit, status: 'SKIPPED',
      skipReason: item.reason,
    })),
  ];
  const boundedPlan = {
    executionPlanVersion: input.executionPlanVersion ?? 1,
    acceptedQueryIds: accepted.map((item) => item.id),
    skippedQueryIds: skipped.map((item) => item.id),
    orderedExecutionSteps: steps,
    maximumConcurrentQueries: 1,
    maximumRetriesPerQuery: retryLimit, timeoutMsPerQuery: timeoutMs,
    maximumSourcesPerQuery: maxSourcesPerQuery,
    maximumTotalSources: Math.max(1, bounded('maxTotalSources', input.limits?.maxTotalSources)),
    maximumCandidateMentions: Math.max(1, bounded('maxCandidateMentions', input.limits?.maxCandidateMentions)),
    maximumCanonicalCandidates: Math.max(1, bounded('maxCanonicalCandidates', input.limits?.maxCanonicalCandidates)),
    deduplicationPolicy: 'Normalized query, canonical URL, excerpt hash, mention fingerprint, and conservative company identity.',
    sourceCategoryPolicy: 'Preserve Pocket 4 category and require attributable public-source metadata.',
    retryPolicy: `Retry retryable provider failures at most ${retryLimit} time(s).`,
    failureContinuationPolicy: 'Continue after individual final query failure; evaluate run status after all steps.',
    costPolicy: 'Bound provider calls by accepted-query and retry budgets; store estimated cost when supplied.',
  };
  const semantic = { searchPlanFingerprint: input.searchPlan.fingerprint, ...boundedPlan };
  return SearchExecutionPlanSchema.parse({
    runId: input.runId, searchPlanId: input.searchPlan.sessionId,
    searchPlanVersion: input.searchPlan.planVersion, ...boundedPlan,
    createdAt: input.createdAt, fingerprint: deterministicFingerprint(semantic),
    provenance: { source: 'pocket_5_execution_policy', method: 'deterministic' },
  });
}
