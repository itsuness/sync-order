import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/**
 * Encryption at rest for the two token columns on `connections`.
 *
 * Pure functions: the key is passed in, never read from `process.env` here.
 * The caller hands over `TOKEN_ENCRYPTION_KEY`, which the env schema (ticket
 * 02) has already checked is at least 32 characters.
 *
 * Stored form is base64 of `iv | authTag | ciphertext` — a fixed layout so
 * anything reading the column knows how to split it. The 12-byte IV is random
 * per call, so encrypting the same token twice gives two different strings.
 */

const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;

export type DecryptResult =
  | { readonly ok: true; readonly value: string }
  | { readonly ok: false; readonly error: 'decryption-failed' };

/**
 * Reduce the operator key to the 32 bytes AES-256 needs. The key is a
 * high-entropy secret (not a password), so a plain SHA-256 is enough — no
 * salt or KDF stretching — and it sidesteps caring whether the key is hex,
 * base64, or a passphrase.
 */
function deriveKey(key: string): Buffer {
  return createHash('sha256').update(key, 'utf8').digest();
}

export function encryptToken(plaintext: string, key: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', deriveKey(key), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64');
}

/**
 * Returns the plaintext, or `{ ok: false }` when the input is not a valid
 * ciphertext for this key (wrong key, truncated column, tampered bytes) —
 * the GCM auth tag makes that check exact.
 */
export function decryptToken(encoded: string, key: string): DecryptResult {
  try {
    const raw = Buffer.from(encoded, 'base64');
    const iv = raw.subarray(0, IV_BYTES);
    const authTag = raw.subarray(IV_BYTES, IV_BYTES + AUTH_TAG_BYTES);
    const ciphertext = raw.subarray(IV_BYTES + AUTH_TAG_BYTES);
    const decipher = createDecipheriv('aes-256-gcm', deriveKey(key), iv);
    decipher.setAuthTag(authTag);
    const value = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
    return { ok: true, value };
  } catch {
    return { ok: false, error: 'decryption-failed' };
  }
}
