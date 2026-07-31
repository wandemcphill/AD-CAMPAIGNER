// Gift card provider adapters. For Reloadly, wraps their official SDK.
// Mock adapter included for testing without live credentials.

import type {
  GiftCardSellProvider,
  GiftCardSellRate,
  GiftCardPurchaseProvider,
  GiftCardProduct
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
        recipientEmail: input.recipient?.email,
        recipientPhoneDetails: input.recipient?.phone
          ? {
              countryCode: product.region,
              phoneNumber: input.recipient.phone
            }
          : undefined
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
        failureReason: orderData.status === 'FAILED' ? 'Order failed at Reloadly' : undefined
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
      return {
        status: (
          orderData.status === 'SUCCESSFUL'
            ? 'DELIVERED'
            : orderData.status === 'FAILED'
              ? 'FAILED'
              : 'PROCESSING'
        ) as 'PROCESSING' | 'FULFILLED' | 'DELIVERED' | 'FAILED',
        codes: orderData.status === 'SUCCESSFUL' ? [orderData.transactionId] : undefined,
        failureReason: orderData.status === 'FAILED' ? 'Order failed' : undefined
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

// ─── Mock Gift Card Sell Provider (CI / tests) ──────────────────────────────────

export function createMockGiftCardSellProvider(
  name = 'mock-giftcard-sell'
): GiftCardSellProvider {
  return {
    name,

    async listSupportedBrands() {
      return ['Apple', 'Amazon', 'Steam', 'Google Play', 'PlayStation', 'Xbox'];
    },

    async getRate(brand, region, denomination) {
      return {
        brand,
        region,
        denomination,
        currency: 'USD',
        rateMinor: Math.floor(denomination * 100 * 0.92),
        rateTimestamp: new Date()
      };
    },

    async submitCard(input) {
      return {
        providerReference: `MOCK${input.reference.slice(0, 16).toUpperCase()}`,
        status: 'PROCESSING',
        failureReason: undefined
      };
    },

    async getTransactionStatus(reference) {
      return {
        status: 'PAID',
        payout: Math.floor(Math.random() * 50000) + 10000,
        payoutCurrency: 'NGN'
      };
    },

    async checkHealth() {
      return {
        status: 'HEALTHY',
        latencyMs: 50
      };
    }
  };
}

// ─── Mock Gift Card Purchase Provider (CI / tests) ───────────────────────────

export function createMockGiftCardPurchaseAdapter(
  name = 'mock-giftcard-buy'
): GiftCardPurchaseProvider {
  return {
    name,

    async getProducts() {
      return [
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
      ];
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

    async purchase(input) {
      return {
        supplierOrderId: `MOCK-${input.reference}`,
        status: 'PROCESSING',
        failureReason: undefined
      };
    },

    async getOrderStatus(orderId) {
      return {
        status: 'DELIVERED',
        codes: ['AAAA-BBBB-CCCC-DDDD'],
        failureReason: undefined
      };
    },

    async checkHealth() {
      return {
        status: 'HEALTHY',
        latencyMs: 50,
        balance: 50000
      };
    }
  };
}
