import type { KnowledgeLifecycleStatus } from './enums';

export class LifecyclePolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LifecyclePolicyError';
  }
}

const ALLOWED: Record<KnowledgeLifecycleStatus, KnowledgeLifecycleStatus[]> = {
  DRAFT: ['APPROVED'],
  APPROVED: ['ACTIVE'],
  ACTIVE: ['RETIRED'],
  RETIRED: [],
};

export function assertEditable(status: KnowledgeLifecycleStatus) {
  if (status !== 'DRAFT') throw new LifecyclePolicyError(`${status} content is immutable.`);
}

export function assertLifecycleTransition(
  from: KnowledgeLifecycleStatus,
  to: KnowledgeLifecycleStatus,
) {
  if (!ALLOWED[from].includes(to)) {
    throw new LifecyclePolicyError(`Invalid lifecycle transition: ${from} -> ${to}.`);
  }
}

export function assertApprovalContent(input: {
  name: string;
  description: string;
  provenanceSource?: string;
}) {
  if (!input.name.trim()) throw new LifecyclePolicyError('Name is required for approval.');
  if (!input.description.trim()) throw new LifecyclePolicyError('Description is required for approval.');
  if (!input.provenanceSource?.trim()) throw new LifecyclePolicyError('Provenance is required for approval.');
}

export function cloneAsDraft<T extends {
  version: number;
  status: KnowledgeLifecycleStatus;
  approvedAt: string | null;
  approvedBy: string | null;
  retiredAt: string | null;
  createdAt: string;
  createdBy: string;
  changeSummary: string;
}>(
  active: T,
  input: { actor: string; createdAt: string; changeSummary: string },
): T {
  if (active.status !== 'ACTIVE') throw new LifecyclePolicyError('Only ACTIVE content can be cloned into a new draft.');
  return {
    ...active,
    version: active.version + 1,
    status: 'DRAFT',
    approvedAt: null,
    approvedBy: null,
    retiredAt: null,
    createdAt: input.createdAt,
    createdBy: input.actor,
    changeSummary: input.changeSummary,
  };
}
