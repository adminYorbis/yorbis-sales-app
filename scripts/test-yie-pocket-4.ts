import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createClient } from '@libsql/client';
import { PlanningContextService } from '../src/application/yie/discovery/planning-context-service';
import { ShadowPlanningService } from '../src/application/yie/discovery/shadow-planning-service';
import { selectICP } from '../src/domain/yie/icp-selection-policy';
import { mapLegacyModeValue } from '../src/domain/yie/enums';
import {
  IntentCriterionSchema, PlanningIntentSchema, ProductionInterpretationSchema,
  type SearchPlanQuery,
} from '../src/domain/yie/planning-schemas';
import {
  applyPlanningTransition, emptyPlanningIntent, mergeExplicitIntentWithICP,
} from '../src/domain/yie/planning-policies';
import { buildSearchPlan, validateSearchQueries } from '../src/domain/yie/search-plan-policy';
import { compareShadowInterpretation } from '../src/domain/yie/shadow-comparison-policy';
import { POCKET_4_MIGRATIONS } from '../src/infrastructure/yie/persistence/migrations';
import {
  protectedTableSnapshot, runYieMigrations,
} from '../src/infrastructure/yie/persistence/migration-runner';
import { TursoDiscoveryPlanningRepository } from '../src/infrastructure/yie/persistence/turso-discovery-planning-repository';
import { TursoICPRepository } from '../src/infrastructure/yie/persistence/turso-icp-repository';
import { TursoSolutionKnowledgeRepository } from '../src/infrastructure/yie/persistence/turso-solution-knowledge-repository';
import { seedPocket3 } from '../src/infrastructure/yie/seeding/pocket-3-seed';
import { FakePlanningProvider } from '../src/infrastructure/yie/testing/fake-planning-provider';

async function main() {
  const directory = mkdtempSync(join(tmpdir(), 'yorbis-pocket-4-'));
  const client = createClient({ url: `file:${join(directory, 'pocket-4.db')}` });
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
    const dry = await runYieMigrations(client, POCKET_4_MIGRATIONS, { dryRun: true });
    assert.deepEqual(dry.plan.map((item) => item.status), ['PENDING', 'PENDING']);
    assert.equal((await client.execute(`SELECT 1 FROM sqlite_schema WHERE name='yie_schema_migrations'`)).rows.length, 0);
    const migrated = await runYieMigrations(client, POCKET_4_MIGRATIONS);
    assert.deepEqual(migrated.applied, ['20260730_001', '20260730_002']);
    assert.deepEqual((await runYieMigrations(client, POCKET_4_MIGRATIONS)).applied, []);
    assert.deepEqual(await protectedTableSnapshot(client), protectedBefore);
    const yieTables = await client.execute(`SELECT name FROM sqlite_schema WHERE type='table' AND name LIKE 'yie_%'`);
    assert.equal(yieTables.rows.length, 18);
    assert.deepEqual((await seedPocket3(client)).conflicting, []);

    const repository = new TursoDiscoveryPlanningRepository(client);
    const knowledge = new TursoSolutionKnowledgeRepository(client);
    const icps = new TursoICPRepository(client);
    const provider = new FakePlanningProvider();
    const logs: Record<string, unknown>[] = [];
    const service = new ShadowPlanningService(
      repository, knowledge, icps, provider,
      () => '2026-07-30T12:00:00.000Z', (entry) => logs.push(entry),
    );

    const created = await service.run({
      rawQuery: 'California Food and Beverage Importers sourcing from Southeast Asia with 20-200 employees',
      actorId: 'test-actor', mode: 'NEW',
      production: ProductionInterpretationSchema.parse({
        reference: 'legacy-run-1',
        rawInput: 'different prior request',
        normalizedFields: { targetGeographies: ['Nevada'] },
        mode: 'restore', restored: true, restoredReference: 'legacy-old',
        resultCount: 1, selectedCategories: ['Food'], explicitRestoreRequested: false,
      }),
    });
    assert.equal(created.intent.version, 1);
    assert.equal(created.intent.mode, 'NEW');
    assert.equal(created.selection.method, 'RECOGNIZED_NAME');
    assert.equal(created.intent.selectedSolutionProfileVersion, 1);
    assert.equal(created.intent.selectedICPVersion, 1);
    assert.ok(created.comparison?.semanticWarnings.includes('POSSIBLE_FALSE_RESTORE'));
    assert.equal(created.plan.queries.length >= 3, true);
    assert.equal(provider.calls.includes('PROPOSE_SEARCH_PLAN'), true);
    assert.equal(provider.calls.includes('PARSE_INTENT'), false);
    assert.equal(created.plan.queries.some((item) => /definitely needing/i.test(item.queryText)), false);

    const session = await repository.getSession(created.sessionId);
    assert.ok(session);
    assert.equal(session.shadowOnly, true);
    assert.equal(session.status, 'PLANNED');

    const v1Snapshot = structuredClone(created.intent.normalizedIntent);
    const refined = await service.run({
      rawQuery: 'Refine to 50-150 employees', actorId: 'test-actor', mode: 'REFINE',
      priorSessionId: created.sessionId,
      patch: { set: { employeeSize: { minimum: 50, maximum: 150 } } },
    });
    assert.equal(refined.intent.version, 2);
    assert.deepEqual(refined.intent.normalizedIntent.targetIndustries, v1Snapshot.targetIndustries);
    assert.deepEqual(created.intent.normalizedIntent, v1Snapshot);
    assert.deepEqual(refined.intent.normalizedIntent.employeeSize, { minimum: 50, maximum: 150 });

    const exclusionsBefore = structuredClone(refined.intent.normalizedIntent.exclusions);
    const expanded = await service.run({
      rawQuery: 'Expand to agriculture companies', actorId: 'test-actor', mode: 'EXPAND',
      priorSessionId: created.sessionId,
      patch: { add: { targetIndustries: ['Agriculture'] }, broadenedFields: ['targetIndustries'] },
    });
    assert.ok(expanded.intent.normalizedIntent.targetIndustries.includes('Agriculture'));
    assert.deepEqual(expanded.intent.normalizedIntent.exclusions, exclusionsBefore);

    const excluded = await service.run({
      rawQuery: 'Exclude restaurants', actorId: 'test-actor', mode: 'EXCLUDE',
      priorSessionId: created.sessionId,
    });
    assert.equal(excluded.intent.version, 4);
    assert.ok(excluded.intent.normalizedIntent.exclusions.length > expanded.intent.normalizedIntent.exclusions.length);
    assert.deepEqual(expanded.intent.normalizedIntent.exclusions, exclusionsBefore);

    const restored = await service.run({
      rawQuery: 'Restore the first interpretation', actorId: 'test-actor', mode: 'RESTORE',
      priorSessionId: created.sessionId, restoreVersion: 1,
    });
    assert.equal(restored.intent.version, 5);
    assert.deepEqual(restored.intent.normalizedIntent, v1Snapshot);
    assert.ok(restored.intent.warnings.includes('RESTORED_NO_NEW_RESEARCH'));
    assert.equal(provider.calls.filter((call) => call === 'PROPOSE_SEARCH_PLAN').length, 4);

    assert.deepEqual(mapLegacyModeValue('reprioritize'), { mode: 'REFINE', preferenceChange: true });
    assert.throws(() => applyPlanningTransition({
      mode: 'EXPAND', base: v1Snapshot, proposed: v1Snapshot,
      patch: { remove: { targetIndustries: ['Food'] }, broadenedFields: ['targetIndustries'] },
    }), /cannot remove/);
    assert.throws(() => applyPlanningTransition({
      mode: 'EXCLUDE', base: v1Snapshot, proposed: v1Snapshot,
      patch: { set: { resultCountPreference: 5 } },
    }), /only add explicit exclusions/);

    const activeICPs = await icps.listActiveICPs();
    const california = activeICPs.find((item) => item.version.name === 'California Food and Beverage Importers')!;
    const explicit = selectICP({
      rawUserInput: 'anything', intent: emptyPlanningIntent(), activeICPs, explicitICPId: california.definition.id,
    });
    assert.equal(explicit.method, 'EXPLICIT_ID');
    const named = selectICP({
      rawUserInput: 'Use California Food and Beverage Importers', intent: emptyPlanningIntent(), activeICPs,
    });
    assert.equal(named.method, 'RECOGNIZED_NAME');
    const ambiguous = selectICP({
      rawUserInput: 'Find growing businesses', intent: emptyPlanningIntent(), activeICPs,
    });
    assert.equal(ambiguous.method, 'AD_HOC');
    assert.ok(ambiguous.warnings.length);

    const userRequired = IntentCriterionSchema.parse({
      id: 'user-size', kind: 'REQUIRED', field: 'employee_count', operator: 'BETWEEN',
      value: { minimum: 1, maximum: 10 }, unknownHandling: 'FAIL',
      description: 'Explicitly require one to ten employees.', origin: 'USER', sourceReference: null,
    });
    const preferenceOverride = mergeExplicitIntentWithICP(
      PlanningIntentSchema.parse({ requiredConstraints: [userRequired] }), california,
    );
    assert.equal(preferenceOverride.intent.preferredCriteria.some((item) => item.field === 'employee_count'), false);
    assert.ok(preferenceOverride.overriddenDefaults.length);
    assert.ok(preferenceOverride.intent.requiredConstraints.some((item) => item.origin === 'ICP'));
    assert.deepEqual(
      new Set([
        ...preferenceOverride.intent.requiredConstraints.map((item) => item.kind),
        ...preferenceOverride.intent.preferredCriteria.map((item) => item.kind),
        ...preferenceOverride.intent.exclusions.map((item) => item.kind),
      ]),
      new Set(['REQUIRED', 'PREFERRED', 'EXCLUDED']),
    );
    const inactive = IntentCriterionSchema.parse({
      id: 'user-inactive', kind: 'REQUIRED', field: 'operating_status', operator: 'EQUALS',
      value: 'INACTIVE', unknownHandling: 'FAIL', description: 'Require inactive.',
      origin: 'USER', sourceReference: null,
    });
    const conflict = mergeExplicitIntentWithICP(
      PlanningIntentSchema.parse({ requiredConstraints: [inactive] }), california,
    );
    assert.ok(conflict.conflicts.some((item) => item.severity === 'HARD'));
    assert.throws(() => IntentCriterionSchema.parse({
      ...inactive, id: 'bad-unknown', unknownHandling: 'GUESS',
    }));

    const duplicate = created.plan.queries[0];
    const unsafeQueries: SearchPlanQuery[] = [
      duplicate,
      { ...duplicate, id: 'duplicate', queryText: duplicate.queryText.toUpperCase() },
      { ...duplicate, id: 'fabricated', queryText: 'Companies definitely needing Yorbis cross-border payments' },
    ];
    const queryValidation = validateSearchQueries(unsafeQueries, created.intent.normalizedIntent);
    assert.equal(queryValidation.accepted.length, 1);
    assert.equal(queryValidation.rejected.length, 2);
    assert.ok(queryValidation.rejected.some((item) => /Unsupported claim/.test(item.reason)));

    const deterministicA = buildSearchPlan({
      sessionId: 'fingerprint', intentVersion: 1, planVersion: 1,
      solutionProfileId: created.intent.selectedSolutionProfileId, solutionProfileVersion: 1,
      icp: california, intent: created.intent.normalizedIntent, createdAt: '2026-07-30T12:00:00.000Z',
    });
    const deterministicB = buildSearchPlan({
      sessionId: 'another-session', intentVersion: 1, planVersion: 7,
      solutionProfileId: created.intent.selectedSolutionProfileId, solutionProfileVersion: 1,
      icp: california, intent: created.intent.normalizedIntent, createdAt: '2026-08-01T12:00:00.000Z',
    });
    assert.equal(deterministicA.fingerprint, deterministicB.fingerprint);
    assert.ok(deterministicA.queries.length <= 20);

    await assert.rejects(() => repository.insertSearchPlan(created.plan), /UNIQUE|constraint/i);
    const events = await repository.listEvents(created.sessionId);
    await assert.rejects(() => repository.appendEvent({ ...events[0], id: 'duplicate-sequence' }), /UNIQUE|constraint/i);

    const context = new PlanningContextService(repository, knowledge, icps);
    const beforeKnowledgeChange = await context.reconstruct(created.sessionId);
    assert.equal(beforeKnowledgeChange.solution.version.version, 1);
    await client.execute({
      sql: `UPDATE yie_knowledge_versions SET status='RETIRED',retired_at=? WHERE definition_id=? AND version=1`,
      args: ['2026-07-30T13:00:00.000Z', created.intent.selectedSolutionProfileId],
    });
    await client.execute({
      sql: `INSERT INTO yie_knowledge_versions
        (definition_id,version,status,name,description,attributes_json,effective_at,created_at,created_by,
         approved_at,approved_by,retired_at,provenance_json,change_summary,content_checksum)
        SELECT definition_id,2,'ACTIVE',name,description,attributes_json,effective_at,created_at,created_by,
         approved_at,approved_by,NULL,provenance_json,'Later version','test' FROM yie_knowledge_versions
         WHERE definition_id=? AND version=1`,
      args: [created.intent.selectedSolutionProfileId],
    });
    const reconstructed = await context.reconstruct(created.sessionId);
    assert.equal(reconstructed.solution.version.version, 1);
    assert.equal(reconstructed.intents[0].selectedSolutionProfileVersion, 1);

    const identicalRestore = compareShadowInterpretation({
      id: 'same', sessionId: created.sessionId, yie: restored.intent, createdAt: '2026-07-30T12:00:00.000Z',
      production: ProductionInterpretationSchema.parse({
        reference: 'legacy-same', rawInput: restored.intent.rawUserInput,
        normalizedFields: restored.intent.normalizedIntent, mode: 'RESTORE',
        restored: true, restoredReference: 'legacy-original', resultCount: 1,
        selectedCategories: [], explicitRestoreRequested: true,
      }),
    });
    assert.equal(identicalRestore.semanticWarnings.includes('POSSIBLE_FALSE_RESTORE'), false);
    const identicalRestoreLater = compareShadowInterpretation({
      id: 'same-later', sessionId: created.sessionId, yie: restored.intent, createdAt: '2026-08-01T12:00:00.000Z',
      production: ProductionInterpretationSchema.parse({
        reference: 'legacy-same', rawInput: restored.intent.rawUserInput,
        normalizedFields: restored.intent.normalizedIntent, mode: 'RESTORE',
        restored: true, restoredReference: 'legacy-original', resultCount: 1,
        selectedCategories: [], explicitRestoreRequested: true,
      }),
    });
    assert.equal(identicalRestore.fingerprint, identicalRestoreLater.fingerprint);

    class FailingProvider extends FakePlanningProvider {
      override async proposeSearchPlan(): Promise<never> { throw new Error('fixture provider failure'); }
    }
    const failing = new ShadowPlanningService(
      repository, knowledge, icps, new FailingProvider(), () => '2026-07-30T14:00:00.000Z',
    );
    await assert.rejects(() => failing.run({
      rawQuery: 'California food importers', actorId: 'failure-test', mode: 'NEW',
      explicitICPId: california.definition.id,
    }), /fixture provider failure/);
    const failedRows = await client.execute(`SELECT status,failure_code FROM yie_discovery_sessions WHERE actor_id='failure-test'`);
    assert.equal(failedRows.rows[0].status, 'FAILED');
    assert.equal(failedRows.rows[0].failure_code, 'SHADOW_PLANNING_FAILED');

    assert.deepEqual(await protectedTableSnapshot(client), protectedBefore);
    assert.equal((await client.execute('SELECT COUNT(*) AS count FROM prospects')).rows[0].count, 0);
    assert.ok(logs.every((entry) => !('rawQuery' in entry)));
    console.log(JSON.stringify({
      pocket: 4, sessions: 2, intentVersions: 5, planQueries: created.plan.queries.length,
      fakeProviderOnly: true, groundingCalls: 0, candidateCalls: 0,
      falseRestoreDetected: true, protectedTablesUnchanged: true,
    }, null, 2));
  } finally {
    client.close();
    try { rmSync(directory, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 }); } catch {}
  }
}
void main();
