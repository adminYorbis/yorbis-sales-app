import { z } from 'zod';
import { ConstraintKindSchema, KnowledgeLifecycleStatusSchema } from './enums';
import { ProvenanceSchema } from './knowledge-schemas';

const RequiredText = z.string().trim().min(1);
const IsoDate = z.string().datetime({ offset: true });

export const CONSTRAINT_OPERATORS = [
  'EQUALS', 'NOT_EQUALS', 'IN', 'NOT_IN', 'CONTAINS', 'NOT_CONTAINS',
  'EXISTS', 'DOES_NOT_EXIST', 'BETWEEN', 'GREATER_THAN_OR_EQUAL',
  'LESS_THAN_OR_EQUAL', 'MATCHES_ANY', 'MATCHES_ALL',
] as const;
export const ConstraintOperatorSchema = z.enum(CONSTRAINT_OPERATORS);
export const UNKNOWN_HANDLING_VALUES = ['FAIL', 'ALLOW', 'REVIEW'] as const;
export const UnknownHandlingSchema = z.enum(UNKNOWN_HANDLING_VALUES);

export const ConstraintValueSchema = z.union([
  z.string().trim().min(1),
  z.number(),
  z.boolean(),
  z.array(z.string().trim().min(1)).min(1),
  z.object({ minimum: z.number(), maximum: z.number() }).strict().refine(
    (value) => value.minimum <= value.maximum,
    'Range minimum cannot exceed maximum.',
  ),
]);

export const ICPCriterionSchema = z.object({
  id: RequiredText,
  icpDefinitionId: RequiredText,
  icpVersion: z.number().int().positive(),
  kind: ConstraintKindSchema,
  field: RequiredText,
  operator: ConstraintOperatorSchema,
  value: ConstraintValueSchema.nullable(),
  unknownHandling: UnknownHandlingSchema,
  description: RequiredText,
  priority: z.number().int().nonnegative().default(0),
}).strict().superRefine((criterion, context) => {
  const noValue = ['EXISTS', 'DOES_NOT_EXIST'].includes(criterion.operator);
  if (noValue && criterion.value !== null) {
    context.addIssue({ code: 'custom', path: ['value'], message: `${criterion.operator} requires a null value.` });
  }
  if (!noValue && criterion.value === null) {
    context.addIssue({ code: 'custom', path: ['value'], message: `${criterion.operator} requires a value.` });
  }
  if (criterion.operator === 'BETWEEN' && (
    !criterion.value || typeof criterion.value !== 'object' || Array.isArray(criterion.value)
    || !('minimum' in criterion.value) || !('maximum' in criterion.value)
  )) {
    context.addIssue({ code: 'custom', path: ['value'], message: 'BETWEEN requires a numeric range.' });
  }
  if (['IN', 'NOT_IN', 'MATCHES_ANY', 'MATCHES_ALL'].includes(criterion.operator) && !Array.isArray(criterion.value)) {
    context.addIssue({ code: 'custom', path: ['value'], message: `${criterion.operator} requires a non-empty string array.` });
  }
});

export const ICPDefinitionSchema = z.object({
  id: RequiredText,
  normalizedName: RequiredText,
  createdAt: IsoDate,
}).strict();

export const ICPVersionSchema = z.object({
  definitionId: RequiredText,
  version: z.number().int().positive(),
  status: KnowledgeLifecycleStatusSchema,
  name: RequiredText,
  description: RequiredText,
  targetProblem: RequiredText,
  solutionDefinitionId: RequiredText,
  solutionVersion: z.number().int().positive(),
  geographyDefinition: RequiredText,
  industryDefinitions: z.array(RequiredText).min(1),
  businessModelDefinitions: z.array(RequiredText).min(1),
  companySizeDefinition: RequiredText,
  scoringConfigurationReference: RequiredText,
  effectiveAt: IsoDate,
  createdAt: IsoDate,
  createdBy: RequiredText,
  approvedAt: IsoDate.nullable().default(null),
  approvedBy: RequiredText.nullable().default(null),
  retiredAt: IsoDate.nullable().default(null),
  provenance: ProvenanceSchema,
  changeSummary: RequiredText,
}).strict().superRefine((value, context) => {
  if (['APPROVED', 'ACTIVE', 'RETIRED'].includes(value.status) && (!value.approvedAt || !value.approvedBy)) {
    context.addIssue({ code: 'custom', message: `${value.status} ICP requires approval provenance.` });
  }
  if (value.status === 'RETIRED' && !value.retiredAt) {
    context.addIssue({ code: 'custom', message: 'RETIRED ICP requires retiredAt.' });
  }
});

export const ICPReferenceSchema = z.object({
  definitionId: RequiredText,
  version: z.number().int().positive(),
  priority: z.number().int().nonnegative().default(0),
}).strict();

export const ICPTextItemSchema = z.object({
  id: RequiredText,
  value: RequiredText,
  priority: z.number().int().nonnegative().default(0),
}).strict();

export type ICPCriterion = z.infer<typeof ICPCriterionSchema>;
export type ICPDefinition = z.infer<typeof ICPDefinitionSchema>;
export type ICPVersion = z.infer<typeof ICPVersionSchema>;
export type ICPReference = z.infer<typeof ICPReferenceSchema>;
export type ICPTextItem = z.infer<typeof ICPTextItemSchema>;
export type ICPAggregate = {
  definition: ICPDefinition;
  version: ICPVersion;
  criteria: ICPCriterion[];
  capabilities: ICPReference[];
  personas: ICPReference[];
  triggers: ICPReference[];
  painHypotheses: ICPTextItem[];
  sourceRecommendations: ICPTextItem[];
};
