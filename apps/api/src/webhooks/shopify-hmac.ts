import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * True when `signature` — Shopify's base64 `X-Shopify-Hmac-Sha256` header — is a
 * valid HMAC-SHA256 of the exact request bytes under `secret`. Constant-time
 * compare. A wrong length or an unparseable signature is a plain `false`, never
 * a throw.
 */
export function verifyShopifyHmac(rawBody: Buffer, signature: string, secret: string): boolean {
  const expected = createHmac('sha256', secret).update(rawBody).digest();
  const provided = Buffer.from(signature, 'base64');
  if (provided.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(provided, expected);
}
