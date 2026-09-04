import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: ['**/node_modules/**', '**/e2e/**'],
    // Integration test files share one Postgres test database and each
    // truncates/counts whole tables — running files in parallel races them
    // against each other. One file at a time keeps that safe.
    fileParallelism: false,
  },
});
