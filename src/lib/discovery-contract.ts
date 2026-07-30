export type EvidenceStatus = 'VERIFIED' | 'INFERRED' | 'UNKNOWN';
export type RequestType = 'NEW_DISCOVERY_REQUEST' | 'REFINE_CURRENT_RESULTS' | 'EXPAND_CURRENT_RESULTS' | 'EXCLUDE_RESULTS' | 'CHANGE_PRIORITY';

export type DiscoverySource = {
  id: string;
  title?: string;
  domain: string;
  url: string;
  publishedDate?: string;
  evidenceSummary: string;
};

export type DiscoverySignal = {
  label: string;
  description: string;
  status: EvidenceStatus;
  category?: string;
  sourceIds?: string[];
};

export type TimingSignal = {
  label: string;
  description: string;
  date?: string;
  sourceIds: string[];
};

export type DiscoveryIntent = {
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

export type DiscoveryCandidate = {
  company_name: string;
  website: string;
  location?: string;
  industry?: string;
  employee_count?: string;
  revenue_range?: string;
  company_description?: string;
  confidence?: 'HIGH' | 'MEDIUM' | 'LOW';
  recommendation_summary?: string;
  best_opportunity?: string;
  signals?: DiscoverySignal[];
  sources?: DiscoverySource[];
  why_now?: TimingSignal[];
  recommended_conversation?: string;
  contact_name?: string | null;
  contact_title?: string | null;
  contact_email?: string | null;
  contact_email_status?: 'verified' | 'unverified' | 'not_found';
  contact_profile_url?: string | null;
  contact_source_url?: string | null;
  contact_reason?: string | null;
};

function safeUrl(value: unknown) {
  if (typeof value !== 'string') return '';
  try {
    const parsed = new URL(value);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.toString() : '';
  } catch {
    return '';
  }
}

export function normalizeIntent(value: unknown): DiscoveryIntent {
  const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const strings = (key: string) => Array.isArray(raw[key]) ? (raw[key] as unknown[]).filter((item): item is string => typeof item === 'string') : [];
  const number = (key: string) => typeof raw[key] === 'number' && Number.isFinite(raw[key]) ? Number(raw[key]) : undefined;
  return {
    companyType: typeof raw.companyType === 'string' ? raw.companyType : undefined,
    industry: typeof raw.industry === 'string' ? raw.industry : undefined,
    geography: typeof raw.geography === 'string' ? raw.geography : undefined,
    employeeMin: number('employeeMin'),
    employeeMax: number('employeeMax'),
    revenueRange: typeof raw.revenueRange === 'string' ? raw.revenueRange : undefined,
    internationalMarkets: strings('internationalMarkets'),
    requiresImportExport: typeof raw.requiresImportExport === 'boolean' ? raw.requiresImportExport : undefined,
    supplierSignals: strings('supplierSignals'),
    paymentSignals: strings('paymentSignals'),
    excludedIndustries: strings('excludedIndustries'),
    verifiedEvidenceRequired: typeof raw.verifiedEvidenceRequired === 'boolean' ? raw.verifiedEvidenceRequired : undefined,
    desiredCount: number('desiredCount'),
    otherConstraints: strings('otherConstraints'),
  };
}

export function normalizeCandidate(value: unknown): DiscoveryCandidate | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const website = safeUrl(raw.website);
  if (typeof raw.company_name !== 'string' || !raw.company_name.trim() || !website) return null;
  const sourceInput = Array.isArray(raw.sources) ? raw.sources : [];
  const sources = sourceInput.flatMap((item, index) => {
    if (!item || typeof item !== 'object') return [];
    const source = item as Record<string, unknown>;
    const url = safeUrl(source.url);
    if (!url) return [];
    return [{
      id: typeof source.id === 'string' ? source.id : `source-${index + 1}`,
      title: typeof source.title === 'string' ? source.title : undefined,
      domain: new URL(url).hostname.replace(/^www\./, ''),
      url,
      publishedDate: typeof source.publishedDate === 'string' ? source.publishedDate : undefined,
      evidenceSummary: typeof source.evidenceSummary === 'string' ? source.evidenceSummary : '',
    }];
  });
  const sourceIds = new Set(sources.map((source) => source.id));
  const signals = (Array.isArray(raw.signals) ? raw.signals : []).flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const signal = item as Record<string, unknown>;
    if (typeof signal.label !== 'string') return [];
    const status = ['VERIFIED', 'INFERRED', 'UNKNOWN'].includes(String(signal.status)) ? signal.status as EvidenceStatus : 'UNKNOWN';
    const ids = Array.isArray(signal.sourceIds) ? signal.sourceIds.filter((id): id is string => typeof id === 'string' && sourceIds.has(id)) : [];
    return [{ label: signal.label, description: typeof signal.description === 'string' ? signal.description : '', status: status === 'VERIFIED' && !ids.length ? 'UNKNOWN' as const : status, category: typeof signal.category === 'string' ? signal.category : undefined, sourceIds: ids }];
  });
  const whyNow = (Array.isArray(raw.why_now) ? raw.why_now : []).flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const signal = item as Record<string, unknown>;
    const ids = Array.isArray(signal.sourceIds) ? signal.sourceIds.filter((id): id is string => typeof id === 'string' && sourceIds.has(id)) : [];
    if (typeof signal.label !== 'string' || !ids.length) return [];
    return [{ label: signal.label, description: typeof signal.description === 'string' ? signal.description : '', date: typeof signal.date === 'string' ? signal.date : undefined, sourceIds: ids }];
  });
  return {
    company_name: raw.company_name.trim(),
    website,
    location: typeof raw.location === 'string' ? raw.location : 'Unknown',
    industry: typeof raw.industry === 'string' ? raw.industry : 'Unknown',
    employee_count: typeof raw.employee_count === 'string' ? raw.employee_count : 'Unknown',
    revenue_range: typeof raw.revenue_range === 'string' ? raw.revenue_range : 'Unknown',
    company_description: typeof raw.company_description === 'string' ? raw.company_description : '',
    confidence: ['HIGH', 'MEDIUM', 'LOW'].includes(String(raw.confidence)) ? raw.confidence as 'HIGH' | 'MEDIUM' | 'LOW' : 'LOW',
    recommendation_summary: typeof raw.recommendation_summary === 'string' ? raw.recommendation_summary : '',
    best_opportunity: typeof raw.best_opportunity === 'string' ? raw.best_opportunity : '',
    signals,
    sources,
    why_now: whyNow,
    recommended_conversation: typeof raw.recommended_conversation === 'string' ? raw.recommended_conversation : '',
    contact_name: typeof raw.contact_name === 'string' ? raw.contact_name : null,
    contact_title: typeof raw.contact_title === 'string' ? raw.contact_title : null,
    contact_email: typeof raw.contact_email === 'string' && raw.contact_email_status === 'verified' ? raw.contact_email : null,
    contact_email_status: raw.contact_email_status === 'verified' ? 'verified' : 'not_found',
    contact_profile_url: safeUrl(raw.contact_profile_url) || null,
    contact_source_url: safeUrl(raw.contact_source_url) || null,
    contact_reason: typeof raw.contact_reason === 'string' ? raw.contact_reason : null,
  };
}
