import { createHmac } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { verifyShopifyHmac } from './shopify-hmac.js';

// Fixed, obviously-fake secret — never a real signing secret in a fixture.
const SECRET = 'test-shopify-webhook-signing-secret';

function sign(body: string, secret = SECRET): string {
  return createHmac('sha256', secret).update(body).digest('base64');
}

describe('verifyShopifyHmac', () => {
  it('accepts a correctly signed body', () => {
    const body = JSON.stringify({ id: 1234, total_price: '10.00' });
    expect(verifyShopifyHmac(Buffer.from(body), sign(body), SECRET)).toBe(true);
  });

  it('rejects a body tampered with after signing', () => {
    const body = JSON.stringify({ id: 1234, total_price: '10.00' });
    const signature = sign(body);
    const tampered = JSON.stringify({ id: 1234, total_price: '999.00' });
    expect(verifyShopifyHmac(Buffer.from(tampered), signature, SECRET)).toBe(false);
  });

  it('rejects a signature made with a different secret', () => {
    const body = JSON.stringify({ id: 1 });
    expect(verifyShopifyHmac(Buffer.from(body), sign(body, 'some-other-secret'), SECRET)).toBe(false);
  });

  it('rejects a malformed or empty signature without throwing', () => {
    const body = Buffer.from('{}');
    expect(verifyShopifyHmac(body, 'not-valid-base64-$$$', SECRET)).toBe(false);
    expect(verifyShopifyHmac(body, '', SECRET)).toBe(false);
  });
});
