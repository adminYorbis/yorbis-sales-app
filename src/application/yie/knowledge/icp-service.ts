import type { ICPRepository } from './icp-repository';
import type { SolutionKnowledgeRepository } from './solution-knowledge-repository';
import {
  ICPVersionSchema,
  ICPCriterionSchema,
  type ICPAggregate,
  type ICPDefinition,
} from '@/domain/yie/icp-schemas';
import {
  assertApprovalContent,
  assertEditable,
  assertLifecycleTransition,
  cloneAsDraft,
  LifecyclePolicyError,
} from '@/domain/yie/lifecycle-policy';

export class ICPService {
  constructor(
    private readonly repository: ICPRepository,
    private readonly knowledgeRepository: SolutionKnowledgeRepository,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async createDraftICP(input: { definition: ICPDefinition; aggregate: ICPAggregate }) {
    if (input.aggregate.definition.id !== input.definition.id) throw new LifecyclePolicyError('ICP definition mismatch.');
    const version = ICPVersionSchema.parse({
      ...input.aggregate.version,
      status: 'DRAFT',
      approvedAt: null,
      approvedBy: null,
      retiredAt: null,
    });
    await this.repository.createDefinition(input.definition);
    await this.repository.insertAggregate({ ...input.aggregate, version });
    return this.required(input.definition.id, version.version);
  }

  async updateDraftICP(aggregate: ICPAggregate) {
    assertEditable(aggregate.version.status);
    this.validateAggregate(aggregate);
    await this.repository.updateDraft(aggregate);
    return this.required(aggregate.definition.id, aggregate.version.version);
  }

  async approveICPVersion(id: string, version: number, actor: string) {
    const aggregate = await this.required(id, version);
    assertLifecycleTransition(aggregate.version.status, 'APPROVED');
    assertApprovalContent({
      name: aggregate.version.name,
      description: aggregate.version.description,
      provenanceSource: aggregate.version.provenance.source,
    });
    await this.validateReferences(aggregate, false);
    await this.repository.setVersionLifecycle({
      definitionId: id, version, status: 'APPROVED', actor, at: this.now(),
    });
    return this.required(id, version);
  }

  async activateApprovedICPVersion(id: string, version: number, actor: string) {
    const aggregate = await this.required(id, version);
    assertLifecycleTransition(aggregate.version.status, 'ACTIVE');
    if (new Date(aggregate.version.effectiveAt).getTime() > new Date(this.now()).getTime()) {
      throw new LifecyclePolicyError('Effective date must not be in the future at activation.');
    }
    await this.validateReferences(aggregate, true);
    await this.repository.setVersionLifecycle({
      definitionId: id, version, status: 'ACTIVE', actor, at: this.now(),
    });
    return this.required(id, version);
  }

  async retireICPVersion(id: string, version: number, actor: string) {
    const aggregate = await this.required(id, version);
    assertLifecycleTransition(aggregate.version.status, 'RETIRED');
    await this.repository.setVersionLifecycle({
      definitionId: id, version, status: 'RETIRED', actor, at: this.now(),
    });
    return this.required(id, version);
  }

  async cloneActiveICPIntoDraft(id: string, actor: string, changeSummary: string) {
    const active = await this.repository.getActiveICP(id);
    if (!active) throw new LifecyclePolicyError('Active ICP not found.');
    const version = cloneAsDraft(active.version, { actor, createdAt: this.now(), changeSummary });
    const clone: ICPAggregate = {
      ...structuredClone(active),
      version,
      criteria: active.criteria.map((item) => ({ ...item, id: `${item.id}-v${version.version}`, icpVersion: version.version })),
      capabilities: active.capabilities.map((item) => ({ ...item })),
      personas: active.personas.map((item) => ({ ...item })),
      triggers: active.triggers.map((item) => ({ ...item })),
      painHypotheses: active.painHypotheses.map((item) => ({ ...item, id: `${item.id}-v${version.version}` })),
      sourceRecommendations: active.sourceRecommendations.map((item) => ({ ...item, id: `${item.id}-v${version.version}` })),
    };
    await this.repository.insertAggregate(clone);
    return this.required(id, version.version);
  }

  getActiveICP(id: string) { return this.repository.getActiveICP(id); }
  getICPVersion(id: string, version: number) { return this.repository.getICPVersion(id, version); }
  listActiveICPs() { return this.repository.listActiveICPs(); }
  listAllICPVersions(id?: string) { return this.repository.listAllICPVersions(id); }

  private validateAggregate(aggregate: ICPAggregate) {
    ICPVersionSchema.parse(aggregate.version);
    aggregate.criteria.forEach((criterion) => ICPCriterionSchema.parse(criterion));
    if (!aggregate.criteria.some((criterion) => criterion.kind === 'REQUIRED')) {
      throw new LifecyclePolicyError('ICP approval requires at least one REQUIRED constraint.');
    }
  }

  private async validateReferences(aggregate: ICPAggregate, requireApproved: boolean) {
    this.validateAggregate(aggregate);
    if (!aggregate.capabilities.length) {
      throw new LifecyclePolicyError('ICP approval requires at least one capability reference.');
    }
    if (!aggregate.personas.length) {
      throw new LifecyclePolicyError('ICP approval requires at least one buyer persona reference.');
    }
    const solution = await this.knowledgeRepository.getVersion(
      aggregate.version.solutionDefinitionId,
      aggregate.version.solutionVersion,
    );
    if (!solution) throw new LifecyclePolicyError('Referenced Solution Profile version does not exist.');
    if (requireApproved && !['APPROVED', 'ACTIVE'].includes(solution.status)) {
      throw new LifecyclePolicyError('Referenced Solution Profile version is not approved.');
    }
    for (const [expectedKind, references] of [
      ['CAPABILITY', aggregate.capabilities],
      ['BUYER_PERSONA', aggregate.personas],
      ['BUYING_TRIGGER', aggregate.triggers],
    ] as const) {
      for (const reference of references) {
        const definition = await this.knowledgeRepository.getDefinition(reference.definitionId);
        const version = await this.knowledgeRepository.getVersion(reference.definitionId, reference.version);
        if (!definition || !version) throw new LifecyclePolicyError(`Missing knowledge reference ${reference.definitionId}@${reference.version}.`);
        if (definition.kind !== expectedKind) {
          throw new LifecyclePolicyError(`${expectedKind} reference cannot point to ${definition.kind}.`);
        }
        if (requireApproved && !['APPROVED', 'ACTIVE'].includes(version.status)) {
          throw new LifecyclePolicyError(`Knowledge reference ${reference.definitionId}@${reference.version} is not approved.`);
        }
      }
    }
  }

  private async required(id: string, version: number) {
    const aggregate = await this.repository.getICPVersion(id, version);
    if (!aggregate) throw new LifecyclePolicyError(`ICP ${id}@${version} was not found.`);
    return aggregate;
  }
}
