import type {
  Campaign,
  CampaignObjective,
  CurrencyCode,
  DestinationKind,
  Money,
  PaymentIntent,
  PromotionDestination,
  SmmOrder,
  SmmServiceKind
} from "@fliptrybe/types";

export interface CampaignQuoteRequest {
  objective: CampaignObjective;
  budgetMinor: number;
  currency: CurrencyCode;
  destinationKind: DestinationKind;
}

export interface CampaignQuote {
  estimatedReach: {
    min: number;
    max: number;
  };
  estimatedCpmMinor: number;
  currency: CurrencyCode;
}

export interface AdsProviderAdapter {
  readonly name: string;
  quoteCampaign(request: CampaignQuoteRequest): Promise<CampaignQuote>;
  createCampaign(campaign: Campaign): Promise<{ providerReference: string; status: Campaign["status"] }>;
  startCampaign(providerReference: string): Promise<{ status: Campaign["status"] }>;
  pauseCampaign(providerReference: string): Promise<{ status: Campaign["status"] }>;
}

export interface PaymentGatewayAdapter {
  readonly name: string;
  createPaymentIntent(input: { amount: Money; workspaceId: string }): Promise<PaymentIntent>;
  verifyPayment(reference: string): Promise<{ status: PaymentIntent["status"]; providerReference: string }>;
}

export interface SmmSupplierAdapter {
  readonly name: string;
  quoteService(input: {
    serviceKind: SmmServiceKind;
    quantity: number;
    destination: PromotionDestination;
  }): Promise<{ amount: Money; estimatedDeliveryMinutes: number }>;
  createOrder(order: SmmOrder): Promise<{ supplierReference: string; status: SmmOrder["status"] }>;
}

export interface AiGenerationAdapter {
  readonly name: string;
  generateCampaignCopy(input: {
    objective: CampaignObjective;
    destinationKind: DestinationKind;
    audience: string;
  }): Promise<{ headlines: string[]; captions: string[]; hashtags: string[] }>;
}

export interface NotificationProviderAdapter {
  readonly name: string;
  send(input: { channel: "EMAIL" | "IN_APP" | "WEBSOCKET" | "WHATSAPP"; to: string; title: string; body: string }): Promise<{ id: string; accepted: boolean }>;
}

export interface StorageProviderAdapter {
  readonly name: string;
  createUploadUrl(input: { key: string; contentType: string }): Promise<{ uploadUrl: string; publicUrl: string }>;
}

function makeId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 12)}`;
}

export function createMockAdsProvider(): AdsProviderAdapter {
  return {
    name: "mock-ads",
    quoteCampaign(request) {
      const budgetFactor = Math.max(1, Math.floor(request.budgetMinor / 1000));

      return Promise.resolve({
        estimatedReach: {
          min: budgetFactor * 18,
          max: budgetFactor * 42
        },
        estimatedCpmMinor: request.destinationKind.includes("LIVE") ? 1500 : 900,
        currency: request.currency
      });
    },
    createCampaign() {
      return Promise.resolve({ providerReference: makeId("mock_ads"), status: "QUEUED" });
    },
    startCampaign() {
      return Promise.resolve({ status: "ACTIVE" });
    },
    pauseCampaign() {
      return Promise.resolve({ status: "PAUSED" });
    }
  };
}

export function createMockPaymentGateway(): PaymentGatewayAdapter {
  return {
    name: "mock-payments",
    createPaymentIntent(input) {
      const now = new Date().toISOString();

      return Promise.resolve({
        id: makeId("pay"),
        workspaceId: input.workspaceId,
        gateway: "MOCK",
        amount: input.amount,
        status: "PENDING",
        providerReference: makeId("mock_payment"),
        createdAt: now,
        updatedAt: now
      });
    },
    verifyPayment(reference) {
      return Promise.resolve({ status: "COMPLETED", providerReference: reference });
    }
  };
}

export function createMockSmmSupplier(): SmmSupplierAdapter {
  return {
    name: "mock-smm",
    quoteService(input) {
      return Promise.resolve({
        amount: { amountMinor: input.quantity * 25, currency: "NGN" },
        estimatedDeliveryMinutes: input.serviceKind === "LIVE_VIEWERS" ? 10 : 120
      });
    },
    createOrder() {
      return Promise.resolve({ supplierReference: makeId("mock_smm"), status: "QUEUED" });
    }
  };
}

export function createMockAiProvider(): AiGenerationAdapter {
  return {
    name: "mock-ai",
    generateCampaignCopy(input) {
      return Promise.resolve({
        headlines: [`Grow your ${input.destinationKind.toLowerCase().replaceAll("_", " ")} today`],
        captions: [`A focused ${input.objective.toLowerCase()} campaign for ${input.audience}.`],
        hashtags: ["#FlipTrybe", "#Growth", "#CreatorBusiness"]
      });
    }
  };
}

export function createMockNotificationProvider(): NotificationProviderAdapter {
  return {
    name: "mock-notifications",
    send() {
      return Promise.resolve({ id: makeId("ntf"), accepted: true });
    }
  };
}

export function createMockStorageProvider(): StorageProviderAdapter {
  return {
    name: "mock-storage",
    createUploadUrl(input) {
      return Promise.resolve({
        uploadUrl: `https://storage.mock/upload/${input.key}`,
        publicUrl: `https://cdn.mock/${input.key}`
      });
    }
  };
}
