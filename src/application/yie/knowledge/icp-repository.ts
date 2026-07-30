import type {
  ICPAggregate,
  ICPDefinition,
  ICPVersion,
} from '@/domain/yie/icp-schemas';

export interface ICPRepository {
  createDefinition(definition: ICPDefinition): Promise<void>;
  getDefinition(id: string): Promise<ICPDefinition | null>;
  findDefinitionByName(normalizedName: string): Promise<ICPDefinition | null>;
  insertAggregate(aggregate: ICPAggregate): Promise<void>;
  updateDraft(aggregate: ICPAggregate): Promise<void>;
  setVersionLifecycle(input: {
    definitionId: string;
    version: number;
    status: ICPVersion['status'];
    actor: string;
    at: string;
  }): Promise<void>;
  getICPVersion(id: string, version: number): Promise<ICPAggregate | null>;
  getActiveICP(id: string): Promise<ICPAggregate | null>;
  listActiveICPs(): Promise<ICPAggregate[]>;
  listAllICPVersions(id?: string): Promise<ICPAggregate[]>;
}
