import { z } from 'zod';

/**
 * One schema, sliced per process.
 *
 * Every key's validation rule is defined once in `fields`. Each process entry
 * point (`api`, `worker`, `web`) picks the subset it needs. This keeps secrets
 * a process has no business reading — the token encryption key, the QuickBooks
 * client secret — out of that process's config object, without maintaining
 * three schemas that would drift. `worker` and `web` have no entry point yet;
 * their schemas are defined here so those tickets import one instead of writing
 * one.
 */
const fields = {
  DATABASE_URL: z.url(),
  SHOPIFY_WEBHOOK_SECRET: z.string().min(1),
  SHOPIFY_API_BASE_URL: z.url(),
  QUICKBOOKS_CLIENT_ID: z.string().min(1),
  QUICKBOOKS_CLIENT_SECRET: z.string().min(1),
  QUICKBOOKS_API_BASE_URL: z.url(),
  // 32 chars is the floor for the AES-256 key this will later be decoded into.
  TOKEN_ENCRYPTION_KEY: z.string().min(32),
  OPERATOR_USERNAME: z.string().min(1),
  OPERATOR_PASSWORD: z.string().min(1),
  // Not a secret. Absent or blank falls back to 3001; anything present must be
  // a valid port so a typo fails loudly instead of silently listening on 0.
  PORT: z.preprocess(
    (v) => (v === '' || v === undefined ? 3001 : v),
    z.coerce.number().int().positive(),
  ),
} as const;

export const apiEnvSchema = z.object({
  DATABASE_URL: fields.DATABASE_URL,
  SHOPIFY_WEBHOOK_SECRET: fields.SHOPIFY_WEBHOOK_SECRET,
  OPERATOR_USERNAME: fields.OPERATOR_USERNAME,
  OPERATOR_PASSWORD: fields.OPERATOR_PASSWORD,
  PORT: fields.PORT,
});

export const workerEnvSchema = z.object({
  DATABASE_URL: fields.DATABASE_URL,
  SHOPIFY_API_BASE_URL: fields.SHOPIFY_API_BASE_URL,
  QUICKBOOKS_CLIENT_ID: fields.QUICKBOOKS_CLIENT_ID,
  QUICKBOOKS_CLIENT_SECRET: fields.QUICKBOOKS_CLIENT_SECRET,
  QUICKBOOKS_API_BASE_URL: fields.QUICKBOOKS_API_BASE_URL,
  TOKEN_ENCRYPTION_KEY: fields.TOKEN_ENCRYPTION_KEY,
});

export const webEnvSchema = z.object({
  DATABASE_URL: fields.DATABASE_URL,
  OPERATOR_USERNAME: fields.OPERATOR_USERNAME,
  OPERATOR_PASSWORD: fields.OPERATOR_PASSWORD,
});

export type ApiEnv = z.infer<typeof apiEnvSchema>;
export type WorkerEnv = z.infer<typeof workerEnvSchema>;
export type WebEnv = z.infer<typeof webEnvSchema>;
