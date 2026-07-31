import { z } from 'zod';
import { ProposedClaimTypeSchema, SourceTypeSchema } from '@/domain/yie/evidence-schemas';
import type { ProviderBudget } from './ai-reasoning-provider';
import type { ProviderOperationMetadata, ProviderResult } from '@/domain/yie/contracts';

const Text = z.string().trim().min(1);
export const SearchSourceProposalSchema = z.object({
  providerResultId: Text.optional(), url: z.url(), title: Text.optional(), publisher: Text.optional(),
  publishedAt: z.string().datetime({ offset: true }).optional(), snippet: z.string().trim().min(1).max(2000),
  rank: z.number().int().positive(), sourceType: SourceTypeSchema.default('OTHER_PUBLIC_SOURCE'),
  relevance: z.number().min(0).max(1).optional(), groundingSourceKey: Text.optional(),
  groundingProvider: Text.optional(),
}).strict();
export const SearchQueryResultSchema = z.object({
  sources: z.array(SearchSourceProposalSchema).max(50),
  groundingSourcesReceived: z.number().int().nonnegative().default(0),
  modelEmittedUrlsReceived: z.number().int().nonnegative().default(0),
  modelEmittedUrls: z.array(z.url()).max(100).default([]),
}).strict();
export type SearchQueryResult = z.infer<typeof SearchQueryResultSchema>;

export interface EvidenceSearchProvider {
  readonly providerId: string;
  executeSearchQuery(input: {
    queryId: string; queryText: string; sourceCategory: string; maximumResults: number;
    budget: ProviderBudget;
  }): Promise<ProviderResult<SearchQueryResult>>;
}

export const CandidateMentionProposalSchema = z.object({
  rawName: Text, normalizedNameProposal: Text, legalNameProposal: Text.optional(),
  brandNameProposal: Text.optional(), websiteProposal: z.url().optional(),
  locationProposal: Text.optional(), industryProposal: Text.optional(), businessModelProposal: Text.optional(),
  mentionContext: z.string().trim().min(1).max(2000),
  entityType: z.enum(['COMPANY', 'PRODUCT', 'PERSON', 'PUBLICATION', 'ASSOCIATION', 'CATEGORY', 'UNKNOWN']),
  confidence: z.number().min(0).max(1),
}).strict();
export type CandidateMentionProposal = z.infer<typeof CandidateMentionProposalSchema>;
export interface CandidateExtractionProvider {
  readonly providerId: string;
  extractCandidateMentions(input: {
    sourceUrl: string; excerpt: string; budget: ProviderBudget;
  }): Promise<ProviderResult<CandidateMentionProposal[]>>;
}

export const ProposedClaimProposalSchema = z.object({
  claimType: ProposedClaimTypeSchema,
  normalizedValue: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]),
  rawValue: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]),
  supportType: z.enum(['DIRECT_TEXT', 'STRUCTURED_METADATA', 'SEARCH_SNIPPET', 'OFFICIAL_PROFILE', 'DIRECTORY_ENTRY', 'INFERRED_FROM_CONTEXT']),
  extractedText: z.string().trim().min(1).max(2000), confidence: z.number().min(0).max(1),
}).strict();
export type ProposedClaimProposal = z.infer<typeof ProposedClaimProposalSchema>;
export interface ClaimExtractionProvider {
  readonly providerId: string;
  extractProposedClaims(input: {
    companyName: string; sourceUrl: string; excerpt: string; budget: ProviderBudget;
  }): Promise<ProviderResult<ProposedClaimProposal[]>>;
}

export type EvidenceProviderMetadata = ProviderOperationMetadata;
