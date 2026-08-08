import { describe, expect, it } from 'vitest';

import { classifyFallbackSafety } from './contract.js';

// These tests encode the single most important financial-safety rule in the
// codebase: an ambiguous failure on a money-moving call must NEVER be treated
// as safe to retry or re-route, because doing so can double-pay a real
// customer. If one of these ever flips to SAFE_TO_RETRY, that is a money bug.

describe('classifyFallbackSafety — read-only operations', () => {
  it('is always safe to retry regardless of how it failed', () => {
    expect(classifyFallbackSafety({ mutatesMoney: false, noResponse: true })).toBe('SAFE_TO_RETRY');
    expect(classifyFallbackSafety({ mutatesMoney: false, httpStatus: 500 })).toBe('SAFE_TO_RETRY');
    expect(classifyFallbackSafety({ mutatesMoney: false, httpStatus: 408 })).toBe('SAFE_TO_RETRY');
    expect(classifyFallbackSafety({ mutatesMoney: false })).toBe('SAFE_TO_RETRY');
  });
});

describe('classifyFallbackSafety — money-moving operations', () => {
  it('treats NO RESPONSE (timeout / socket error) as possibly-executed', () => {
    expect(classifyFallbackSafety({ mutatesMoney: true, noResponse: true })).toBe(
      'PROVIDER_TRANSACTION_MAY_EXIST'
    );
  });

  it('treats a timeout as possibly-executed even when a 408 came back', () => {
    expect(classifyFallbackSafety({ mutatesMoney: true, httpStatus: 408 })).toBe(
      'PROVIDER_TRANSACTION_MAY_EXIST'
    );
  });

  it('treats rate-limiting (429) as possibly-executed', () => {
    // 429 can be returned AFTER partial processing — not provably a no-op.
    expect(classifyFallbackSafety({ mutatesMoney: true, httpStatus: 429 })).toBe(
      'PROVIDER_TRANSACTION_MAY_EXIST'
    );
  });

  it('treats every 5xx as possibly-executed', () => {
    for (const status of [500, 502, 503, 504]) {
      expect(classifyFallbackSafety({ mutatesMoney: true, httpStatus: status })).toBe(
        'PROVIDER_TRANSACTION_MAY_EXIST'
      );
    }
  });

  it('treats an unknown failure (no status, no flag) as possibly-executed', () => {
    // Conservative default — the whole point of the rule.
    expect(classifyFallbackSafety({ mutatesMoney: true })).toBe('PROVIDER_TRANSACTION_MAY_EXIST');
  });

  it('allows retry only when the provider definitively refused before acceptance', () => {
    // Ordinary 4xx = request rejected outright, nothing created.
    for (const status of [400, 401, 403, 404, 409, 422]) {
      expect(classifyFallbackSafety({ mutatesMoney: true, httpStatus: status })).toBe(
        'SAFE_TO_RETRY'
      );
    }
  });

  it('honours an explicit rejected-before-acceptance signal', () => {
    expect(
      classifyFallbackSafety({
        mutatesMoney: true,
        providerRejectedBeforeAcceptance: true,
        httpStatus: 500
      })
    ).toBe('SAFE_TO_RETRY');
  });

  it('still refuses retry on no-response even if rejected-before-acceptance is claimed', () => {
    // No response means we never saw a rejection — the claim cannot be trusted.
    expect(
      classifyFallbackSafety({
        mutatesMoney: true,
        noResponse: true,
        providerRejectedBeforeAcceptance: true
      })
    ).toBe('PROVIDER_TRANSACTION_MAY_EXIST');
  });
});
