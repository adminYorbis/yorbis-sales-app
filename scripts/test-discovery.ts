import assert from 'node:assert/strict';
import { normalizeCandidate, normalizeIntent } from '../src/lib/discovery-contract';
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

console.log('Discovery contract and deterministic scoring tests passed.');
