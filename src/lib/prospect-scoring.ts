export type SearchIntent = {
  companyType?: string;
  industry?: string;
  geography?: string;
  employeeMin?: number;
  employeeMax?: number;
  revenueRange?: string;
  internationalMarkets?: string[];
  requiresImportExport?: boolean;
  supplierSignals?: string[];
  paymentSignals?: string[];
  excludedIndustries?: string[];
  verifiedEvidenceRequired?: boolean;
  desiredCount?: number;
  otherConstraints?: string[];
};

export type ScoreInput = {
  location?: string;
  employee_count?: string;
  signals?: Array<{ label: string; status: 'VERIFIED' | 'INFERRED' | 'UNKNOWN'; category?: string }>;
  evidence?: Array<{ claim: string; source_url?: string }>;
};

export const FIT_SCORE_WEIGHTS = {
  internationalSupplierEvidence: 18,
  crossBorderActivity: 12,
  importExportEvidence: 12,
  vendorPaymentLikelihood: 10,
  payInOpportunity: 6,
  payoutOpportunity: 9,
  companySizeFit: 7,
  geographicFit: 6,
  multipleCountryOperations: 6,
  evidenceStrength: 8,
  currentTimingSignals: 6,
} as const;

function hasSignal(input: ScoreInput, terms: string[], verifiedOnly = false) {
  return (input.signals || []).some((signal) => {
    if (verifiedOnly && signal.status !== 'VERIFIED') return false;
    const text = `${signal.label} ${signal.category || ''}`.toLowerCase();
    return terms.some((term) => text.includes(term));
  });
}

export function calculateFitScore(input: ScoreInput & { whyNowCount?: number }, intent: SearchIntent) {
  const breakdown: Record<string, number> = {};
  breakdown.internationalSupplierEvidence = hasSignal(input, ['supplier', 'sourcing'], true) ? 18 : hasSignal(input, ['supplier', 'sourcing']) ? 9 : 0;
  breakdown.crossBorderActivity = hasSignal(input, ['international', 'global', 'cross-border'], true) ? 12 : hasSignal(input, ['international', 'global', 'cross-border']) ? 6 : 0;
  breakdown.importExportEvidence = hasSignal(input, ['import', 'export'], true) ? 12 : hasSignal(input, ['import', 'export']) ? 6 : 0;
  breakdown.vendorPaymentLikelihood = hasSignal(input, ['vendor', 'supplier payment']) ? 10 : 0;
  breakdown.payInOpportunity = hasSignal(input, ['customer payment', 'card', 'collection']) ? 6 : 0;
  breakdown.payoutOpportunity = hasSignal(input, ['payout', 'supplier', 'contractor']) ? 9 : 0;
  breakdown.companySizeFit = input.employee_count && input.employee_count !== 'Unknown' ? 7 : 0;
  breakdown.geographicFit = intent.geography && input.location?.toLowerCase().includes(intent.geography.toLowerCase()) ? 6 : 0;
  breakdown.multipleCountryOperations = hasSignal(input, ['multi-country', 'multiple countries'], true) ? 6 : 0;
  const sourcedEvidence = (input.evidence || []).filter((item) => item.source_url).length;
  breakdown.evidenceStrength = sourcedEvidence >= 3 ? 8 : sourcedEvidence >= 1 ? 4 : 0;
  breakdown.currentTimingSignals = input.whyNowCount ? 6 : 0;

  const score = Math.min(100, Object.values(breakdown).reduce((sum, value) => sum + value, 0));
  return {
    score,
    breakdown,
    classification: score >= 80 ? 'STRONG OPPORTUNITY' : score >= 60 ? 'MODERATE OPPORTUNITY' : 'NEEDS REVIEW',
  };
}
