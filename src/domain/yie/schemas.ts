import { z } from 'zod';
import {
  DiscoveryModeSchema,
  RetrievalStatusSchema,
  SourceTrustTierSchema,
  VerificationStateSchema,
} from './enums';

const NonEmptyString = z.string().trim().min(1);
const StringList = z.array(NonEmptyString).default([]);
const NullableId = NonEmptyString.nullable().optional();
const IsoDate = z.string().datetime({ offset: true });

export const CompanySizeRangeSchema = z.object({
  minimum: z.number().int().nonnegative().optional(),
  maximum: z.number().int().positive().optional(),
}).strict().superRefine((value, context) => {
  if (value.minimum !== undefined && value.maximum !== undefined && value.minimum > value.maximum) {
    context.addIssue({ code: 'custom', message: 'Company-size minimum cannot exceed maximum.' });
  }
});

export const IcpReferenceSchema = z.object({
  id: NonEmptyString,
  version: z.number().int().positive(),
}).strict();

export const DiscoveryIntentSchema = z.object({
  id: NonEmptyString,
  rawRequest: NonEmptyString,
  mode: DiscoveryModeSchema,
  selectedIcp: IcpReferenceSchema.nullable().optional(),
  industries: StringList,
  geographies: StringList,
  companySize: CompanySizeRangeSchema.nullable().optional(),
  businessModels: StringList,
  requiredSignals: StringList,
  preferredSignals: StringList,
  excludedSignals: StringList,
  buyerRoles: StringList,
  desiredResultCount: z.number().int().min(1).max(200),
  parentIntentId: NullableId,
  sessionId: NullableId,
  version: z.number().int().positive(),
  widenedFields: StringList,
}).strict().superRefine((value, context) => {
  if (value.mode === 'NEW') {
    if (value.parentIntentId) {
      context.addIssue({ code: 'custom', path: ['parentIntentId'], message: 'NEW intent cannot inherit a parent intent.' });
    }
    if (value.sessionId) {
      context.addIssue({ code: 'custom', path: ['sessionId'], message: 'NEW intent cannot inherit a session.' });
    }
    if (value.widenedFields.length) {
      context.addIssue({ code: 'custom', path: ['widenedFields'], message: 'NEW intent cannot inherit widened criteria.' });
    }
  }
});

export const PATCH_ARRAY_FIELDS = [
  'industries',
  'geographies',
  'businessModels',
  'requiredSignals',
  'preferredSignals',
  'excludedSignals',
  'buyerRoles',
] as const;
export const PATCH_CLEAR_FIELDS = [
  'selectedIcp',
  'companySize',
  'industries',
  'geographies',
  'businessModels',
  'requiredSignals',
  'preferredSignals',
  'excludedSignals',
  'buyerRoles',
] as const;

const PatchArrayOperationsSchema = z.object({
  industries: z.array(NonEmptyString).optional(),
  geographies: z.array(NonEmptyString).optional(),
  businessModels: z.array(NonEmptyString).optional(),
  requiredSignals: z.array(NonEmptyString).optional(),
  preferredSignals: z.array(NonEmptyString).optional(),
  excludedSignals: z.array(NonEmptyString).optional(),
  buyerRoles: z.array(NonEmptyString).optional(),
}).strict();

export const DiscoveryIntentPatchSchema = z.object({
  set: z.object({
    selectedIcp: IcpReferenceSchema.nullable().optional(),
    companySize: CompanySizeRangeSchema.nullable().optional(),
    desiredResultCount: z.number().int().min(1).max(200).optional(),
  }).strict().optional(),
  add: PatchArrayOperationsSchema.optional(),
  remove: PatchArrayOperationsSchema.optional(),
  clear: z.array(z.enum(PATCH_CLEAR_FIELDS)).optional(),
}).strict();

export const DiscoveryIntentProposalSchema = z.object({
  mode: DiscoveryModeSchema,
  selectedIcp: IcpReferenceSchema.nullable().optional(),
  industries: z.array(NonEmptyString).optional(),
  geographies: z.array(NonEmptyString).optional(),
  companySize: CompanySizeRangeSchema.nullable().optional(),
  businessModels: z.array(NonEmptyString).optional(),
  requiredSignals: z.array(NonEmptyString).optional(),
  preferredSignals: z.array(NonEmptyString).optional(),
  excludedSignals: z.array(NonEmptyString).optional(),
  buyerRoles: z.array(NonEmptyString).optional(),
  desiredResultCount: z.number().int().min(1).max(200).optional(),
  patch: DiscoveryIntentPatchSchema.optional(),
}).strict();

export const SearchStrategyProposalSchema = z.object({
  key: NonEmptyString,
  type: z.enum(['WEB_SEARCH', 'DIRECTORY_SEARCH', 'COMPANY_SITE_SEARCH']),
  query: NonEmptyString,
  purpose: NonEmptyString,
  priority: z.number().int().min(1).max(100),
  expectedSignals: z.array(NonEmptyString).default([]),
}).strict();

export const SearchPlanProposalSchema = z.object({
  intentVersion: z.number().int().positive(),
  strategies: z.array(SearchStrategyProposalSchema).min(1).max(20),
  rationale: NonEmptyString,
}).strict();

export const CompanySourceProposalSchema = z.object({
  sourceKey: NonEmptyString,
  url: z.url(),
  title: NonEmptyString.optional(),
  publisher: NonEmptyString.optional(),
  publishedAt: IsoDate.optional(),
  trustTier: SourceTrustTierSchema.optional(),
  relevantExcerpt: z.string().trim().max(4000).optional(),
}).strict();

export const CompanyClaimProposalSchema = z.object({
  claimKey: NonEmptyString,
  subject: NonEmptyString,
  predicate: NonEmptyString,
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]),
  sourceKeys: z.array(NonEmptyString).default([]),
  proposedState: VerificationStateSchema.default('UNKNOWN'),
  explanation: z.string().trim().max(2000).optional(),
}).strict();

export const DecisionMakerProposalSchema = z.object({
  name: NonEmptyString,
  title: NonEmptyString,
  profileUrl: z.url().optional(),
  publicBusinessEmail: z.email().optional(),
  sourceKeys: z.array(NonEmptyString).default([]),
  personaReason: z.string().trim().max(2000).optional(),
}).strict();

export const BuyingSignalProposalSchema = z.object({
  signalType: NonEmptyString,
  label: NonEmptyString,
  description: NonEmptyString,
  eventDate: IsoDate.optional(),
  sourceKeys: z.array(NonEmptyString).default([]),
  proposedState: VerificationStateSchema.default('UNKNOWN'),
}).strict();

export const CandidateCompanyProposalSchema = z.object({
  candidateKey: NonEmptyString,
  name: NonEmptyString,
  website: z.url(),
  proposedDomain: NonEmptyString,
  description: z.string().trim().max(3000).optional(),
  sources: z.array(CompanySourceProposalSchema).default([]),
  claims: z.array(CompanyClaimProposalSchema).default([]),
  decisionMakers: z.array(DecisionMakerProposalSchema).default([]),
  buyingSignals: z.array(BuyingSignalProposalSchema).default([]),
}).strict();

export const TokenUsageSchema = z.object({
  inputTokens: z.number().int().nonnegative().optional(),
  outputTokens: z.number().int().nonnegative().optional(),
  totalTokens: z.number().int().nonnegative().optional(),
}).strict();

export const ProviderOperationMetadataSchema = z.object({
  provider: NonEmptyString,
  model: NonEmptyString.optional(),
  operation: NonEmptyString,
  requestId: NonEmptyString,
  startedAt: IsoDate,
  completedAt: IsoDate,
  durationMs: z.number().int().nonnegative(),
  retryCount: z.number().int().nonnegative(),
  tokenUsage: TokenUsageSchema.optional(),
  groundingUsed: z.boolean(),
  partialOutputAvailable: z.boolean(),
}).strict();

export const GroundingSourceMetadataSchema = z.object({
  sourceKey: NonEmptyString,
  url: z.url(),
  title: NonEmptyString.optional(),
  domain: NonEmptyString,
}).strict();

export const RetrievalResultSchema = z.object({
  requestedUrl: z.url(),
  canonicalUrl: z.url().optional(),
  status: RetrievalStatusSchema,
  title: NonEmptyString.optional(),
  publisher: NonEmptyString.optional(),
  retrievedAt: IsoDate,
  relevantExcerpt: z.string().trim().max(4000).optional(),
  fingerprint: NonEmptyString.optional(),
}).strict();
