import crypto from 'crypto';
import type { Client } from '@libsql/client';
import type { SolutionKnowledgeRepository } from '@/application/yie/knowledge/solution-knowledge-repository';
import {
  KnowledgeDefinitionSchema,
  KnowledgeVersionSchema,
  SolutionRelationshipSchema,
  type KnowledgeDefinition,
  type KnowledgeKind,
  type KnowledgeVersion,
  type SolutionRelationship,
} from '@/domain/yie/knowledge-schemas';

function checksum(value: unknown) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function parseVersion(row: Record<string, unknown>): KnowledgeVersion {
  return KnowledgeVersionSchema.parse({
    definitionId: row.definition_id,
    version: Number(row.version),
    status: row.status,
    name: row.name,
    description: row.description,
    attributes: JSON.parse(String(row.attributes_json || '{}')),
    effectiveAt: row.effective_at,
    createdAt: row.created_at,
    createdBy: row.created_by,
    approvedAt: row.approved_at,
    approvedBy: row.approved_by,
    retiredAt: row.retired_at,
    provenance: JSON.parse(String(row.provenance_json)),
    changeSummary: row.change_summary,
  });
}

export class TursoSolutionKnowledgeRepository implements SolutionKnowledgeRepository {
  constructor(private readonly client: Client) {}

  async createDefinition(definition: KnowledgeDefinition) {
    const value = KnowledgeDefinitionSchema.parse(definition);
    await this.client.execute({
      sql: 'INSERT INTO yie_knowledge_definitions (id, kind, normalized_name, created_at) VALUES (?, ?, ?, ?)',
      args: [value.id, value.kind, value.normalizedName, value.createdAt],
    });
  }

  async getDefinition(id: string) {
    const result = await this.client.execute({ sql: 'SELECT * FROM yie_knowledge_definitions WHERE id = ?', args: [id] });
    const row = result.rows[0];
    return row ? KnowledgeDefinitionSchema.parse({
      id: row.id, kind: row.kind, normalizedName: row.normalized_name, createdAt: row.created_at,
    }) : null;
  }

  async findDefinitionByName(kind: KnowledgeKind, normalizedName: string) {
    const result = await this.client.execute({
      sql: 'SELECT * FROM yie_knowledge_definitions WHERE kind = ? AND normalized_name = ?',
      args: [kind, normalizedName],
    });
    const row = result.rows[0];
    return row ? KnowledgeDefinitionSchema.parse({
      id: row.id, kind: row.kind, normalizedName: row.normalized_name, createdAt: row.created_at,
    }) : null;
  }

  async insertVersion(version: KnowledgeVersion) {
    const value = KnowledgeVersionSchema.parse(version);
    await this.client.execute({
      sql: `INSERT INTO yie_knowledge_versions
        (definition_id, version, status, name, description, attributes_json, effective_at, created_at,
         created_by, approved_at, approved_by, retired_at, provenance_json, change_summary, content_checksum)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [value.definitionId, value.version, value.status, value.name, value.description,
        JSON.stringify(value.attributes), value.effectiveAt, value.createdAt, value.createdBy,
        value.approvedAt, value.approvedBy, value.retiredAt, JSON.stringify(value.provenance),
        value.changeSummary, checksum(value)],
    });
  }

  async updateDraft(version: KnowledgeVersion) {
    const value = KnowledgeVersionSchema.parse(version);
    const existing = await this.getVersion(value.definitionId, value.version);
    if (!existing || existing.status !== 'DRAFT' || value.status !== 'DRAFT') throw new Error('Only DRAFT knowledge can be updated.');
    await this.client.execute({
      sql: `UPDATE yie_knowledge_versions SET name = ?, description = ?, attributes_json = ?,
        effective_at = ?, provenance_json = ?, change_summary = ?, content_checksum = ?
        WHERE definition_id = ? AND version = ? AND status = 'DRAFT'`,
      args: [value.name, value.description, JSON.stringify(value.attributes), value.effectiveAt,
        JSON.stringify(value.provenance), value.changeSummary, checksum(value), value.definitionId, value.version],
    });
  }

  async setVersionLifecycle(input: {
    definitionId: string; version: number; status: KnowledgeVersion['status']; actor: string; at: string;
  }) {
    const existing = await this.getVersion(input.definitionId, input.version);
    if (!existing) throw new Error('Knowledge version not found.');
    const expected = input.status === 'APPROVED' ? 'DRAFT' : input.status === 'ACTIVE' ? 'APPROVED' : 'ACTIVE';
    const statements = [];
    if (input.status === 'ACTIVE') {
      statements.push({
        sql: `UPDATE yie_knowledge_versions SET status = 'RETIRED', retired_at = ?
          WHERE definition_id = ? AND status = 'ACTIVE' AND version <> ?`,
        args: [input.at, input.definitionId, input.version],
      });
    }
    statements.push({
      sql: `UPDATE yie_knowledge_versions SET status = ?,
        approved_at = CASE WHEN ? = 'APPROVED' THEN ? ELSE approved_at END,
        approved_by = CASE WHEN ? = 'APPROVED' THEN ? ELSE approved_by END,
        retired_at = CASE WHEN ? = 'RETIRED' THEN ? ELSE retired_at END
        WHERE definition_id = ? AND version = ? AND status = ?`,
      args: [input.status, input.status, input.at, input.status, input.actor, input.status, input.at,
        input.definitionId, input.version, expected],
    });
    const results = await this.client.batch(statements, 'write');
    if (Number(results.at(-1)?.rowsAffected ?? 0) !== 1) throw new Error(`Lifecycle transition to ${input.status} failed.`);
  }

  async getVersion(id: string, version: number) {
    const result = await this.client.execute({
      sql: 'SELECT * FROM yie_knowledge_versions WHERE definition_id = ? AND version = ?',
      args: [id, version],
    });
    return result.rows[0] ? parseVersion(result.rows[0]) : null;
  }

  async getActiveVersion(id: string) {
    const result = await this.client.execute({
      sql: `SELECT * FROM yie_knowledge_versions WHERE definition_id = ? AND status = 'ACTIVE' LIMIT 1`,
      args: [id],
    });
    return result.rows[0] ? parseVersion(result.rows[0]) : null;
  }

  async listVersions(id: string) {
    const result = await this.client.execute({
      sql: 'SELECT * FROM yie_knowledge_versions WHERE definition_id = ? ORDER BY version',
      args: [id],
    });
    return result.rows.map((row) => parseVersion(row));
  }

  async replaceRelationships(solutionDefinitionId: string, solutionVersion: number, relationships: SolutionRelationship[]) {
    const statements = [{
      sql: 'DELETE FROM yie_solution_relationships WHERE solution_definition_id = ? AND solution_version = ?',
      args: [solutionDefinitionId, solutionVersion],
    }];
    for (const raw of relationships) {
      const relationship = SolutionRelationshipSchema.parse(raw);
      statements.push({
        sql: `INSERT INTO yie_solution_relationships
          (solution_definition_id, solution_version, relation_type, target_definition_id, target_version, priority)
          VALUES (?, ?, ?, ?, ?, ?)`,
        args: [relationship.solutionDefinitionId, relationship.solutionVersion, relationship.relationType,
          relationship.targetDefinitionId, relationship.targetVersion, relationship.priority],
      });
    }
    await this.client.batch(statements, 'write');
  }

  async getRelationships(solutionDefinitionId: string, solutionVersion: number) {
    const result = await this.client.execute({
      sql: `SELECT * FROM yie_solution_relationships
        WHERE solution_definition_id = ? AND solution_version = ? ORDER BY relation_type, priority`,
      args: [solutionDefinitionId, solutionVersion],
    });
    return result.rows.map((row) => SolutionRelationshipSchema.parse({
      solutionDefinitionId: row.solution_definition_id,
      solutionVersion: Number(row.solution_version),
      relationType: row.relation_type,
      targetDefinitionId: row.target_definition_id,
      targetVersion: Number(row.target_version),
      priority: Number(row.priority),
    }));
  }

  async getActiveSolutionProfile() {
    const result = await this.client.execute(`
      SELECT v.definition_id, v.version FROM yie_knowledge_versions v
      JOIN yie_knowledge_definitions d ON d.id = v.definition_id
      WHERE d.kind = 'SOLUTION_PROFILE' AND v.status = 'ACTIVE'
      ORDER BY v.effective_at DESC LIMIT 1
    `);
    return result.rows[0]
      ? this.getSolutionProfileVersion(String(result.rows[0].definition_id), Number(result.rows[0].version))
      : null;
  }

  async getSolutionProfileVersion(id: string, version: number) {
    const definition = await this.getDefinition(id);
    const value = await this.getVersion(id, version);
    if (!definition || !value || definition.kind !== 'SOLUTION_PROFILE') return null;
    return { definition, version: value, relationships: await this.getRelationships(id, version) };
  }
}
