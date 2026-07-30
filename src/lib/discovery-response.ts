export type DiscoveryErrorCode =
  | 'DISCOVERY_REQUEST_INVALID'
  | 'DISCOVERY_INTERPRETATION_FAILED'
  | 'GEMINI_REQUEST_FAILED'
  | 'GEMINI_TIMEOUT'
  | 'GEMINI_RESPONSE_EMPTY'
  | 'DISCOVERY_RESPONSE_INVALID'
  | 'DISCOVERY_SCORING_FAILED'
  | 'DISCOVERY_PERSISTENCE_FAILED'
  | 'DISCOVERY_UNKNOWN_ERROR';

export class DiscoveryError extends Error {
  constructor(
    public code: DiscoveryErrorCode,
    message: string,
    public status = 500,
  ) {
    super(message);
    this.name = 'DiscoveryError';
  }
}

export function extractJson(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) throw new DiscoveryError('GEMINI_RESPONSE_EMPTY', 'The research service returned an empty response.');

  const unfenced = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
  try {
    return JSON.parse(unfenced);
  } catch {
    // Continue with a balanced JSON object/array scan for prose-wrapped output.
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
  throw new DiscoveryError('DISCOVERY_RESPONSE_INVALID', 'The research response could not be processed.');
}

export function candidateRecords(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== 'object') return [];
  const object = value as Record<string, unknown>;
  if (Array.isArray(object.companies)) return object.companies;
  if (Array.isArray(object.prospects)) return object.prospects;
  return [];
}

export function safeDiscoveryError(error: unknown) {
  if (error instanceof DiscoveryError) return error;
  const message = error instanceof Error ? error.message : String(error);
  if (/timeout|timed out|deadline|abort/i.test(message)) {
    return new DiscoveryError('GEMINI_TIMEOUT', 'The research request took too long. Please retry with a smaller request.', 504);
  }
  if (/GoogleGenerativeAI|generateContent|fetching from|model/i.test(message)) {
    return new DiscoveryError('GEMINI_REQUEST_FAILED', 'The research service could not complete this request.', 502);
  }
  return new DiscoveryError('DISCOVERY_UNKNOWN_ERROR', 'Yorbis could not complete this discovery.');
}
