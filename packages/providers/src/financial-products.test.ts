import { describe, expect, it } from 'vitest';

import {
  createMockRemittanceProvider,
  createMockVirtualAccountProvider,
  createMockVirtualCardProvider
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
  it('quotes and sends a transfer', async () => {
    const provider = createMockRemittanceProvider();
    const quote = await provider.getQuote({
      sourceCurrency: 'NGN',
      destinationCurrency: 'USD',
      sourceAmountMinor: 100_000
    });
    expect(quote.feeMinor).toBeGreaterThan(0);

    const transfer = await provider.sendTransfer({
      reference: 'tx1',
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
        quoteId: 'nonexistent',
        recipient: { name: 'X', accountNumber: '0', bankCode: '0', country: 'US' }
      })
    ).rejects.toThrow();
  });
});
