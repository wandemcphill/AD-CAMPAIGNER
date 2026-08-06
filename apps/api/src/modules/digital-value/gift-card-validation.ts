// Gift card e-code validation + fraud scoring for the SOGO sell pipeline.
//
// SOGO requires that FlipTrybe reject invalid/incomplete e-codes and reduce
// fraudulent submissions before they ever reach SOGO's API. This module is
// the validation gate: format/duplicate checks are hard rejects (never sent
// to SOGO), fraud scoring routes ambiguous-but-not-provably-invalid
// submissions to manual review instead of auto-submitting.
//
// This is intentionally NOT the @fliptrybe/service-trust-engine package —
// that package's OCR/classification stages return simulated placeholder
// data and its arbiter is hardcoded to always return REVIEW. It also
// requires an uploaded image (mediaAssetId), which the gift card sell flow
// does not have; submissions here are text e-codes. These rules operate
// directly on the submitted text.

import { createHash } from 'node:crypto';

export type GiftCardBrandKey =
  | 'APPLE'
  | 'AMAZON'
  | 'STEAM'
  | 'GOOGLE_PLAY'
  | 'PLAYSTATION'
  | 'XBOX'
  | 'RAZER_GOLD'
  | 'ITUNES'
  | 'OTHER';

interface EcodeRule {
  minLength: number;
  maxLength: number;
  pattern: RegExp;
}

// Length/charset rules per brand, applied to the normalized code (uppercased,
// whitespace and separator characters stripped). Deliberately conservative —
// real issuer formats vary, but every legitimate code for these brands falls
// within these bounds, so this rejects empty/placeholder/truncated input
// without false-rejecting real cards.
const ECODE_RULES: Record<GiftCardBrandKey, EcodeRule> = {
  APPLE: { minLength: 16, maxLength: 16, pattern: /^[A-Z0-9]{16}$/ },
  ITUNES: { minLength: 16, maxLength: 16, pattern: /^[A-Z0-9]{16}$/ },
  AMAZON: { minLength: 14, maxLength: 16, pattern: /^[A-Z0-9]{14,16}$/ },
  GOOGLE_PLAY: { minLength: 16, maxLength: 22, pattern: /^[A-Z0-9]{16,22}$/ },
  STEAM: { minLength: 15, maxLength: 15, pattern: /^[A-Z0-9]{15}$/ },
  PLAYSTATION: { minLength: 12, maxLength: 12, pattern: /^[A-Z0-9]{12}$/ },
  XBOX: { minLength: 25, maxLength: 25, pattern: /^[A-Z0-9]{25}$/ },
  RAZER_GOLD: { minLength: 16, maxLength: 20, pattern: /^[A-Z0-9]{16,20}$/ },
  OTHER: { minLength: 8, maxLength: 32, pattern: /^[A-Z0-9]{8,32}$/ }
};

export type ValidationReasonCode =
  | 'BRAND_NOT_CONFIGURED'
  | 'REGION_NOT_SUPPORTED'
  | 'ECODE_MISSING'
  | 'ECODE_LENGTH_INVALID'
  | 'ECODE_FORMAT_INVALID'
  | 'ECODE_DUPLICATE'
  | 'DENOMINATION_INVALID';

export interface EcodeValidationResult {
  valid: boolean;
  reasons: ValidationReasonCode[];
  normalizedCode: string;
}

const KNOWN_REGIONS = new Set(['US', 'UK', 'EU', 'GLOBAL']);

export function isKnownGiftCardRegion(region: string): boolean {
  return KNOWN_REGIONS.has(region);
}

/** Strips whitespace/dashes/underscores and uppercases — the form used for both regex checks and hashing, so "XXXX-XXXX" and "XXXXXXXX" are treated as the same code. */
export function normalizeGiftCardCode(rawCode: string): string {
  return rawCode.trim().toUpperCase().replace(/[\s\-_]+/g, '');
}

export function isKnownGiftCardBrand(brand: string): brand is GiftCardBrandKey {
  return Object.prototype.hasOwnProperty.call(ECODE_RULES, brand);
}

export function validateGiftCardECode(
  brand: string,
  region: string,
  denomination: number,
  rawCode: string | undefined | null
): EcodeValidationResult {
  const reasons: ValidationReasonCode[] = [];

  if (!isKnownGiftCardBrand(brand)) {
    reasons.push('BRAND_NOT_CONFIGURED');
    return { valid: false, reasons, normalizedCode: '' };
  }

  if (!isKnownGiftCardRegion(region)) {
    reasons.push('REGION_NOT_SUPPORTED');
  }

  if (!Number.isInteger(denomination) || denomination <= 0) {
    reasons.push('DENOMINATION_INVALID');
  }

  const normalizedCode = normalizeGiftCardCode(rawCode ?? '');

  if (!normalizedCode) {
    reasons.push('ECODE_MISSING');
    return { valid: false, reasons, normalizedCode };
  }

  const rule = ECODE_RULES[brand];

  if (normalizedCode.length < rule.minLength || normalizedCode.length > rule.maxLength) {
    reasons.push('ECODE_LENGTH_INVALID');
  } else if (!rule.pattern.test(normalizedCode)) {
    reasons.push('ECODE_FORMAT_INVALID');
  }

  return { valid: reasons.length === 0, reasons, normalizedCode };
}

/** Stable, non-reversible fingerprint for duplicate detection. Never store or log the raw code. */
export function hashGiftCardCode(normalizedCode: string): string {
  return createHash('sha256').update(normalizedCode).digest('hex');
}

export interface FraudScoreInput {
  denomination: number;
  currency: string;
  brand: string;
  region: string;
  /** Count of gift card sell submissions by this user in the trailing velocity window (e.g. 10 min). */
  recentSubmissionCount: number;
  /** Hours since the workspace was created — new workspaces are higher risk. */
  workspaceAgeHours: number;
}

export interface FraudScoreResult {
  score: number; // 0-100, higher = more suspicious
  reasons: string[];
}

const HIGH_VELOCITY_THRESHOLD = 3; // submissions within the window before it's suspicious
const HIGH_DENOMINATION_MINOR_USD = 500_00; // $500+ face value
const NEW_WORKSPACE_HOURS = 24;

/**
 * Combines real, currently-computable signals into a 0-100 fraud score.
 * This intentionally does not fabricate signals we can't back with data
 * (no OCR/image confidence — there's no image in this flow).
 */
export function computeGiftCardFraudScore(input: FraudScoreInput): FraudScoreResult {
  let score = 0;
  const reasons: string[] = [];

  if (input.recentSubmissionCount >= HIGH_VELOCITY_THRESHOLD) {
    score += 35;
    reasons.push(`FRAUD_HIGH_VELOCITY: ${input.recentSubmissionCount} submissions in the last 10 minutes`);
  } else if (input.recentSubmissionCount >= 1) {
    score += 10;
    reasons.push(`FRAUD_ELEVATED_VELOCITY: ${input.recentSubmissionCount} prior submission(s) in the last 10 minutes`);
  }

  if (input.workspaceAgeHours < NEW_WORKSPACE_HOURS) {
    score += 20;
    reasons.push(`FRAUD_NEW_ACCOUNT: workspace is ${input.workspaceAgeHours.toFixed(1)}h old`);
  }

  if (input.denomination >= HIGH_DENOMINATION_MINOR_USD) {
    score += 20;
    reasons.push(`FRAUD_HIGH_DENOMINATION: ${input.currency} ${(input.denomination / 100).toFixed(2)}`);
  }

  if (input.brand === 'APPLE' && input.region && input.region !== 'US') {
    score += 10;
    reasons.push(`FRAUD_BRAND_REGION_MISMATCH: Apple card claimed for region ${input.region}`);
  }

  return { score: Math.max(0, Math.min(100, score)), reasons };
}

export const FRAUD_REVIEW_THRESHOLD = 50;
