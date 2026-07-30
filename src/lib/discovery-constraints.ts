import type { DiscoveryIntent } from './discovery-contract';

export type ConstraintEvaluation = {
  constraint: string;
  status: 'passed' | 'failed' | 'unknown';
  explanation: string;
  sourceIds: string[];
};

type CandidateInput = {
  location?: string;
  industry?: string;
  company_description?: string;
  employee_count?: string;
  signals?: Array<{ label: string; description?: string; status: 'VERIFIED' | 'INFERRED' | 'UNKNOWN'; sourceIds?: string[] }>;
};

function text(input: CandidateInput) {
  return `${input.industry || ''} ${input.company_description || ''} ${(input.signals || []).map((signal) => `${signal.label} ${signal.description || ''}`).join(' ')}`.toLowerCase();
}

export function evaluateRequiredConstraints(candidate: CandidateInput, intent: DiscoveryIntent): ConstraintEvaluation[] {
  const evaluations: ConstraintEvaluation[] = [];
  const candidateText = text(candidate);
  if (intent.geography) {
    const location = (candidate.location || '').toLowerCase();
    evaluations.push({
      constraint: `Location: ${intent.geography}`,
      status: !location || location === 'unknown' ? 'unknown' : location.includes(intent.geography.toLowerCase()) ? 'passed' : 'failed',
      explanation: !location || location === 'unknown' ? 'Public location evidence was unavailable.' : `Reported location: ${candidate.location}.`,
      sourceIds: [],
    });
  }
  const type = intent.industry || intent.companyType;
  if (type) {
    evaluations.push({
      constraint: `Company type: ${type}`,
      status: candidateText.includes(type.toLowerCase()) ? 'passed' : candidate.industry && candidate.industry !== 'Unknown' ? 'failed' : 'unknown',
      explanation: candidate.industry && candidate.industry !== 'Unknown' ? `Reported industry: ${candidate.industry}.` : 'Industry could not be verified.',
      sourceIds: [],
    });
  }
  if (intent.employeeMin !== undefined || intent.employeeMax !== undefined) {
    const numbers = candidate.employee_count?.match(/\d[\d,]*/g)?.map((value) => Number(value.replaceAll(',', ''))) || [];
    const minimum = numbers[0];
    const maximum = numbers[1] ?? numbers[0];
    const passed = minimum !== undefined
      && (intent.employeeMin === undefined || maximum >= intent.employeeMin)
      && (intent.employeeMax === undefined || minimum <= intent.employeeMax);
    evaluations.push({
      constraint: `Employee range: ${intent.employeeMin ?? 'any'}–${intent.employeeMax ?? 'any'}`,
      status: minimum === undefined ? 'unknown' : passed ? 'passed' : 'failed',
      explanation: minimum === undefined ? 'No reliable employee range was found.' : `Public estimate: ${candidate.employee_count}.`,
      sourceIds: [],
    });
  }
  if (intent.requiresImportExport) {
    const matching = (candidate.signals || []).filter((signal) => /import|export/i.test(`${signal.label} ${signal.description || ''}`));
    const verified = matching.find((signal) => signal.status === 'VERIFIED');
    evaluations.push({
      constraint: 'Import/export activity',
      status: verified ? 'passed' : 'unknown',
      explanation: verified ? verified.description || verified.label : 'Import/export activity was not verified by a cited source.',
      sourceIds: verified?.sourceIds || [],
    });
  }
  for (const market of intent.internationalMarkets || []) {
    const matching = (candidate.signals || []).filter((signal) => `${signal.label} ${signal.description || ''}`.toLowerCase().includes(market.toLowerCase()));
    const verified = matching.find((signal) => signal.status === 'VERIFIED');
    evaluations.push({
      constraint: `International market: ${market}`,
      status: verified ? 'passed' : 'unknown',
      explanation: verified ? verified.description || verified.label : `No cited source verified activity involving ${market}.`,
      sourceIds: verified?.sourceIds || [],
    });
  }
  return evaluations;
}
