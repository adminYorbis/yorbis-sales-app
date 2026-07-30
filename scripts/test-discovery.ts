import assert from 'node:assert/strict';
import {
  applyDiscoveryIntentPatch,
  createEmptyDiscoveryIntent,
  determineDiscoveryMode,
  normalizeCandidate,
  normalizeIntent,
} from '../src/lib/discovery-contract';
import { candidateRecords, extractJson } from '../src/lib/discovery-response';
import { evaluateRequiredConstraints } from '../src/lib/discovery-constraints';
import { calculateFitScore } from '../src/lib/prospect-scoring';

const intent = normalizeIntent({
  geography: 'California',
  employeeMin: 20,
  employeeMax: 200,
  internationalMarkets: ['India'],
  excludedIndustries: ['Food'],
  desiredCount: 25,
});
assert.equal(intent.geography, 'California');
assert.deepEqual(intent.excludedIndustries, ['Food']);

const normalized = normalizeCandidate({
  company_name: 'Example Distribution',
  website: 'https://example.com',
  location: 'California',
  employee_count: '75',
  sources: [{ id: 's1', url: 'https://example.com/about', evidenceSummary: 'Sources products in India.' }],
  signals: [
    { label: 'International sourcing', description: 'Sources products in India.', status: 'VERIFIED', category: 'supplier', sourceIds: ['s1'] },
    { label: 'Uncited import activity', description: 'No source.', status: 'VERIFIED', category: 'import-export', sourceIds: ['missing'] },
  ],
  contact_email: 'guessed@example.com',
  contact_email_status: 'unverified',
});
assert.ok(normalized);
assert.equal(normalized?.signals?.[0].status, 'VERIFIED');
assert.equal(normalized?.signals?.[1].status, 'UNKNOWN');
assert.equal(normalized?.contact_email, null);
assert.equal(normalizeCandidate({ company_name: 'Bad URL', website: 'javascript:alert(1)' }), null);

assert.deepEqual(extractJson('```json\n{"companies":[]}\n```'), { companies: [] });
assert.deepEqual(extractJson('Research complete.\n{"prospects":[{"company_name":"Legacy"}]}\nDone.'), {
  prospects: [{ company_name: 'Legacy' }],
});
assert.equal(candidateRecords({ prospects: [{ company_name: 'Legacy' }] }).length, 1);

const base = calculateFitScore({
  location: 'California',
  employee_count: '75',
  signals: normalized?.signals,
  evidence: [{ claim: 'Sourcing', source_url: 'https://example.com/about' }],
}, intent);
const withTiming = calculateFitScore({
  location: 'California',
  employee_count: '75',
  signals: normalized?.signals,
  evidence: [{ claim: 'Sourcing', source_url: 'https://example.com/about' }],
  whyNowCount: 1,
}, intent);
assert.equal(withTiming.score - base.score, 6);
assert.equal(withTiming.score, Object.values(withTiming.breakdown).reduce((sum, value) => sum + value, 0));

const firstSearch = normalizeIntent({
  geography: 'California', companyType: 'Distributor', employeeMin: 20, employeeMax: 200,
  internationalMarkets: ['India'], requiresImportExport: true,
});
const secondSearch = normalizeIntent({
  geography: 'New York', industry: 'Software', internationalMarkets: ['Europe'],
  paymentSignals: ['International contractor payments'],
});
assert.equal(secondSearch.geography, 'New York');
assert.equal(secondSearch.employeeMin, undefined);
assert.equal(secondSearch.requiresImportExport, undefined);
assert.deepEqual(secondSearch.internationalMarkets, ['Europe']);
assert.notEqual(secondSearch.companyType, firstSearch.companyType);

const refined = applyDiscoveryIntentPatch(firstSearch, { set: { employeeMin: 50 }, clear: ['employeeMax'] });
assert.equal(refined.geography, 'California');
assert.equal(refined.employeeMin, 50);
assert.equal(refined.employeeMax, undefined);
const excluded = applyDiscoveryIntentPatch(refined, { add: { excludedIndustries: ['Food'] } });
assert.deepEqual(excluded.excludedIndustries, ['Food']);
assert.deepEqual(createEmptyDiscoveryIntent().excludedIndustries, []);
assert.equal(determineDiscoveryMode('Find New York software companies', true), 'new');
assert.equal(determineDiscoveryMode('Only show companies above 50 employees', true), 'refine');
assert.equal(determineDiscoveryMode('Exclude food companies', true), 'exclude');
assert.equal(determineDiscoveryMode('Prioritize companies importing from India', true), 'reprioritize');
assert.equal(determineDiscoveryMode('Find 20 more', true), 'expand');

const matchingConstraints = evaluateRequiredConstraints({
  location: 'Los Angeles, California',
  industry: 'Distributor',
  company_description: 'Wholesale distributor',
  employee_count: '50',
  signals: [{
    label: 'Imports from India',
    description: 'The company imports products from suppliers in India.',
    status: 'VERIFIED',
    sourceIds: ['source-1'],
  }],
}, normalizeIntent({
  geography: 'California',
  companyType: 'Distributor',
  employeeMin: 25,
  employeeMax: 100,
  requiresImportExport: true,
  internationalMarkets: ['India'],
}));
assert.ok(
  matchingConstraints.every((evaluation) => evaluation.status === 'passed'),
  'A fully supported candidate should pass every required constraint',
);

const unknownConstraints = evaluateRequiredConstraints({
  location: 'California',
  industry: 'Distributor',
  company_description: 'Wholesale distributor',
  signals: [],
}, normalizeIntent({
  geography: 'California',
  companyType: 'Distributor',
  employeeMin: 25,
  internationalMarkets: ['India'],
}));
assert.ok(
  unknownConstraints.some((evaluation) => evaluation.status === 'unknown'),
  'Missing public evidence should stay in Needs Review',
);

const failedConstraints = evaluateRequiredConstraints({
  location: 'Austin, Texas',
  industry: 'Distributor',
}, normalizeIntent({
  geography: 'California',
  companyType: 'Distributor',
}));
assert.ok(
  failedConstraints.some((evaluation) => evaluation.status === 'failed'),
  'A known geography contradiction should fail the hard constraint',
);

console.log('Discovery contract and deterministic scoring tests passed.');
