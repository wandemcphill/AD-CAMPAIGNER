// Gift card provider adapters. For Reloadly, wraps their official SDK.
// Mock adapter included for testing without live credentials.

import type {
  GiftCardSellProvider,
  GiftCardPurchaseProvider
} from './index.js';

// ─── Reloadly Gift Card Purchase Adapter ──────────────────────────────────────

export interface ReloadlyConfig {
  clientId: string;
  clientSecret: string;
  sandbox?: boolean;
  fetcher?: typeof fetch;
}

interface ReloadlyAuthToken {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface ReloadlyProductResponse {
  id: string;
  operatorId: number;
  operatorName: string;
  product: string;
  productName: string;
  productCategory: string;
  countryCode: string;
  countryName: string;
  isActive: boolean;
  denominationType: 'VARIABLE' | 'FIXED';
  minAmount?: number;
  maxAmount?: number;
  fixedAmounts?: Array<{ amount: number; localAmount: number; currencyCode: string }>;
  fixedRecipientDenominations?: Array<{ amount: number; currencyCode: string }>;
  logoUrls?: string[];
  redeemInstruction?: {
    concise?: string;
    verbose?: string;
    imagesUrl?: string[];
  };
}

interface ReloadlyOrderRequest {
  productId: number;
  countryCode: string;
  quantity: number;
  unitPrice: number;
  customIdentifier?: string;
  senderName?: string;
  recipientEmail?: string;
  recipientPhoneDetails?: {
    countryCode: string;
    phoneNumber: string;
  };
}

interface ReloadlyOrderResponse {
  transactionId: string;
  amount: number;
  discount: number;
  currencyCode: string;
  fee: number;
  smsFee?: number;
  recipientEmail?: string;
  recipientPhone?: string;
  customIdentifier?: string;
  status: 'SUCCESSFUL' | 'PENDING' | 'FAILED';
  transactionCreatedTime: string;
  product: {
    productId: number;
    productName: string;
    countryCode: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    currencyCode: string;
    brand?: string;
  };
}

let reloadlyTokenCache: { token: string; expiresAt: Date } | null = null;

async function getReloadlyToken(config: ReloadlyConfig): Promise<string> {
  const now = new Date();
  if (reloadlyTokenCache && reloadlyTokenCache.expiresAt > now) {
    return reloadlyTokenCache.token;
  }

  const f = config.fetcher ?? fetch;
  const response = await f('https://auth.reloadly.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: 'client_credentials',
      audience: config.sandbox
        ? 'https://giftcards-sandbox.reloadly.com'
        : 'https://giftcards.reloadly.com'
    })
  });

  if (!response.ok) {
    throw new Error(`Reloadly auth failed: ${response.statusText}`);
  }

  const data = (await response.json()) as ReloadlyAuthToken;
  const expiresAt = new Date(now.getTime() + (data.expires_in - 60) * 1000);
  reloadlyTokenCache = { token: data.access_token, expiresAt };
  return data.access_token;
}

export function createReloadlyGiftCardAdapter(config: ReloadlyConfig): GiftCardPurchaseProvider {
  const baseUrl = config.sandbox
    ? 'https://giftcards-sandbox.reloadly.com'
    : 'https://giftcards.reloadly.com';
  const f = config.fetcher ?? fetch;

  return {
    name: 'reloadly',

    async getProducts(filters) {
      const token = await getReloadlyToken(config);
      const url = new URL(`${baseUrl}/products`);

      if (filters?.country) {
        url.searchParams.append('countryCode', filters.country);
      }

      const response = await f(url.toString(), {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error(`Reloadly getProducts failed: ${response.statusText}`);
      }

      const items = ((await response.json()) as ReloadlyProductResponse[]) || [];
      return items.map((p) => ({
        productId: p.id,
        brand: p.productName || p.product,
        region: p.countryCode,
        country: p.countryCode,
        denomination: p.fixedRecipientDenominations?.[0]?.amount || p.minAmount || 0,
        currency: p.fixedRecipientDenominations?.[0]?.currencyCode || 'USD',
        retailPrice: p.fixedRecipientDenominations?.[0]?.amount || 0,
        wholesalePrice: (p.fixedAmounts?.[0]?.amount || 0) * 0.95,
        available: p.isActive
      }));
    },

    async getProduct(productId) {
      const token = await getReloadlyToken(config);
      const response = await f(`${baseUrl}/products/${productId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error(`Reloadly getProduct failed: ${response.statusText}`);
      }

      const p = (await response.json()) as ReloadlyProductResponse;
      return {
        productId: p.id,
        brand: p.productName || p.product,
        region: p.countryCode,
        country: p.countryCode,
        denomination: p.fixedRecipientDenominations?.[0]?.amount || p.minAmount || 0,
        currency: p.fixedRecipientDenominations?.[0]?.currencyCode || 'USD',
        retailPrice: p.fixedRecipientDenominations?.[0]?.amount || 0,
        wholesalePrice: (p.fixedAmounts?.[0]?.amount || 0) * 0.95,
        available: p.isActive
      };
    },

    async getPrice(productId, quantity = 1) {
      const token = await getReloadlyToken(config);
      const response = await f(`${baseUrl}/products/${productId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error(`Reloadly getPrice failed: ${response.statusText}`);
      }

      const p = (await response.json()) as ReloadlyProductResponse;
      const unitPrice = p.fixedRecipientDenominations?.[0]?.amount || p.minAmount || 0;
      return {
        productId,
        price: unitPrice * quantity,
        fee: Math.ceil(unitPrice * 0.02)
      };
    },

    async purchase(input) {
      const token = await getReloadlyToken(config);

      const product = await this.getProduct(input.productId);
      const unitPrice = product.retailPrice;

      const body: ReloadlyOrderRequest = {
        productId: parseInt(input.productId),
        countryCode: product.region,
        quantity: input.quantity,
        unitPrice,
        customIdentifier: input.reference,
        ...(input.recipient?.email ? { recipientEmail: input.recipient.email } : {}),
        ...(input.recipient?.phone
          ? { recipientPhoneDetails: { countryCode: product.region, phoneNumber: input.recipient.phone } }
          : {})
      };

      const response = await f(`${baseUrl}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorData = await response.text();
        return {
          supplierOrderId: '',
          status: 'AMBIGUOUS' as const,
          failureReason: `Reloadly order failed: ${response.statusText} - ${errorData}`
        };
      }

      const orderData = (await response.json()) as ReloadlyOrderResponse;
      const status =
        orderData.status === 'SUCCESSFUL'
          ? ('PROCESSING' as const)
          : orderData.status === 'FAILED'
            ? ('AMBIGUOUS' as const)
            : ('PROCESSING' as const);

      return {
        supplierOrderId: orderData.transactionId,
        status,
        ...(orderData.status === 'FAILED' ? { failureReason: 'Order failed at Reloadly' } : {})
      };
    },

    async getOrderStatus(orderId) {
      const token = await getReloadlyToken(config);
      const response = await f(`${baseUrl}/orders/${orderId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) {
        return {
          status: 'FAILED' as const,
          failureReason: `Could not fetch order status: ${response.statusText}`
        };
      }

      const orderData = (await response.json()) as ReloadlyOrderResponse;
      const orderStatus = (
        orderData.status === 'SUCCESSFUL'
          ? 'DELIVERED'
          : orderData.status === 'FAILED'
            ? 'FAILED'
            : 'PROCESSING'
      ) as 'PROCESSING' | 'FULFILLED' | 'DELIVERED' | 'FAILED';
      return {
        status: orderStatus,
        ...(orderData.status === 'SUCCESSFUL' ? { codes: [orderData.transactionId] } : {}),
        ...(orderData.status === 'FAILED' ? { failureReason: 'Order failed' } : {})
      };
    },

    async checkHealth() {
      const start = Date.now();
      try {
        const token = await getReloadlyToken(config);
        const response = await f(`${baseUrl}/products?limit=1`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        return {
          status: response.ok ? ('HEALTHY' as const) : ('DEGRADED' as const),
          latencyMs: Date.now() - start
        };
      } catch {
        return {
          status: 'DOWN' as const,
          latencyMs: Date.now() - start
        };
      }
    }
  };
}

// ─── Sogo Gift Card Sell Adapter ─────────────────────────────────────────────

export interface SogoConfig {
  apiKey: string;
  sandbox?: boolean;
  fetcher?: typeof fetch;
}

interface SogoCatalogItem {
  slug: string;
  name: string;
  currencies: string[];
  denominations: number[];
  card_types: string[];
  requires_pin: boolean;
  is_active: boolean;
}

interface SogoRateData {
  slug: string;
  name: string;
  rates: Record<string, Record<string, Record<string, number | Record<string, number>>>>;
}

interface SogoSubmitResponse {
  id: string;
  slug: string;
  status: string;
  payout_currency: string;
  payout_amount: number;
  created_at: string;
}

export function createSogoGiftCardAdapter(config: SogoConfig): GiftCardSellProvider {
  const baseUrl = config.sandbox
    ? 'https://sandbox.sogo.africa/v1'
    : 'https://api.sogo.africa/v1';
  const f = config.fetcher ?? fetch;

  return {
    name: 'sogo',

    async listSupportedBrands() {
      const response = await f(`${baseUrl}/gift-cards/sell/catalog`, {
        headers: { Authorization: `Bearer ${config.apiKey}` }
      });

      if (!response.ok) {
        throw new Error(`Sogo catalog failed: ${response.statusText}`);
      }

      const body = (await response.json()) as { data: SogoCatalogItem[] };
      return body.data
        .filter((item) => item.is_active)
        .map((item) => item.name);
    },

    async getRate(brand, region, denomination) {
      const response = await f(`${baseUrl}/gift-cards/sell/rates`, {
        headers: { Authorization: `Bearer ${config.apiKey}` }
      });

      if (!response.ok) {
        throw new Error(`Sogo rates failed: ${response.statusText}`);
      }

      const body = (await response.json()) as { data: SogoRateData[] };
      const item = body.data.find(
        (r) => r.name.toLowerCase() === brand.toLowerCase()
      );

      if (!item) {
        throw new Error(`Brand ${brand} not found in Sogo catalog`);
      }

      // Navigate nested rate structure: rates[currency][cardType][targetCurrency]
      // For simplicity, assume we're converting to NGN
      let rateMinor = 0;
      for (const currencyRates of Object.values(item.rates)) {
        if (typeof currencyRates === 'object') {
          for (const cardTypeRates of Object.values(currencyRates)) {
            if (typeof cardTypeRates === 'object') {
              // cardTypeRates could be { NGN: number } or { NGN: { receipt_type: number } }
              if (typeof cardTypeRates.NGN === 'number') {
                rateMinor = Math.floor(cardTypeRates.NGN * 100);
                break;
              } else if (typeof cardTypeRates.NGN === 'object') {
                // Pick the best (highest) rate among receipt types
                const rates = Object.values(cardTypeRates.NGN);
                rateMinor = Math.floor(Math.max(...rates) * 100);
                break;
              }
            }
          }
          if (rateMinor > 0) break;
        }
      }

      return {
        brand,
        region,
        denomination,
        currency: 'NGN',
        rateMinor,
        rateTimestamp: new Date()
      };
    },

    async submitCard(input) {
      const idempotencyKey = `${input.reference}-${Date.now()}`;
      const currency = input.cardInfo.currency || 'USD';
      const cardCode = input.cardInfo.cardCode || '';
      const slug = input.reference.split('-')[0] || input.reference;

      const response = await f(`${baseUrl}/gift-cards/sell`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
          'Idempotency-Key': idempotencyKey
        },
        body: JSON.stringify({
          slug: slug.toLowerCase(),
          card_country: input.region,
          card_type: 'ecode',
          card_currency: currency,
          card_amount: input.denomination,
          additional_info: cardCode,
          payout_currency: 'NGN'
        })
      });

      if (!response.ok) {
        const errorData = await response.text();
        return {
          providerReference: '',
          status: 'AMBIGUOUS' as const,
          failureReason: `Sogo submit failed: ${response.statusText} - ${errorData}`
        };
      }

      const result = (await response.json()) as SogoSubmitResponse;

      return {
        providerReference: result.id,
        status: 'PROCESSING' as const
      };
    },

    getTransactionStatus() {
      // Sogo webhooks drive status updates, not polling
      // This endpoint would require a GET /transactions/{id} endpoint
      // which may not be documented. For now, return PROCESSING and rely on webhooks.
      return Promise.resolve({
        status: 'PROCESSING' as const
      });
    },

    async checkHealth() {
      const start = Date.now();
      try {
        const response = await f(`${baseUrl}/gift-cards/sell/catalog`, {
          headers: { Authorization: `Bearer ${config.apiKey}` }
        });

        return {
          status: response.ok ? ('HEALTHY' as const) : ('DEGRADED' as const),
          latencyMs: Date.now() - start
        };
      } catch {
        return {
          status: 'DOWN' as const,
          latencyMs: Date.now() - start
        };
      }
    }
  };
}

// ─── Mock Gift Card Sell Provider (CI / tests) ──────────────────────────────────

export function createMockGiftCardSellProvider(
  name = 'mock-giftcard-sell'
): GiftCardSellProvider {
  return {
    name,

    listSupportedBrands(): Promise<string[]> {
      return Promise.resolve(['Apple', 'Amazon', 'Steam', 'Google Play', 'PlayStation', 'Xbox']);
    },

    getRate(brand, region, denomination) {
      return Promise.resolve({
        brand,
        region,
        denomination,
        currency: 'USD',
        rateMinor: Math.floor(denomination * 100 * 0.92),
        rateTimestamp: new Date()
      });
    },

    submitCard(input) {
      return Promise.resolve({
        providerReference: `MOCK${input.reference.slice(0, 16).toUpperCase()}`,
        status: 'PROCESSING' as const
      });
    },

    getTransactionStatus() {
      return Promise.resolve({
        status: 'PAID' as const,
        payout: Math.floor(Math.random() * 50000) + 10000,
        payoutCurrency: 'NGN'
      });
    },

    checkHealth() {
      return Promise.resolve({
        status: 'HEALTHY' as const,
        latencyMs: 50
      });
    }
  };
}

// ─── Mock Gift Card Purchase Provider (CI / tests) ───────────────────────────

export function createMockGiftCardPurchaseAdapter(
  name = 'mock-giftcard-buy'
): GiftCardPurchaseProvider {
  return {
    name,

    getProducts() {
      return Promise.resolve([
        {
          productId: 'steam-100',
          brand: 'Steam',
          region: 'US',
          country: 'US',
          denomination: 100,
          currency: 'USD',
          retailPrice: 100,
          wholesalePrice: 95,
          available: true
        },
        {
          productId: 'amazon-50',
          brand: 'Amazon',
          region: 'US',
          country: 'US',
          denomination: 50,
          currency: 'USD',
          retailPrice: 50,
          wholesalePrice: 47,
          available: true
        }
      ]);
    },

    async getProduct(productId) {
      const products = await this.getProducts();
      const product = products.find((p) => p.productId === productId);
      if (!product) throw new Error(`Product ${productId} not found`);
      return product;
    },

    async getPrice(productId, quantity = 1) {
      const product = await this.getProduct(productId);
      return {
        productId,
        price: product.retailPrice * quantity,
        fee: Math.ceil(product.retailPrice * 0.02)
      };
    },

    purchase(input) {
      return Promise.resolve({
        supplierOrderId: `MOCK-${input.reference}`,
        status: 'PROCESSING' as const
      });
    },

    getOrderStatus() {
      return Promise.resolve({
        status: 'DELIVERED' as const,
        codes: ['AAAA-BBBB-CCCC-DDDD']
      });
    },

    checkHealth() {
      return Promise.resolve({
        status: 'HEALTHY' as const,
        latencyMs: 50,
        balance: 50000
      });
    }
  };
}
