export type SearchIntent = {
  companyType?: string;
  geography?: string;
  employeeMin?: number;
  employeeMax?: number;
  revenueRange?: string;
  internationalMarkets?: string[];
  requiresImportExport?: boolean;
  supplierSignals?: string[];
  paymentSignals?: string[];
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
  internationalSupplierEvidence: 24,
  crossBorderActivity: 16,
  importExportEvidence: 15,
  vendorPaymentLikelihood: 12,
  payInOpportunity: 7,
  payoutOpportunity: 10,
  companySizeFit: 6,
  geographicFit: 5,
  evidenceStrength: 5,
} as const;

function hasSignal(input: ScoreInput, terms: string[], verifiedOnly = false) {
  return (input.signals || []).some((signal) => {
    if (verifiedOnly && signal.status !== 'VERIFIED') return false;
    const text = `${signal.label} ${signal.category || ''}`.toLowerCase();
    return terms.some((term) => text.includes(term));
  });
}

export function calculateFitScore(input: ScoreInput, intent: SearchIntent) {
  const breakdown: Record<string, number> = {};
  breakdown.internationalSupplierEvidence = hasSignal(input, ['supplier', 'sourcing'], true) ? 24 : hasSignal(input, ['supplier', 'sourcing']) ? 12 : 0;
  breakdown.crossBorderActivity = hasSignal(input, ['international', 'global', 'multi-country'], true) ? 16 : hasSignal(input, ['international', 'global']) ? 8 : 0;
  breakdown.importExportEvidence = hasSignal(input, ['import', 'export'], true) ? 15 : hasSignal(input, ['import', 'export']) ? 7 : 0;
  breakdown.vendorPaymentLikelihood = hasSignal(input, ['vendor', 'supplier payment']) ? 12 : 0;
  breakdown.payInOpportunity = hasSignal(input, ['customer payment', 'card', 'collection']) ? 7 : 0;
  breakdown.payoutOpportunity = hasSignal(input, ['payout', 'supplier', 'contractor']) ? 10 : 0;
  breakdown.companySizeFit = input.employee_count && input.employee_count !== 'Unknown' ? 6 : 0;
  breakdown.geographicFit = intent.geography && input.location?.toLowerCase().includes(intent.geography.toLowerCase()) ? 5 : 0;
  const sourcedEvidence = (input.evidence || []).filter((item) => item.source_url).length;
  breakdown.evidenceStrength = sourcedEvidence >= 3 ? 5 : sourcedEvidence >= 1 ? 3 : 0;

  const score = Math.min(100, Object.values(breakdown).reduce((sum, value) => sum + value, 0));
  return {
    score,
    breakdown,
    classification: score >= 80 ? 'STRONG MATCH' : score >= 60 ? 'MODERATE MATCH' : 'NEEDS REVIEW',
  };
}
