import { describe, expect, it } from 'vitest';

import { decryptToken, encryptToken } from './token-cipher.js';

const KEY = 'a-test-token-encryption-key-at-least-32-chars';
const TOKEN = 'test-shopify-access-token';

describe('token cipher', () => {
  it('round-trips a token back to the original', () => {
    expect(decryptToken(encryptToken(TOKEN, KEY), KEY)).toEqual({ ok: true, value: TOKEN });
  });

  it('produces ciphertext that is not the plaintext', () => {
    const encoded = encryptToken(TOKEN, KEY);
    expect(encoded).not.toBe(TOKEN);
    expect(Buffer.from(encoded, 'base64').toString('utf8')).not.toContain(TOKEN);
  });

  it('uses a fresh IV each call, so the same token encrypts differently', () => {
    expect(encryptToken(TOKEN, KEY)).not.toBe(encryptToken(TOKEN, KEY));
  });

  it('reports failure instead of throwing when the key is wrong', () => {
    const encoded = encryptToken(TOKEN, KEY);
    expect(decryptToken(encoded, `${KEY}-different`)).toEqual({ ok: false, error: 'decryption-failed' });
  });

  it('reports failure on a tampered ciphertext', () => {
    const raw = Buffer.from(encryptToken(TOKEN, KEY), 'base64');
    const last = raw.length - 1;
    raw.writeUInt8(raw.readUInt8(last) ^ 0x01, last);
    expect(decryptToken(raw.toString('base64'), KEY)).toEqual({ ok: false, error: 'decryption-failed' });
  });
});
