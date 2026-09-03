import { z } from 'zod';

import { apiEnvSchema, type ApiEnv } from './schema.js';

/**
 * Raised when `process.env` does not satisfy a process's schema. `keys` lists
 * the offending top-level variable names; `message` is a human-readable block
 * naming each one and why it failed.
 */
export class EnvValidationError extends Error {
  readonly keys: readonly string[];

  constructor(error: z.ZodError) {
    const lines = error.issues.map(
      (issue) => `  ${issue.path.join('.') || '(root)'}: ${issue.message}`,
    );
    super(`Invalid environment:\n${lines.join('\n')}`);
    this.name = 'EnvValidationError';
    this.keys = error.issues.map((issue) => String(issue.path[0] ?? ''));
  }
}

/**
 * Parse `source` against `schema`. Pure: no console, no `process.exit`. Throws
 * {@link EnvValidationError} on any missing or malformed value — ticket 02
 * wants a loud crash, and this is the throw its unit tests assert against.
 */
export function parseEnv<T>(
  schema: z.ZodType<T>,
  source: Record<string, unknown> = process.env,
): T {
  const result = schema.safeParse(source);
  if (!result.success) {
    throw new EnvValidationError(result.error);
  }
  return result.data;
}

/**
 * Parse the API process's env once at boot. On failure, print which keys are
 * missing or invalid and exit non-zero before any request is served.
 */
export function loadApiEnv(source: Record<string, unknown> = process.env): ApiEnv {
  try {
    return parseEnv(apiEnvSchema, source);
  } catch (error) {
    if (error instanceof EnvValidationError) {
      process.stderr.write(`\n[api] ${error.message}\n\n`);
      process.exit(1);
    }
    throw error;
  }
}
