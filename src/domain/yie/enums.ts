import { z } from 'zod';

export const VERIFICATION_STATES = [
  'VERIFIED',
  'INFERRED',
  'UNKNOWN',
  'CONFLICTING',
  'REJECTED',
] as const;
export const VerificationStateSchema = z.enum(VERIFICATION_STATES);
export type VerificationState = z.infer<typeof VerificationStateSchema>;

export const DISCOVERY_MODES = ['NEW', 'REFINE', 'EXPAND', 'EXCLUDE', 'RESTORE'] as const;
export const DiscoveryModeSchema = z.enum(DISCOVERY_MODES);
export type DiscoveryMode = z.infer<typeof DiscoveryModeSchema>;

export const CONSTRAINT_KINDS = ['REQUIRED', 'PREFERRED', 'EXCLUDED'] as const;
export const ConstraintKindSchema = z.enum(CONSTRAINT_KINDS);
export type ConstraintKind = z.infer<typeof ConstraintKindSchema>;

export const CONSTRAINT_OUTCOMES = [
  'PASS',
  'FAIL',
  'UNKNOWN',
  'CONFLICTING',
  'NOT_APPLICABLE',
] as const;
export const ConstraintOutcomeSchema = z.enum(CONSTRAINT_OUTCOMES);
export type ConstraintOutcome = z.infer<typeof ConstraintOutcomeSchema>;

export const SOURCE_TRUST_TIERS = ['PRIMARY', 'HIGH', 'MEDIUM', 'LOW', 'UNTRUSTED'] as const;
export const SourceTrustTierSchema = z.enum(SOURCE_TRUST_TIERS);
export type SourceTrustTier = z.infer<typeof SourceTrustTierSchema>;

export const PROPOSAL_STATUSES = ['PROPOSED', 'VALIDATED', 'REJECTED'] as const;
export const ProposalStatusSchema = z.enum(PROPOSAL_STATUSES);
export type ProposalStatus = z.infer<typeof ProposalStatusSchema>;

export const OPERATION_STATUSES = [
  'PENDING',
  'RUNNING',
  'COMPLETED',
  'PARTIAL',
  'FAILED',
  'CANCELLED',
] as const;
export const OperationStatusSchema = z.enum(OPERATION_STATUSES);
export type OperationStatus = z.infer<typeof OperationStatusSchema>;

export const RETRIEVAL_STATUSES = ['RETRIEVED', 'UNAVAILABLE', 'BLOCKED', 'FAILED'] as const;
export const RetrievalStatusSchema = z.enum(RETRIEVAL_STATUSES);
export type RetrievalStatus = z.infer<typeof RetrievalStatusSchema>;

export type LegacyDiscoveryMode =
  | 'new'
  | 'refine'
  | 'expand'
  | 'exclude'
  | 'reprioritize'
  | 'restore';

export type LegacyModeMapping = {
  mode: DiscoveryMode;
  preferenceChange: boolean;
};

export function mapLegacyModeValue(mode: LegacyDiscoveryMode): LegacyModeMapping {
  switch (mode) {
    case 'new':
      return { mode: 'NEW', preferenceChange: false };
    case 'refine':
      return { mode: 'REFINE', preferenceChange: false };
    case 'reprioritize':
      return { mode: 'REFINE', preferenceChange: true };
    case 'expand':
      return { mode: 'EXPAND', preferenceChange: false };
    case 'exclude':
      return { mode: 'EXCLUDE', preferenceChange: false };
    case 'restore':
      return { mode: 'RESTORE', preferenceChange: false };
  }
}

export function toLegacyMode(mode: DiscoveryMode): Exclude<LegacyDiscoveryMode, 'reprioritize'> {
  return mode.toLowerCase() as Exclude<LegacyDiscoveryMode, 'reprioritize'>;
}
