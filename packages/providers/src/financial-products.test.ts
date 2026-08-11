import { createHmac } from 'node:crypto';

import { describe, expect, it, vi } from 'vitest';

import {
  createFincraRemittanceProvider,
  createInflowVirtualAccountProvider,
  createMapleradVirtualCardProvider,
  createMockRemittanceProvider,
  createMockVirtualAccountProvider,
  createMockVirtualCardProvider,
  createPayscribeVirtualAccountProvider,
  createSudoVirtualCardProvider,
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

describe('Inflow virtual account adapter — mapped against live-verified sandbox behavior', () => {
  it('declares customer-scoped VA creation only, no merchant-level VA', () => {
    const provider = createInflowVirtualAccountProvider({ apiKey: 'gtw_sk_test_x' });
    expect(provider.virtualAccountCapabilities).toEqual({
      supportsMerchantAccountCreation: false,
      supportsCustomerVirtualAccounts: true
    });
  });

  it('creates a customer then assigns a virtual account when no providerCustomerId is given', async () => {
    const fetcher = vi.fn().mockImplementation((url: string) => {
      if (String(url).endsWith('/v1/customers')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({ data: { id: 'cust_123', firstName: 'Ada', lastName: 'Verify' } }),
            { status: 201 }
          )
        );
      }
      if (String(url).endsWith('/v1/customers/cust_123/virtual-account')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: {
                id: 'va_456',
                provider: 'monnify',
                isActive: true,
                accounts: [
                  { bankCode: '232', bankName: 'Sterling bank', accountNumber: '2210260837', accountName: 'Ada' },
                  { bankCode: '035', bankName: 'Wema bank', accountNumber: '0017869951', accountName: 'Ada' }
                ]
              }
            }),
            { status: 201 }
          )
        );
      }
      throw new Error(`Unexpected URL ${String(url)}`);
    });
    const provider = createInflowVirtualAccountProvider({ apiKey: 'gtw_sk_test_x', fetcher });
    const account = await provider.createAccount({
      reference: 'ref1',
      accountName: 'Ada Verify',
      currency: 'NGN',
      customerEmail: 'ada@example.com'
    });
    expect(account.providerAccountId).toBe('cust_123:va_456');
    expect(account.accountNumber).toBe('2210260837');
    expect(account.bankName).toBe('Sterling bank');
    expect(account.currency).toBe('NGN');
  });

  it('reuses an existing providerCustomerId and skips customer creation', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            id: 'va_789',
            provider: 'monnify',
            accounts: [{ bankCode: '232', bankName: 'Sterling bank', accountNumber: '111', accountName: 'X' }]
          }
        }),
        { status: 201 }
      )
    );
    const provider = createInflowVirtualAccountProvider({ apiKey: 'gtw_sk_test_x', fetcher });
    const account = await provider.createAccount({
      reference: 'ref2',
      accountName: 'X Y',
      currency: 'NGN',
      providerCustomerId: 'cust_existing'
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(account.providerAccountId).toBe('cust_existing:va_789');
  });

  it('rejects createAccount when no providerCustomerId and no customerEmail are given', async () => {
    const provider = createInflowVirtualAccountProvider({ apiKey: 'gtw_sk_test_x' });
    await expect(
      provider.createAccount({ reference: 'ref3', accountName: 'No Email', currency: 'NGN' })
    ).rejects.toThrow(/customerEmail|providerCustomerId/);
  });

  it('maps a real GET /v1/customers/{id}/virtual-accounts response, finding the matching vaId', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            {
              id: 'adbdef7f-c19c-4292-878f-b2e5122ad922',
              provider: 'monnify',
              isActive: true,
              accounts: [
                { bankCode: '232', bankName: 'Sterling bank', accountName: 'Ada', accountNumber: '2210260837' },
                { bankCode: '035', bankName: 'Wema bank', accountName: 'Ada', accountNumber: '0017869951' }
              ]
            }
          ]
        }),
        { status: 200 }
      )
    );
    const provider = createInflowVirtualAccountProvider({ apiKey: 'gtw_sk_test_x', fetcher });
    const account = await provider.getAccount('7474852b-ca34-4c2a-ac3b-5de029de9f22:adbdef7f-c19c-4292-878f-b2e5122ad922');
    expect(account.accountNumber).toBe('2210260837');
    expect(account.bankName).toBe('Sterling bank');
    expect(account.balanceMinor).toBe(0);
    expect(fetcher).toHaveBeenCalledWith(
      'https://app.inflowpay.net/api/v1/customers/7474852b-ca34-4c2a-ac3b-5de029de9f22/virtual-accounts',
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer gtw_sk_test_x' }) })
    );
  });

  it('rejects getAccount for a malformed providerAccountId', async () => {
    const provider = createInflowVirtualAccountProvider({ apiKey: 'gtw_sk_test_x' });
    await expect(provider.getAccount('not-composite')).rejects.toThrow(/Malformed/);
  });

  it('rejects getAccount when no matching vaId is found for the customer', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [] }), { status: 200 }));
    const provider = createInflowVirtualAccountProvider({ apiKey: 'gtw_sk_test_x', fetcher });
    await expect(provider.getAccount('cust_1:va_missing')).rejects.toThrow(/No virtual account found/);
  });

  it('refuses closeAccount() rather than guessing a nonexistent per-VA endpoint', async () => {
    const provider = createInflowVirtualAccountProvider({ apiKey: 'gtw_sk_test_x' });
    await expect(provider.closeAccount('cust_1:va_1')).rejects.toThrow(/UNSUPPORTED/);
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

describe('Sudo virtual card adapter — mapped against official docs + live-verified sandbox behavior', () => {
  it('rejects issueCard with no providerCustomerId', async () => {
    const provider = createSudoVirtualCardProvider({ apiKey: 'sudo_test_x' });
    await expect(
      provider.issueCard({
        reference: 'ref1',
        cardholderName: 'Test Cardholder',
        currency: 'NGN',
        fundingAmountMinor: 500
      })
    ).rejects.toThrow(/providerCustomerId/);
  });

  it('issues a card: auto-provisions a wallet account, then creates the card (live-shaped responses)', async () => {
    const fetcher = vi
      .fn()
      // POST /accounts
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            statusCode: 200,
            message: 'Account created successfully.',
            data: { _id: 'acct_debit_1', type: 'wallet', currency: 'NGN' }
          }),
          { status: 200 }
        )
      )
      // POST /cards
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            statusCode: 200,
            message: 'Card mapped successfully.',
            data: {
              _id: '6a7b4006239d666d7ca2c9a4',
              account: '6a7b4003239d666d7ca2c99c',
              type: 'virtual',
              brand: 'Visa',
              currency: 'NGN',
              maskedPan: '506321*********3765',
              expiryMonth: '08',
              expiryYear: '2029',
              status: 'active'
            }
          }),
          { status: 200 }
        )
      );
    const provider = createSudoVirtualCardProvider({ apiKey: 'sudo_test_x', fetcher });
    const card = await provider.issueCard({
      reference: 'ref1',
      cardholderName: 'Test Cardholder',
      currency: 'NGN',
      fundingAmountMinor: 500,
      providerCustomerId: 'cust_1',
      brand: 'VISA'
    });

    expect(card.providerCardId).toBe('6a7b4006239d666d7ca2c9a4');
    expect(card.last4).toBe('3765');
    expect(card.expiryMonth).toBe(8);
    expect(card.expiryYear).toBe(2029);
    expect(card.brand).toBe('VISA');
    expect(card.status).toBe('ACTIVE');

    const [acctUrl, acctInit] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(acctUrl).toBe('https://api.sudo.africa/accounts');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const acctBody = JSON.parse(acctInit.body as string);
    expect(acctBody).toMatchObject({ type: 'wallet', currency: 'NGN', customerId: 'cust_1' });

    const [cardUrl, cardInit] = fetcher.mock.calls[1] as [string, RequestInit];
    expect(cardUrl).toBe('https://api.sudo.africa/cards');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const cardBody = JSON.parse(cardInit.body as string);
    expect(cardBody).toMatchObject({
      customerId: 'cust_1',
      type: 'virtual',
      currency: 'NGN',
      brand: 'Visa',
      debitAccountId: 'acct_debit_1',
      amount: 500
    });
  });

  it('throws (does not silently coerce) when Sudo returns a non-VISA/MASTERCARD brand', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ statusCode: 200, message: 'ok', data: { _id: 'acct_debit_1' } }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            statusCode: 200,
            message: 'ok',
            data: {
              _id: 'card_verve_1',
              account: 'acct_card_1',
              brand: 'Verve',
              currency: 'NGN',
              maskedPan: '506321*********3765',
              expiryMonth: '08',
              expiryYear: '2029',
              status: 'active'
            }
          }),
          { status: 200 }
        )
      );
    const provider = createSudoVirtualCardProvider({ apiKey: 'sudo_test_x', fetcher });
    await expect(
      provider.issueCard({
        reference: 'ref1',
        cardholderName: 'Test Cardholder',
        currency: 'NGN',
        fundingAmountMinor: 500,
        providerCustomerId: 'cust_1'
      })
    ).rejects.toThrow(/Verve.*not supported/s);
  });

  it('surfaces a Sudo "brand not available" 400 as a ProviderApiError', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ statusCode: 200, message: 'ok', data: { _id: 'acct_debit_1' } }), {
          status: 200
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ statusCode: 400, message: 'Visa Cards are not available at the moment.' }),
          { status: 400 }
        )
      );
    const provider = createSudoVirtualCardProvider({ apiKey: 'sudo_test_x', fetcher });
    await expect(
      provider.issueCard({
        reference: 'ref1',
        cardholderName: 'Test Cardholder',
        currency: 'NGN',
        fundingAmountMinor: 500,
        providerCustomerId: 'cust_1'
      })
    ).rejects.toThrow(/not available/);
  });

  it('rejects fundCard with no config.fundingAccountId', async () => {
    const provider = createSudoVirtualCardProvider({ apiKey: 'sudo_test_x' });
    await expect(
      provider.fundCard({ providerCardId: 'card_1', amountMinor: 500, reference: 'ref1' })
    ).rejects.toThrow(/fundingAccountId/);
  });

  it('funds a card via /accounts/transfer using the card\'s own account as creditAccountId', async () => {
    const fetcher = vi
      .fn()
      // GET /cards/{id}
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ statusCode: 200, message: 'ok', data: { _id: 'card_1', account: 'acct_card_1' } }),
          { status: 200 }
        )
      )
      // POST /accounts/transfer
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ statusCode: 200, responseCode: '00', message: 'ok', data: {} }), {
          status: 200
        })
      )
      // GET /cards/{id}/balance
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ statusCode: 200, message: 'ok', data: { currentBalance: 4500, availableBalance: 4500 } }),
          { status: 200 }
        )
      );
    const provider = createSudoVirtualCardProvider({
      apiKey: 'sudo_test_x',
      fundingAccountId: 'acct_funding_1',
      fetcher
    });
    const result = await provider.fundCard({ providerCardId: 'card_1', amountMinor: 500, reference: 'ref1' });
    expect(result.balanceMinor).toBe(4500);

    const [transferUrl, transferInit] = fetcher.mock.calls[1] as [string, RequestInit];
    expect(transferUrl).toBe('https://api.sudo.africa/accounts/transfer');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const body = JSON.parse(transferInit.body as string);
    expect(body).toMatchObject({
      debitAccountId: 'acct_funding_1',
      creditAccountId: 'acct_card_1',
      amount: 500, // minor units — live-confirmed via sandbox balance math
      paymentReference: 'ref1'
    });
  });

  it('freezes and unfreezes a card via PUT /cards/{id} status transitions', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ statusCode: 200, data: {} }), { status: 200 }));
    const provider = createSudoVirtualCardProvider({ apiKey: 'sudo_test_x', fetcher });

    const frozen = await provider.freezeCard('card_1');
    expect(frozen.status).toBe('FROZEN');
    const [freezeUrl, freezeInit] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(freezeUrl).toBe('https://api.sudo.africa/cards/card_1');
    expect(freezeInit.method).toBe('PUT');
    expect(JSON.parse(freezeInit.body as string)).toEqual({ status: 'inactive' });

    const active = await provider.unfreezeCard('card_1');
    expect(active.status).toBe('ACTIVE');
    const [, unfreezeInit] = fetcher.mock.calls[1] as [string, RequestInit];
    expect(JSON.parse(unfreezeInit.body as string)).toEqual({ status: 'active' });
  });

  it('throws (does not guess) on terminateCard', () => {
    const provider = createSudoVirtualCardProvider({ apiKey: 'sudo_test_x' });
    expect(() => provider.terminateCard('card_1')).toThrow(/cancellationReason/);
  });

  it('getCard maps a live-shaped GET /cards/{id} + GET /cards/{id}/balance response', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            statusCode: 200,
            message: 'ok',
            data: {
              _id: 'card_1',
              brand: 'MasterCard',
              currency: 'NGN',
              maskedPan: '506321*********3765',
              expiryMonth: '08',
              expiryYear: '2029',
              status: 'inactive'
            }
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ statusCode: 200, message: 'ok', data: { currentBalance: 4000, availableBalance: 4000 } }),
          { status: 200 }
        )
      );
    const provider = createSudoVirtualCardProvider({ apiKey: 'sudo_test_x', fetcher });
    const card = await provider.getCard('card_1');
    expect(card.brand).toBe('MASTERCARD');
    expect(card.status).toBe('FROZEN');
    expect(card.last4).toBe('3765');
    expect(card.balanceMinor).toBe(4000);
  });
});

describe('Maplerad virtual card adapter — mapped against official docs + live-verified sandbox behavior', () => {
  it('rejects issueCard with no providerCustomerId', async () => {
    const provider = createMapleradVirtualCardProvider({ apiKey: 'mpr_sandbox_sk_x' });
    await expect(
      provider.issueCard({
        reference: 'ref1',
        cardholderName: 'Test Cardholder',
        currency: 'USD',
        fundingAmountMinor: 200
      })
    ).rejects.toThrow(/providerCustomerId/);
  });

  it('issues a card: creates async, polls GET /issuing/?customer_id=... for the new card', async () => {
    const beforeList = new Response(
      JSON.stringify({ status: true, message: 'ok', data: [], meta: { page: 1, page_size: 50, total: 0 } }),
      { status: 200 }
    );
    const createResponse = new Response(
      JSON.stringify({ status: true, message: 'Card creation in progress', data: { reference: 'd8792f11-x' } }),
      { status: 200 }
    );
    const afterList = new Response(
      JSON.stringify({
        status: true,
        message: 'ok',
        data: [
          {
            id: '15b94ef8-4a42-4df4-894f-68189f45c5b0',
            name: 'User Test',
            masked_pan: '222183******7030',
            expiry: '08/31',
            status: 'ACTIVE',
            issuer: 'VISA',
            currency: 'USD',
            balance: 200
          }
        ],
        meta: { page: 1, page_size: 50, total: 1 }
      }),
      { status: 200 }
    );
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(beforeList)
      .mockResolvedValueOnce(createResponse)
      .mockResolvedValueOnce(afterList);

    const provider = createMapleradVirtualCardProvider({ apiKey: 'mpr_sandbox_sk_x', fetcher });
    const card = await provider.issueCard({
      reference: 'ref1',
      cardholderName: 'Test Cardholder',
      currency: 'USD',
      fundingAmountMinor: 200,
      providerCustomerId: '416e2f6d-ed4a-42c6-adaa-c349fef9a290',
      brand: 'VISA'
    });

    expect(card.providerCardId).toBe('15b94ef8-4a42-4df4-894f-68189f45c5b0');
    expect(card.last4).toBe('7030');
    expect(card.expiryMonth).toBe(8);
    expect(card.expiryYear).toBe(2031);
    expect(card.brand).toBe('VISA');
    expect(card.status).toBe('ACTIVE');
    expect(card.currency).toBe('USD');

    const [createUrl, createInit] = fetcher.mock.calls[1] as [string, RequestInit];
    expect(createUrl).toBe('https://api.maplerad.com/v1/issuing/');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const createBody = JSON.parse(createInit.body as string);
    expect(createBody).toMatchObject({
      customer_id: '416e2f6d-ed4a-42c6-adaa-c349fef9a290',
      currency: 'USD',
      type: 'VIRTUAL',
      auto_approve: true,
      brand: 'VISA',
      amount: 200
    });
  }, 10000);

  it('surfaces the Tier-1-required business error as a ProviderApiError', async () => {
    const beforeList = new Response(
      JSON.stringify({ status: true, message: 'ok', data: [], meta: { page: 1, page_size: 50, total: 0 } }),
      { status: 200 }
    );
    const tier1Error = new Response(
      JSON.stringify({ status: false, message: 'service is only available for Tier 1 customers' }),
      { status: 200 }
    );
    const fetcher = vi.fn().mockResolvedValueOnce(beforeList).mockResolvedValueOnce(tier1Error);
    const provider = createMapleradVirtualCardProvider({ apiKey: 'mpr_sandbox_sk_x', fetcher });
    await expect(
      provider.issueCard({
        reference: 'ref1',
        cardholderName: 'Test Cardholder',
        currency: 'USD',
        fundingAmountMinor: 200,
        providerCustomerId: 'cust_tier0'
      })
    ).rejects.toThrow(/Tier 1/);
  });

  it('funds a card via POST /issuing/{id}/fund', async () => {
    const fundResponse = new Response(
      JSON.stringify({ status: true, message: 'Successfully funded card', data: { id: 'txn_1' } }),
      { status: 200 }
    );
    const getCardResponse = new Response(
      JSON.stringify({
        status: true,
        message: 'ok',
        data: {
          id: 'card_1',
          masked_pan: '222183******7030',
          expiry: '08/31',
          status: 'ACTIVE',
          issuer: 'VISA',
          currency: 'USD',
          balance: 700
        }
      }),
      { status: 200 }
    );
    const fetcher = vi.fn().mockResolvedValueOnce(fundResponse).mockResolvedValueOnce(getCardResponse);
    const provider = createMapleradVirtualCardProvider({ apiKey: 'mpr_sandbox_sk_x', fetcher });
    const result = await provider.fundCard({ providerCardId: 'card_1', amountMinor: 500, reference: 'ref1' });
    expect(result.balanceMinor).toBe(700);

    const [fundUrl, fundInit] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(fundUrl).toBe('https://api.maplerad.com/v1/issuing/card_1/fund');
    expect(JSON.parse(fundInit.body as string)).toEqual({ amount: 500 });
  });

  it('freezes and unfreezes a card via PATCH /issuing/{id}/freeze|/unfreeze', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ status: true, message: 'ok' }), { status: 200 }));
    const provider = createMapleradVirtualCardProvider({ apiKey: 'mpr_sandbox_sk_x', fetcher });

    const frozen = await provider.freezeCard('card_1');
    expect(frozen.status).toBe('FROZEN');
    const [freezeUrl, freezeInit] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(freezeUrl).toBe('https://api.maplerad.com/v1/issuing/card_1/freeze');
    expect(freezeInit.method).toBe('PATCH');

    const active = await provider.unfreezeCard('card_1');
    expect(active.status).toBe('ACTIVE');
    const [unfreezeUrl] = fetcher.mock.calls[1] as [string, RequestInit];
    expect(unfreezeUrl).toBe('https://api.maplerad.com/v1/issuing/card_1/unfreeze');
  });

  it('throws (does not guess) on terminateCard — no documented endpoint exists', () => {
    const provider = createMapleradVirtualCardProvider({ apiKey: 'mpr_sandbox_sk_x' });
    expect(() => provider.terminateCard('card_1')).toThrow(/not implemented/);
  });

  it('getCard maps a live-shaped GET /issuing/{id} response', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          status: true,
          message: 'ok',
          data: {
            id: 'card_1',
            masked_pan: '222682******9166',
            expiry: '08/31',
            status: 'DISABLED',
            issuer: 'MASTERCARD',
            currency: 'USD',
            balance: 700
          }
        }),
        { status: 200 }
      )
    );
    const provider = createMapleradVirtualCardProvider({ apiKey: 'mpr_sandbox_sk_x', fetcher });
    const card = await provider.getCard('card_1');
    expect(card.brand).toBe('MASTERCARD');
    expect(card.status).toBe('FROZEN');
    expect(card.last4).toBe('9166');
    expect(card.balanceMinor).toBe(700);
  });
});
