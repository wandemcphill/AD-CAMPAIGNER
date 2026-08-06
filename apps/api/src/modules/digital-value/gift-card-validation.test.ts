import { describe, expect, it } from 'vitest';

import {
  validateGiftCardECode,
  normalizeGiftCardCode,
  hashGiftCardCode,
  computeGiftCardFraudScore,
  isKnownGiftCardBrand,
  isKnownGiftCardRegion,
  FRAUD_REVIEW_THRESHOLD
} from './gift-card-validation';

describe('validateGiftCardECode', () => {
  it('accepts a well-formed Apple code', () => {
    const result = validateGiftCardECode('APPLE', 'US', 50, 'ABCD1234EFGH5678');
    expect(result.valid).toBe(true);
    expect(result.reasons).toHaveLength(0);
  });

  it('accepts a dashed code and normalizes it the same as the undashed form', () => {
    const dashed = validateGiftCardECode('STEAM', 'US', 20, 'ABCDE-FGHJK-MNPQR');
    const plain = validateGiftCardECode('STEAM', 'US', 20, 'ABCDEFGHJKMNPQR');
    expect(dashed.valid).toBe(true);
    expect(dashed.normalizedCode).toBe(plain.normalizedCode);
  });

  it('rejects an empty code', () => {
    const result = validateGiftCardECode('APPLE', 'US', 50, '');
    expect(result.valid).toBe(false);
    expect(result.reasons).toContain('ECODE_MISSING');
  });

  it('rejects a whitespace-only code', () => {
    const result = validateGiftCardECode('APPLE', 'US', 50, '   ');
    expect(result.valid).toBe(false);
    expect(result.reasons).toContain('ECODE_MISSING');
  });

  it('rejects a too-short code', () => {
    const result = validateGiftCardECode('APPLE', 'US', 50, '12345');
    expect(result.valid).toBe(false);
    expect(result.reasons).toContain('ECODE_LENGTH_INVALID');
  });

  it('rejects a code with invalid characters', () => {
    const result = validateGiftCardECode('APPLE', 'US', 50, '!!!!!!!!!!!!!!!!');
    expect(result.valid).toBe(false);
    expect(result.reasons).toContain('ECODE_FORMAT_INVALID');
  });

  it('rejects an unconfigured brand', () => {
    const result = validateGiftCardECode('APPLE_GIFT_CARD', 'US', 50, 'ABCD1234EFGH5678');
    expect(result.valid).toBe(false);
    expect(result.reasons).toContain('BRAND_NOT_CONFIGURED');
  });

  it('rejects an unsupported region', () => {
    const result = validateGiftCardECode('APPLE', 'MARS', 50, 'ABCD1234EFGH5678');
    expect(result.valid).toBe(false);
    expect(result.reasons).toContain('REGION_NOT_SUPPORTED');
  });

  it('rejects a non-positive denomination', () => {
    const result = validateGiftCardECode('APPLE', 'US', 0, 'ABCD1234EFGH5678');
    expect(result.valid).toBe(false);
    expect(result.reasons).toContain('DENOMINATION_INVALID');
  });
});

describe('normalizeGiftCardCode / hashGiftCardCode', () => {
  it('normalizes case and separators identically', () => {
    expect(normalizeGiftCardCode('abcd-1234_efgh 5678')).toBe('ABCD1234EFGH5678');
  });

  it('hashes identical normalized codes identically', () => {
    const a = hashGiftCardCode(normalizeGiftCardCode('ABCD-1234-EFGH-5678'));
    const b = hashGiftCardCode(normalizeGiftCardCode('abcd1234efgh5678'));
    expect(a).toBe(b);
  });

  it('hashes different codes differently', () => {
    const a = hashGiftCardCode(normalizeGiftCardCode('ABCD1234EFGH5678'));
    const b = hashGiftCardCode(normalizeGiftCardCode('ZZZZ1234EFGH5678'));
    expect(a).not.toBe(b);
  });
});

describe('isKnownGiftCardBrand / isKnownGiftCardRegion', () => {
  it('recognizes configured brands only', () => {
    expect(isKnownGiftCardBrand('APPLE')).toBe(true);
    expect(isKnownGiftCardBrand('APPLE_GIFT_CARD')).toBe(false);
  });

  it('recognizes configured regions only', () => {
    expect(isKnownGiftCardRegion('US')).toBe(true);
    expect(isKnownGiftCardRegion('MARS')).toBe(false);
  });
});

describe('computeGiftCardFraudScore', () => {
  const base = {
    denomination: 25,
    currency: 'USD',
    brand: 'APPLE',
    region: 'US',
    recentSubmissionCount: 0,
    workspaceAgeHours: 24 * 30
  };

  it('scores a clean, low-value, established-account submission as low risk', () => {
    const result = computeGiftCardFraudScore(base);
    expect(result.score).toBeLessThan(FRAUD_REVIEW_THRESHOLD);
  });

  it('flags high submission velocity as a contributing signal', () => {
    const clean = computeGiftCardFraudScore(base);
    const highVelocity = computeGiftCardFraudScore({ ...base, recentSubmissionCount: 5 });
    expect(highVelocity.score).toBeGreaterThan(clean.score);
    expect(highVelocity.reasons.some((r) => r.includes('FRAUD_HIGH_VELOCITY'))).toBe(true);
  });

  it('flags brand new workspaces', () => {
    const result = computeGiftCardFraudScore({ ...base, workspaceAgeHours: 1 });
    expect(result.reasons.some((r) => r.includes('FRAUD_NEW_ACCOUNT'))).toBe(true);
  });

  it('flags very high denominations', () => {
    const result = computeGiftCardFraudScore({ ...base, denomination: 1000_00 });
    expect(result.reasons.some((r) => r.includes('FRAUD_HIGH_DENOMINATION'))).toBe(true);
  });

  it('combines signals into a review-triggering score', () => {
    const result = computeGiftCardFraudScore({
      ...base,
      recentSubmissionCount: 4,
      workspaceAgeHours: 2,
      denomination: 1000_00
    });
    expect(result.score).toBeGreaterThanOrEqual(FRAUD_REVIEW_THRESHOLD);
  });

  it('clamps score to 100', () => {
    const result = computeGiftCardFraudScore({
      ...base,
      recentSubmissionCount: 10,
      workspaceAgeHours: 0,
      denomination: 5000_00,
      region: 'UK'
    });
    expect(result.score).toBeLessThanOrEqual(100);
  });
});
