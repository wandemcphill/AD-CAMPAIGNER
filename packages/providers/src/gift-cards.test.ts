import { describe, expect, it, vi } from 'vitest';

import { createSogoGiftCardAdapter } from './gift-cards';

function jsonResponse(body: unknown, ok = true, statusText = 'OK') {
  return {
    ok,
    statusText,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body))
  } as Response;
}

describe('createSogoGiftCardAdapter', () => {
  it('uses the SOGO provider name expected by webhook reconciliation', () => {
    const adapter = createSogoGiftCardAdapter({ apiKey: 'test', fetcher: vi.fn<typeof fetch>() });

    expect(adapter.name).toBe('SOGO');
  });

  it('resolves brand names through the SOGO catalog before fetching a sell rate', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({
          data: [
            {
              slug: 'apple-gift-card',
              name: 'Apple Gift Card',
              currencies: ['USD'],
              denominations: [100],
              card_types: ['ecode'],
              requires_pin: false,
              is_active: true
            }
          ]
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: [
            {
              slug: 'apple-gift-card',
              name: 'Apple Gift Card',
              rates: {
                USD: {
                  ecode: {
                    NGN: 900
                  }
                }
              }
            }
          ]
        })
      );

    const adapter = createSogoGiftCardAdapter({
      apiKey: 'test',
      sandbox: true,
      fetcher
    });

    const rate = await adapter.getRate('APPLE_GIFT_CARD', 'US', 100);

    expect(rate).toMatchObject({
      brand: 'APPLE_GIFT_CARD',
      region: 'US',
      denomination: 100,
      currency: 'NGN',
      rateMinor: 90000
    });
    expect(fetcher).toHaveBeenNthCalledWith(
      1,
      'https://sandbox.sogo.africa/v1/gift-cards/sell/catalog',
      expect.objectContaining({ headers: { Authorization: 'Bearer test' } })
    );
  });

  it('submits sell requests with the SOGO catalog slug and stable idempotency key', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({
          data: [
            {
              slug: 'steam',
              name: 'Steam',
              currencies: ['USD'],
              denominations: [50],
              card_types: ['ecode'],
              requires_pin: false,
              is_active: true
            }
          ]
        })
      )
      .mockResolvedValueOnce(jsonResponse({ id: 'sogo_txn_1', status: 'processing' }));

    const adapter = createSogoGiftCardAdapter({
      apiKey: 'test',
      sandbox: true,
      fetcher
    });

    const result = await adapter.submitCard({
      reference: 'gcs_123',
      brand: 'Steam',
      region: 'US',
      denomination: 50,
      cardInfo: {
        currency: 'USD',
        cardCode: 'AAAA-BBBB',
        cardType: 'ecode'
      }
    });

    expect(result).toEqual({ providerReference: 'sogo_txn_1', status: 'PROCESSING' });
    const sellRequest = fetcher.mock.calls[1];
    const sellRequestInit = sellRequest?.[1];

    expect(sellRequest?.[0]).toBe('https://sandbox.sogo.africa/v1/gift-cards/sell');
    expect(sellRequestInit?.method).toBe('POST');
    expect(new Headers(sellRequestInit?.headers).get('Authorization')).toBe('Bearer test');
    expect(new Headers(sellRequestInit?.headers).get('Idempotency-Key')).toBe('gcs_123');
    expect(sellRequestInit?.body).toBe(
      JSON.stringify({
        reference: 'gcs_123',
        slug: 'steam',
        card_country: 'US',
        card_type: 'ecode',
        card_currency: 'USD',
        card_amount: 50,
        additional_info: 'AAAA-BBBB',
        payout_currency: 'NGN'
      })
    );
  });
});
