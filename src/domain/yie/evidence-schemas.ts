import { z } from 'zod';
import { ProvenanceSchema } from './knowledge-schemas';

const Text = z.string().trim().min(1);
const OptionalText = Text.nullable().default(null);
const IsoDate = z.string().datetime({ offset: true });
const JsonRecord = z.record(z.string(), z.unknown()).default({});
const Hash = z.string().regex(/^[a-f0-9]{64}$/);

export const DiscoveryRunStatusSchema = z.enum([
  'CREATED', 'PREPARING', 'EXECUTING', 'EXTRACTING', 'RESOLVING',
  'COMPLETED', 'PARTIALLY_COMPLETED', 'FAILED', 'CANCELLED', 'SUPERSEDED',
]);
export const DiscoveryRunSchema = z.object({
  id: Text, sessionId: Text, intentVersion: z.number().int().positive(),
  searchPlanId: Text, searchPlanVersion: z.number().int().positive(), runVersion: z.number().int().positive(),
  status: DiscoveryRunStatusSchema, shadowOnly: z.literal(true),
  executionMode: z.enum(['SHADOW', 'DRY_RUN', 'RESUME']), providerKey: Text,
  startedAt: IsoDate.nullable(), completedAt: IsoDate.nullable(), failedAt: IsoDate.nullable(),
  cancelledAt: IsoDate.nullable(), resumedFromRunId: OptionalText, correlationId: Text,
  actorProvenance: Text, queryBudget: z.number().int().min(0).max(20),
  sourceBudget: z.number().int().min(0).max(200), candidateBudget: z.number().int().min(0).max(100),
  providerRequestCount: z.number().int().nonnegative(), providerRetryCount: z.number().int().nonnegative(),
  totalProviderLatencyMs: z.number().int().nonnegative(), estimatedProviderCost: z.number().nonnegative().nullable(),
  failureCode: OptionalText, failureMessageSummary: z.string().trim().max(500).nullable(),
  metadata: JsonRecord, createdAt: IsoDate, updatedAt: IsoDate,
}).strict();

export const ExecutionStepStatusSchema = z.enum(['PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED_RETRYABLE', 'FAILED_FINAL', 'SKIPPED', 'CANCELLED']);
export const SearchExecutionStepSchema = z.object({
  stepId: Text, searchPlanQueryId: Text, queryText: Text.max(500), sourceCategory: Text,
  priority: z.number().int().min(1).max(100), executionOrder: z.number().int().positive(),
  maximumResults: z.number().int().min(1).max(50), timeoutMs: z.number().int().min(100).max(60_000),
  retryLimit: z.number().int().min(0).max(3), status: ExecutionStepStatusSchema,
  skipReason: OptionalText,
}).strict();
export const SearchExecutionPlanSchema = z.object({
  runId: Text, searchPlanId: Text, searchPlanVersion: z.number().int().positive(),
  executionPlanVersion: z.number().int().positive(), acceptedQueryIds: z.array(Text),
  skippedQueryIds: z.array(Text), orderedExecutionSteps: z.array(SearchExecutionStepSchema).max(20),
  maximumConcurrentQueries: z.number().int().min(1).max(4),
  maximumRetriesPerQuery: z.number().int().min(0).max(3),
  timeoutMsPerQuery: z.number().int().min(100).max(60_000),
  maximumSourcesPerQuery: z.number().int().min(1).max(50),
  maximumTotalSources: z.number().int().min(1).max(200),
  maximumCandidateMentions: z.number().int().min(1).max(200),
  maximumCanonicalCandidates: z.number().int().min(1).max(100),
  deduplicationPolicy: Text, sourceCategoryPolicy: Text, retryPolicy: Text,
  failureContinuationPolicy: Text, costPolicy: Text, createdAt: IsoDate,
  fingerprint: Hash, provenance: ProvenanceSchema,
}).strict();

export const SearchAttemptSchema = z.object({
  id: Text, runId: Text, executionStepId: Text, searchPlanQueryId: Text,
  attemptNumber: z.number().int().positive(), providerKey: Text, queryText: Text.max(500),
  sourceCategory: Text, status: ExecutionStepStatusSchema, startedAt: IsoDate,
  completedAt: IsoDate.nullable(), latencyMs: z.number().int().nonnegative(),
  resultCount: z.number().int().nonnegative(), retryable: z.boolean(),
  errorCode: OptionalText, errorSummary: z.string().trim().max(500).nullable(),
  providerRequestMetadata: JsonRecord, estimatedCost: z.number().nonnegative().nullable(),
}).strict();

export const SourceTypeSchema = z.enum([
  'COMPANY_WEBSITE', 'TRADE_ASSOCIATION', 'INDUSTRY_DIRECTORY', 'GOVERNMENT_REGISTRY',
  'BUSINESS_PUBLICATION', 'JOB_POSTING', 'PROFESSIONAL_PROFILE', 'IMPORT_RECORD',
  'TRADE_SHOW_DIRECTORY', 'OTHER_PUBLIC_SOURCE',
]);
export const SourceRetrievalStatusSchema = z.enum([
  'ACCESS_DENIED', 'NOT_FOUND', 'TIMEOUT', 'UNSUPPORTED_CONTENT', 'ROBOTS_RESTRICTED',
  'PROVIDER_SNIPPET_ONLY', 'RETRIEVED', 'PARTIAL',
]);
export const CanonicalSourceSchema = z.object({
  id: Text, canonicalUrl: z.url(), normalizedUrl: z.url(), originalUrl: z.url(),
  domain: Text, registrableDomain: Text, sourceType: SourceTypeSchema, sourceCategory: Text,
  title: OptionalText, publisher: OptionalText, publishedAt: IsoDate.nullable(), retrievedAt: IsoDate,
  firstSeenAt: IsoDate, lastSeenAt: IsoDate, contentHash: Hash.nullable(), excerptHash: Hash.nullable(),
  language: OptionalText, httpStatus: z.number().int().min(100).max(599).nullable(),
  retrievalStatus: SourceRetrievalStatusSchema, robotsOrAccessNote: OptionalText,
  provenance: ProvenanceSchema, metadata: JsonRecord,
}).strict();
export const SourceObservationSchema = z.object({
  id: Text, runId: Text, sourceId: Text, searchAttemptId: Text, searchPlanQueryId: Text,
  executionStepId: Text, rank: z.number().int().positive(), providerResultId: OptionalText,
  providerSnippet: z.string().trim().max(2000), retrievedExcerpt: z.string().trim().max(2000).nullable(),
  matchedTerms: z.array(Text).max(50), discoveredAt: IsoDate, retrievalMethod: Text,
  relevanceProposal: z.number().min(0).max(1).nullable(), provenance: ProvenanceSchema,
  fingerprint: Hash,
}).strict();
export const SourceExcerptSchema = z.object({
  id: Text, sourceId: Text, runId: Text,
  excerptType: z.enum(['SEARCH_SNIPPET', 'PAGE_EXCERPT', 'COMPANY_DESCRIPTION', 'IMPORT_ACTIVITY',
    'BUSINESS_MODEL', 'LOCATION', 'EMPLOYEE_SIZE', 'SUPPLIER_GEOGRAPHY', 'OPERATING_STATUS', 'OTHER']),
  excerptText: z.string().trim().min(1).max(2000), characterStart: z.number().int().nonnegative().nullable(),
  characterEnd: z.number().int().positive().nullable(), sectionHeading: OptionalText,
  extractor: Text, createdAt: IsoDate, contentHash: Hash, provenance: ProvenanceSchema,
}).strict();

export const CandidateMentionStatusSchema = z.enum(['PROPOSED', 'ACCEPTED', 'REJECTED', 'AMBIGUOUS', 'DUPLICATE']);
export const CandidateMentionSchema = z.object({
  id: Text, runId: Text, sourceId: Text, sourceExcerptId: Text.nullable(), rawName: Text,
  normalizedNameProposal: Text, legalNameProposal: OptionalText, brandNameProposal: OptionalText,
  websiteProposal: z.url().nullable(), locationProposal: OptionalText, industryProposal: OptionalText,
  businessModelProposal: OptionalText, mentionContext: z.string().trim().min(1).max(2000),
  extractionMethod: Text, extractionConfidence: z.number().min(0).max(1),
  validationStatus: CandidateMentionStatusSchema, rejectionReason: OptionalText,
  entityType: z.enum(['COMPANY', 'PRODUCT', 'PERSON', 'PUBLICATION', 'ASSOCIATION', 'CATEGORY', 'UNKNOWN']),
  createdAt: IsoDate, provenance: ProvenanceSchema, fingerprint: Hash,
}).strict();
export const CandidateCompanyStatusSchema = z.enum([
  'PROPOSED', 'ACTIVE_CANDIDATE', 'AMBIGUOUS_IDENTITY', 'MERGED', 'REJECTED', 'SUPERSEDED',
]);
export const CandidateCompanySchema = z.object({
  id: Text, canonicalName: Text, normalizedName: Text, legalName: OptionalText,
  brandNames: z.array(Text).max(50), canonicalDomain: OptionalText, canonicalWebsite: z.url().nullable(),
  headquartersGeographyProposal: OptionalText, operatingGeographiesProposal: z.array(Text).max(50),
  industryProposals: z.array(Text).max(50), businessModelProposals: z.array(Text).max(50),
  status: CandidateCompanyStatusSchema, mergeConfidence: z.number().min(0).max(1),
  firstSeenRunId: Text, firstSeenAt: IsoDate, lastSeenAt: IsoDate,
  provenance: ProvenanceSchema, metadata: JsonRecord,
}).strict();
export const IdentityResolutionDecisionSchema = z.object({
  id: Text, runId: Text, action: z.enum(['CREATE_NEW', 'LINK_MENTION', 'MERGE_AUTOMATIC', 'POSSIBLE_DUPLICATE', 'REJECT']),
  sourceCandidateId: Text.nullable(), targetCandidateId: Text.nullable(), mentionId: Text,
  confidence: z.number().min(0).max(1), matchedSignals: z.array(Text), conflictingSignals: z.array(Text),
  explanation: Text, reviewRequired: z.boolean(), createdAt: IsoDate, provenance: ProvenanceSchema,
}).strict();

export const ProposedClaimTypeSchema = z.enum([
  'COMPANY_NAME', 'LEGAL_NAME', 'WEBSITE', 'LOCATION', 'INDUSTRY', 'BUSINESS_MODEL',
  'OPERATING_STATUS', 'IMPORTING_ACTIVITY', 'EXPORTING_ACTIVITY', 'INTERNATIONAL_ACTIVITY',
  'SUPPLIER_GEOGRAPHY', 'CUSTOMER_GEOGRAPHY', 'EMPLOYEE_SIZE', 'REVENUE_RANGE',
  'PRODUCT_CATEGORY', 'WAREHOUSE_OR_FACILITY', 'OTHER',
]);
export const ProposedClaimStatusSchema = z.enum(['PROPOSED', 'CONFLICTING', 'AMBIGUOUS', 'REJECTED', 'SUPERSEDED']);
export const ProposedClaimSchema = z.object({
  id: Text, runId: Text, candidateCompanyId: Text, claimType: ProposedClaimTypeSchema,
  normalizedValue: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]),
  rawValue: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]),
  claimStatus: ProposedClaimStatusSchema, extractionConfidence: z.number().min(0).max(1),
  sourceCount: z.number().int().positive(), createdAt: IsoDate, updatedAt: IsoDate,
  provenance: ProvenanceSchema, fingerprint: Hash,
}).strict();
export const ClaimEvidenceLinkSchema = z.object({
  id: Text, claimId: Text, sourceId: Text, sourceExcerptId: Text.nullable(),
  sourceObservationId: Text.nullable(),
  supportType: z.enum(['DIRECT_TEXT', 'STRUCTURED_METADATA', 'SEARCH_SNIPPET', 'OFFICIAL_PROFILE', 'DIRECTORY_ENTRY', 'INFERRED_FROM_CONTEXT']),
  extractedText: z.string().trim().min(1).max(2000), relevanceConfidence: z.number().min(0).max(1),
  createdAt: IsoDate, provenance: ProvenanceSchema, fingerprint: Hash,
}).strict();

export const DiscoveryCheckpointSchema = z.object({
  id: Text, runId: Text,
  checkpointType: z.enum(['RUN_CREATED', 'EXECUTION_PLAN_CREATED', 'QUERY_STARTED', 'QUERY_COMPLETED',
    'QUERY_FAILED', 'SOURCES_PERSISTED', 'EXTRACTION_STARTED', 'SOURCE_EXTRACTED',
    'CANDIDATE_RESOLVED', 'CLAIMS_PERSISTED', 'RUN_COMPLETED', 'RUN_PARTIALLY_COMPLETED',
    'RUN_FAILED', 'RUN_CANCELLED']),
  sequence: z.number().int().positive(), status: Text, referenceId: OptionalText,
  createdAt: IsoDate, payloadSummary: z.string().trim().max(500), fingerprint: Hash,
  provenance: ProvenanceSchema,
}).strict();

export type DiscoveryRun = z.infer<typeof DiscoveryRunSchema>;
export type SearchExecutionPlan = z.infer<typeof SearchExecutionPlanSchema>;
export type SearchExecutionStep = z.infer<typeof SearchExecutionStepSchema>;
export type SearchAttempt = z.infer<typeof SearchAttemptSchema>;
export type CanonicalSource = z.infer<typeof CanonicalSourceSchema>;
export type SourceObservation = z.infer<typeof SourceObservationSchema>;
export type SourceExcerpt = z.infer<typeof SourceExcerptSchema>;
export type CandidateMention = z.infer<typeof CandidateMentionSchema>;
export type CandidateCompany = z.infer<typeof CandidateCompanySchema>;
export type IdentityResolutionDecision = z.infer<typeof IdentityResolutionDecisionSchema>;
export type ProposedClaim = z.infer<typeof ProposedClaimSchema>;
export type ClaimEvidenceLink = z.infer<typeof ClaimEvidenceLinkSchema>;
export type DiscoveryCheckpoint = z.infer<typeof DiscoveryCheckpointSchema>;
