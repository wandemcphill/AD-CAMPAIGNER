/**
 * Normalizes a Nigerian mobile number entered in any common shape into the
 * international MSISDN format the rest of this codebase already expects —
 * see packages/providers/src/telecom.ts's own validateNumber, which checks
 * for exactly this shape: digits only, "234" country code, no leading "+",
 * no leading trunk "0".
 *
 * Nigerian carriers advertise numbers in local dialing format
 * (0XXXXXXXXXX) — that's what a person actually types. The validation this
 * feeds into requires the first digit to be 1-9, so every correctly-typed
 * local-format number was being rejected as "invalid" before this existed.
 * This runs before that validation, not instead of it: input that isn't one
 * of the recognized shapes is returned unchanged, so malformed numbers still
 * get rejected by the check that follows — this only stops *valid* numbers
 * from being rejected.
 *
 * Recognized shapes (whitespace, dashes, and a leading "+" are stripped
 * before matching):
 *   07014442268     11 digits, local trunk format      -> 2347014442268
 *   2347014442268   13 digits, already international    -> unchanged
 *   +2347014442268  same, with a leading +               -> 2347014442268
 *   7014442268      10 digits, bare subscriber number    -> 2347014442268
 */
export function normalizeNigerianMsisdn(input: string): string {
  const digits = input.replace(/[^\d]/g, "");

  if (digits.startsWith("234") && digits.length === 13) return digits;
  if (digits.startsWith("0") && digits.length === 11) return `234${digits.slice(1)}`;
  if (digits.length === 10) return `234${digits}`;

  return digits;
}
