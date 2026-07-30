import type {
  DiscoveryIntent,
  DiscoveryIntentPatch,
  IntentTransitionValidation,
} from './contracts';
import type { DiscoveryMode, LegacyDiscoveryMode } from './enums';
import { mapLegacyModeValue } from './enums';
import {
  DiscoveryIntentPatchSchema,
  DiscoveryIntentSchema,
  PATCH_ARRAY_FIELDS,
} from './schemas';

type ArrayField = (typeof PATCH_ARRAY_FIELDS)[number];

export type NewIntentInput = {
  id: string;
  rawRequest: string;
  selectedIcp?: DiscoveryIntent['selectedIcp'];
  industries?: string[];
  geographies?: string[];
  companySize?: DiscoveryIntent['companySize'];
  businessModels?: string[];
  requiredSignals?: string[];
  preferredSignals?: string[];
  excludedSignals?: string[];
  buyerRoles?: string[];
  desiredResultCount?: number;
};

export type DerivedIntentContext = {
  id: string;
  rawRequest: string;
};

export type ExpandPatch = {
  add?: Partial<Pick<DiscoveryIntent, ArrayField>>;
  companySize?: DiscoveryIntent['companySize'];
  desiredResultCount?: number;
};

export type ExcludePatch = {
  excludedSignals: string[];
};

export type ExpandedIntent = {
  intent: Readonly<DiscoveryIntent>;
  widenedFields: Array<ArrayField | 'companySize' | 'desiredResultCount'>;
};

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

function nextBase(base: DiscoveryIntent, context: DerivedIntentContext, mode: DiscoveryMode): DiscoveryIntent {
  return {
    ...base,
    id: context.id,
    rawRequest: context.rawRequest,
    mode,
    parentIntentId: base.id,
    sessionId: base.sessionId ?? null,
    version: base.version + 1,
    widenedFields: [],
  };
}

function applyArrayOperations(
  intent: DiscoveryIntent,
  patch: DiscoveryIntentPatch,
) {
  for (const field of PATCH_ARRAY_FIELDS) {
    const current = new Set(intent[field]);
    for (const value of patch.add?.[field] ?? []) current.add(value);
    for (const value of patch.remove?.[field] ?? []) current.delete(value);
    intent[field] = unique([...current]);
  }
}

export function createNewIntent(input: NewIntentInput): Readonly<DiscoveryIntent> {
  const intent = DiscoveryIntentSchema.parse({
    id: input.id,
    rawRequest: input.rawRequest,
    mode: 'NEW',
    selectedIcp: input.selectedIcp ?? null,
    industries: unique(input.industries ?? []),
    geographies: unique(input.geographies ?? []),
    companySize: input.companySize ?? null,
    businessModels: unique(input.businessModels ?? []),
    requiredSignals: unique(input.requiredSignals ?? []),
    preferredSignals: unique(input.preferredSignals ?? []),
    excludedSignals: unique(input.excludedSignals ?? []),
    buyerRoles: unique(input.buyerRoles ?? []),
    desiredResultCount: input.desiredResultCount ?? 25,
    parentIntentId: null,
    sessionId: null,
    version: 1,
    widenedFields: [],
  });
  return deepFreeze(intent);
}

export function applyRefinePatch(
  authoritativeBase: DiscoveryIntent,
  untrustedPatch: unknown,
  context: DerivedIntentContext,
): Readonly<DiscoveryIntent> {
  const base = DiscoveryIntentSchema.parse(authoritativeBase);
  const patch = DiscoveryIntentPatchSchema.parse(untrustedPatch);
  const next = nextBase(base, context, 'REFINE');

  if (patch.set?.selectedIcp !== undefined) next.selectedIcp = patch.set.selectedIcp;
  if (patch.set?.companySize !== undefined) next.companySize = patch.set.companySize;
  if (patch.set?.desiredResultCount !== undefined) next.desiredResultCount = patch.set.desiredResultCount;
  for (const field of patch.clear ?? []) {
    if (field === 'selectedIcp' || field === 'companySize') next[field] = null;
    else next[field] = [];
  }
  applyArrayOperations(next, patch);
  return deepFreeze(DiscoveryIntentSchema.parse(next));
}

function widenedCompanySize(
  base: DiscoveryIntent['companySize'],
  proposed: DiscoveryIntent['companySize'],
) {
  if (!proposed) return base ?? null;
  if (!base) return proposed;
  const minimum = proposed.minimum ?? base.minimum;
  const maximum = proposed.maximum ?? base.maximum;
  if (base.minimum !== undefined && minimum !== undefined && minimum > base.minimum) {
    throw new Error('EXPAND cannot narrow the company-size minimum.');
  }
  if (base.maximum !== undefined && maximum !== undefined && maximum < base.maximum) {
    throw new Error('EXPAND cannot narrow the company-size maximum.');
  }
  return { minimum, maximum };
}

export function applyExpandPatch(
  authoritativeBase: DiscoveryIntent,
  untrustedPatch: unknown,
  context: DerivedIntentContext,
): ExpandedIntent {
  const base = DiscoveryIntentSchema.parse(authoritativeBase);
  const patch = untrustedPatch as ExpandPatch;
  const allowedKeys = new Set(['add', 'companySize', 'desiredResultCount']);
  if (!patch || typeof patch !== 'object' || Object.keys(patch).some((key) => !allowedKeys.has(key))) {
    throw new Error('EXPAND patch contains an unsupported operation.');
  }
  const add = patch.add ?? {};
  if (Object.keys(add).some((key) => !PATCH_ARRAY_FIELDS.includes(key as ArrayField))) {
    throw new Error('EXPAND patch contains an unsupported field.');
  }

  const next = nextBase(base, context, 'EXPAND');
  const widenedFields: ExpandedIntent['widenedFields'] = [];
  for (const field of PATCH_ARRAY_FIELDS) {
    const values = add[field] ?? [];
    if (values.length) {
      next[field] = unique([...next[field], ...values]);
      widenedFields.push(field);
    }
  }
  if (patch.companySize !== undefined) {
    next.companySize = widenedCompanySize(base.companySize, patch.companySize);
    widenedFields.push('companySize');
  }
  if (patch.desiredResultCount !== undefined) {
    if (patch.desiredResultCount < base.desiredResultCount) {
      throw new Error('EXPAND cannot reduce desired result count.');
    }
    next.desiredResultCount = patch.desiredResultCount;
    widenedFields.push('desiredResultCount');
  }
  next.widenedFields = unique(widenedFields);
  const intent = deepFreeze(DiscoveryIntentSchema.parse(next));
  return { intent, widenedFields };
}

export function applyExcludePatch(
  authoritativeBase: DiscoveryIntent,
  untrustedPatch: unknown,
  context: DerivedIntentContext,
): Readonly<DiscoveryIntent> {
  const base = DiscoveryIntentSchema.parse(authoritativeBase);
  const parsed = untrustedPatch as ExcludePatch;
  if (
    !parsed
    || typeof parsed !== 'object'
    || Object.keys(parsed).some((key) => key !== 'excludedSignals')
    || !Array.isArray(parsed.excludedSignals)
  ) {
    throw new Error('EXCLUDE may only add explicit excluded signals.');
  }
  const next = nextBase(base, context, 'EXCLUDE');
  next.excludedSignals = unique([...base.excludedSignals, ...parsed.excludedSignals]);
  return deepFreeze(DiscoveryIntentSchema.parse(next));
}

export function restoreIntentSnapshot(snapshot: unknown): Readonly<DiscoveryIntent> {
  const parsed = DiscoveryIntentSchema.parse(snapshot);
  return deepFreeze({ ...parsed, mode: 'RESTORE' });
}

export function mapLegacyMode(mode: LegacyDiscoveryMode) {
  return mapLegacyModeValue(mode);
}

export function validateIntentTransition(
  base: DiscoveryIntent | undefined,
  next: DiscoveryIntent,
): IntentTransitionValidation {
  const parsedNext = DiscoveryIntentSchema.safeParse(next);
  if (!parsedNext.success) return { valid: false, reason: parsedNext.error.issues[0]?.message ?? 'Invalid intent.' };
  if (next.mode === 'NEW') {
    return !base && !next.parentIntentId && !next.sessionId
      ? { valid: true }
      : { valid: false, reason: 'NEW cannot inherit a base, parent intent, or session.' };
  }
  if (next.mode === 'RESTORE') return { valid: true };
  if (!base) return { valid: false, reason: `${next.mode} requires an authoritative base intent.` };
  if (next.parentIntentId !== base.id) return { valid: false, reason: 'Derived intent must identify its authoritative parent.' };
  if ((next.sessionId ?? null) !== (base.sessionId ?? null)) return { valid: false, reason: 'Derived intent cannot change session ownership.' };
  if (next.version !== base.version + 1) return { valid: false, reason: 'Derived intent version must increment exactly once.' };
  return { valid: true };
}
