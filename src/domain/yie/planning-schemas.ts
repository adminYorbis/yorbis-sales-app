import { z } from 'zod';
import { ConstraintKindSchema, DiscoveryModeSchema } from './enums';
import { ConstraintOperatorSchema, ConstraintValueSchema, UnknownHandlingSchema } from './icp-schemas';
import { ProvenanceSchema } from './knowledge-schemas';

const Text = z.string().trim().min(1);
const TextList = z.array(Text).max(100).default([]);
const OptionalTextList = z.array(Text).max(100);
const IsoDate = z.string().datetime({ offset: true });
const JsonRecord = z.record(z.string(), z.unknown()).default({});

export const DiscoverySessionStatusSchema = z.enum([
  'CREATED', 'INTERPRETING', 'PLANNED', 'FAILED', 'CANCELLED', 'SUPERSEDED',
]);
export const IntentOriginSchema = z.enum(['USER', 'PRIOR', 'ICP', 'SOLUTION', 'AI', 'SYSTEM']);
export const IntentCriterionSchema = z.object({
  id: Text,
  kind: ConstraintKindSchema,
  field: Text,
  operator: ConstraintOperatorSchema,
  value: ConstraintValueSchema.nullable(),
  unknownHandling: UnknownHandlingSchema,
  description: Text,
  origin: IntentOriginSchema,
  sourceReference: Text.nullable().default(null),
}).strict().superRefine((criterion, context) => {
  const noValue = ['EXISTS', 'DOES_NOT_EXIST'].includes(criterion.operator);
  if (noValue !== (criterion.value === null)) {
    context.addIssue({ code: 'custom', path: ['value'], message: `${criterion.operator} has an invalid value.` });
  }
  if (criterion.operator === 'BETWEEN' && (
    !criterion.value || typeof criterion.value !== 'object' || Array.isArray(criterion.value)
    || !('minimum' in criterion.value) || !('maximum' in criterion.value)
  )) context.addIssue({ code: 'custom', path: ['value'], message: 'BETWEEN requires a numeric range.' });
  if (['IN', 'NOT_IN', 'MATCHES_ANY', 'MATCHES_ALL'].includes(criterion.operator)
    && !Array.isArray(criterion.value)) {
    context.addIssue({ code: 'custom', path: ['value'], message: `${criterion.operator} requires an array.` });
  }
});

const RangeSchema = z.object({
  minimum: z.number().nonnegative().optional(),
  maximum: z.number().positive().optional(),
}).strict().superRefine((range, context) => {
  if (range.minimum !== undefined && range.maximum !== undefined && range.minimum > range.maximum) {
    context.addIssue({ code: 'custom', message: 'Range minimum cannot exceed maximum.' });
  }
});

export const PlanningIntentSchema = z.object({
  targetGeographies: TextList,
  targetIndustries: TextList,
  targetBusinessModels: TextList,
  employeeSize: RangeSchema.nullable().default(null),
  revenueRange: RangeSchema.nullable().default(null),
  internationalActivity: z.enum(['REQUIRED', 'PREFERRED', 'EXCLUDED', 'UNSPECIFIED']).default('UNSPECIFIED'),
  importingActivity: z.enum(['REQUIRED', 'PREFERRED', 'EXCLUDED', 'UNSPECIFIED']).default('UNSPECIFIED'),
  exportingActivity: z.enum(['REQUIRED', 'PREFERRED', 'EXCLUDED', 'UNSPECIFIED']).default('UNSPECIFIED'),
  supplierGeographies: TextList,
  customerGeographies: TextList,
  paymentPainHypotheses: TextList,
  relevantBuyerPersonas: TextList,
  buyingTriggers: TextList,
  requiredConstraints: z.array(IntentCriterionSchema).max(100).default([]),
  preferredCriteria: z.array(IntentCriterionSchema).max(100).default([]),
  exclusions: z.array(IntentCriterionSchema).max(100).default([]),
  sourcePreferences: TextList,
  resultCountPreference: z.number().int().min(1).max(200).default(25),
  freshnessPreferenceDays: z.number().int().min(1).max(3650).nullable().default(null),
  confidenceNotes: TextList,
  unresolvedAmbiguities: TextList,
  defaultUnknownHandling: UnknownHandlingSchema.default('REVIEW'),
}).strict();

export const PlanningIntentPatchSchema = z.object({
  set: z.object({
    targetGeographies: OptionalTextList.optional(),
    targetIndustries: OptionalTextList.optional(),
    targetBusinessModels: OptionalTextList.optional(),
    employeeSize: RangeSchema.nullable().optional(),
    revenueRange: RangeSchema.nullable().optional(),
    internationalActivity: z.enum(['REQUIRED', 'PREFERRED', 'EXCLUDED', 'UNSPECIFIED']).optional(),
    importingActivity: z.enum(['REQUIRED', 'PREFERRED', 'EXCLUDED', 'UNSPECIFIED']).optional(),
    exportingActivity: z.enum(['REQUIRED', 'PREFERRED', 'EXCLUDED', 'UNSPECIFIED']).optional(),
    resultCountPreference: z.number().int().min(1).max(200).optional(),
    freshnessPreferenceDays: z.number().int().min(1).max(3650).nullable().optional(),
    defaultUnknownHandling: UnknownHandlingSchema.optional(),
  }).strict().optional(),
  add: z.object({
    targetGeographies: OptionalTextList.optional(), targetIndustries: OptionalTextList.optional(),
    targetBusinessModels: OptionalTextList.optional(), supplierGeographies: OptionalTextList.optional(),
    customerGeographies: OptionalTextList.optional(), paymentPainHypotheses: OptionalTextList.optional(),
    relevantBuyerPersonas: OptionalTextList.optional(), buyingTriggers: OptionalTextList.optional(),
    requiredConstraints: z.array(IntentCriterionSchema).optional(),
    preferredCriteria: z.array(IntentCriterionSchema).optional(),
    exclusions: z.array(IntentCriterionSchema).optional(), sourcePreferences: OptionalTextList.optional(),
    confidenceNotes: OptionalTextList.optional(), unresolvedAmbiguities: OptionalTextList.optional(),
  }).strict().optional(),
  remove: z.object({
    targetGeographies: OptionalTextList.optional(), targetIndustries: OptionalTextList.optional(),
    targetBusinessModels: OptionalTextList.optional(), supplierGeographies: OptionalTextList.optional(),
    customerGeographies: OptionalTextList.optional(), paymentPainHypotheses: OptionalTextList.optional(),
    relevantBuyerPersonas: OptionalTextList.optional(), buyingTriggers: OptionalTextList.optional(),
    sourcePreferences: OptionalTextList.optional(), confidenceNotes: OptionalTextList.optional(),
    unresolvedAmbiguities: OptionalTextList.optional(),
  }).strict().optional(),
  broadenedFields: OptionalTextList.optional(),
  restoredFromVersion: z.number().int().positive().optional(),
}).strict();

export const IntentConflictSchema = z.object({
  code: Text, field: Text, severity: z.enum(['WARNING', 'HARD']),
  userValue: z.unknown(), policyValue: z.unknown(), explanation: Text,
}).strict();

export const DiscoverySessionSchema = z.object({
  id: Text, externalCorrelationId: Text.nullable(), actorId: Text,
  status: DiscoverySessionStatusSchema, lifecycleMode: DiscoveryModeSchema,
  createdAt: IsoDate, updatedAt: IsoDate, completedAt: IsoDate.nullable(),
  failedAt: IsoDate.nullable(), failureCode: Text.nullable(), currentIntentVersion: z.number().int().nonnegative(),
  selectedSolutionProfileId: Text, selectedSolutionProfileVersion: z.number().int().positive(),
  selectedICPId: Text.nullable(), selectedICPVersion: z.number().int().positive().nullable(),
  productionDiscoveryReference: Text.nullable(), shadowOnly: z.literal(true),
  provenance: ProvenanceSchema, metadata: JsonRecord,
}).strict();

export const DiscoveryIntentVersionSchema = z.object({
  sessionId: Text, version: z.number().int().positive(), parentVersion: z.number().int().positive().nullable(),
  mode: DiscoveryModeSchema, rawUserInput: Text, normalizedIntent: PlanningIntentSchema,
  patch: PlanningIntentPatchSchema.nullable(), explanation: Text,
  selectedSolutionProfileId: Text, selectedSolutionProfileVersion: z.number().int().positive(),
  selectedICPId: Text.nullable(), selectedICPVersion: z.number().int().positive().nullable(),
  createdAt: IsoDate, createdBy: Text, provenance: ProvenanceSchema,
  proposalMetadata: JsonRecord.nullable(), validationResult: z.object({
    valid: z.boolean(), conflicts: z.array(IntentConflictSchema), rejectedProposals: TextList,
    manualReviewRequired: z.boolean(),
  }).strict(),
  warnings: TextList,
}).strict();

export const SessionEventTypeSchema = z.enum([
  'SESSION_CREATED', 'SOLUTION_PINNED', 'ICP_SELECTED', 'INTENT_PROPOSED',
  'INTENT_VALIDATED', 'INTENT_VERSION_CREATED', 'CONFLICT_DETECTED',
  'PLAN_PROPOSED', 'PLAN_VALIDATED', 'PLAN_CREATED', 'SHADOW_COMPARISON_CREATED',
  'SESSION_FAILED', 'SESSION_CANCELLED', 'SESSION_SUPERSEDED',
]);
export const DiscoverySessionEventSchema = z.object({
  id: Text, sessionId: Text, sequence: z.number().int().positive(),
  type: SessionEventTypeSchema, occurredAt: IsoDate, actorId: Text, payload: JsonRecord,
}).strict();

export const SearchQueryStatusSchema = z.enum(['PROPOSED', 'ACCEPTED', 'REJECTED', 'SUPERSEDED']);
export const SearchPlanQuerySchema = z.object({
  id: Text, queryText: Text.max(500), queryPurpose: Text, targetConstraint: Text,
  sourceCategory: z.enum(['GENERAL_WEB', 'COMPANY_WEBSITE', 'TRADE_ASSOCIATION', 'INDUSTRY_DIRECTORY', 'GOVERNMENT_REGISTRY', 'JOB_POSTING', 'BUSINESS_PUBLICATION']),
  priority: z.number().int().min(1).max(100), expectedYield: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  rationale: Text, requiredEvidenceType: Text, geographicQualifier: Text.nullable(),
  industryQualifier: Text.nullable(), triggerQualifier: Text.nullable(), personaQualifier: Text.nullable(),
  status: SearchQueryStatusSchema,
}).strict();

export const SearchPlanSchema = z.object({
  sessionId: Text, intentVersion: z.number().int().positive(), planVersion: z.number().int().positive(),
  solutionProfileId: Text, solutionProfileVersion: z.number().int().positive(),
  icpId: Text.nullable(), icpVersion: z.number().int().positive().nullable(),
  objective: Text, qualificationStrategy: Text, disqualificationStrategy: Text,
  searchThemes: TextList, sourceCategories: TextList, sourceRecommendations: TextList,
  evidenceRequirements: TextList, expectedCandidateVolume: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  resultLimit: z.number().int().min(1).max(200), freshnessPolicy: Text,
  geographicStrategy: Text, industryStrategy: Text, companySizeStrategy: Text,
  buyerPersonaStrategy: Text, triggerStrategy: Text, ambiguityHandlingRules: TextList,
  stoppingRules: TextList, planWarnings: TextList, provenance: ProvenanceSchema,
  createdAt: IsoDate, fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  queries: z.array(SearchPlanQuerySchema).min(3).max(20),
}).strict();

export const ProductionInterpretationSchema = z.object({
  reference: Text.nullable().default(null), rawInput: Text, normalizedFields: JsonRecord,
  mode: Text, restored: z.boolean(), restoredReference: Text.nullable().default(null),
  resultCount: z.number().int().nonnegative().nullable().default(null),
  selectedCategories: TextList, explicitRestoreRequested: z.boolean().default(false),
}).strict();
export const ShadowComparisonSchema = z.object({
  id: Text, sessionId: Text, productionReference: Text.nullable(),
  matchedFields: TextList, differingFields: TextList, productionOnlyFields: TextList,
  yieOnlyFields: TextList, semanticWarnings: TextList, likelyRestorationMismatch: z.boolean(),
  likelyCacheOrSessionReuseWarning: z.boolean(), confidence: z.number().min(0).max(1),
  fingerprint: z.string().regex(/^[a-f0-9]{64}$/), createdAt: IsoDate,
}).strict();

export type PlanningIntent = z.infer<typeof PlanningIntentSchema>;
export type PlanningIntentPatch = z.infer<typeof PlanningIntentPatchSchema>;
export type IntentCriterion = z.infer<typeof IntentCriterionSchema>;
export type IntentConflict = z.infer<typeof IntentConflictSchema>;
export type DiscoverySession = z.infer<typeof DiscoverySessionSchema>;
export type DiscoveryIntentVersion = z.infer<typeof DiscoveryIntentVersionSchema>;
export type DiscoverySessionEvent = z.infer<typeof DiscoverySessionEventSchema>;
export type SearchPlan = z.infer<typeof SearchPlanSchema>;
export type SearchPlanQuery = z.infer<typeof SearchPlanQuerySchema>;
export type ProductionInterpretation = z.infer<typeof ProductionInterpretationSchema>;
export type ShadowComparison = z.infer<typeof ShadowComparisonSchema>;
