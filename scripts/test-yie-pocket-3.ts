import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createClient } from '@libsql/client';
import { ICPService } from '../src/application/yie/knowledge/icp-service';
import { SolutionKnowledgeService } from '../src/application/yie/knowledge/solution-knowledge-service';
import { ICPCriterionSchema } from '../src/domain/yie/icp-schemas';
import { assertLifecycleTransition } from '../src/domain/yie/lifecycle-policy';
import {
  POCKET_3_MIGRATIONS,
} from '../src/infrastructure/yie/persistence/migrations';
import {
  planYieMigrations,
  protectedTableSnapshot,
  runYieMigrations,
} from '../src/infrastructure/yie/persistence/migration-runner';
import { TursoICPRepository } from '../src/infrastructure/yie/persistence/turso-icp-repository';
import { TursoSolutionKnowledgeRepository } from '../src/infrastructure/yie/persistence/turso-solution-knowledge-repository';
import {
  POCKET_3_ICPS,
  POCKET_3_KNOWLEDGE,
  SOLUTION_ID,
  stableId,
} from '../src/infrastructure/yie/seeding/pocket-3-catalog';
import { seedPocket3 } from '../src/infrastructure/yie/seeding/pocket-3-seed';

async function expectReject(action: () => Promise<unknown>, pattern: RegExp) {
  await assert.rejects(action, pattern);
}

async function main() {
  const directory = mkdtempSync(join(tmpdir(), 'yorbis-pocket-3-'));
  const client = createClient({ url: `file:${join(directory, 'pocket-3.db')}` });
  try {
    await client.executeMultiple(`
      CREATE TABLE "user" (id TEXT PRIMARY KEY, email TEXT);
      CREATE TABLE "account" (provider TEXT, providerAccountId TEXT);
      CREATE TABLE "session" (sessionToken TEXT PRIMARY KEY);
      CREATE TABLE "verificationToken" (identifier TEXT, token TEXT);
      CREATE TABLE "authenticator" (credentialID TEXT PRIMARY KEY);
      CREATE TABLE prospects (id INTEGER PRIMARY KEY, company_name TEXT);
      CREATE TABLE contacts (id INTEGER PRIMARY KEY, prospect_id INTEGER);
      CREATE TABLE outreach (id INTEGER PRIMARY KEY, prospect_id INTEGER);
      CREATE TABLE search_runs (id TEXT PRIMARY KEY, query TEXT);
      CREATE TABLE search_run_results (id TEXT PRIMARY KEY, search_run_id TEXT);
    `);
    const protectedBefore = await protectedTableSnapshot(client);

    const dryRun = await runYieMigrations(client, POCKET_3_MIGRATIONS, { dryRun: true });
    assert.equal(dryRun.plan.length, 1);
    assert.equal(dryRun.plan[0].status, 'PENDING');
    assert.deepEqual(dryRun.applied, []);

    const firstMigration = await runYieMigrations(client, POCKET_3_MIGRATIONS);
    assert.deepEqual(firstMigration.applied, ['20260730_001']);
    const secondMigration = await runYieMigrations(client, POCKET_3_MIGRATIONS);
    assert.deepEqual(secondMigration.applied, []);
    assert.equal((await planYieMigrations(client, POCKET_3_MIGRATIONS))[0].status, 'APPLIED');
    assert.deepEqual(await protectedTableSnapshot(client), protectedBefore);

    const tables = await client.execute(`
      SELECT name FROM sqlite_schema WHERE type='table' AND name LIKE 'yie_%' ORDER BY name
    `);
    assert.equal(tables.rows.length, 12);
    assert.ok(tables.rows.some((row) => row.name === 'yie_schema_migrations'));
    assert.ok(tables.rows.some((row) => row.name === 'yie_icp_profile_versions'));

    const drySeed = await seedPocket3(client, { dryRun: true });
    assert.equal(drySeed.inserted.length, POCKET_3_KNOWLEDGE.length + POCKET_3_ICPS.length);
    assert.deepEqual(drySeed.conflicting, []);

    const firstSeed = await seedPocket3(client);
    assert.equal(firstSeed.inserted.length, POCKET_3_KNOWLEDGE.length + POCKET_3_ICPS.length);
    assert.deepEqual(firstSeed.conflicting, []);
    const secondSeed = await seedPocket3(client);
    assert.equal(secondSeed.inserted.length, 0);
    assert.equal(secondSeed.unchanged.length, POCKET_3_KNOWLEDGE.length + POCKET_3_ICPS.length);
    assert.deepEqual(secondSeed.conflicting, []);

    const knowledgeRepository = new TursoSolutionKnowledgeRepository(client);
    const icpRepository = new TursoICPRepository(client);
    const activeSolution = await knowledgeRepository.getActiveSolutionProfile();
    assert.ok(activeSolution);
    assert.equal(activeSolution.definition.id, SOLUTION_ID);
    assert.equal(activeSolution.version.status, 'ACTIVE');
    assert.ok(activeSolution.relationships.length >= 50);

    const kinds = await client.execute(`
      SELECT d.kind, COUNT(*) AS count FROM yie_knowledge_definitions d
      JOIN yie_knowledge_versions v ON v.definition_id=d.id AND v.status='ACTIVE'
      GROUP BY d.kind ORDER BY d.kind
    `);
    assert.deepEqual(
      kinds.rows.map((row) => String(row.kind)),
      ['BUYER_PERSONA', 'BUYING_TRIGGER', 'CAPABILITY', 'NEGATIVE_FIT_SIGNAL', 'PROBLEM_SOLVED', 'SOLUTION_PROFILE'],
    );

    const activeIcps = await icpRepository.listActiveICPs();
    assert.ok(activeIcps.length >= 15);
    const california = activeIcps.find((item) => item.version.name === 'California Food and Beverage Importers');
    assert.ok(california);
    assert.ok(california.criteria.filter((item) => item.kind === 'REQUIRED').length >= 5);
    assert.ok(california.criteria.filter((item) => item.kind === 'PREFERRED').length >= 8);
    assert.ok(california.criteria.filter((item) => item.kind === 'EXCLUDED').length >= 7);
    assert.ok(california.personas.length >= 8);
    assert.ok(california.triggers.length >= 10);
    assert.ok(california.sourceRecommendations.length >= 10);

    for (const icp of activeIcps) {
      assert.ok(icp.criteria.some((criterion) => criterion.kind === 'REQUIRED'));
      for (const reference of [...icp.capabilities, ...icp.personas, ...icp.triggers]) {
        const version = await knowledgeRepository.getVersion(reference.definitionId, reference.version);
        assert.ok(version);
        assert.equal(version.status, 'ACTIVE');
      }
    }

    assert.throws(
      () => ICPCriterionSchema.parse({
        id: 'bad', icpDefinitionId: 'x', icpVersion: 1, kind: 'REQUIRED',
        field: 'industry', operator: 'MATCHES_ANY', value: [], unknownHandling: 'FAIL',
        description: 'Invalid empty array', priority: 0,
      }),
    );
    assert.throws(
      () => ICPCriterionSchema.parse({
        id: 'bad-operator-value', icpDefinitionId: 'x', icpVersion: 1, kind: 'REQUIRED',
        field: 'website', operator: 'EXISTS', value: 'yes', unknownHandling: 'FAIL',
        description: 'EXISTS must not carry a value', priority: 0,
      }),
    );
    assert.throws(
      () => ICPCriterionSchema.parse({
        id: 'bad-unknown', icpDefinitionId: 'x', icpVersion: 1, kind: 'REQUIRED',
        field: 'website', operator: 'EXISTS', value: null, unknownHandling: 'GUESS',
        description: 'Unknown behavior must be explicit', priority: 0,
      }),
    );
    assert.deepEqual(
      new Set(california.criteria.map((criterion) => criterion.kind)),
      new Set(['REQUIRED', 'PREFERRED', 'EXCLUDED']),
    );
    assert.throws(() => assertLifecycleTransition('ACTIVE', 'DRAFT'), /Invalid lifecycle transition/);

    const now = () => '2026-07-30T12:00:00.000Z';
    const solutionService = new SolutionKnowledgeService(knowledgeRepository, now);
    const solutionDraft = await solutionService.cloneActiveVersionIntoDraft(SOLUTION_ID, 'test-reviewer', 'Test next version');
    assert.equal(solutionDraft.version.version, 2);
    assert.equal(solutionDraft.version.status, 'DRAFT');
    solutionDraft.version.description = `${solutionDraft.version.description} Version two.`;
    await solutionService.updateDraft(solutionDraft);
    await expectReject(
      () => solutionService.activateApprovedVersion(SOLUTION_ID, 2, 'test-approver'),
      /Invalid lifecycle transition/,
    );
    await solutionService.approveVersion(SOLUTION_ID, 2, 'test-approver');
    const approvedSolution = await solutionService.getSolutionProfileVersion(SOLUTION_ID, 2);
    assert.ok(approvedSolution);
    await expectReject(() => solutionService.updateDraft(approvedSolution), /immutable/);
    await solutionService.activateApprovedVersion(SOLUTION_ID, 2, 'test-approver');
    assert.equal((await knowledgeRepository.getVersion(SOLUTION_ID, 1))?.status, 'RETIRED');
    assert.equal((await knowledgeRepository.getActiveVersion(SOLUTION_ID))?.version, 2);
    await expectReject(() => solutionService.updateDraft({
      ...solutionDraft,
      version: { ...solutionDraft.version, status: 'ACTIVE' },
    }), /immutable/);
    assert.equal((await solutionService.getSolutionProfileVersion(SOLUTION_ID, 1))?.version.description,
      activeSolution.version.description);

    const icpService = new ICPService(icpRepository, knowledgeRepository, now);
    const icpDraft = await icpService.cloneActiveICPIntoDraft(california.definition.id, 'test-reviewer', 'Test ICP revision');
    icpDraft.version.description = `${icpDraft.version.description} Version two.`;
    icpDraft.version.solutionVersion = 2;
    await icpService.updateDraftICP(icpDraft);
    await icpService.approveICPVersion(california.definition.id, 2, 'test-approver');
    await icpService.activateApprovedICPVersion(california.definition.id, 2, 'test-approver');
    assert.equal((await icpRepository.getICPVersion(california.definition.id, 1))?.version.status, 'RETIRED');
    assert.equal((await icpRepository.getActiveICP(california.definition.id))?.version.version, 2);

    const invalidDraft = await icpService.cloneActiveICPIntoDraft(
      california.definition.id, 'test-reviewer', 'Validate missing reference protection',
    );
    invalidDraft.version.solutionVersion = 2;
    invalidDraft.capabilities = [];
    await icpService.updateDraftICP(invalidDraft);
    await expectReject(
      () => icpService.approveICPVersion(california.definition.id, 3, 'test-approver'),
      /capability reference/,
    );
    invalidDraft.capabilities = california.capabilities;
    invalidDraft.personas = [];
    await icpService.updateDraftICP(invalidDraft);
    await expectReject(
      () => icpService.approveICPVersion(california.definition.id, 3, 'test-approver'),
      /buyer persona reference/,
    );

    const protectedAfter = await protectedTableSnapshot(client);
    assert.deepEqual(protectedAfter, protectedBefore);

    const driftId = stableId('capability', 'Global fiat payments');
    await client.execute({
      sql: 'UPDATE yie_knowledge_versions SET description=? WHERE definition_id=? AND version=1',
      args: ['Manual protected change', driftId],
    });
    const driftReport = await seedPocket3(client);
    assert.ok(driftReport.conflicting.includes(driftId));
    const drifted = await knowledgeRepository.getVersion(driftId, 1);
    assert.equal(drifted?.description, 'Manual protected change');

    const ledger = await client.execute('SELECT version FROM yie_schema_migrations');
    assert.deepEqual(ledger.rows.map((row) => String(row.version)), ['20260730_001']);
    console.log(JSON.stringify({
      pocket: 3,
      migratedTables: tables.rows.map((row) => String(row.name)),
      knowledgeDefinitions: POCKET_3_KNOWLEDGE.length,
      activeIcpsSeeded: activeIcps.length,
      lifecycleAndHistory: 'passed',
      idempotencyAndDriftProtection: 'passed',
      protectedTablesUnchanged: true,
    }, null, 2));
  } finally {
    client.close();
    try {
      rmSync(directory, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
    } catch {
      // libSQL can briefly retain its local file handle on Windows; the OS temp directory is safe to reap later.
    }
  }
}

void main();
