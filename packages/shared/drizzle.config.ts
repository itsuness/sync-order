import { defineConfig } from 'drizzle-kit';

// `drizzle-kit generate` reads only `schema` and `out`. `drizzle-kit migrate`
// also needs `dbCredentials.url`; it fails loudly with an empty string, which
// is the intended behaviour when neither variable is set.
const url = process.env.DATABASE_URL ?? process.env.TEST_DATABASE_URL ?? '';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url },
  strict: true,
  verbose: true,
});
