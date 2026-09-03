import { describe, expect, it } from 'vitest';

import { EnvValidationError, parseEnv } from './load.js';
import { apiEnvSchema, workerEnvSchema } from './schema.js';

// Obviously-fake values. Never a real secret in a fixture (CLAUDE.md).
const validWorkerEnv = {
  DATABASE_URL: 'postgres://user:pass@localhost:5432/ordersync',
  SHOPIFY_API_BASE_URL: 'https://example-shop.myshopify.com',
  QUICKBOOKS_CLIENT_ID: 'fake-qb-client-id',
  QUICKBOOKS_CLIENT_SECRET: 'fake-qb-client-secret',
  QUICKBOOKS_API_BASE_URL: 'https://sandbox-quickbooks.example.com',
  TOKEN_ENCRYPTION_KEY: 'fake-token-encryption-key-32-bytes-long',
};

const validApiEnv = {
  DATABASE_URL: 'postgres://user:pass@localhost:5432/ordersync',
  SHOPIFY_WEBHOOK_SECRET: 'fake-shopify-webhook-secret',
  OPERATOR_USERNAME: 'operator',
  OPERATOR_PASSWORD: 'fake-operator-password',
};

describe('parseEnv', () => {
  it('returns the parsed config for a complete env', () => {
    const env = parseEnv(workerEnvSchema, validWorkerEnv);

    expect(env.DATABASE_URL).toBe(validWorkerEnv.DATABASE_URL);
    expect(env.TOKEN_ENCRYPTION_KEY).toBe(validWorkerEnv.TOKEN_ENCRYPTION_KEY);
  });

  it('applies the PORT default when it is absent', () => {
    const env = parseEnv(apiEnvSchema, validApiEnv);

    expect(env.PORT).toBe(3001);
  });

  it('coerces a provided PORT to a number', () => {
    const env = parseEnv(apiEnvSchema, { ...validApiEnv, PORT: '8080' });

    expect(env.PORT).toBe(8080);
  });

  it('treats a blank PORT as unset and falls back to the default', () => {
    const env = parseEnv(apiEnvSchema, { ...validApiEnv, PORT: '' });

    expect(env.PORT).toBe(3001);
  });

  it('rejects a non-numeric PORT', () => {
    expect(() =>
      parseEnv(apiEnvSchema, { ...validApiEnv, PORT: 'not-a-port' }),
    ).toThrowError(/PORT/);
  });

  it('throws naming the key when a required var is missing', () => {
    const { TOKEN_ENCRYPTION_KEY: _omitted, ...missingKey } = validWorkerEnv;

    expect(() => parseEnv(workerEnvSchema, missingKey)).toThrowError(
      /TOKEN_ENCRYPTION_KEY/,
    );
  });

  it('exposes every offending key on the thrown error', () => {
    try {
      parseEnv(workerEnvSchema, { DATABASE_URL: validWorkerEnv.DATABASE_URL });
      expect.unreachable('parseEnv should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(EnvValidationError);
      if (!(error instanceof EnvValidationError)) return;
      expect(error.keys).toContain('SHOPIFY_API_BASE_URL');
      expect(error.keys).toContain('TOKEN_ENCRYPTION_KEY');
      expect(error.keys).not.toContain('DATABASE_URL');
    }
  });

  it('throws naming the key when a URL var is malformed', () => {
    const malformed = { ...validWorkerEnv, DATABASE_URL: 'not-a-url' };

    expect(() => parseEnv(workerEnvSchema, malformed)).toThrowError(
      /DATABASE_URL/,
    );
  });

  it('rejects a token encryption key shorter than 32 characters', () => {
    const shortKey = { ...validWorkerEnv, TOKEN_ENCRYPTION_KEY: 'too-short' };

    expect(() => parseEnv(workerEnvSchema, shortKey)).toThrowError(
      /TOKEN_ENCRYPTION_KEY/,
    );
  });
});
