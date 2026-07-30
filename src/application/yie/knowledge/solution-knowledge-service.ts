import crypto from 'crypto';
import type { SolutionKnowledgeRepository } from './solution-knowledge-repository';
import {
  KnowledgeDefinitionSchema,
  KnowledgeVersionSchema,
  type KnowledgeAggregate,
  type KnowledgeDefinition,
  type KnowledgeVersion,
  type SolutionRelationship,
} from '@/domain/yie/knowledge-schemas';
import {
  assertApprovalContent,
  assertEditable,
  assertLifecycleTransition,
  cloneAsDraft,
  LifecyclePolicyError,
} from '@/domain/yie/lifecycle-policy';

export class SolutionKnowledgeService {
  constructor(
    private readonly repository: SolutionKnowledgeRepository,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async createDraftSolutionProfile(input: {
    definition: KnowledgeDefinition;
    version: Omit<KnowledgeVersion, 'status' | 'approvedAt' | 'approvedBy' | 'retiredAt'>;
    relationships?: SolutionRelationship[];
  }) {
    const definition = KnowledgeDefinitionSchema.parse(input.definition);
    if (definition.kind !== 'SOLUTION_PROFILE') {
      throw new LifecyclePolicyError('A Solution Profile draft requires a SOLUTION_PROFILE definition.');
    }
    const version = KnowledgeVersionSchema.parse({
      ...input.version, status: 'DRAFT', approvedAt: null, approvedBy: null, retiredAt: null,
    });
    await this.repository.createDefinition(definition);
    await this.repository.insertVersion(version);
    await this.repository.replaceRelationships(definition.id, version.version, input.relationships ?? []);
    return this.repository.getSolutionProfileVersion(definition.id, version.version);
  }

  async updateDraft(aggregate: KnowledgeAggregate) {
    assertEditable(aggregate.version.status);
    KnowledgeVersionSchema.parse(aggregate.version);
    await this.repository.updateDraft(aggregate.version);
    await this.repository.replaceRelationships(
      aggregate.definition.id,
      aggregate.version.version,
      aggregate.relationships,
    );
    return this.repository.getSolutionProfileVersion(aggregate.definition.id, aggregate.version.version);
  }

  async approveVersion(id: string, versionNumber: number, actor: string) {
    const aggregate = await this.requiredAggregate(id, versionNumber);
    assertLifecycleTransition(aggregate.version.status, 'APPROVED');
    assertApprovalContent({
      name: aggregate.version.name,
      description: aggregate.version.description,
      provenanceSource: aggregate.version.provenance.source,
    });
    await this.assertRelationshipsValid(aggregate.relationships);
    await this.repository.setVersionLifecycle({
      definitionId: id, version: versionNumber, status: 'APPROVED', actor, at: this.now(),
    });
    return this.requiredAggregate(id, versionNumber);
  }

  async activateApprovedVersion(id: string, versionNumber: number, actor: string) {
    const aggregate = await this.requiredAggregate(id, versionNumber);
    assertLifecycleTransition(aggregate.version.status, 'ACTIVE');
    if (new Date(aggregate.version.effectiveAt).getTime() > new Date(this.now()).getTime()) {
      throw new LifecyclePolicyError('Effective date must not be in the future at activation.');
    }
    await this.assertRelationshipsValid(aggregate.relationships, true);
    await this.repository.setVersionLifecycle({
      definitionId: id, version: versionNumber, status: 'ACTIVE', actor, at: this.now(),
    });
    return this.requiredAggregate(id, versionNumber);
  }

  async retireActiveVersion(id: string, versionNumber: number, actor: string) {
    const aggregate = await this.requiredAggregate(id, versionNumber);
    assertLifecycleTransition(aggregate.version.status, 'RETIRED');
    await this.repository.setVersionLifecycle({
      definitionId: id, version: versionNumber, status: 'RETIRED', actor, at: this.now(),
    });
    return this.requiredAggregate(id, versionNumber);
  }

  async cloneActiveVersionIntoDraft(id: string, actor: string, changeSummary: string) {
    const active = await this.repository.getActiveVersion(id);
    if (!active) throw new LifecyclePolicyError('Active version not found.');
    const clone = cloneAsDraft(active, { actor, createdAt: this.now(), changeSummary });
    const relationships = await this.repository.getRelationships(id, active.version);
    await this.repository.insertVersion(clone);
    await this.repository.replaceRelationships(id, clone.version, relationships.map((relationship) => ({
      ...relationship, solutionVersion: clone.version,
    })));
    return this.requiredAggregate(id, clone.version);
  }

  getActiveSolutionProfile() {
    return this.repository.getActiveSolutionProfile();
  }

  getSolutionProfileVersion(id: string, version: number) {
    return this.repository.getSolutionProfileVersion(id, version);
  }

  listSolutionProfileVersions(id: string) {
    return this.repository.listVersions(id);
  }

  private async requiredAggregate(id: string, version: number) {
    const aggregate = await this.repository.getSolutionProfileVersion(id, version);
    if (!aggregate) throw new LifecyclePolicyError(`Solution version ${id}@${version} was not found.`);
    return aggregate;
  }

  private async assertRelationshipsValid(relationships: SolutionRelationship[], requireApproved = false) {
    const expectedKinds = {
      CAPABILITY: 'CAPABILITY',
      PROBLEM: 'PROBLEM_SOLVED',
      PERSONA: 'BUYER_PERSONA',
      TRIGGER: 'BUYING_TRIGGER',
      NEGATIVE_SIGNAL: 'NEGATIVE_FIT_SIGNAL',
    } as const;
    for (const relationship of relationships) {
      const definition = await this.repository.getDefinition(relationship.targetDefinitionId);
      const target = await this.repository.getVersion(relationship.targetDefinitionId, relationship.targetVersion);
      if (!definition || !target) throw new LifecyclePolicyError(`Missing referenced knowledge version ${relationship.targetDefinitionId}@${relationship.targetVersion}.`);
      if (definition.kind !== expectedKinds[relationship.relationType]) {
        throw new LifecyclePolicyError(`Relationship ${relationship.relationType} cannot reference ${definition.kind}.`);
      }
      if (requireApproved && !['APPROVED', 'ACTIVE'].includes(target.status)) {
        throw new LifecyclePolicyError(`Referenced knowledge ${relationship.targetDefinitionId}@${relationship.targetVersion} is not approved.`);
      }
    }
  }
}

export function deterministicContentChecksum(value: unknown) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
