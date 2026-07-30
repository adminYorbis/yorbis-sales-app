import crypto from 'crypto';
import type { Client, InStatement } from '@libsql/client';
import type { ICPRepository } from '@/application/yie/knowledge/icp-repository';
import {
  ICPDefinitionSchema,
  ICPCriterionSchema,
  ICPReferenceSchema,
  ICPTextItemSchema,
  ICPVersionSchema,
  type ICPAggregate,
  type ICPDefinition,
  type ICPVersion,
} from '@/domain/yie/icp-schemas';

function checksum(value: unknown) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export class TursoICPRepository implements ICPRepository {
  constructor(private readonly client: Client) {}

  async createDefinition(definition: ICPDefinition) {
    const value = ICPDefinitionSchema.parse(definition);
    await this.client.execute({
      sql: 'INSERT INTO yie_icp_profiles (id, normalized_name, created_at) VALUES (?, ?, ?)',
      args: [value.id, value.normalizedName, value.createdAt],
    });
  }

  async getDefinition(id: string) {
    const result = await this.client.execute({ sql: 'SELECT * FROM yie_icp_profiles WHERE id = ?', args: [id] });
    const row = result.rows[0];
    return row ? ICPDefinitionSchema.parse({ id: row.id, normalizedName: row.normalized_name, createdAt: row.created_at }) : null;
  }

  async findDefinitionByName(normalizedName: string) {
    const result = await this.client.execute({ sql: 'SELECT * FROM yie_icp_profiles WHERE normalized_name = ?', args: [normalizedName] });
    const row = result.rows[0];
    return row ? ICPDefinitionSchema.parse({ id: row.id, normalizedName: row.normalized_name, createdAt: row.created_at }) : null;
  }

  async insertAggregate(aggregate: ICPAggregate) {
    await this.client.batch(this.aggregateStatements(aggregate, false), 'write');
  }

  async updateDraft(aggregate: ICPAggregate) {
    const existing = await this.getICPVersion(aggregate.definition.id, aggregate.version.version);
    if (!existing || existing.version.status !== 'DRAFT' || aggregate.version.status !== 'DRAFT') {
      throw new Error('Only DRAFT ICP content can be updated.');
    }
    await this.client.batch(this.aggregateStatements(aggregate, true), 'write');
  }

  async setVersionLifecycle(input: {
    definitionId: string; version: number; status: ICPVersion['status']; actor: string; at: string;
  }) {
    const expected = input.status === 'APPROVED' ? 'DRAFT' : input.status === 'ACTIVE' ? 'APPROVED' : 'ACTIVE';
    const statements: InStatement[] = [];
    if (input.status === 'ACTIVE') {
      statements.push({
        sql: `UPDATE yie_icp_profile_versions SET status = 'RETIRED', retired_at = ?
          WHERE definition_id = ? AND status = 'ACTIVE' AND version <> ?`,
        args: [input.at, input.definitionId, input.version],
      });
    }
    statements.push({
      sql: `UPDATE yie_icp_profile_versions SET status = ?,
        approved_at = CASE WHEN ? = 'APPROVED' THEN ? ELSE approved_at END,
        approved_by = CASE WHEN ? = 'APPROVED' THEN ? ELSE approved_by END,
        retired_at = CASE WHEN ? = 'RETIRED' THEN ? ELSE retired_at END
        WHERE definition_id = ? AND version = ? AND status = ?`,
      args: [input.status, input.status, input.at, input.status, input.actor, input.status, input.at,
        input.definitionId, input.version, expected],
    });
    const result = await this.client.batch(statements, 'write');
    if (Number(result.at(-1)?.rowsAffected ?? 0) !== 1) throw new Error(`ICP lifecycle transition to ${input.status} failed.`);
  }

  async getICPVersion(id: string, version: number) {
    const definition = await this.getDefinition(id);
    const result = await this.client.execute({
      sql: 'SELECT * FROM yie_icp_profile_versions WHERE definition_id = ? AND version = ?',
      args: [id, version],
    });
    if (!definition || !result.rows[0]) return null;
    return this.hydrate(definition, result.rows[0]);
  }

  async getActiveICP(id: string) {
    const result = await this.client.execute({
      sql: `SELECT version FROM yie_icp_profile_versions WHERE definition_id = ? AND status = 'ACTIVE' LIMIT 1`,
      args: [id],
    });
    return result.rows[0] ? this.getICPVersion(id, Number(result.rows[0].version)) : null;
  }

  async listActiveICPs() {
    const result = await this.client.execute(`
      SELECT definition_id, version FROM yie_icp_profile_versions
      WHERE status = 'ACTIVE' ORDER BY name
    `);
    return (await Promise.all(result.rows.map((row) =>
      this.getICPVersion(String(row.definition_id), Number(row.version))
    ))).filter((value): value is ICPAggregate => value !== null);
  }

  async listAllICPVersions(id?: string) {
    const result = id
      ? await this.client.execute({ sql: 'SELECT definition_id, version FROM yie_icp_profile_versions WHERE definition_id = ? ORDER BY version', args: [id] })
      : await this.client.execute('SELECT definition_id, version FROM yie_icp_profile_versions ORDER BY name, version');
    return (await Promise.all(result.rows.map((row) =>
      this.getICPVersion(String(row.definition_id), Number(row.version))
    ))).filter((value): value is ICPAggregate => value !== null);
  }

  private aggregateStatements(aggregate: ICPAggregate, update: boolean): InStatement[] {
    const version = ICPVersionSchema.parse(aggregate.version);
    aggregate.criteria.forEach((item) => ICPCriterionSchema.parse(item));
    const statements: InStatement[] = [];
    if (update) {
      statements.push({
        sql: `UPDATE yie_icp_profile_versions SET name=?, description=?, target_problem=?, solution_definition_id=?,
          solution_version=?, geography_definition=?, industry_definitions_json=?, business_model_definitions_json=?,
          company_size_definition=?, scoring_configuration_reference=?, effective_at=?, provenance_json=?,
          change_summary=?, content_checksum=? WHERE definition_id=? AND version=? AND status='DRAFT'`,
        args: [
          version.name, version.description, version.targetProblem, version.solutionDefinitionId,
          version.solutionVersion, version.geographyDefinition, JSON.stringify(version.industryDefinitions),
          JSON.stringify(version.businessModelDefinitions), version.companySizeDefinition,
          version.scoringConfigurationReference, version.effectiveAt, JSON.stringify(version.provenance),
          version.changeSummary, checksum(aggregate), version.definitionId, version.version,
        ],
      });
      for (const table of ['yie_icp_criteria', 'yie_icp_capabilities', 'yie_icp_personas', 'yie_icp_triggers', 'yie_icp_pain_hypotheses', 'yie_icp_source_recommendations']) {
        statements.push({ sql: `DELETE FROM ${table} WHERE icp_definition_id = ? AND icp_version = ?`, args: [version.definitionId, version.version] });
      }
    } else {
      statements.push({
        sql: `INSERT INTO yie_icp_profile_versions
          (definition_id,version,status,name,description,target_problem,solution_definition_id,solution_version,
           geography_definition,industry_definitions_json,business_model_definitions_json,company_size_definition,
           scoring_configuration_reference,effective_at,created_at,created_by,approved_at,approved_by,retired_at,
           provenance_json,change_summary,content_checksum)
          VALUES (${Array(22).fill('?').join(',')})`,
        args: this.versionArgs(version, aggregate),
      });
    }
    for (const criterion of aggregate.criteria) statements.push({
      sql: `INSERT INTO yie_icp_criteria
        (id,icp_definition_id,icp_version,kind,field,operator,value_json,unknown_handling,description,priority)
        VALUES (?,?,?,?,?,?,?,?,?,?)`,
      args: [criterion.id, criterion.icpDefinitionId, criterion.icpVersion, criterion.kind, criterion.field,
        criterion.operator, criterion.value === null ? null : JSON.stringify(criterion.value),
        criterion.unknownHandling, criterion.description, criterion.priority],
    });
    for (const [table, items] of [
      ['yie_icp_capabilities', aggregate.capabilities],
      ['yie_icp_personas', aggregate.personas],
      ['yie_icp_triggers', aggregate.triggers],
    ] as const) for (const raw of items) {
      const item = ICPReferenceSchema.parse(raw);
      statements.push({
        sql: `INSERT INTO ${table} (icp_definition_id,icp_version,definition_id,version,priority) VALUES (?,?,?,?,?)`,
        args: [version.definitionId, version.version, item.definitionId, item.version, item.priority],
      });
    }
    for (const [table, items] of [
      ['yie_icp_pain_hypotheses', aggregate.painHypotheses],
      ['yie_icp_source_recommendations', aggregate.sourceRecommendations],
    ] as const) for (const raw of items) {
      const item = ICPTextItemSchema.parse(raw);
      statements.push({
        sql: `INSERT INTO ${table} (id,icp_definition_id,icp_version,value,priority) VALUES (?,?,?,?,?)`,
        args: [item.id, version.definitionId, version.version, item.value, item.priority],
      });
    }
    return statements;
  }

  private versionArgs(version: ICPVersion, aggregate: ICPAggregate) {
    return [
      version.definitionId, version.version, version.status, version.name, version.description,
      version.targetProblem, version.solutionDefinitionId, version.solutionVersion,
      version.geographyDefinition, JSON.stringify(version.industryDefinitions),
      JSON.stringify(version.businessModelDefinitions), version.companySizeDefinition,
      version.scoringConfigurationReference, version.effectiveAt, version.createdAt, version.createdBy,
      version.approvedAt, version.approvedBy, version.retiredAt, JSON.stringify(version.provenance),
      version.changeSummary, checksum(aggregate),
    ];
  }

  private async hydrate(definition: ICPDefinition, row: Record<string, unknown>): Promise<ICPAggregate> {
    const id = definition.id;
    const versionNumber = Number(row.version);
    const [criteria, capabilities, personas, triggers, pain, sources] = await Promise.all([
      this.client.execute({ sql: 'SELECT * FROM yie_icp_criteria WHERE icp_definition_id=? AND icp_version=? ORDER BY kind,priority', args: [id, versionNumber] }),
      this.client.execute({ sql: 'SELECT * FROM yie_icp_capabilities WHERE icp_definition_id=? AND icp_version=? ORDER BY priority', args: [id, versionNumber] }),
      this.client.execute({ sql: 'SELECT * FROM yie_icp_personas WHERE icp_definition_id=? AND icp_version=? ORDER BY priority', args: [id, versionNumber] }),
      this.client.execute({ sql: 'SELECT * FROM yie_icp_triggers WHERE icp_definition_id=? AND icp_version=? ORDER BY priority', args: [id, versionNumber] }),
      this.client.execute({ sql: 'SELECT * FROM yie_icp_pain_hypotheses WHERE icp_definition_id=? AND icp_version=? ORDER BY priority', args: [id, versionNumber] }),
      this.client.execute({ sql: 'SELECT * FROM yie_icp_source_recommendations WHERE icp_definition_id=? AND icp_version=? ORDER BY priority', args: [id, versionNumber] }),
    ]);
    const refs = (rows: typeof capabilities.rows) => rows.map((item) => ICPReferenceSchema.parse({
      definitionId: item.definition_id, version: Number(item.version), priority: Number(item.priority),
    }));
    const texts = (rows: typeof pain.rows) => rows.map((item) => ICPTextItemSchema.parse({
      id: item.id, value: item.value, priority: Number(item.priority),
    }));
    return {
      definition,
      version: ICPVersionSchema.parse({
        definitionId: row.definition_id, version: versionNumber, status: row.status, name: row.name,
        description: row.description, targetProblem: row.target_problem,
        solutionDefinitionId: row.solution_definition_id, solutionVersion: Number(row.solution_version),
        geographyDefinition: row.geography_definition,
        industryDefinitions: JSON.parse(String(row.industry_definitions_json)),
        businessModelDefinitions: JSON.parse(String(row.business_model_definitions_json)),
        companySizeDefinition: row.company_size_definition,
        scoringConfigurationReference: row.scoring_configuration_reference,
        effectiveAt: row.effective_at, createdAt: row.created_at, createdBy: row.created_by,
        approvedAt: row.approved_at, approvedBy: row.approved_by, retiredAt: row.retired_at,
        provenance: JSON.parse(String(row.provenance_json)), changeSummary: row.change_summary,
      }),
      criteria: criteria.rows.map((item) => ICPCriterionSchema.parse({
        id: item.id, icpDefinitionId: item.icp_definition_id, icpVersion: Number(item.icp_version),
        kind: item.kind, field: item.field, operator: item.operator,
        value: item.value_json === null ? null : JSON.parse(String(item.value_json)),
        unknownHandling: item.unknown_handling, description: item.description, priority: Number(item.priority),
      })),
      capabilities: refs(capabilities.rows), personas: refs(personas.rows), triggers: refs(triggers.rows),
      painHypotheses: texts(pain.rows), sourceRecommendations: texts(sources.rows),
    };
  }
}
