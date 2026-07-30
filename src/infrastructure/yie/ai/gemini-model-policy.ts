export const CURRENT_WORKING_GEMINI_DEFAULT = 'gemini-3.1-flash-lite';

export type GeminiOperation = 'PARSE_INTENT' | 'PROPOSE_SEARCH_PLAN' | 'DISCOVER_CANDIDATES';

export type GeminiModelPolicy = Record<GeminiOperation, string>;

function validatedModel(value: string | undefined, operation: GeminiOperation) {
  const model = value?.trim() || CURRENT_WORKING_GEMINI_DEFAULT;
  if (/^gemini-2\.0(?:-|$)/i.test(model)) {
    throw new Error(`Retired Gemini 2.0 model is not permitted for ${operation}.`);
  }
  return model;
}

export function loadGeminiModelPolicy(
  environment: Record<string, string | undefined> = process.env,
): GeminiModelPolicy {
  return {
    PARSE_INTENT: validatedModel(environment.GEMINI_INTENT_MODEL, 'PARSE_INTENT'),
    PROPOSE_SEARCH_PLAN: validatedModel(environment.GEMINI_PLANNING_MODEL, 'PROPOSE_SEARCH_PLAN'),
    DISCOVER_CANDIDATES: validatedModel(environment.GEMINI_DISCOVERY_MODEL, 'DISCOVER_CANDIDATES'),
  };
}
