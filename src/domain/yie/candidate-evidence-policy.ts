import { deterministicFingerprint } from './planning-policies';
import { canonicalizePublicUrl } from './source-policy';
import {
  CandidateMentionSchema, ClaimEvidenceLinkSchema, IdentityResolutionDecisionSchema,
  ProposedClaimSchema, type CandidateCompany, type CandidateMention,
  type ClaimEvidenceLink, type IdentityResolutionDecision, type ProposedClaim,
} from './evidence-schemas';
import type {
  CandidateMentionProposal, ProposedClaimProposal,
} from '@/application/yie/providers/evidence-providers';

export function normalizeCompanyName(value: string) {
  return value.toLowerCase().replace(/\b(incorporated|inc|llc|ltd|limited|corp|corporation|company|co)\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ').trim();
}
export function validateMention(input: {
  id: string; runId: string; sourceId: string; sourceExcerptId?: string | null;
  proposal: CandidateMentionProposal; evidenceText: string; createdAt: string;
}): CandidateMention {
  const context = input.evidenceText.slice(0, 2000);
  const supported = context.toLowerCase().includes(input.proposal.rawName.toLowerCase())
    || context.toLowerCase().includes(input.proposal.normalizedNameProposal.toLowerCase());
  const invalidEntity = input.proposal.entityType !== 'COMPANY';
  const status = invalidEntity || !supported ? 'REJECTED' : input.proposal.confidence < 0.55 ? 'AMBIGUOUS' : 'ACCEPTED';
  const reason = invalidEntity ? `${input.proposal.entityType} is not an eligible company entity.`
    : !supported ? 'Company name is not supported by persisted source evidence.'
      : status === 'AMBIGUOUS' ? 'Extraction confidence requires review.' : null;
  const semantic = {
    runId: input.runId, sourceId: input.sourceId, sourceExcerptId: input.sourceExcerptId ?? null,
    rawName: input.proposal.rawName, normalizedNameProposal: normalizeCompanyName(input.proposal.normalizedNameProposal),
  };
  return CandidateMentionSchema.parse({
    id: input.id, ...semantic, legalNameProposal: input.proposal.legalNameProposal ?? null,
    brandNameProposal: input.proposal.brandNameProposal ?? null,
    websiteProposal: input.proposal.websiteProposal ?? null, locationProposal: input.proposal.locationProposal ?? null,
    industryProposal: input.proposal.industryProposal ?? null,
    businessModelProposal: input.proposal.businessModelProposal ?? null,
    mentionContext: context, extractionMethod: 'bounded_provider_extraction',
    extractionConfidence: input.proposal.confidence, validationStatus: status, rejectionReason: reason,
    entityType: input.proposal.entityType, createdAt: input.createdAt,
    provenance: { source: 'persisted_source_excerpt', method: 'validated_provider_proposal' },
    fingerprint: deterministicFingerprint(semantic),
  });
}

export function resolveIdentity(input: {
  id: string; runId: string; mention: CandidateMention; existing: CandidateCompany[]; createdAt: string;
}): IdentityResolutionDecision {
  const proposedDomain = input.mention.websiteProposal
    ? canonicalizePublicUrl(input.mention.websiteProposal).domain : null;
  const domainMatch = proposedDomain
    ? input.existing.find((item) => item.canonicalDomain === proposedDomain) : undefined;
  if (domainMatch) return IdentityResolutionDecisionSchema.parse({
    id: input.id, runId: input.runId, action: 'LINK_MENTION', sourceCandidateId: null,
    targetCandidateId: domainMatch.id, mentionId: input.mention.id, confidence: 1,
    matchedSignals: ['exact_canonical_domain'], conflictingSignals: [],
    explanation: 'Exact canonical domain links the mention to the existing unverified candidate.',
    reviewRequired: false, createdAt: input.createdAt,
    provenance: { source: 'identity_policy', method: 'deterministic' },
  });
  const legalLocation = input.mention.legalNameProposal && input.mention.locationProposal
    ? input.existing.find((item) =>
      normalizeCompanyName(item.legalName ?? item.canonicalName) === normalizeCompanyName(input.mention.legalNameProposal!)
      && item.headquartersGeographyProposal?.toLowerCase() === input.mention.locationProposal?.toLowerCase()
      && (!proposedDomain || !item.canonicalDomain || proposedDomain === item.canonicalDomain)
    ) : undefined;
  if (legalLocation) return IdentityResolutionDecisionSchema.parse({
    id: input.id, runId: input.runId, action: 'MERGE_AUTOMATIC', sourceCandidateId: null,
    targetCandidateId: legalLocation.id, mentionId: input.mention.id, confidence: 0.95,
    matchedSignals: ['exact_legal_name', 'matching_location'], conflictingSignals: [],
    explanation: 'Exact legal name and location support automatic linking.',
    reviewRequired: false, createdAt: input.createdAt,
    provenance: { source: 'identity_policy', method: 'deterministic' },
  });
  const nameMatch = input.existing.find((item) => item.normalizedName === input.mention.normalizedNameProposal);
  if (nameMatch) return IdentityResolutionDecisionSchema.parse({
    id: input.id, runId: input.runId, action: 'POSSIBLE_DUPLICATE', sourceCandidateId: null,
    targetCandidateId: nameMatch.id, mentionId: input.mention.id, confidence: 0.45,
    matchedSignals: ['similar_or_equal_normalized_name'],
    conflictingSignals: proposedDomain && nameMatch.canonicalDomain && proposedDomain !== nameMatch.canonicalDomain
      ? ['conflicting_domain'] : ['insufficient_strong_identity_signals'],
    explanation: 'Name similarity alone cannot merge candidate companies.',
    reviewRequired: true, createdAt: input.createdAt,
    provenance: { source: 'identity_policy', method: 'deterministic' },
  });
  return IdentityResolutionDecisionSchema.parse({
    id: input.id, runId: input.runId, action: 'CREATE_NEW', sourceCandidateId: null,
    targetCandidateId: null, mentionId: input.mention.id, confidence: proposedDomain ? 0.85 : 0.65,
    matchedSignals: proposedDomain ? ['new_canonical_domain'] : ['new_supported_name'],
    conflictingSignals: [], explanation: 'No strong existing identity match was found.',
    reviewRequired: false, createdAt: input.createdAt,
    provenance: { source: 'identity_policy', method: 'deterministic' },
  });
}

const PROHIBITED_CLAIMS = /\b(need(s|ed)? yorbis|payment pain|buying readiness|budget|decision.?maker|transaction volume|qualified prospect|opportunity score)\b/i;
export function validateClaimWithEvidence(input: {
  claimId: string; evidenceId: string; runId: string; candidateCompanyId: string;
  sourceId: string; sourceExcerptId?: string | null; sourceObservationId?: string | null;
  proposal: ProposedClaimProposal; createdAt: string;
}): { claim: ProposedClaim; evidence: ClaimEvidenceLink } {
  if (PROHIBITED_CLAIMS.test(`${JSON.stringify(input.proposal.rawValue)} ${input.proposal.extractedText}`)) {
    throw new Error('Pocket 5 cannot persist qualification, payment-need, contact, volume, or scoring claims.');
  }
  const evidenceText = input.proposal.extractedText.trim().slice(0, 2000);
  if (!evidenceText) throw new Error('Proposed claim requires bounded source evidence.');
  const claimSemantic = {
    runId: input.runId, candidateCompanyId: input.candidateCompanyId,
    claimType: input.proposal.claimType, normalizedValue: input.proposal.normalizedValue,
    rawValue: input.proposal.rawValue,
  };
  const claim = ProposedClaimSchema.parse({
    id: input.claimId, ...claimSemantic, claimStatus: 'PROPOSED',
    extractionConfidence: input.proposal.confidence, sourceCount: 1,
    createdAt: input.createdAt, updatedAt: input.createdAt,
    provenance: { source: 'persisted_source_evidence', method: 'validated_provider_proposal' },
    fingerprint: deterministicFingerprint(claimSemantic),
  });
  const evidenceSemantic = {
    claimId: claim.id, sourceId: input.sourceId, sourceExcerptId: input.sourceExcerptId ?? null,
    sourceObservationId: input.sourceObservationId ?? null, supportType: input.proposal.supportType,
    extractedText: evidenceText,
  };
  const evidence = ClaimEvidenceLinkSchema.parse({
    id: input.evidenceId, ...evidenceSemantic, relevanceConfidence: input.proposal.confidence,
    createdAt: input.createdAt,
    provenance: { source: 'persisted_source_evidence', method: 'bounded_link' },
    fingerprint: deterministicFingerprint(evidenceSemantic),
  });
  return { claim, evidence };
}
