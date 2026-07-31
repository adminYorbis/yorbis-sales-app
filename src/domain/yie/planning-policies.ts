import crypto from 'crypto';
import type { ICPAggregate } from './icp-schemas';
import {
  PlanningIntentPatchSchema,
  PlanningIntentSchema,
  type IntentConflict,
  type IntentCriterion,
  type PlanningIntent,
  type PlanningIntentPatch,
} from './planning-schemas';

const ARRAY_FIELDS = [
  'targetGeographies', 'targetIndustries', 'targetBusinessModels', 'supplierGeographies',
  'customerGeographies', 'paymentPainHypotheses', 'relevantBuyerPersonas', 'buyingTriggers',
  'sourcePreferences', 'confidenceNotes', 'unresolvedAmbiguities',
] as const;

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
function deepFreeze<T>(value: T): Readonly<T> {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}
function stable(value: unknown): string {
  if (value && typeof value === 'object') {
    if (Array.isArray(value)) return `[${value.map(stable).sort().join(',')}]`;
    return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b))
      .map(([key, child]) => `${key}:${stable(child)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
export function deterministicFingerprint(value: unknown) {
  return crypto.createHash('sha256').update(stable(value)).digest('hex');
}
function criterionKey(value: IntentCriterion) {
  return `${value.kind}|${value.field}|${value.operator}|${stable(value.value)}`;
}
function dedupeCriteria(values: IntentCriterion[]) {
  return [...new Map(values.map((value) => [criterionKey(value), value])).values()];
}

export function emptyPlanningIntent(input: Partial<PlanningIntent> = {}) {
  return PlanningIntentSchema.parse(input);
}

export function icpDefaults(icp: ICPAggregate): PlanningIntent {
  const mapCriterion = (criterion: ICPAggregate['criteria'][number]): IntentCriterion => ({
    id: criterion.id,
    kind: criterion.kind,
    field: criterion.field,
    operator: criterion.operator,
    value: criterion.value,
    unknownHandling: criterion.unknownHandling,
    description: criterion.description,
    origin: 'ICP',
    sourceReference: `${icp.definition.id}@${icp.version.version}`,
  });
  return PlanningIntentSchema.parse({
    targetGeographies: [icp.version.geographyDefinition],
    targetIndustries: icp.version.industryDefinitions,
    targetBusinessModels: icp.version.businessModelDefinitions,
    paymentPainHypotheses: icp.painHypotheses.map((item) => item.value),
    relevantBuyerPersonas: icp.personas.map((item) => item.definitionId),
    buyingTriggers: icp.triggers.map((item) => item.definitionId),
    requiredConstraints: icp.criteria.filter((item) => item.kind === 'REQUIRED').map(mapCriterion),
    preferredCriteria: icp.criteria.filter((item) => item.kind === 'PREFERRED').map(mapCriterion),
    exclusions: icp.criteria.filter((item) => item.kind === 'EXCLUDED').map(mapCriterion),
    sourcePreferences: icp.sourceRecommendations.map((item) => item.value),
    confidenceNotes: [`Defaults from ${icp.version.name} v${icp.version.version}.`],
  });
}

function valuesConflict(left: IntentCriterion, right: IntentCriterion) {
  if (left.field !== right.field) return false;
  if (left.operator === 'EQUALS' && right.operator === 'EQUALS') return stable(left.value) !== stable(right.value);
  if (left.operator === 'EQUALS' && right.operator === 'NOT_EQUALS') return stable(left.value) === stable(right.value);
  if (left.operator === 'NOT_EQUALS' && right.operator === 'EQUALS') return stable(left.value) === stable(right.value);
  return false;
}

export function mergeExplicitIntentWithICP(explicitInput: Partial<PlanningIntent>, icp: ICPAggregate | null) {
  const explicit = PlanningIntentSchema.parse(explicitInput);
  if (!icp) return {
    intent: deepFreeze(explicit),
    conflicts: [] as IntentConflict[],
    overriddenDefaults: [] as string[],
    warnings: ['No ICP was pinned; planning uses a structured ad hoc intent.'],
  };
  const defaults = icpDefaults(icp);
  const conflicts: IntentConflict[] = [];
  for (const user of [...explicit.requiredConstraints, ...explicit.exclusions]) {
    for (const policy of [...defaults.requiredConstraints, ...defaults.exclusions]) {
      if (valuesConflict(user, policy)) conflicts.push({
        code: 'HARD_CONSTRAINT_CONFLICT',
        field: user.field,
        severity: 'HARD',
        userValue: user.value,
        policyValue: policy.value,
        explanation: `Explicit user ${user.kind.toLowerCase()} conflicts with pinned ICP ${policy.kind.toLowerCase()}.`,
      });
    }
  }
  const explicitRequiredFields = new Set(explicit.requiredConstraints.map((item) => item.field));
  const overriddenDefaults = defaults.preferredCriteria
    .filter((item) => explicitRequiredFields.has(item.field))
    .map((item) => `ICP preference ${item.field} was overridden by an explicit user requirement.`);
  const merged = PlanningIntentSchema.parse({
    ...defaults,
    ...explicit,
    targetGeographies: explicit.targetGeographies.length ? explicit.targetGeographies : defaults.targetGeographies,
    targetIndustries: explicit.targetIndustries.length ? explicit.targetIndustries : defaults.targetIndustries,
    targetBusinessModels: explicit.targetBusinessModels.length ? explicit.targetBusinessModels : defaults.targetBusinessModels,
    paymentPainHypotheses: unique([...explicit.paymentPainHypotheses, ...defaults.paymentPainHypotheses]),
    relevantBuyerPersonas: unique([...explicit.relevantBuyerPersonas, ...defaults.relevantBuyerPersonas]),
    buyingTriggers: unique([...explicit.buyingTriggers, ...defaults.buyingTriggers]),
    sourcePreferences: unique([...explicit.sourcePreferences, ...defaults.sourcePreferences]),
    requiredConstraints: dedupeCriteria([...explicit.requiredConstraints, ...defaults.requiredConstraints]),
    preferredCriteria: dedupeCriteria([
      ...explicit.preferredCriteria,
      ...defaults.preferredCriteria.filter((item) => !explicitRequiredFields.has(item.field)),
    ]),
    exclusions: dedupeCriteria([...explicit.exclusions, ...defaults.exclusions]),
    confidenceNotes: unique([...explicit.confidenceNotes, ...defaults.confidenceNotes]),
  });
  return {
    intent: deepFreeze(merged),
    conflicts,
    overriddenDefaults,
    warnings: conflicts.length ? ['Manual review is required for hard intent conflicts.'] : [],
  };
}

function applyCommon(base: PlanningIntent, patch: PlanningIntentPatch) {
  const next = structuredClone(base);
  if (patch.set) Object.assign(next, patch.set);
  for (const field of ARRAY_FIELDS) {
    const additions = patch.add?.[field] ?? [];
    const removals = patch.remove?.[field] ?? [];
    next[field] = unique([...next[field], ...additions].filter((value) => !removals.includes(value))) as never;
  }
  for (const field of ['requiredConstraints', 'preferredCriteria', 'exclusions'] as const) {
    next[field] = dedupeCriteria([...next[field], ...(patch.add?.[field] ?? [])]);
  }
  return next;
}

export function applyPlanningTransition(input: {
  mode: 'NEW' | 'REFINE' | 'EXPAND' | 'EXCLUDE' | 'RESTORE';
  base?: PlanningIntent;
  proposed: PlanningIntent;
  patch?: PlanningIntentPatch | null;
  restoreSnapshot?: PlanningIntent;
}) {
  if (input.mode === 'NEW') return deepFreeze(PlanningIntentSchema.parse(input.proposed));
  if (input.mode === 'RESTORE') {
    if (!input.restoreSnapshot) throw new Error('RESTORE requires an exact historical intent snapshot.');
    return deepFreeze(PlanningIntentSchema.parse(structuredClone(input.restoreSnapshot)));
  }
  if (!input.base) throw new Error(`${input.mode} requires an authoritative prior intent.`);
  const patch = PlanningIntentPatchSchema.parse(input.patch ?? {});
  if (input.mode === 'EXCLUDE') {
    if (patch.set || patch.remove || Object.keys(patch.add ?? {}).some((key) => key !== 'exclusions')) {
      throw new Error('EXCLUDE may only add explicit exclusions.');
    }
  }
  if (input.mode === 'EXPAND') {
    if (patch.remove || patch.add?.exclusions?.length || patch.set?.employeeSize || patch.set?.revenueRange) {
      throw new Error('EXPAND cannot remove criteria, add exclusions, or replace ranges.');
    }
    const allowed = new Set(patch.broadenedFields ?? []);
    const changed = Object.keys(patch.add ?? {});
    if (changed.some((field) => !allowed.has(field))) throw new Error('EXPAND must name every broadened field.');
  }
  const next = applyCommon(input.base, patch);
  if (input.mode === 'EXPAND') next.exclusions = structuredClone(input.base.exclusions);
  return deepFreeze(PlanningIntentSchema.parse(next));
}

export function inferPlanningIntent(rawInput: string): PlanningIntent {
  const text = rawInput.toLowerCase();
  const geographies = ['California', 'New York', 'Texas', 'United States', 'Southeast Asia', 'India']
    .filter((value) => text.includes(value.toLowerCase()));
  const industries = [
    ['food', 'Food'], ['beverage', 'Beverage'], ['produce', 'Produce'], ['electronics', 'Electronics'],
    ['property management', 'Property management'], ['staffing', 'Staffing'], ['construction', 'Construction'],
  ].filter(([needle]) => text.includes(needle)).map(([, value]) => value);
  const models = ['importer', 'exporter', 'distributor', 'wholesale', 'manufacturer', 'marketplace']
    .filter((value) => text.includes(value));
  const size = rawInput.match(/(\d+)\s*(?:-|–|to)\s*(\d+)\s+employees?/i);
  return PlanningIntentSchema.parse({
    targetGeographies: geographies,
    targetIndustries: industries,
    targetBusinessModels: models,
    employeeSize: size ? { minimum: Number(size[1]), maximum: Number(size[2]) } : null,
    internationalActivity: /\binternational|global|overseas|foreign\b/i.test(rawInput) ? 'REQUIRED' : 'UNSPECIFIED',
    importingActivity: /\bimport|sourc/i.test(rawInput) ? 'REQUIRED' : 'UNSPECIFIED',
    exportingActivity: /\bexport/i.test(rawInput) ? 'REQUIRED' : 'UNSPECIFIED',
  });
}
