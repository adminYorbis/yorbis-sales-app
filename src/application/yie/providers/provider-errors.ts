export const PROVIDER_ERROR_CODES = [
  'CONFIGURATION',
  'AUTHENTICATION',
  'RATE_LIMIT',
  'QUOTA',
  'TIMEOUT',
  'UNSUPPORTED_CAPABILITY',
  'MALFORMED_RESPONSE',
  'SAFETY_BLOCK',
  'UPSTREAM',
  'CANCELLED',
  'UNKNOWN',
] as const;

export type ProviderErrorCode = (typeof PROVIDER_ERROR_CODES)[number];

export class ProviderError extends Error {
  constructor(
    public readonly code: ProviderErrorCode,
    message: string,
    public readonly retryable: boolean,
    options?: {
      provider?: string;
      operation?: string;
      partialOutputAvailable?: boolean;
      cause?: unknown;
    },
  ) {
    super(message, { cause: options?.cause });
    this.name = 'ProviderError';
    this.provider = options?.provider;
    this.operation = options?.operation;
    this.partialOutputAvailable = options?.partialOutputAvailable ?? false;
  }

  readonly provider?: string;
  readonly operation?: string;
  readonly partialOutputAvailable: boolean;
}

export function isRetryableProviderError(error: unknown): error is ProviderError {
  return error instanceof ProviderError && error.retryable;
}

export function unsupportedCapability(provider: string, capability: string) {
  return new ProviderError(
    'UNSUPPORTED_CAPABILITY',
    `${provider} does not support ${capability}.`,
    false,
    { provider, operation: capability },
  );
}
