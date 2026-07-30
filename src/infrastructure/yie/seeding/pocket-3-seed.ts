import type { Client } from '@libsql/client';
import { TursoSolutionKnowledgeRepository } from '../persistence/turso-solution-knowledge-repository';
import { TursoICPRepository } from '../persistence/turso-icp-repository';
import type { SolutionRelationship } from '@/domain/yie/knowledge-schemas';
import {
  POCKET_3_ICPS,
  POCKET_3_KNOWLEDGE,
  POCKET_3_SEED_VERSION,
  SEED_ACTOR,
  SEED_AT,
  SOLUTION_ID,
} from './pocket-3-catalog';

export type SeedReport = {
  seedVersion: string;
  dryRun: boolean;
  inserted: string[];
  unchanged: string[];
  skipped: string[];
  conflicting: string[];
};

function normalizedName(value: string) {
  return value.trim().toLowerCase();
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value
      .map(canonicalize)
      .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalize(child)]),
    );
  }
  return value;
}

function comparable(value: unknown) {
  return JSON.stringify(canonicalize(value));
}

function relationType(kind: string): SolutionRelationship['relationType'] {
  if (kind === 'CAPABILITY') return 'CAPABILITY';
  if (kind === 'PROBLEM_SOLVED') return 'PROBLEM';
  if (kind === 'BUYER_PERSONA') return 'PERSONA';
  if (kind === 'BUYING_TRIGGER') return 'TRIGGER';
  return 'NEGATIVE_SIGNAL';
}

export async function seedPocket3(client: Client, options: { dryRun?: boolean } = {}): Promise<SeedReport> {
  const report: SeedReport = {
    seedVersion: POCKET_3_SEED_VERSION,
    dryRun: Boolean(options.dryRun),
    inserted: [],
    unchanged: [],
    skipped: [],
    conflicting: [],
  };
  const knowledge = new TursoSolutionKnowledgeRepository(client);
  const icps = new TursoICPRepository(client);

  for (const item of POCKET_3_KNOWLEDGE) {
    const definition = {
      id: item.id,
      kind: item.kind,
      normalizedName: normalizedName(item.name),
      createdAt: SEED_AT,
    };
    const version = {
      definitionId: item.id,
      version: 1,
      status: 'ACTIVE' as const,
      name: item.name,
      description: item.description,
      attributes: item.attributes ?? {},
      effectiveAt: SEED_AT,
      createdAt: SEED_AT,
      createdBy: SEED_ACTOR,
      approvedAt: SEED_AT,
      approvedBy: SEED_ACTOR,
      retiredAt: null,
      provenance: { source: 'approved_business_context', method: 'manual_seed', seedVersion: POCKET_3_SEED_VERSION },
      changeSummary: 'Initial approved Pocket 3 knowledge seed.',
    };
    const existingDefinition = await knowledge.getDefinition(item.id);
    const existingVersion = existingDefinition ? await knowledge.getVersion(item.id, 1) : null;
    if (existingDefinition && (
      existingDefinition.kind !== definition.kind || existingDefinition.normalizedName !== definition.normalizedName
    )) {
      report.conflicting.push(item.id);
      continue;
    }
    if (existingVersion) {
      if (comparable(existingVersion) === comparable(version)) report.unchanged.push(item.id);
      else report.conflicting.push(item.id);
      continue;
    }
    if (options.dryRun) {
      report.inserted.push(item.id);
      continue;
    }
    if (!existingDefinition) await knowledge.createDefinition(definition);
    await knowledge.insertVersion(version);
    report.inserted.push(item.id);
  }

  const expectedRelationships: SolutionRelationship[] = POCKET_3_KNOWLEDGE
    .filter((item) => item.id !== SOLUTION_ID)
    .map((item, index) => ({
      solutionDefinitionId: SOLUTION_ID,
      solutionVersion: 1,
      relationType: relationType(item.kind),
      targetDefinitionId: item.id,
      targetVersion: 1,
      priority: index,
    }));
  if (!options.dryRun && !report.conflicting.includes(SOLUTION_ID)) {
    const existing = await knowledge.getRelationships(SOLUTION_ID, 1);
    if (!existing.length) await knowledge.replaceRelationships(SOLUTION_ID, 1, expectedRelationships);
    else if (comparable(existing) !== comparable(expectedRelationships)) report.conflicting.push(`${SOLUTION_ID}:relationships`);
  }

  for (const aggregate of POCKET_3_ICPS) {
    const id = aggregate.definition.id;
    const existingDefinition = await icps.getDefinition(id);
    const existing = existingDefinition ? await icps.getICPVersion(id, 1) : null;
    if (existingDefinition && existingDefinition.normalizedName !== aggregate.definition.normalizedName) {
      report.conflicting.push(id);
      continue;
    }
    if (existing) {
      if (comparable(existing) === comparable(aggregate)) report.unchanged.push(id);
      else report.conflicting.push(id);
      continue;
    }
    if (options.dryRun) {
      report.inserted.push(id);
      continue;
    }
    if (!existingDefinition) await icps.createDefinition(aggregate.definition);
    await icps.insertAggregate(aggregate);
    report.inserted.push(id);
  }

  return report;
}
