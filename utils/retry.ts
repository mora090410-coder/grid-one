export interface RetryOptions {
  retries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  jitter?: boolean;
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  sleepFn?: (ms: number) => Promise<void>;
  randomFn?: () => number;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const defaultShouldRetry = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return msg.includes('network') || msg.includes('timeout') || msg.includes('http 5');
};

/**
 * Retries an async operation with exponential backoff.
 * Intended for transient network and upstream errors.
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    retries = 3,
    baseDelayMs = 300,
    maxDelayMs = 5000,
    jitter = true,
    shouldRetry = defaultShouldRetry,
    sleepFn = defaultSleep,
    randomFn = Math.random,
  } = options;

  let attempt = 0;
  let lastError: unknown;

  while (attempt <= retries) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt >= retries || !shouldRetry(error, attempt)) {
        throw error;
      }

      const exponential = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
      const jitterOffset = jitter ? Math.floor(exponential * 0.2 * randomFn()) : 0;
      await sleepFn(exponential + jitterOffset);
      attempt += 1;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Retry failed');
}
