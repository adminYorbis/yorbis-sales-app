import type {
  KnowledgeAggregate,
  KnowledgeDefinition,
  KnowledgeKind,
  KnowledgeVersion,
  SolutionRelationship,
} from '@/domain/yie/knowledge-schemas';

export interface SolutionKnowledgeRepository {
  createDefinition(definition: KnowledgeDefinition): Promise<void>;
  getDefinition(id: string): Promise<KnowledgeDefinition | null>;
  findDefinitionByName(kind: KnowledgeKind, normalizedName: string): Promise<KnowledgeDefinition | null>;
  insertVersion(version: KnowledgeVersion): Promise<void>;
  updateDraft(version: KnowledgeVersion): Promise<void>;
  setVersionLifecycle(input: {
    definitionId: string;
    version: number;
    status: KnowledgeVersion['status'];
    actor: string;
    at: string;
  }): Promise<void>;
  getVersion(id: string, version: number): Promise<KnowledgeVersion | null>;
  getActiveVersion(id: string): Promise<KnowledgeVersion | null>;
  listVersions(id: string): Promise<KnowledgeVersion[]>;
  replaceRelationships(
    solutionDefinitionId: string,
    solutionVersion: number,
    relationships: SolutionRelationship[],
  ): Promise<void>;
  getRelationships(solutionDefinitionId: string, solutionVersion: number): Promise<SolutionRelationship[]>;
  getActiveSolutionProfile(): Promise<KnowledgeAggregate | null>;
  getSolutionProfileVersion(id: string, version: number): Promise<KnowledgeAggregate | null>;
}
