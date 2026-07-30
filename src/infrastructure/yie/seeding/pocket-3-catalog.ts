import type { KnowledgeKind } from '@/domain/yie/knowledge-schemas';
import type { ICPAggregate, ICPCriterion } from '@/domain/yie/icp-schemas';

export const POCKET_3_SEED_VERSION = 'pocket-3-v1';
export const SEED_AT = '2026-07-30T00:00:00.000Z';
export const SEED_ACTOR = 'approved-manual-seed';
export const SOLUTION_ID = 'solution-yorbis-global-payments-platform';

export function stableId(prefix: string, name: string) {
  return `${prefix}-${name.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
}

export type SeedKnowledgeItem = {
  id: string;
  kind: KnowledgeKind;
  name: string;
  description: string;
  attributes?: Record<string, unknown>;
};

const capabilities = [
  'Global fiat payments',
  'Cross-border supplier payments',
  'International customer collections',
  'Multi-currency wallets',
  'FX support and pricing',
  'Domestic transfers',
  'International transfers',
  'Stablecoin-enabled payment capabilities',
  'Card processing',
  'Payment-provider orchestration',
  'Consolidated payment visibility',
  'Pay-in and payout workflows',
];
const problems = [
  'Slow international supplier-payment processes',
  'Fragmented payment-provider operations',
  'Lack of consolidated wallet visibility',
  'Complex international AP workflows',
  'Complex international AR workflows',
  'Manual vendor-payment operations',
  'Difficulty collecting from overseas customers',
  'Contractor and marketplace payout complexity',
  'Limited payment-method flexibility',
  'Long pay-in to payout workflows',
  'Lack of consolidated payment status and visibility',
  'Operational burden from multiple provider integrations',
];
const personas = [
  'Chief Financial Officer', 'Controller', 'VP of Finance', 'Finance Director', 'Treasurer',
  'Treasury Manager', 'Head of Payments', 'Accounts Payable Manager', 'Accounts Receivable Manager',
  'Chief Operating Officer', 'Founder or CEO at smaller companies',
];
const triggers = [
  'International expansion', 'New overseas suppliers', 'New foreign customers',
  'Opening a warehouse or distribution center', 'Entering a new country', 'Hiring a CFO',
  'Hiring a Controller', 'Hiring AP staff', 'Hiring treasury staff', 'ERP implementation',
  'ERP migration', 'NetSuite adoption', 'SAP adoption', 'Oracle adoption', 'Sage Intacct adoption',
  'Microsoft Dynamics adoption', 'Acquisition', 'Rapid growth', 'Finance transformation',
  'Treasury modernization', 'Payment-provider dissatisfaction',
  'New marketplace or contractor volume', 'Increased import or export activity',
  'New product line', 'Distribution expansion', 'Warehouse expansion',
  'FDA or import-related activity',
];
const negatives = [
  'Purely local cash business', 'Domestic-only microbusiness', 'Consumer hobby business',
  'Inactive or dissolved company', 'No functioning website or verifiable operations',
  'No meaningful business-payment activity', 'Business outside approved product or risk appetite',
  'Single-location local business with no cross-border or scalable payment need',
];

function items(kind: KnowledgeKind, prefix: string, names: string[]): SeedKnowledgeItem[] {
  return names.map((name) => ({
    id: stableId(prefix, name),
    kind,
    name,
    description: name,
    attributes: {},
  }));
}

export const POCKET_3_KNOWLEDGE: SeedKnowledgeItem[] = [
  {
    id: SOLUTION_ID,
    kind: 'SOLUTION_PROFILE',
    name: 'Yorbis Global Payments Platform',
    description: 'Yorbis helps businesses collect, hold, convert, route, and pay money across domestic and international payment workflows through a consolidated platform.',
    attributes: {
      coverageDisclaimer: 'Geographic, currency, pricing, settlement, licensing, savings, and regulatory coverage require separately approved product data.',
    },
  },
  ...items('CAPABILITY', 'capability', capabilities),
  ...items('PROBLEM_SOLVED', 'problem', problems),
  ...items('BUYER_PERSONA', 'persona', personas),
  ...items('BUYING_TRIGGER', 'trigger', triggers),
  ...items('NEGATIVE_FIT_SIGNAL', 'negative', negatives),
];

const capability = (name: string) => ({ definitionId: stableId('capability', name), version: 1, priority: 0 });
const persona = (name: string, priority: number) => ({ definitionId: stableId('persona', name), version: 1, priority });
const trigger = (name: string, priority: number) => ({ definitionId: stableId('trigger', name), version: 1, priority });

type IcpSeedInput = {
  name: string;
  description: string;
  targetProblem: string;
  geography: string;
  industries: string[];
  businessModels: string[];
  companySize?: string;
  required?: Array<[string, ICPCriterion['operator'], ICPCriterion['value'], ICPCriterion['unknownHandling'], string]>;
  preferred?: Array<[string, ICPCriterion['operator'], ICPCriterion['value'], string]>;
  excluded?: string[];
  capabilityNames?: string[];
  personaNames?: string[];
  triggerNames?: string[];
  pains?: string[];
  sources?: string[];
};

const commonSources = [
  'Official company websites',
  'Company about and operations pages',
  'Credible business publications',
  'Job postings',
  'Public professional profiles',
  'Trade association and exhibitor directories',
];

function criterion(
  icpId: string,
  index: number,
  kind: ICPCriterion['kind'],
  field: string,
  operator: ICPCriterion['operator'],
  value: ICPCriterion['value'],
  unknownHandling: ICPCriterion['unknownHandling'],
  description: string,
): ICPCriterion {
  return {
    id: `${icpId}-criterion-${kind.toLowerCase()}-${index + 1}`,
    icpDefinitionId: icpId,
    icpVersion: 1,
    kind,
    field,
    operator,
    value,
    unknownHandling,
    description,
    priority: index,
  };
}

function createIcp(input: IcpSeedInput): ICPAggregate {
  const id = stableId('icp', input.name);
  const required = input.required ?? [
    ['operating_status', 'EQUALS', 'ACTIVE', 'FAIL', 'Company must have verifiable active operations.'],
    ['industry', 'MATCHES_ANY', input.industries, 'REVIEW', 'Company must fit a target industry.'],
    ['payment_need', 'EXISTS', null, 'REVIEW', 'Evidence of scalable or cross-border business-payment activity is required.'],
  ];
  const preferred = input.preferred ?? [
    ['employee_count', 'BETWEEN', { minimum: 20, maximum: 500 }, 'Company size is preferred, not mandatory.'],
    ['finance_function', 'EXISTS', null, 'An identifiable finance function improves reachability.'],
  ];
  const excluded = input.excluded ?? [
    'Inactive or dissolved company', 'Domestic-only microbusiness',
    'No functioning website or verifiable operations', 'No meaningful business-payment activity',
  ];
  const criteria = [
    ...required.map((item, index) => criterion(id, index, 'REQUIRED', item[0], item[1], item[2], item[3], item[4])),
    ...preferred.map((item, index) => criterion(id, index, 'PREFERRED', item[0], item[1], item[2], 'ALLOW', item[3])),
    ...excluded.map((value, index) => criterion(id, index, 'EXCLUDED', 'negative_fit_signal', 'EQUALS', value, 'ALLOW', value)),
  ];
  const personaNames = input.personaNames ?? ['Chief Financial Officer', 'Controller', 'VP of Finance', 'Chief Operating Officer'];
  const triggerNames = input.triggerNames ?? ['International expansion', 'Rapid growth', 'Finance transformation', 'ERP implementation'];
  return {
    definition: { id, normalizedName: input.name.toLowerCase(), createdAt: SEED_AT },
    version: {
      definitionId: id, version: 1, status: 'ACTIVE', name: input.name,
      description: input.description, targetProblem: input.targetProblem,
      solutionDefinitionId: SOLUTION_ID, solutionVersion: 1,
      geographyDefinition: input.geography, industryDefinitions: input.industries,
      businessModelDefinitions: input.businessModels,
      companySizeDefinition: input.companySize ?? 'Preferred 20 to 500 employees; review outside range.',
      scoringConfigurationReference: 'future-deterministic-scoring-policy',
      effectiveAt: SEED_AT, createdAt: SEED_AT, createdBy: SEED_ACTOR,
      approvedAt: SEED_AT, approvedBy: SEED_ACTOR, retiredAt: null,
      provenance: { source: 'approved_business_context', method: 'manual_seed', seedVersion: POCKET_3_SEED_VERSION },
      changeSummary: 'Initial approved Pocket 3 ICP seed.',
    },
    criteria,
    capabilities: (input.capabilityNames ?? ['Cross-border supplier payments', 'International transfers', 'FX support and pricing', 'Consolidated payment visibility']).map(capability),
    personas: personaNames.map((name, index) => persona(name, index + 1)),
    triggers: triggerNames.map((name, index) => trigger(name, index + 1)),
    painHypotheses: (input.pains ?? [input.targetProblem]).map((value, index) => ({ id: `${id}-pain-${index + 1}`, value, priority: index })),
    sourceRecommendations: (input.sources ?? commonSources).map((value, index) => ({ id: `${id}-source-${index + 1}`, value, priority: index })),
  };
}

const californiaFood = createIcp({
  name: 'California Food and Beverage Importers',
  description: 'Operating food and beverage businesses with meaningful California operations and verifiable international sourcing or import activity.',
  targetProblem: 'Businesses importing food or beverage products may face recurring international supplier payments, foreign exchange exposure, fragmented payment providers, AP complexity, and the need for better payment visibility.',
  geography: 'California headquarters or meaningful California operation',
  industries: ['Food', 'Beverage'],
  businessModels: ['Wholesale', 'Distribution', 'Manufacturing', 'Importing', 'Brand owner'],
  required: [
    ['operating_status', 'EQUALS', 'ACTIVE', 'FAIL', 'Active operating company.'],
    ['industry', 'MATCHES_ANY', ['Food', 'Beverage'], 'FAIL', 'Food or beverage industry.'],
    ['geography', 'CONTAINS', 'California', 'REVIEW', 'California headquarters or meaningful operation.'],
    ['international_sourcing', 'EXISTS', null, 'FAIL', 'Imports, foreign suppliers, international sourcing, or international distribution.'],
    ['b2b_activity', 'EXISTS', null, 'REVIEW', 'Meaningful B2B operating activity.'],
  ],
  preferred: [
    ['employee_count', 'BETWEEN', { minimum: 20, maximum: 500 }, 'Preferred 20 to 500 employees.'],
    ['business_model', 'MATCHES_ANY', ['Wholesale', 'Distribution', 'Manufacturing', 'Importing', 'Brand owner'], 'Preferred operating models.'],
    ['supplier_count', 'GREATER_THAN_OR_EQUAL', 2, 'Multiple suppliers preferred.'],
    ['supplier_country_count', 'GREATER_THAN_OR_EQUAL', 2, 'Multiple supplier countries preferred.'],
    ['finance_function', 'EXISTS', null, 'Identifiable finance function.'],
    ['financial_decision_maker', 'EXISTS', null, 'Identifiable financial decision maker.'],
    ['recurring_supplier_payments', 'EXISTS', null, 'Recurring supplier-payment activity.'],
    ['operational_complexity', 'EXISTS', null, 'Complexity beyond a local storefront.'],
  ],
  excluded: [
    'Restaurant', 'Local grocery store', 'Consumer-only storefront', 'Domestic-only microbusiness',
    'Inactive company', 'Non-operating brand with no verifiable company activity',
    'Business with no meaningful international sourcing or payment need',
  ],
  personaNames: [
    'Chief Financial Officer', 'Controller', 'VP of Finance', 'Finance Director',
    'Treasury Manager', 'Accounts Payable Manager', 'Chief Operating Officer',
    'Founder or CEO at smaller companies',
  ],
  triggerNames: [
    'Warehouse expansion', 'International expansion', 'New product line', 'New overseas suppliers',
    'FDA or import-related activity', 'Hiring a Controller', 'Hiring AP staff',
    'ERP implementation', 'Acquisition', 'Distribution expansion',
  ],
  pains: [
    'Recurring international supplier payments and FX exposure',
    'Fragmented providers and international AP complexity',
    'Need for consolidated payment status and visibility',
  ],
  sources: [
    'Official company websites', 'Company about and sourcing pages', 'Product catalogs',
    'Trade association directories', 'Trade-show exhibitor directories',
    'Regulatory and government registries where lawfully accessible',
    'Credible business publications', 'Job postings', 'Warehouse and expansion announcements',
    'Public professional profiles', 'Import-related public records where permitted',
  ],
});

export const POCKET_3_ICPS: ICPAggregate[] = [
  californiaFood,
  createIcp({ name: 'Produce Importers', description: 'Produce import and distribution businesses.', targetProblem: 'Recurring payments to overseas growers and suppliers create cross-border AP and visibility needs.', geography: 'United States', industries: ['Produce', 'Food distribution'], businessModels: ['Importer', 'Distributor', 'Wholesaler'] }),
  createIcp({ name: 'Consumer Goods Importers', description: 'Consumer-goods businesses sourcing internationally.', targetProblem: 'International sourcing can create supplier-payment, FX, and provider-fragmentation complexity.', geography: 'United States', industries: ['Consumer goods'], businessModels: ['Importer', 'Distributor', 'Brand owner'] }),
  createIcp({ name: 'Industrial Equipment Importers', description: 'Industrial machinery and equipment importers.', targetProblem: 'High-value global vendor payments require visibility and flexible international payment workflows.', geography: 'United States', industries: ['Industrial equipment', 'Machinery'], businessModels: ['Importer', 'Distributor'] }),
  createIcp({ name: 'Medical Device Importers', description: 'Operating medical-device import and distribution companies.', targetProblem: 'International supplier payments and operational controls create complex cross-border workflows.', geography: 'United States', industries: ['Medical devices'], businessModels: ['Importer', 'Distributor'] }),
  createIcp({ name: 'Textile and Apparel Importers', description: 'Apparel and textile businesses sourcing overseas.', targetProblem: 'Multi-supplier international sourcing creates FX, AP, and payment-status complexity.', geography: 'United States', industries: ['Textiles', 'Apparel'], businessModels: ['Importer', 'Brand owner', 'Distributor'] }),
  createIcp({ name: 'Furniture Importers', description: 'Furniture importers, wholesalers, and brands.', targetProblem: 'Overseas supplier payments and long supply chains require consolidated payment visibility.', geography: 'United States', industries: ['Furniture', 'Home goods'], businessModels: ['Importer', 'Wholesaler', 'Brand owner'] }),
  createIcp({ name: 'Electronics Importers', description: 'Electronics businesses sourcing internationally.', targetProblem: 'Frequent international vendor payments and FX exposure create treasury and AP complexity.', geography: 'United States', industries: ['Electronics'], businessModels: ['Importer', 'Distributor', 'Manufacturer'] }),
  createIcp({ name: 'Food Exporters', description: 'Food businesses selling to overseas customers.', targetProblem: 'International customer collections and payment routing complicate AR operations.', geography: 'United States', industries: ['Food', 'Agriculture'], businessModels: ['Exporter', 'Manufacturer', 'Distributor'], capabilityNames: ['International customer collections', 'Global fiat payments', 'FX support and pricing', 'Consolidated payment visibility'] }),
  createIcp({ name: 'Global Manufacturers', description: 'Manufacturers operating global supplier or customer networks.', targetProblem: 'Global pay-in and payout workflows create fragmented AP, AR, and treasury operations.', geography: 'Global operations with approved service fit', industries: ['Manufacturing'], businessModels: ['Manufacturer'], capabilityNames: ['Cross-border supplier payments', 'International customer collections', 'Pay-in and payout workflows', 'Payment-provider orchestration'] }),
  createIcp({ name: 'Property Management Companies', description: 'Property managers collecting payments and paying vendor networks.', targetProblem: 'High-volume collections and vendor payouts create reconciliation and visibility burden.', geography: 'United States', industries: ['Property management', 'Real estate operations'], businessModels: ['Property manager', 'Real estate operator'], capabilityNames: ['Card processing', 'Domestic transfers', 'Pay-in and payout workflows', 'Consolidated payment visibility'] }),
  createIcp({ name: 'Accounting and Business Management Firms', description: 'Firms managing payments for business clients.', targetProblem: 'Multi-client payables and collections create provider and visibility complexity.', geography: 'United States', industries: ['Accounting', 'Business management'], businessModels: ['Professional services', 'Client payment operator'] }),
  createIcp({ name: 'Staffing Companies With International Contractors', description: 'Staffing firms paying international contractor workforces.', targetProblem: 'Contractor payouts across markets create payment-method, routing, and status complexity.', geography: 'United States or approved operating markets', industries: ['Staffing', 'Recruiting'], businessModels: ['Staffing platform', 'Agency'], capabilityNames: ['International transfers', 'Global fiat payments', 'Stablecoin-enabled payment capabilities', 'Consolidated payment visibility'], triggerNames: ['New marketplace or contractor volume', 'International expansion', 'Rapid growth', 'Payment-provider dissatisfaction'] }),
  createIcp({ name: 'Construction and Engineering Companies With Global Vendors', description: 'Construction and engineering operators with international vendors.', targetProblem: 'Global vendor and project payments create AP, FX, and payment-visibility complexity.', geography: 'United States with global vendors', industries: ['Construction', 'Engineering'], businessModels: ['Project operator', 'Contractor', 'Engineering firm'] }),
  createIcp({ name: 'Digital Marketplaces and Platforms', description: 'Platforms collecting customer funds and paying sellers or contractors.', targetProblem: 'Pay-in to payout workflows and provider orchestration create operational complexity at scale.', geography: 'Approved operating markets', industries: ['Marketplace', 'Software platform'], businessModels: ['Digital marketplace', 'Platform'], capabilityNames: ['Pay-in and payout workflows', 'Card processing', 'Payment-provider orchestration', 'Consolidated payment visibility'], triggerNames: ['New marketplace or contractor volume', 'Rapid growth', 'International expansion', 'Payment-provider dissatisfaction'] }),
];
