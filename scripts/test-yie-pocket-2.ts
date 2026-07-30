import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  CONSTRAINT_KINDS,
  CONSTRAINT_OUTCOMES,
  DISCOVERY_MODES,
  SOURCE_TRUST_TIERS,
  VERIFICATION_STATES,
} from '../src/domain/yie/enums';
import {
  applyExcludePatch,
  applyExpandPatch,
  applyRefinePatch,
  createNewIntent,
  mapLegacyMode,
  restoreIntentSnapshot,
  validateIntentTransition,
} from '../src/domain/yie/intent-policies';
import {
  DiscoveryIntentPatchSchema,
  DiscoveryIntentSchema,
  SearchPlanProposalSchema,
} from '../src/domain/yie/schemas';
import { ProviderError } from '../src/application/yie/providers/provider-errors';
import { ProviderRegistry } from '../src/application/yie/providers/provider-registry';
import {
  GeminiShadowAdapter,
  type NeutralGeminiClient,
  type NeutralGeminiResponse,
} from '../src/infrastructure/yie/ai/gemini-adapter';
import { loadGeminiModelPolicy } from '../src/infrastructure/yie/ai/gemini-model-policy';
import { extractAndValidate, extractJsonValue } from '../src/infrastructure/yie/ai/safe-json';
import {
  currentIntentToYieProposal,
  currentNewIntentToYie,
} from '../src/application/yie/compatibility/current-discovery-adapter';
import { compareCurrentAndYieIntent } from '../src/application/yie/compatibility/shadow-comparison';

async function main() {
assert.deepEqual(VERIFICATION_STATES, ['VERIFIED', 'INFERRED', 'UNKNOWN', 'CONFLICTING', 'REJECTED']);
assert.deepEqual(DISCOVERY_MODES, ['NEW', 'REFINE', 'EXPAND', 'EXCLUDE', 'RESTORE']);
assert.deepEqual(CONSTRAINT_KINDS, ['REQUIRED', 'PREFERRED', 'EXCLUDED']);
assert.deepEqual(CONSTRAINT_OUTCOMES, ['PASS', 'FAIL', 'UNKNOWN', 'CONFLICTING', 'NOT_APPLICABLE']);
assert.deepEqual(SOURCE_TRUST_TIERS, ['PRIMARY', 'HIGH', 'MEDIUM', 'LOW', 'UNTRUSTED']);
assert.deepEqual(mapLegacyMode('reprioritize'), { mode: 'REFINE', preferenceChange: true });

const previous = createNewIntent({
  id: 'previous',
  rawRequest: 'California distributors',
  industries: ['Distribution'],
  geographies: ['California'],
  excludedSignals: ['Food'],
  desiredResultCount: 75,
});
const clean = createNewIntent({
  id: 'clean',
  rawRequest: 'New York software companies',
  industries: ['Software'],
  geographies: ['New York'],
});
assert.equal(clean.parentIntentId, null);
assert.equal(clean.sessionId, null);
assert.deepEqual(clean.industries, ['Software']);
assert.deepEqual(clean.geographies, ['New York']);
assert.deepEqual(clean.excludedSignals, []);
assert.equal(clean.desiredResultCount, 25);
assert.equal(validateIntentTransition(previous, clean).valid, false);
assert.equal(validateIntentTransition(undefined, clean).valid, true);

assert.throws(() => DiscoveryIntentSchema.parse({
  ...clean,
  parentIntentId: previous.id,
}), /cannot inherit a parent intent/);

const sessionBase = DiscoveryIntentSchema.parse({
  ...previous,
  mode: 'REFINE',
  sessionId: 'session-1',
});
const refined = applyRefinePatch(sessionBase, {
  add: { preferredSignals: ['International contractors'] },
  set: { companySize: { minimum: 50 } },
}, { id: 'refined', rawRequest: 'Prefer larger international teams' });
assert.deepEqual(refined.industries, ['Distribution']);
assert.deepEqual(refined.geographies, ['California']);
assert.deepEqual(refined.preferredSignals, ['International contractors']);
assert.deepEqual(refined.companySize, { minimum: 50 });
assert.deepEqual(sessionBase.preferredSignals, []);
assert.equal(validateIntentTransition(sessionBase, refined).valid, true);

assert.throws(() => DiscoveryIntentPatchSchema.parse({
  set: { geography: 'Texas' },
}), /Unrecognized key/);

const expanded = applyExpandPatch(sessionBase, {
  add: { geographies: ['Nevada'] },
  companySize: { minimum: 10 },
  desiredResultCount: 100,
}, { id: 'expanded', rawRequest: 'Expand into Nevada and smaller firms' });
assert.deepEqual(expanded.intent.industries, ['Distribution']);
assert.deepEqual(expanded.intent.geographies, ['California', 'Nevada']);
assert.deepEqual(expanded.intent.excludedSignals, ['Food']);
assert.deepEqual(expanded.widenedFields, ['geographies', 'companySize', 'desiredResultCount']);
assert.throws(() => applyExpandPatch(sessionBase, {
  remove: { industries: ['Distribution'] },
}, { id: 'bad-expand', rawRequest: 'Bad expansion' }), /unsupported operation/);

const excluded = applyExcludePatch(sessionBase, {
  excludedSignals: ['Crypto-only'],
}, { id: 'excluded', rawRequest: 'Exclude crypto-only businesses' });
assert.deepEqual(excluded.industries, sessionBase.industries);
assert.deepEqual(excluded.geographies, sessionBase.geographies);
assert.deepEqual(excluded.excludedSignals, ['Food', 'Crypto-only']);
assert.throws(() => applyExcludePatch(sessionBase, {
  excludedSignals: ['Food'],
  industries: [],
}, { id: 'bad-exclude', rawRequest: 'Bad exclusion' }), /only add explicit excluded signals/);

let providerInvocations = 0;
const restored = restoreIntentSnapshot(sessionBase);
assert.equal(restored.mode, 'RESTORE');
assert.equal(providerInvocations, 0);
assert.equal(Object.isFrozen(restored), true);
assert.equal(Object.isFrozen(restored.industries), true);

assert.deepEqual(extractJsonValue('```json\n{"ok":true}\n```'), { ok: true });
assert.deepEqual(extractJsonValue('Result follows: {"ok":true} End.'), { ok: true });
assert.throws(() => extractJsonValue('not json'), (error) =>
  error instanceof ProviderError && error.code === 'MALFORMED_RESPONSE'
);
assert.throws(
  () => extractAndValidate('{"intentVersion":"wrong","strategies":[],"rationale":"x"}', SearchPlanProposalSchema),
  (error) => error instanceof ProviderError && error.code === 'MALFORMED_RESPONSE',
);

const models = loadGeminiModelPolicy({
  GEMINI_INTENT_MODEL: 'gemini-3.1-flash-lite',
  GEMINI_PLANNING_MODEL: 'gemini-3.1-flash-lite',
  GEMINI_DISCOVERY_MODEL: 'gemini-3.1-flash-lite',
});
assert.throws(() => loadGeminiModelPolicy({ GEMINI_INTENT_MODEL: 'gemini-2.0-flash' }), /Retired Gemini 2.0/);

const validIntentResponse = JSON.stringify({
  mode: 'NEW',
  selectedIcp: null,
  industries: ['Distribution'],
  geographies: ['California'],
  companySize: null,
  businessModels: [],
  requiredSignals: [],
  preferredSignals: [],
  excludedSignals: [],
  buyerRoles: [],
  desiredResultCount: 25,
});

function adapter(client: NeutralGeminiClient) {
  return new GeminiShadowAdapter({
    client,
    models,
    now: () => new Date('2026-01-01T00:00:00.000Z'),
    requestId: () => 'request-1',
  });
}

let timeoutCalls = 0;
await assert.rejects(
  () => adapter({
    generate() {
      timeoutCalls += 1;
      return new Promise<NeutralGeminiResponse>(() => undefined);
    },
  }).parseDiscoveryIntent({
    rawRequest: 'test',
    mode: 'NEW',
    budget: { timeoutMs: 5, maxRetries: 0 },
  }),
  (error) => error instanceof ProviderError && error.code === 'TIMEOUT',
);
assert.equal(timeoutCalls, 1);

let authFailureCalls = 0;
await assert.rejects(
  () => adapter({
    async generate() {
      authFailureCalls += 1;
      throw Object.assign(new Error('API key rejected'), { status: 401 });
    },
  }).parseDiscoveryIntent({
    rawRequest: 'test',
    mode: 'NEW',
    budget: { timeoutMs: 100, maxRetries: 3 },
  }),
  (error) => error instanceof ProviderError && error.code === 'AUTHENTICATION' && !error.retryable,
);
assert.equal(authFailureCalls, 1);

let retryCalls = 0;
const retried = await adapter({
  async generate() {
    retryCalls += 1;
    if (retryCalls < 3) throw Object.assign(new Error('temporary upstream'), { status: 503 });
    return { text: `\`\`\`json\n${validIntentResponse}\n\`\`\`` };
  },
}).parseDiscoveryIntent({
  rawRequest: 'California distributors',
  mode: 'NEW',
  budget: { timeoutMs: 100, maxRetries: 2 },
});
assert.equal(retryCalls, 3);
assert.equal(retried.metadata.retryCount, 2);
assert.equal(retried.value.mode, 'NEW');

const malformedAdapter = adapter({
  async generate() {
    return { text: '{"mode":"NEW","providerSpecificThing":true}' };
  },
});
await assert.rejects(
  () => malformedAdapter.parseDiscoveryIntent({
    rawRequest: 'test',
    mode: 'NEW',
    budget: { timeoutMs: 100, maxRetries: 0 },
  }),
  (error) => error instanceof ProviderError && error.code === 'MALFORMED_RESPONSE',
);

const registry = new ProviderRegistry();
const reasoning = adapter({ async generate() { return { text: validIntentResponse }; } });
registry.register({
  id: 'gemini',
  reasoning,
  search: reasoning,
  configuredModels: {
    PARSE_INTENT: models.PARSE_INTENT,
    PROPOSE_SEARCH_PLAN: models.PROPOSE_SEARCH_PLAN,
    DISCOVER_CANDIDATES: models.DISCOVER_CANDIDATES,
  },
});
assert.equal(registry.supports('gemini', 'AI_REASONING'), true);
assert.equal(registry.supports('gemini', 'SEARCH_GROUNDING'), true);
assert.equal(registry.supports('gemini', 'SOURCE_RETRIEVAL'), false);
assert.throws(
  () => registry.retrieval('gemini'),
  (error) => error instanceof ProviderError && error.code === 'UNSUPPORTED_CAPABILITY',
);
assert.equal(registry.configuredModel('gemini', 'PARSE_INTENT'), 'gemini-3.1-flash-lite');

const currentIntent = {
  companyType: 'Distributor',
  geography: 'California',
  employeeMin: 20,
  employeeMax: 200,
  internationalMarkets: ['India'],
  excludedIndustries: ['Food'],
  desiredCount: 25,
};
const proposal = currentIntentToYieProposal(currentIntent, 'Find distributors', 'reprioritize');
assert.equal(proposal.mode, 'REFINE');
assert.deepEqual(proposal.preferredSignals, ['India']);
const compatible = currentNewIntentToYie(currentIntent, { id: 'compat', rawRequest: 'Find distributors' });
const differences = compareCurrentAndYieIntent(currentIntent, compatible);
assert.ok(differences.every((difference) => typeof difference.field === 'string'));

function sourceFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

const yieFiles = sourceFiles(join(process.cwd(), 'src')).filter((file) => file.includes(`${join('src', '')}`) && file.includes('yie'));
const sdkImports = yieFiles.filter((file) => /from ['"]@google\/genai['"]/.test(readFileSync(file, 'utf8')));
assert.deepEqual(
  sdkImports.map((file) => file.replaceAll('\\', '/').split('/src/')[1]),
  ['infrastructure/yie/composition-root.ts'],
  'Only the YIE composition root may import and instantiate the Gemini SDK',
);
const retiredModelReferences = yieFiles.filter((file) =>
  /gemini-2\.0/i.test(readFileSync(file, 'utf8'))
  && !file.endsWith(join('ai', 'gemini-model-policy.ts'))
);
assert.deepEqual(retiredModelReferences, [], 'New active YIE code must not introduce a retired Gemini model.');

providerInvocations += 0;
console.log('YIE Pocket 2 domain, provider, compatibility, and safety tests passed.');
}

void main();
