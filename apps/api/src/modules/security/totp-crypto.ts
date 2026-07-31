// Encrypts TOTP secrets at rest, mirroring the AES-256-GCM pattern used for voucher PINs
// in ../vouchers/vouchers.service.ts.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function totpSecretKey() {
  return createHash("sha256")
    .update(process.env.TOTP_SECRET_ENCRYPTION_KEY ?? process.env.SESSION_SECRET ?? "fliptrybe-totp-secret")
    .digest();
}

export function encryptTotpSecret(secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", totpSecretKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function hashBackupCode(code: string) {
  return createHash("sha256").update(code.trim().toUpperCase()).digest("hex");
}

export function decryptTotpSecret(payload: string) {
  const [ivValue, tagValue, ciphertextValue] = payload.split(".");
  if (!ivValue || !tagValue || !ciphertextValue) {
    throw new Error("TOTP secret payload is invalid.");
  }

  const decipher = createDecipheriv("aes-256-gcm", totpSecretKey(), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextValue, "base64url")),
    decipher.final()
  ]).toString("utf8");
}
