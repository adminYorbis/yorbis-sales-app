import { z } from 'zod';
import { KnowledgeLifecycleStatusSchema } from './enums';

const RequiredText = z.string().trim().min(1);
const IsoDate = z.string().datetime({ offset: true });

export const KNOWLEDGE_KINDS = [
  'SOLUTION_PROFILE',
  'CAPABILITY',
  'PROBLEM_SOLVED',
  'BUYER_PERSONA',
  'BUYING_TRIGGER',
  'NEGATIVE_FIT_SIGNAL',
] as const;
export const KnowledgeKindSchema = z.enum(KNOWLEDGE_KINDS);
export type KnowledgeKind = z.infer<typeof KnowledgeKindSchema>;

export const ProvenanceSchema = z.object({
  source: RequiredText,
  method: RequiredText,
  seedVersion: RequiredText.optional(),
  notes: z.string().trim().optional(),
}).strict();

export const KnowledgeDefinitionSchema = z.object({
  id: RequiredText,
  kind: KnowledgeKindSchema,
  normalizedName: RequiredText,
  createdAt: IsoDate,
}).strict();

export const KnowledgeVersionSchema = z.object({
  definitionId: RequiredText,
  version: z.number().int().positive(),
  status: KnowledgeLifecycleStatusSchema,
  name: RequiredText,
  description: RequiredText,
  attributes: z.record(z.string(), z.unknown()).default({}),
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
    context.addIssue({ code: 'custom', message: `${value.status} version requires approval provenance.` });
  }
  if (value.status === 'RETIRED' && !value.retiredAt) {
    context.addIssue({ code: 'custom', message: 'RETIRED version requires retiredAt.' });
  }
});

export const SolutionRelationshipSchema = z.object({
  solutionDefinitionId: RequiredText,
  solutionVersion: z.number().int().positive(),
  relationType: z.enum(['CAPABILITY', 'PROBLEM', 'PERSONA', 'TRIGGER', 'NEGATIVE_SIGNAL']),
  targetDefinitionId: RequiredText,
  targetVersion: z.number().int().positive(),
  priority: z.number().int().nonnegative().default(0),
}).strict();

export type KnowledgeDefinition = z.infer<typeof KnowledgeDefinitionSchema>;
export type KnowledgeVersion = z.infer<typeof KnowledgeVersionSchema>;
export type SolutionRelationship = z.infer<typeof SolutionRelationshipSchema>;
export type KnowledgeAggregate = {
  definition: KnowledgeDefinition;
  version: KnowledgeVersion;
  relationships: SolutionRelationship[];
};
