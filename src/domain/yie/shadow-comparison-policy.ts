import { deterministicFingerprint } from './planning-policies';
import {
  ProductionInterpretationSchema,
  ShadowComparisonSchema,
  type DiscoveryIntentVersion,
  type ProductionInterpretation,
  type ShadowComparison,
} from './planning-schemas';

function comparable(value: unknown) {
  if (Array.isArray(value)) return JSON.stringify([...value].sort());
  return JSON.stringify(value ?? null);
}
export function compareShadowInterpretation(input: {
  id: string; sessionId: string; production: ProductionInterpretation;
  yie: DiscoveryIntentVersion; createdAt: string;
}): ShadowComparison {
  const production = ProductionInterpretationSchema.parse(input.production);
  const yieFields = input.yie.normalizedIntent as unknown as Record<string, unknown>;
  const productionFields = production.normalizedFields;
  const keys = new Set([...Object.keys(productionFields), ...Object.keys(yieFields)]);
  const matchedFields: string[] = [];
  const differingFields: string[] = [];
  const productionOnlyFields: string[] = [];
  const yieOnlyFields: string[] = [];
  for (const key of [...keys].sort()) {
    if (!(key in yieFields)) productionOnlyFields.push(key);
    else if (!(key in productionFields)) yieOnlyFields.push(key);
    else if (comparable(productionFields[key]) === comparable(yieFields[key])) matchedFields.push(key);
    else differingFields.push(key);
  }
  const rawDiffers = production.rawInput.trim().toLowerCase() !== input.yie.rawUserInput.trim().toLowerCase();
  const materiallyDiffers = rawDiffers || differingFields.length > 0;
  const falseRestore = production.restored && materiallyDiffers
    && !production.explicitRestoreRequested && input.yie.mode !== 'RESTORE';
  const warnings = [
    ...(falseRestore ? ['POSSIBLE_FALSE_RESTORE'] : []),
    ...(production.restored && !production.restoredReference ? ['RESTORE_REFERENCE_MISSING'] : []),
    ...(production.mode.toUpperCase() !== input.yie.mode ? ['MODE_INTERPRETATION_DIFFERS'] : []),
  ];
  const content = {
    id: input.id, sessionId: input.sessionId, productionReference: production.reference,
    matchedFields, differingFields, productionOnlyFields, yieOnlyFields, semanticWarnings: warnings,
    likelyRestorationMismatch: falseRestore,
    likelyCacheOrSessionReuseWarning: falseRestore,
    confidence: keys.size ? matchedFields.length / keys.size : 0.5,
    createdAt: input.createdAt,
  };
  const fingerprintContent = Object.fromEntries(
    Object.entries(content).filter(([key]) => !['id', 'createdAt'].includes(key)),
  );
  return ShadowComparisonSchema.parse({ ...content, fingerprint: deterministicFingerprint(fingerprintContent) });
}
