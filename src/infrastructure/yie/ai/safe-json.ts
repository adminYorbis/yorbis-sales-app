import { z } from 'zod';
import { ProviderError } from '@/application/yie/providers/provider-errors';

export function extractJsonValue(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new ProviderError('MALFORMED_RESPONSE', 'Provider returned an empty structured response.', false);
  }
  const unfenced = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
  try {
    return JSON.parse(unfenced);
  } catch {
    // Continue with a balanced object/array scan for surrounded JSON.
  }

  for (let start = 0; start < unfenced.length; start += 1) {
    const opening = unfenced[start];
    if (opening !== '{' && opening !== '[') continue;
    const closing = opening === '{' ? '}' : ']';
    let depth = 0;
    let quoted = false;
    let escaped = false;
    for (let end = start; end < unfenced.length; end += 1) {
      const character = unfenced[end];
      if (quoted) {
        if (escaped) escaped = false;
        else if (character === '\\') escaped = true;
        else if (character === '"') quoted = false;
        continue;
      }
      if (character === '"') quoted = true;
      else if (character === opening) depth += 1;
      else if (character === closing) {
        depth -= 1;
        if (depth === 0) {
          try {
            return JSON.parse(unfenced.slice(start, end + 1));
          } catch {
            break;
          }
        }
      }
    }
  }
  throw new ProviderError('MALFORMED_RESPONSE', 'Provider structured response was not valid JSON.', false);
}

export function extractAndValidate<T>(text: string, schema: z.ZodType<T>): T {
  const parsed = schema.safeParse(extractJsonValue(text));
  if (!parsed.success) {
    throw new ProviderError(
      'MALFORMED_RESPONSE',
      `Provider response failed validation: ${parsed.error.issues[0]?.message ?? 'unknown schema error'}`,
      false,
    );
  }
  return parsed.data;
}
