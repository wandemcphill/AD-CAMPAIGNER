import { describe, expect, it, vi } from 'vitest';

import { createSogoRmbAdapter, SogoRmbProviderError } from './rmb';

function jsonResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body))
  } as Response;
}

describe('createSogoRmbAdapter', () => {
  it('loads live-shaped RMB rates from the Sogo endpoint', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        data: {
          channels: [
            {
              channel: 'alipay',
              name: 'Alipay',
              is_available: true,
              account_types: [
                {
                  type: 'nigerian',
                  name: 'Nigerian account',
                  is_available: true,
                  rates: [{ min_rmb: 100, max_rmb: null, ngn_per_rmb: 230 }]
                }
              ],
              rates: []
            }
          ],
          limits: { min_rmb: 100, max_rmb: 50000, currency: 'CNY' }
        }
      })
    );

    const adapter = createSogoRmbAdapter({ apiKey: 'sogo_sk_test_demo', sandbox: true, fetcher });
    const rates = await adapter.getRates();

    expect(rates.channels[0]).toMatchObject({
      channel: 'alipay',
      isAvailable: true,
      accountTypes: [{ type: 'nigerian', rates: [{ minRmb: 100, ngnPerRmb: 230 }] }]
    });
    expect(fetcher).toHaveBeenCalledWith(
      'https://sandbox.sogo.africa/v1/rmb/buy/rates',
      expect.objectContaining({ headers: { Authorization: 'Bearer sogo_sk_test_demo' } })
    );
  });

  it('sends recipient_name, QR code, account type and idempotency key on RMB buy', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce({ ok: true, blob: () => Promise.resolve(new Blob(['qr'])) } as Response)
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            reference: 'sogo_rmb_123',
            exchange_rate: 230,
            ngn_amount: { raw: 2300 }
          }
        })
      );

    const adapter = createSogoRmbAdapter({ apiKey: 'sogo_sk_test_demo', sandbox: true, fetcher });
    const result = await adapter.submitOrder({
      channel: 'alipay',
      accountType: 'nigerian',
      rmbAmount: 10,
      recipientName: 'Zhang Wei',
      recipientIdentifier: 'recipient1234',
      qrCodeUrl: 'https://storage.example/qr.jpg',
      description: 'Invoice 12345',
      idempotencyKey: '550e8400-e29b-41d4-a716-446655440000'
    });

    expect(result).toEqual({
      providerReference: 'sogo_rmb_123',
      status: 'processing',
      exchangeRate: 230,
      ngnAmountMinor: 230000
    });

    const init = fetcher.mock.calls[1]?.[1];
    const form = init?.body as FormData;
    expect(fetcher.mock.calls[1]?.[0]).toBe('https://sandbox.sogo.africa/v1/rmb/buy');
    expect(init?.method).toBe('POST');
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer sogo_sk_test_demo');
    expect(new Headers(init?.headers).get('Idempotency-Key')).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(form.get('channel')).toBe('alipay');
    expect(form.get('alipay_account_type')).toBe('nigerian');
    expect(form.get('rmb_amount')).toBe('10');
    expect(form.get('recipient_name')).toBe('Zhang Wei');
    expect(form.get('recipient_identifier')).toBe('recipient1234');
    expect(form.get('description')).toBe('Invoice 12345');
    expect(form.get('qr_code')).toBeInstanceOf(Blob);
  });

  it('surfaces structured provider errors instead of masking them', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({ error: { code: 'invalid_scope', message: 'Missing rmb:read' } }, false, 403)
    );

    const adapter = createSogoRmbAdapter({ apiKey: 'bad-key', fetcher });

    await expect(adapter.getRates()).rejects.toBeInstanceOf(SogoRmbProviderError);
    const error = await adapter.getRates().catch((caught: unknown) => caught);
    expect(error).toMatchObject({ statusCode: 403 });
  });
});
