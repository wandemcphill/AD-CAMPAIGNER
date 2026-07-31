// Minimal RFC 6238 TOTP (time-based one-time password) implementation, self-contained
// to avoid adding a new dependency. Uses HMAC-SHA1 / 6 digits / 30s step, matching the
// defaults every mainstream authenticator app (Google Authenticator, Authy, 1Password,
// Microsoft Authenticator) assumes when no algorithm/digits/period is specified in the
// otpauth:// URI.
import { createHmac, randomBytes } from "node:crypto";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const STEP_SECONDS = 30;
const DIGITS = 6;

export function generateBase32Secret(byteLength = 20) {
  const bytes = randomBytes(byteLength);
  let bits = "";
  for (const byte of bytes) bits += byte.toString(2).padStart(8, "0");

  let output = "";
  for (let i = 0; i + 5 <= bits.length; i += 5) {
    output += BASE32_ALPHABET[parseInt(bits.slice(i, i + 5), 2)];
  }

  return output;
}

function base32Decode(secret: string) {
  const cleaned = secret.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = "";
  for (const char of cleaned) {
    const value = BASE32_ALPHABET.indexOf(char);
    if (value === -1) continue;
    bits += value.toString(2).padStart(5, "0");
  }

  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }

  return Buffer.from(bytes);
}

function hotp(secret: string, counter: number) {
  const key = base32Decode(secret);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));

  const hmac = createHmac("sha1", key).update(counterBuffer).digest();
  const lastByte = hmac[hmac.length - 1] ?? 0;
  const offset = lastByte & 0x0f;
  const binary =
    ((hmac[offset] ?? 0) & 0x7f) << 24 |
    ((hmac[offset + 1] ?? 0) & 0xff) << 16 |
    ((hmac[offset + 2] ?? 0) & 0xff) << 8 |
    ((hmac[offset + 3] ?? 0) & 0xff);

  return String(binary % 10 ** DIGITS).padStart(DIGITS, "0");
}

export function generateTotp(secret: string, at: number = Date.now()) {
  return hotp(secret, Math.floor(at / 1000 / STEP_SECONDS));
}

/** Accepts the current step and one step before/after to tolerate clock drift. */
export function verifyTotp(secret: string, code: string, at: number = Date.now()) {
  const normalized = code.trim().replace(/\s+/g, "");
  if (!/^\d{6}$/.test(normalized)) return false;

  const step = Math.floor(at / 1000 / STEP_SECONDS);
  for (const delta of [0, -1, 1]) {
    if (hotp(secret, step + delta) === normalized) return true;
  }

  return false;
}

export function buildOtpauthUri(secret: string, accountLabel: string, issuer = "FlipTrybe") {
  const label = encodeURIComponent(`${issuer}:${accountLabel}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: String(DIGITS),
    period: String(STEP_SECONDS)
  });

  return `otpauth://totp/${label}?${params.toString()}`;
}
