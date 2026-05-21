import type { SmmSupplierAdapter, SmmSupplierQuote } from "@fliptrybe/providers";
import type {
  CurrencyCode,
  DestinationKind,
  Money,
  PromotionDestination,
  SmmOrder,
  SmmServiceKind
} from "@fliptrybe/types";

export type SmmFraudRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "BLOCKED";
export type SmmFraudAction = "ALLOW" | "REVIEW" | "BLOCK";
export type SmmSupplierHealthStatus = "healthy" | "degraded" | "down";

export interface SmmPricingRule {
  serviceKind: SmmServiceKind;
  markupBps: number;
  rushMarkupBps: number;
  minimumMarginMinor: number;
  platformFeeMinor: number;
}

export interface SmmMarginResult {
  supplierCost: Money;
  customerPrice: Money;
  grossMargin: Money;
  marginBps: number;
  isProfitable: boolean;
}

export interface SmmPricedQuote extends SmmMarginResult {
  estimatedDeliveryMinutes: number;
  markupBps: number;
  minimumMarginApplied: boolean;
  supplierName?: string;
}

export interface SmmFraudSignal {
  code: string;
  message: string;
  score: number;
  severity: Exclude<SmmFraudRiskLevel, "LOW">;
}

export interface SmmFraudAssessment {
  score: number;
  riskLevel: SmmFraudRiskLevel;
  action: SmmFraudAction;
  signals: SmmFraudSignal[];
}

export interface SmmRetryPolicy {
  attempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitterRatio: number;
}

export interface SmmFulfillmentQueueJob {
  orderId: string;
  workspaceId: string;
  serviceKind: SmmServiceKind;
  destinationKind: DestinationKind;
  destinationUrl: string;
  quantity: number;
  supplierName?: string;
  supplierCost: Money;
  customerPrice: Money;
  grossMargin: Money;
  fraudRiskLevel: SmmFraudRiskLevel;
  retryPolicy: SmmRetryPolicy;
  enqueuedAt: string;
}

export interface SmmSupplierHealth {
  supplierName: string;
  status: SmmSupplierHealthStatus;
  latencyMs: number;
  checkedAt: string;
  reason?: string;
}

export interface SmmServiceHealthMonitor {
  checkSupplier(supplier: SmmSupplierAdapter): Promise<SmmSupplierHealth>;
  checkAll(): Promise<SmmSupplierHealth[]>;
}

export const smmService = {
  name: "smm",
  responsibilities: [
    "supplier APIs",
    "service catalog",
    "fulfillment",
    "retry policy",
    "pricing",
    "margin control",
    "fraud detection",
    "supplier health"
  ]
} as const;

export const defaultSmmPricingRules: SmmPricingRule[] = [
  {
    serviceKind: "FOLLOWERS",
    markupBps: 4500,
    rushMarkupBps: 1500,
    minimumMarginMinor: 150,
    platformFeeMinor: 50
  },
  {
    serviceKind: "LIKES",
    markupBps: 4000,
    rushMarkupBps: 1000,
    minimumMarginMinor: 100,
    platformFeeMinor: 25
  },
  {
    serviceKind: "VIEWS",
    markupBps: 3500,
    rushMarkupBps: 1000,
    minimumMarginMinor: 75,
    platformFeeMinor: 25
  },
  {
    serviceKind: "COMMENTS",
    markupBps: 6000,
    rushMarkupBps: 2000,
    minimumMarginMinor: 250,
    platformFeeMinor: 75
  },
  {
    serviceKind: "SHARES",
    markupBps: 4000,
    rushMarkupBps: 1000,
    minimumMarginMinor: 100,
    platformFeeMinor: 25
  },
  {
    serviceKind: "LIVE_VIEWERS",
    markupBps: 6500,
    rushMarkupBps: 2500,
    minimumMarginMinor: 300,
    platformFeeMinor: 100
  },
  {
    serviceKind: "CHANNEL_MEMBERS",
    markupBps: 5000,
    rushMarkupBps: 1500,
    minimumMarginMinor: 200,
    platformFeeMinor: 50
  }
];

export const defaultSmmRetryPolicy: SmmRetryPolicy = {
  attempts: 5,
  baseDelayMs: 30_000,
  maxDelayMs: 900_000,
  jitterRatio: 0.2
};

const sampleDestination: PromotionDestination = {
  kind: "INSTAGRAM_PROFILE",
  url: "https://instagram.com/fliptrybe"
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(value, max));
}

function requireSameCurrency(left: Money, right: Money) {
  if (left.currency !== right.currency) {
    throw new Error(`Cannot compare ${left.currency} and ${right.currency} SMM money values.`);
  }
}

function getRule(serviceKind: SmmServiceKind, rules: SmmPricingRule[]) {
  const rule = rules.find((item) => item.serviceKind === serviceKind);

  if (!rule) {
    throw new Error(`Missing SMM pricing rule for ${serviceKind}.`);
  }

  return rule;
}

function getRisk(score: number): Pick<SmmFraudAssessment, "action" | "riskLevel"> {
  if (score >= 90) {
    return { action: "BLOCK", riskLevel: "BLOCKED" };
  }
  if (score >= 60) {
    return { action: "REVIEW", riskLevel: "HIGH" };
  }
  if (score >= 30) {
    return { action: "REVIEW", riskLevel: "MEDIUM" };
  }

  return { action: "ALLOW", riskLevel: "LOW" };
}

function hasValidPublicUrl(destination: PromotionDestination) {
  try {
    const url = new URL(destination.url);
    const hostname = url.hostname.toLowerCase();

    return (
      (url.protocol === "https:" || url.protocol === "http:") &&
      hostname.includes(".") &&
      hostname !== "localhost"
    );
  } catch {
    return false;
  }
}

function destinationMatchesService(order: SmmOrder) {
  const destination = order.destination.kind;

  if (order.serviceKind === "LIVE_VIEWERS") {
    return destination.includes("LIVE");
  }
  if (order.serviceKind === "CHANNEL_MEMBERS") {
    return destination.includes("CHANNEL") || destination.includes("GROUP");
  }

  return true;
}

function createSignal(
  code: string,
  message: string,
  score: number,
  severity: Exclude<SmmFraudRiskLevel, "LOW">
): SmmFraudSignal {
  return { code, message, score, severity };
}

function getErrorReason(error: unknown) {
  return error instanceof Error ? error.message : "Unknown supplier health error.";
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, supplierName: string) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${supplierName} health check timed out after ${timeoutMs}ms.`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

export function calculateSmmMargin(input: {
  supplierCost: Money;
  customerPrice: Money;
}): SmmMarginResult {
  requireSameCurrency(input.supplierCost, input.customerPrice);

  const grossMarginMinor = input.customerPrice.amountMinor - input.supplierCost.amountMinor;

  return {
    supplierCost: input.supplierCost,
    customerPrice: input.customerPrice,
    grossMargin: {
      amountMinor: grossMarginMinor,
      currency: input.customerPrice.currency
    },
    marginBps:
      input.customerPrice.amountMinor > 0
        ? Math.round((grossMarginMinor * 10_000) / input.customerPrice.amountMinor)
        : 0,
    isProfitable: grossMarginMinor >= 0
  };
}

export function calculateSmmPrice(input: {
  quote: SmmSupplierQuote;
  serviceKind: SmmServiceKind;
  rush?: boolean;
  rules?: SmmPricingRule[];
}): SmmPricedQuote {
  const rules = input.rules ?? defaultSmmPricingRules;
  const rule = getRule(input.serviceKind, rules);
  const markupBps = rule.markupBps + (input.rush ? rule.rushMarkupBps : 0);
  const markedUpMinor =
    Math.ceil((input.quote.amount.amountMinor * (10_000 + markupBps)) / 10_000) +
    rule.platformFeeMinor;
  const floorMinor = input.quote.amount.amountMinor + rule.minimumMarginMinor;
  const customerPrice: Money = {
    amountMinor: Math.max(markedUpMinor, floorMinor),
    currency: input.quote.amount.currency
  };
  const margin = calculateSmmMargin({
    supplierCost: input.quote.amount,
    customerPrice
  });
  const pricedQuote: SmmPricedQuote = {
    ...margin,
    estimatedDeliveryMinutes: input.quote.estimatedDeliveryMinutes,
    markupBps,
    minimumMarginApplied: customerPrice.amountMinor === floorMinor
  };

  return input.quote.supplierName
    ? { ...pricedQuote, supplierName: input.quote.supplierName }
    : pricedQuote;
}

export function assessSmmOrderFraud(input: {
  order: SmmOrder;
  quote?: SmmSupplierQuote;
  recentOrders?: SmmOrder[];
}): SmmFraudAssessment {
  const signals: SmmFraudSignal[] = [];

  if (!hasValidPublicUrl(input.order.destination)) {
    signals.push(
      createSignal(
        "INVALID_DESTINATION_URL",
        "Destination must be a public http(s) URL.",
        95,
        "BLOCKED"
      )
    );
  }

  if (input.order.quantity < 10) {
    signals.push(
      createSignal(
        "LOW_QUANTITY_PROBE",
        "Quantity is below normal supplier minimums.",
        25,
        "MEDIUM"
      )
    );
  }

  if (input.order.quantity > 100_000) {
    signals.push(
      createSignal(
        "OVERSIZED_ORDER",
        "Quantity is above the automated fulfillment limit.",
        70,
        "HIGH"
      )
    );
  } else if (input.order.quantity > 50_000) {
    signals.push(
      createSignal("LARGE_ORDER", "Quantity should be reviewed before fulfillment.", 35, "MEDIUM")
    );
  }

  if (!destinationMatchesService(input.order)) {
    signals.push(
      createSignal(
        "DESTINATION_SERVICE_MISMATCH",
        "Requested service does not match the destination type.",
        65,
        "HIGH"
      )
    );
  }

  if (input.quote && input.quote.amount.amountMinor <= 0) {
    signals.push(
      createSignal("ZERO_COST_QUOTE", "Supplier returned a zero or negative quote.", 90, "BLOCKED")
    );
  }

  const duplicates =
    input.recentOrders?.filter(
      (order) =>
        order.destination.url === input.order.destination.url &&
        order.serviceKind === input.order.serviceKind &&
        order.status !== "FAILED" &&
        order.status !== "CANCELLED"
    ) ?? [];

  if (duplicates.length >= 3) {
    signals.push(
      createSignal(
        "DUPLICATE_DESTINATION_VELOCITY",
        "Multiple active orders target the same destination and service.",
        45,
        "MEDIUM"
      )
    );
  }

  const score = clamp(
    signals.reduce((total, signal) => total + signal.score, 0),
    0,
    100
  );
  const risk = getRisk(score);

  return {
    score,
    ...risk,
    signals
  };
}

export function calculateSmmRetryDelayMs(
  policy: SmmRetryPolicy,
  attempt: number,
  randomSeed = 0.5
) {
  const normalizedAttempt = Math.max(1, attempt);
  const exponentialDelay = policy.baseDelayMs * 2 ** (normalizedAttempt - 1);
  const cappedDelay = Math.min(exponentialDelay, policy.maxDelayMs);
  const jitterRange = cappedDelay * policy.jitterRatio;
  const jitterOffset = Math.round((clamp(randomSeed, 0, 1) - 0.5) * 2 * jitterRange);

  return Math.max(0, cappedDelay + jitterOffset);
}

export function shouldRetrySmmFailure(input: {
  error: unknown;
  attempt: number;
  policy?: SmmRetryPolicy;
}) {
  const policy = input.policy ?? defaultSmmRetryPolicy;
  const message = getErrorReason(input.error).toLowerCase();
  const nonRetryable = ["invalid api key", "requires an api key", "service map references missing"];

  return input.attempt < policy.attempts && !nonRetryable.some((item) => message.includes(item));
}

export function createSmmFulfillmentQueueJob(input: {
  order: SmmOrder;
  pricedQuote: SmmPricedQuote;
  fraudAssessment: SmmFraudAssessment;
  retryPolicy?: SmmRetryPolicy;
  enqueuedAt?: string;
}): SmmFulfillmentQueueJob {
  const job: SmmFulfillmentQueueJob = {
    orderId: input.order.id,
    workspaceId: input.order.workspaceId,
    serviceKind: input.order.serviceKind,
    destinationKind: input.order.destination.kind,
    destinationUrl: input.order.destination.url,
    quantity: input.order.quantity,
    supplierCost: input.pricedQuote.supplierCost,
    customerPrice: input.pricedQuote.customerPrice,
    grossMargin: input.pricedQuote.grossMargin,
    fraudRiskLevel: input.fraudAssessment.riskLevel,
    retryPolicy: input.retryPolicy ?? defaultSmmRetryPolicy,
    enqueuedAt: input.enqueuedAt ?? new Date().toISOString()
  };

  return input.pricedQuote.supplierName
    ? { ...job, supplierName: input.pricedQuote.supplierName }
    : job;
}

export function createSmmServiceHealthMonitor(
  suppliers: SmmSupplierAdapter[],
  options?: {
    timeoutMs?: number;
    degradedLatencyMs?: number;
    sampleQuantity?: number;
    sampleServiceKind?: SmmServiceKind;
    sampleDestination?: PromotionDestination;
    now?: () => number;
  }
): SmmServiceHealthMonitor {
  const timeoutMs = options?.timeoutMs ?? 5_000;
  const degradedLatencyMs = options?.degradedLatencyMs ?? 2_500;
  const sampleQuantity = options?.sampleQuantity ?? 100;
  const sampleServiceKind = options?.sampleServiceKind ?? "FOLLOWERS";
  const healthDestination = options?.sampleDestination ?? sampleDestination;
  const getNow = options?.now ?? Date.now;

  return {
    async checkSupplier(supplier) {
      const startedAt = getNow();

      try {
        await withTimeout(
          supplier.quoteService({
            serviceKind: sampleServiceKind,
            quantity: sampleQuantity,
            destination: healthDestination
          }),
          timeoutMs,
          supplier.name
        );

        const latencyMs = Math.max(0, getNow() - startedAt);

        return {
          supplierName: supplier.name,
          status: latencyMs > degradedLatencyMs ? "degraded" : "healthy",
          latencyMs,
          checkedAt: new Date().toISOString()
        };
      } catch (error) {
        return {
          supplierName: supplier.name,
          status: "down",
          latencyMs: Math.max(0, getNow() - startedAt),
          checkedAt: new Date().toISOString(),
          reason: getErrorReason(error)
        };
      }
    },
    checkAll() {
      return Promise.all(suppliers.map((supplier) => this.checkSupplier(supplier)));
    }
  };
}

export function summarizeSmmSupplierHealth(results: SmmSupplierHealth[]) {
  const down = results.filter((result) => result.status === "down").length;
  const degraded = results.filter((result) => result.status === "degraded").length;

  if (results.length === 0 || down === results.length) {
    return "down" as const;
  }
  if (down > 0 || degraded > 0) {
    return "degraded" as const;
  }

  return "healthy" as const;
}

export function getCurrencyExposure(amounts: Money[]): Partial<Record<CurrencyCode, number>> {
  return amounts.reduce<Partial<Record<CurrencyCode, number>>>((exposure, amount) => {
    exposure[amount.currency] = (exposure[amount.currency] ?? 0) + amount.amountMinor;

    return exposure;
  }, {});
}
