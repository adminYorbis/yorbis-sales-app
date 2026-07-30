import type { DiscoveryIntent as CurrentDiscoveryIntent } from '@/lib/discovery-contract';
import type { DiscoveryIntent as YieDiscoveryIntent } from '@/domain/yie/contracts';
import { normalizeIntent } from '@/lib/discovery-contract';
import { yieIntentToCurrent } from './current-discovery-adapter';

export type ShadowDifference = {
  field: string;
  current: unknown;
  shadow: unknown;
};

function stable(value: unknown) {
  if (Array.isArray(value)) return JSON.stringify([...value].sort());
  return JSON.stringify(value ?? null);
}

export function compareCurrentAndYieIntent(
  currentInput: CurrentDiscoveryIntent,
  yieIntent: YieDiscoveryIntent,
): ShadowDifference[] {
  const current = normalizeIntent(currentInput);
  const shadow = normalizeIntent(yieIntentToCurrent(yieIntent));
  const fields = new Set([...Object.keys(current), ...Object.keys(shadow)]);
  return [...fields].flatMap((field) => {
    const currentValue = current[field as keyof CurrentDiscoveryIntent];
    const shadowValue = shadow[field as keyof CurrentDiscoveryIntent];
    return stable(currentValue) === stable(shadowValue)
      ? []
      : [{ field, current: currentValue, shadow: shadowValue }];
  });
}
