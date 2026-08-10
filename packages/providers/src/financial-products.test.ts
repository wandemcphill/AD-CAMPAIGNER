import { createHmac } from 'node:crypto';

import { describe, expect, it, vi } from 'vitest';

import {
  createFincraRemittanceProvider,
  createMockRemittanceProvider,
  createMockVirtualAccountProvider,
  createMockVirtualCardProvider,
  createPayscribeVirtualAccountProvider,
  createSwapprRemittanceProvider,
  createSwapprVirtualAccountProvider,
  createYativoRemittanceProvider,
  verifyFincraWebhook,
  verifySwapprWebhook
} from './financial-products.js';

describe('createMockVirtualAccountProvider', () => {
  it('creates and retrieves an account', async () => {
    const provider = createMockVirtualAccountProvider();
    const created = await provider.createAccount({
      reference: 'ref1',
      accountName: 'Jane Doe',
      currency: 'NGN'
    });
    expect(created.accountNumber).toHaveLength(10);

    const fetched = await provider.getAccount(created.providerAccountId);
    expect(fetched.balanceMinor).toBe(0);
  });

  it('rejects fetching an unknown account', async () => {
    const provider = createMockVirtualAccountProvider();
    await expect(provider.getAccount('nope')).rejects.toThrow();
  });

  it('declares full merchant + customer VA capability (dev/test only)', () => {
    const provider = createMockVirtualAccountProvider();
    expect(provider.virtualAccountCapabilities).toEqual({
      supportsMerchantAccountCreation: true,
      supportsCustomerVirtualAccounts: true
    });
  });
});

describe('createMockVirtualCardProvider', () => {
  it('issues a funded card and allows top-up', async () => {
    const provider = createMockVirtualCardProvider();
    const card = await provider.issueCard({
      reference: 'card1',
      cardholderName: 'Jane Doe',
      currency: 'NGN',
      fundingAmountMinor: 500_00
    });
    expect(card.status).toBe('ACTIVE');

    const funded = await provider.fundCard({
      providerCardId: card.providerCardId,
      amountMinor: 100_00,
      reference: 'fund1'
    });
    expect(funded.balanceMinor).toBe(600_00);
  });

  it('freezes, unfreezes, and terminates a card', async () => {
    const provider = createMockVirtualCardProvider();
    const card = await provider.issueCard({
      reference: 'card2',
      cardholderName: 'Jane Doe',
      currency: 'NGN',
      fundingAmountMinor: 200_00
    });

    await provider.freezeCard(card.providerCardId);
    expect((await provider.getCard(card.providerCardId)).status).toBe('FROZEN');

    await provider.unfreezeCard(card.providerCardId);
    expect((await provider.getCard(card.providerCardId)).status).toBe('ACTIVE');

    const terminated = await provider.terminateCard(card.providerCardId);
    expect(terminated.refundableMinor).toBe(200_00);
  });
});

describe('createMockRemittanceProvider', () => {
  it('declares full remittance capability (dev/test only) and a locked quote', async () => {
    const provider = createMockRemittanceProvider();
    expect(provider.remittanceCapabilities).toEqual({
      supportsIndicativeRates: true,
      supportsLockedQuotes: true,
      supportsConversions: true,
      supportsPayouts: true,
      supportsBeneficiaries: true
    });

    const quote = await provider.getQuote({
      sourceCurrency: 'NGN',
      destinationCurrency: 'USD',
      sourceAmountMinor: 100_000
    });
    expect(quote.isLocked).toBe(true);
    expect(quote.feeMinor).toBeGreaterThan(0);
  });

  it('quotes and sends a transfer with an explicit amount', async () => {
    const provider = createMockRemittanceProvider();
    const quote = await provider.getQuote({
      sourceCurrency: 'NGN',
      destinationCurrency: 'USD',
      sourceAmountMinor: 100_000
    });

    const transfer = await provider.sendTransfer({
      reference: 'tx1',
      idempotencyKey: 'idem-tx1',
      amountMinor: 100_000,
      sourceCurrency: 'NGN',
      destinationCurrency: 'USD',
      quoteId: quote.quoteId,
      recipient: {
        name: 'John Smith',
        accountNumber: '1234567890',
        bankCode: '001',
        country: 'US'
      }
    });
    expect(transfer.status).toBe('PROCESSING');

    const status = await provider.getTransferStatus(transfer.providerReference);
    expect(status.status).toBe('PROCESSING');
  });

  it('rejects sending against an unknown quote', async () => {
    const provider = createMockRemittanceProvider();
    await expect(
      provider.sendTransfer({
        reference: 'tx2',
        idempotencyKey: 'idem-tx2',
        amountMinor: 5_000,
        sourceCurrency: 'NGN',
        destinationCurrency: 'USD',
        quoteId: 'nonexistent',
        recipient: { name: 'X', accountNumber: '0', bankCode: '0', country: 'US' }
      })
    ).rejects.toThrow();
  });

  it('rejects a missing/zero amount', async () => {
    const provider = createMockRemittanceProvider();
    await expect(
      provider.sendTransfer({
        reference: 'tx3',
        idempotencyKey: 'idem-tx3',
        amountMinor: 0,
        sourceCurrency: 'NGN',
        destinationCurrency: 'NGN',
        recipient: { name: 'X', accountNumber: '0', bankCode: '0', country: 'NG' }
      })
    ).rejects.toThrow(/positive integer amountMinor/);
  });

  it('rejects a non-integer/negative amount', async () => {
    const provider = createMockRemittanceProvider();
    await expect(
      provider.sendTransfer({
        reference: 'tx4',
        idempotencyKey: 'idem-tx4',
        amountMinor: -50,
        sourceCurrency: 'NGN',
        destinationCurrency: 'NGN',
        recipient: { name: 'X', accountNumber: '0', bankCode: '0', country: 'NG' }
      })
    ).rejects.toThrow(/positive integer amountMinor/);
  });

  it('rejects a currency mismatch against the quote', async () => {
    const provider = createMockRemittanceProvider();
    const quote = await provider.getQuote({
      sourceCurrency: 'NGN',
      destinationCurrency: 'USD',
      sourceAmountMinor: 10_000
    });
    await expect(
      provider.sendTransfer({
        reference: 'tx5',
        idempotencyKey: 'idem-tx5',
        amountMinor: 10_000,
        sourceCurrency: 'NGN',
        destinationCurrency: 'GBP', // mismatched vs the NGN->USD quote
        quoteId: quote.quoteId,
        recipient: { name: 'X', accountNumber: '0', bankCode: '0', country: 'GB' }
      })
    ).rejects.toThrow(/Currency mismatch/);
  });

  it('replays the cached result for a duplicate idempotency key (no double-send)', async () => {
    const provider = createMockRemittanceProvider();
    const quote = await provider.getQuote({
      sourceCurrency: 'NGN',
      destinationCurrency: 'NGN',
      sourceAmountMinor: 10_000
    });
    const input = {
      reference: 'tx6',
      idempotencyKey: 'idem-tx6-shared',
      amountMinor: 10_000,
      sourceCurrency: 'NGN',
      destinationCurrency: 'NGN',
      quoteId: quote.quoteId,
      recipient: { name: 'X', accountNumber: '0', bankCode: '0', country: 'NG' }
    };
    const first = await provider.sendTransfer(input);
    const second = await provider.sendTransfer(input);
    expect(second).toEqual(first);
  });
});

describe('Swappr virtual account adapter — capability + admin-provisioned guard', () => {
  it('declares merchant VA as NOT creatable, customer VIBAN as creatable', () => {
    const provider = createSwapprVirtualAccountProvider({ apiKey: 'sk_test_x' });
    expect(provider.virtualAccountCapabilities).toEqual({
      supportsMerchantAccountCreation: false,
      supportsCustomerVirtualAccounts: true
    });
  });

  it('refuses createAccount() rather than guessing a nonexistent endpoint', async () => {
    const provider = createSwapprVirtualAccountProvider({ apiKey: 'sk_test_x' });
    await expect(
      provider.createAccount({ reference: 'r1', accountName: 'X', currency: 'NGN' })
    ).rejects.toThrow(/admin-provisioned|UNSUPPORTED/i);
  });

  it('refuses closeAccount() rather than guessing a nonexistent endpoint', async () => {
    const provider = createSwapprVirtualAccountProvider({ apiKey: 'sk_test_x' });
    await expect(provider.closeAccount('acct_1')).rejects.toThrow(/admin-provisioned|UNSUPPORTED/i);
  });

  it('maps a real GET /v1/virtual_accounts/{id} response', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'ckva_1',
          currency: 'NGN',
          status: 'active',
          account_number: '2359114409',
          account_name: 'SWAPPR DEMO / FLIP TRYBE LTD',
          bank_name: 'Swappr Demo Bank',
          bank_code: '999'
        }),
        { status: 200 }
      )
    );
    const provider = createSwapprVirtualAccountProvider({ apiKey: 'sk_test_x', fetcher });
    const acct = await provider.getAccount('ckva_1');
    expect(acct.accountNumber).toBe('2359114409');
    expect(acct.bankName).toBe('Swappr Demo Bank');
    expect(acct.balanceMinor).toBe(0); // VA object carries no balance field per docs
    expect(fetcher).toHaveBeenCalledWith(
      'https://api.swappr.me/api/v1/virtual_accounts/ckva_1',
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer sk_test_x' }) })
    );
  });
});

describe('Swappr remittance adapter — mapped against official docs, no HTTP', () => {
  it('declares NO locked quotes (honest capability, per architectural rule)', () => {
    const provider = createSwapprRemittanceProvider({ apiKey: 'sk_test_x' });
    expect(provider.remittanceCapabilities.supportsLockedQuotes).toBe(false);
    expect(provider.remittanceCapabilities.supportsIndicativeRates).toBe(true);
  });

  it('returns an explicitly non-locked quote for a same-currency payout', async () => {
    const provider = createSwapprRemittanceProvider({ apiKey: 'sk_test_x' });
    const quote = await provider.getQuote({
      sourceCurrency: 'NGN',
      destinationCurrency: 'NGN',
      sourceAmountMinor: 50_000
    });
    expect(quote.isLocked).toBe(false);
    expect(quote.destinationAmountMinor).toBe(50_000);
  });

  it('fetches an indicative rate and marks it unlocked', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ object: 'list', data: [{ from_currency: 'NGN', to_currency: 'USD', rate: '0.00067' }] }),
        { status: 200 }
      )
    );
    const provider = createSwapprRemittanceProvider({ apiKey: 'sk_test_x', fetcher });
    const quote = await provider.getQuote({
      sourceCurrency: 'NGN',
      destinationCurrency: 'USD',
      sourceAmountMinor: 1_000_000
    });
    expect(quote.isLocked).toBe(false);
    expect(quote.rate).toBeCloseTo(0.00067);
    expect(quote.destinationAmountMinor).toBe(Math.round(1_000_000 * 0.00067));
  });

  it('rejects sendTransfer with a missing/zero amount', async () => {
    const provider = createSwapprRemittanceProvider({ apiKey: 'sk_test_x' });
    await expect(
      provider.sendTransfer({
        reference: 'r1',
        idempotencyKey: 'idem1',
        amountMinor: 0,
        sourceCurrency: 'NGN',
        destinationCurrency: 'NGN',
        recipient: { name: 'X', accountNumber: '0690000032', bankCode: '044', country: 'NG' }
      })
    ).rejects.toThrow(/positive integer amountMinor/);
  });

  it('rejects sendTransfer without an idempotencyKey', async () => {
    const provider = createSwapprRemittanceProvider({ apiKey: 'sk_test_x' });
    await expect(
      provider.sendTransfer({
        reference: 'r1',
        idempotencyKey: '',
        amountMinor: 5_000,
        sourceCurrency: 'NGN',
        destinationCurrency: 'NGN',
        recipient: { name: 'X', accountNumber: '0690000032', bankCode: '044', country: 'NG' }
      })
    ).rejects.toThrow(/idempotencyKey/);
  });

  it('rejects a non-NGN corridor as UNSUPPORTED (recipient mapping not built)', async () => {
    const provider = createSwapprRemittanceProvider({ apiKey: 'sk_test_x' });
    await expect(
      provider.sendTransfer({
        reference: 'r1',
        idempotencyKey: 'idem1',
        amountMinor: 5_000,
        sourceCurrency: 'GBP',
        destinationCurrency: 'GBP',
        recipient: { name: 'X', accountNumber: '12345678', bankCode: '200000', country: 'GB' }
      })
    ).rejects.toThrow(/UNSUPPORTED/);
  });

  it('sends a documented NGN payout request and maps a successful response', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          object: 'payout',
          id: 'ck123',
          reference: 'po_abc123',
          status: 'paid',
          currency: 'NGN',
          amount_minor: '500000',
          fee_minor: 75,
          recipient_name: 'ADAEZE BLESSING NWAFOR'
        }),
        { status: 201 }
      )
    );
    const provider = createSwapprRemittanceProvider({ apiKey: 'sk_test_x', fetcher });
    const result = await provider.sendTransfer({
      reference: 'flp_ref_1',
      idempotencyKey: 'idem-abc',
      amountMinor: 500_000,
      sourceCurrency: 'NGN',
      destinationCurrency: 'NGN',
      recipient: { name: 'Adaeze Nwafor', accountNumber: '0690000032', bankCode: '044', country: 'NG' }
    });

    expect(result.providerReference).toBe('po_abc123');
    expect(result.status).toBe('COMPLETED'); // 'paid' maps to COMPLETED
    expect(result.executedFeeMinor).toBe(75);

    const [, init] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(init.headers).toMatchObject({ 'Idempotency-Key': 'idem-abc' });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({
      amount_minor: '500000',
      currency: 'NGN',
      recipient: { account_number: '0690000032', bank_code: '044' }
    });
  });

  it('maps draft/queued/processing statuses to PROCESSING, failed/cancelled to FAILED', async () => {
    for (const [raw, expected] of [
      ['draft', 'PROCESSING'],
      ['queued', 'PROCESSING'],
      ['processing', 'PROCESSING'],
      ['paid', 'COMPLETED'],
      ['failed', 'FAILED'],
      ['cancelled', 'FAILED']
    ] as const) {
      const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: raw }), { status: 200 }));
      const provider = createSwapprRemittanceProvider({ apiKey: 'sk_test_x', fetcher });
      const status = await provider.getTransferStatus('po_x');
      expect(status.status).toBe(expected);
    }
  });

  it('throws a ProviderApiError on a 5xx response', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('server error', { status: 502 }));
    const provider = createSwapprRemittanceProvider({ apiKey: 'sk_test_x', fetcher });
    await expect(provider.getTransferStatus('po_x')).rejects.toThrow(/HTTP 502/);
  });

  it('throws on a 403 ip_not_allowed response', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ message: 'ip_not_allowed' }), { status: 403 }));
    const provider = createSwapprRemittanceProvider({ apiKey: 'sk_test_x', fetcher });
    await expect(provider.getTransferStatus('po_x')).rejects.toThrow(/ip_not_allowed/);
  });
});

describe('verifySwapprWebhook', () => {
  const secret = 'whsec_test_abc';

  function sign(t: number, rawBody: string): string {
    const sig = createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex');
    return `t=${t},v1=${sig}`;
  }

  it('accepts a validly signed, fresh webhook', () => {
    const rawBody = JSON.stringify({ event: 'payout_paid', id: 'po_1' });
    const t = Math.floor(Date.now() / 1000);
    const header = sign(t, rawBody);
    expect(verifySwapprWebhook({ rawBody, signatureHeader: header, secret })).toBe(true);
  });

  it('rejects a tampered body', () => {
    const rawBody = JSON.stringify({ event: 'payout_paid', id: 'po_1' });
    const t = Math.floor(Date.now() / 1000);
    const header = sign(t, rawBody);
    expect(
      verifySwapprWebhook({ rawBody: rawBody + 'tampered', signatureHeader: header, secret })
    ).toBe(false);
  });

  it('rejects a stale (replayed) timestamp', () => {
    const rawBody = JSON.stringify({ event: 'payout_paid', id: 'po_1' });
    const t = Math.floor(Date.now() / 1000) - 600; // 10 minutes old
    const header = sign(t, rawBody);
    expect(verifySwapprWebhook({ rawBody, signatureHeader: header, secret })).toBe(false);
  });

  it('rejects a malformed signature header', () => {
    expect(
      verifySwapprWebhook({ rawBody: '{}', signatureHeader: 'not-a-valid-header', secret })
    ).toBe(false);
  });
});

describe('Yativo remittance adapter — capability declaration', () => {
  it('declares genuine locked quotes (unlike Swappr)', () => {
    const provider = createYativoRemittanceProvider({ accountId: 'acc_1', appSecret: 'secret_1' });
    expect(provider.remittanceCapabilities.supportsLockedQuotes).toBe(true);
  });
});

describe('Payscribe virtual account adapter — capability declaration', () => {
  it('declares customer-scoped VA creation, no separate merchant VA', () => {
    const provider = createPayscribeVirtualAccountProvider({ apiKey: 'ps_sk_test_x' });
    expect(provider.virtualAccountCapabilities).toEqual({
      supportsMerchantAccountCreation: false,
      supportsCustomerVirtualAccounts: true
    });
  });
});

describe('Fincra remittance adapter — mapped against live-verified sandbox behavior', () => {
  it('declares genuine locked quotes (live-confirmed, unlike Swappr)', () => {
    const provider = createFincraRemittanceProvider({ apiKey: 'sk_test_x', businessId: 'biz_1' });
    expect(provider.remittanceCapabilities.supportsLockedQuotes).toBe(true);
    expect(provider.remittanceCapabilities.supportsBeneficiaries).toBe(false);
  });

  it('fetches a locked quote and maps minor-unit amounts', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          message: 'ok',
          data: {
            sourceCurrency: 'NGN',
            destinationCurrency: 'USD',
            sourceAmount: 1_000_000,
            destinationAmount: 670,
            fee: 500,
            rate: 0.00067,
            reference: 'quote_abc123',
            expireAt: '2026-08-10T12:00:30.000Z'
          }
        }),
        { status: 200 }
      )
    );
    const provider = createFincraRemittanceProvider({ apiKey: 'sk_test_x', businessId: 'biz_1', fetcher });
    const quote = await provider.getQuote({
      sourceCurrency: 'NGN',
      destinationCurrency: 'USD',
      sourceAmountMinor: 1_000_000
    });
    expect(quote.isLocked).toBe(true);
    expect(quote.quoteId).toBe('quote_abc123');
    expect(quote.destinationAmountMinor).toBe(670);
    expect(quote.feeMinor).toBe(500);
    expect(quote.expiresAt).toBe('2026-08-10T12:00:30.000Z');

    const [url, init] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://sandboxapi.fincra.com/quotes/generate');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({ business: 'biz_1', amount: '1000000' });
  });

  it('rejects sendTransfer with a missing/zero amount', async () => {
    const provider = createFincraRemittanceProvider({ apiKey: 'sk_test_x', businessId: 'biz_1' });
    await expect(
      provider.sendTransfer({
        reference: 'r1',
        idempotencyKey: 'idem1',
        amountMinor: 0,
        sourceCurrency: 'NGN',
        destinationCurrency: 'NGN',
        recipient: { name: 'X', accountNumber: '0690000032', bankCode: '044', country: 'NG' }
      })
    ).rejects.toThrow(/positive integer amountMinor/);
  });

  it('rejects sendTransfer without an idempotencyKey', async () => {
    const provider = createFincraRemittanceProvider({ apiKey: 'sk_test_x', businessId: 'biz_1' });
    await expect(
      provider.sendTransfer({
        reference: 'r1',
        idempotencyKey: '',
        amountMinor: 5_000,
        sourceCurrency: 'NGN',
        destinationCurrency: 'NGN',
        recipient: { name: 'X', accountNumber: '0690000032', bankCode: '044', country: 'NG' }
      })
    ).rejects.toThrow(/idempotencyKey/);
  });

  it('sends a documented NGN payout request (amount in minor units) and maps a successful response', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          message: 'ok',
          data: { id: 12345, reference: 'fncr_ref_abc', customerReference: 'idem-abc', status: 'successful' }
        }),
        { status: 200 }
      )
    );
    const provider = createFincraRemittanceProvider({ apiKey: 'sk_test_x', businessId: 'biz_1', fetcher });
    const result = await provider.sendTransfer({
      reference: 'flp_ref_1',
      idempotencyKey: 'idem-abc',
      amountMinor: 500_000,
      sourceCurrency: 'NGN',
      destinationCurrency: 'NGN',
      recipient: { name: 'Adaeze Nwafor', accountNumber: '0690000032', bankCode: '044', country: 'NG' }
    });

    expect(result.providerReference).toBe('fncr_ref_abc');
    expect(result.status).toBe('COMPLETED');

    const [url, init] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://sandboxapi.fincra.com/disbursements/payouts');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({
      amount: '500000', // minor units — live-confirmed via sandbox balance math
      customerReference: 'idem-abc',
      beneficiary: { accountNumber: '0690000032', bankCode: '044', firstName: 'Adaeze', lastName: 'Nwafor' }
    });
  });

  it('surfaces a duplicate customerReference as a 422 ProviderApiError (reject-on-duplicate, not replay)', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ success: false, message: 'customerReference already used' }), { status: 422 })
      );
    const provider = createFincraRemittanceProvider({ apiKey: 'sk_test_x', businessId: 'biz_1', fetcher });
    await expect(
      provider.sendTransfer({
        reference: 'flp_ref_1',
        idempotencyKey: 'idem-dup',
        amountMinor: 100,
        sourceCurrency: 'NGN',
        destinationCurrency: 'NGN',
        recipient: { name: 'X', accountNumber: '0690000032', bankCode: '044', country: 'NG' }
      })
    ).rejects.toThrow(/HTTP 422/);
  });

  it('maps successful/failed/processing statuses via the reference status endpoint', async () => {
    for (const [raw, expected] of [
      ['successful', 'COMPLETED'],
      ['failed', 'FAILED'],
      ['processing', 'PROCESSING'],
      ['pending', 'PROCESSING']
    ] as const) {
      const fetcher = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ success: true, message: 'ok', data: { status: raw } }), { status: 200 })
      );
      const provider = createFincraRemittanceProvider({ apiKey: 'sk_test_x', businessId: 'biz_1', fetcher });
      const status = await provider.getTransferStatus('fncr_ref_x');
      expect(status.status).toBe(expected);
    }
  });

  it('throws a ProviderApiError on a 5xx response', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('server error', { status: 502 }));
    const provider = createFincraRemittanceProvider({ apiKey: 'sk_test_x', businessId: 'biz_1', fetcher });
    await expect(provider.getTransferStatus('fncr_ref_x')).rejects.toThrow(/HTTP 502/);
  });
});

describe('verifyFincraWebhook', () => {
  const key = 'whenc_test_abc';

  function sign(rawBody: string): string {
    return createHmac('sha512', key).update(rawBody).digest('hex');
  }

  it('accepts a validly signed webhook', () => {
    const rawBody = JSON.stringify({ event: 'payout.successful', reference: 'fncr_ref_abc' });
    expect(verifyFincraWebhook(rawBody, sign(rawBody), key)).toBe(true);
  });

  it('rejects a tampered body', () => {
    const rawBody = JSON.stringify({ event: 'payout.successful', reference: 'fncr_ref_abc' });
    expect(verifyFincraWebhook(rawBody + 'tampered', sign(rawBody), key)).toBe(false);
  });

  it('rejects a missing signature header', () => {
    expect(verifyFincraWebhook('{}', '', key)).toBe(false);
  });
});
