import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));

// Comments are allowed to name the rule; code is not allowed to break it.
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

// Acceptance criterion 4 / CONTEXT.md "The one rule": the receiver never
// touches QuickBooks. Guard it statically so a future edit that imports an
// adapter here fails loudly instead of silently breaking retry/replay.
describe('shopify orders/create receiver — the one rule', () => {
  it('has no QuickBooks adapter or client in the receiver code path', () => {
    for (const file of ['orders-create-route.ts', 'record-shopify-event.ts', 'shopify-hmac.ts']) {
      const code = stripComments(readFileSync(resolve(here, file), 'utf8'));
      expect(code).not.toMatch(/quickbooks/i);
    }
  });
});
