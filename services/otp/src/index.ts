import type {
  CurrencyCode,
  LedgerEntry,
  Money,
  OtpOrder,
  OtpPricingResult,
  OtpProviderHealth,
  OtpProviderTier,
  OtpRefundResult,
  OtpRoutingAttempt,
  OtpRoutingResult,
  OtpService,
  OtpWalletCharge,
  Wallet
} from "@fliptrybe/types";

export type OtpFraudAction = "ALLOW" | "REVIEW" | "BLOCK";
export type OtpFraudRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "BLOCKED";

export interface OtpPricingRule {
  tier: OtpProviderTier;
  markupBps: number;
  minimumMarginMinor: number;
  platformFeeMinor: number;
  customerCurrency: CurrencyCode;
  usdToNgnRate: number;
}

export interface OtpProviderQuote {
  providerName: string;
  tier: OtpProviderTier;
  supplierCost: Money;
  available: boolean;
  estimatedLatencyMs: number;
  successRateBps: number;
  inventory: number;
}

export interface OtpFraudSignal {
  code: string;
  message: string;
  score: number;
  severity: Exclude<OtpFraudRiskLevel, "LOW">;
}

export interface OtpFraudAssessment {
  score: number;
  riskLevel: OtpFraudRiskLevel;
  action: OtpFraudAction;
  signals: OtpFraudSignal[];
}

export interface OtpWalletState {
  wallet: Wallet;
  ledgerEntries: LedgerEntry[];
  charges: OtpWalletCharge[];
}

export interface OtpChargeInput {
  otpOrderId: string;
  idempotencyKey: string;
  workspaceId: string;
  walletId: string;
  amount: Money;
  providerName?: string;
  providerReference?: string;
}

export const defaultOtpServices: OtpService[] = [
  {
    id: "otp_service_whatsapp_ng",
    code: "whatsapp",
    name: "WhatsApp",
    countryCode: "NG",
    providerTier: "BUDGET",
    category: "messaging",
    visible: true,
    requiresAdminApproval: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  },
  {
    id: "otp_service_telegram_ng",
    code: "telegram",
    name: "Telegram",
    countryCode: "NG",
    providerTier: "BUDGET",
    category: "messaging",
    visible: true,
    requiresAdminApproval: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  },
  {
    id: "otp_service_google_us",
    code: "google",
    name: "Google",
    countryCode: "US",
    providerTier: "PREMIUM",
    category: "identity",
    visible: false,
    requiresAdminApproval: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  },
  {
    id: "otp_service_openai_us",
    code: "openai",
    name: "OpenAI",
    countryCode: "US",
    providerTier: "PREMIUM",
    category: "ai",
    visible: false,
    requiresAdminApproval: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  }
];

export const defaultOtpPricingRules: OtpPricingRule[] = [
  {
    tier: "BUDGET",
    markupBps: 5500,
    minimumMarginMinor: 15000,
    platformFeeMinor: 5000,
    customerCurrency: "NGN",
    usdToNgnRate: 1600
  },
  {
    tier: "PREMIUM",
    markupBps: 8500,
    minimumMarginMinor: 75000,
    platformFeeMinor: 15000,
    customerCurrency: "NGN",
    usdToNgnRate: 1600
  }
];

function makeId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 12)}`;
}

function now() {
  return new Date().toISOString();
}

function assertMoneyAmount(amount: Money, message: string, options: { positive?: boolean } = {}) {
  const minimum = options.positive ? 1 : 0;

  if (!Number.isInteger(amount.amountMinor) || amount.amountMinor < minimum) {
    throw new Error(message);
  }
}

function assertPricingRule(rule: OtpPricingRule) {
  if (!Number.isInteger(rule.markupBps) || rule.markupBps < 0) {
    throw new Error("OTP markup basis points must be a non-negative integer.");
  }
  if (!Number.isInteger(rule.minimumMarginMinor) || rule.minimumMarginMinor < 0) {
    throw new Error("OTP minimum margin must be a non-negative minor-unit amount.");
  }
  if (!Number.isInteger(rule.platformFeeMinor) || rule.platformFeeMinor < 0) {
    throw new Error("OTP platform fee must be a non-negative minor-unit amount.");
  }
  if (!Number.isFinite(rule.usdToNgnRate) || rule.usdToNgnRate <= 0) {
    throw new Error("OTP USD/NGN exchange rate must be positive.");
  }
}

function getPricingRule(tier: OtpProviderTier, rules: OtpPricingRule[]) {
  const rule = rules.find((item) => item.tier === tier);

  if (!rule) {
    throw new Error(`Missing OTP pricing rule for ${tier}.`);
  }
  assertPricingRule(rule);

  return rule;
}

function calculateAvailableBalance(entries: LedgerEntry[]): Money {
  const currency = entries[0]?.amount.currency ?? "NGN";
  const amountMinor = entries.reduce((balance, entry) => {
    switch (entry.kind) {
      case "CREDIT":
      case "RELEASE":
      case "REVERSAL":
        return balance + entry.amount.amountMinor;
      case "DEBIT":
      case "HOLD":
        return balance - entry.amount.amountMinor;
    }
  }, 0);

  return { amountMinor, currency };
}

function convertSupplierCostToCustomerCurrency(input: {
  supplierCost: Money;
  rule: OtpPricingRule;
}): Money {
  if (input.supplierCost.currency === input.rule.customerCurrency) {
    return input.supplierCost;
  }
  if (input.supplierCost.currency !== "USD" || input.rule.customerCurrency !== "NGN") {
    throw new Error(
      `Unsupported OTP currency conversion ${input.supplierCost.currency}/${input.rule.customerCurrency}.`
    );
  }

  return {
    amountMinor: Math.ceil(input.supplierCost.amountMinor * input.rule.usdToNgnRate),
    currency: "NGN"
  };
}

function risk(score: number): Pick<OtpFraudAssessment, "action" | "riskLevel"> {
  if (score >= 90) {
    return { action: "BLOCK", riskLevel: "BLOCKED" };
  }
  if (score >= 60) {
    return { action: "REVIEW", riskLevel: "HIGH" };
  }
  if (score >= 35) {
    return { action: "REVIEW", riskLevel: "MEDIUM" };
  }

  return { action: "ALLOW", riskLevel: "LOW" };
}

function signal(
  code: string,
  message: string,
  score: number,
  severity: Exclude<OtpFraudRiskLevel, "LOW">
): OtpFraudSignal {
  return { code, message, score, severity };
}

export function calculateOtpPrice(input: {
  supplierCost: Money;
  tier: OtpProviderTier;
  rules?: OtpPricingRule[];
}): OtpPricingResult {
  assertMoneyAmount(
    input.supplierCost,
    "OTP supplier cost must be a non-negative minor-unit amount."
  );
  const rule = getPricingRule(input.tier, input.rules ?? defaultOtpPricingRules);
  const convertedSupplierCost = convertSupplierCostToCustomerCurrency({
    supplierCost: input.supplierCost,
    rule
  });
  const markedUpMinor =
    Math.ceil((convertedSupplierCost.amountMinor * (10_000 + rule.markupBps)) / 10_000) +
    rule.platformFeeMinor;
  const floorMinor = convertedSupplierCost.amountMinor + rule.minimumMarginMinor;
  const customerPrice: Money = {
    amountMinor: Math.max(markedUpMinor, floorMinor),
    currency: rule.customerCurrency
  };
  const grossMargin: Money = {
    amountMinor: customerPrice.amountMinor - convertedSupplierCost.amountMinor,
    currency: customerPrice.currency
  };

  return {
    supplierCost: input.supplierCost,
    customerPrice,
    grossMargin,
    marginBps:
      customerPrice.amountMinor > 0
        ? Math.round((grossMargin.amountMinor * 10_000) / customerPrice.amountMinor)
        : 0,
    markupBps: rule.markupBps,
    exchangeRate: rule.usdToNgnRate,
    profitable: grossMargin.amountMinor >= rule.minimumMarginMinor
  };
}

export function routeOtpProvider(input: {
  quotes: OtpProviderQuote[];
  health: OtpProviderHealth[];
  preferredTier?: OtpProviderTier;
  rules?: OtpPricingRule[];
}): OtpRoutingResult {
  const attempts: OtpRoutingAttempt[] = [];
  const candidates = input.quotes
    .filter((quote) => quote.available)
    .filter((quote) => !input.preferredTier || quote.tier === input.preferredTier)
    .map((quote) => {
      const health =
        input.health.find((item) => item.providerName === quote.providerName) ??
        ({
          providerName: quote.providerName,
          tier: quote.tier,
          status: "DEGRADED",
          latencyMs: quote.estimatedLatencyMs,
          successRateBps: quote.successRateBps,
          createdAt: now(),
          updatedAt: now()
        } satisfies OtpProviderHealth);
      const pricing = calculateOtpPrice({
        supplierCost: quote.supplierCost,
        tier: quote.tier,
        ...(input.rules === undefined ? {} : { rules: input.rules })
      });
      const healthPenalty =
        health.status === "HEALTHY"
          ? 0
          : health.status === "DEGRADED"
            ? 1_500
            : health.status === "DOWN"
              ? 9_000
              : 10_000;
      const latencyPenalty = Math.min(2_000, Math.round(health.latencyMs / 10));
      const costPenalty = Math.min(3_000, Math.round(pricing.customerPrice.amountMinor / 1_000));
      const inventoryBonus = Math.min(1_000, quote.inventory * 10);
      const score =
        quote.successRateBps + inventoryBonus - healthPenalty - latencyPenalty - costPenalty;

      return { quote, pricing, health, score };
    })
    .sort((left, right) => right.score - left.score);

  for (const candidate of candidates) {
    attempts.push({
      id: makeId("otp_route"),
      otpOrderId: "pending",
      providerName: candidate.quote.providerName,
      providerTier: candidate.quote.tier,
      score: candidate.score,
      status: candidate.health.status === "DOWN" ? "SKIPPED" : "SELECTED",
      ...(candidate.health.status === "DOWN" ? { reason: "Provider is down." } : {}),
      createdAt: now(),
      updatedAt: now()
    });
  }

  const selected = candidates.find((candidate) => candidate.health.status !== "DOWN");

  if (!selected) {
    throw new Error("No OTP provider is healthy enough to route this request.");
  }

  return {
    providerName: selected.quote.providerName,
    providerTier: selected.quote.tier,
    score: selected.score,
    quote: selected.pricing,
    attempts
  };
}

export function assessOtpFraud(input: {
  service: OtpService;
  recentOrders: OtpOrder[];
  workspaceApproved: boolean;
  attestationAccepted: boolean;
  deviceId?: string;
  ipAddress?: string;
}): OtpFraudAssessment {
  const signals: OtpFraudSignal[] = [];

  if (!input.workspaceApproved) {
    signals.push(
      signal(
        "workspace_not_approved",
        "Workspace is not approved for the OTP compliant beta.",
        95,
        "BLOCKED"
      )
    );
  }
  if (!input.attestationAccepted) {
    signals.push(
      signal(
        "missing_attestation",
        "User did not attest that the request is for owned accounts or authorized testing.",
        90,
        "BLOCKED"
      )
    );
  }
  if (input.service.requiresAdminApproval) {
    signals.push(
      signal(
        "admin_approval_required",
        "This OTP service is high-risk and requires admin approval before purchase.",
        65,
        "HIGH"
      )
    );
  }

  const oneHourAgo = Date.now() - 60 * 60 * 1_000;
  const recentCount = input.recentOrders.filter(
    (order) => Date.parse(order.createdAt) >= oneHourAgo
  ).length;

  if (recentCount >= 10) {
    signals.push(
      signal("workspace_velocity", "Workspace has too many OTP requests this hour.", 45, "HIGH")
    );
  }

  const duplicateActiveOrder = input.recentOrders.some(
    (order) =>
      order.serviceCode === input.service.code &&
      order.countryCode === input.service.countryCode &&
      ["CHARGED", "ALLOCATING", "WAITING", "RECEIVED"].includes(order.status)
  );

  if (duplicateActiveOrder) {
    signals.push(
      signal(
        "duplicate_active_order",
        "An active OTP order for the same country and service already exists.",
        35,
        "MEDIUM"
      )
    );
  }

  const score = Math.min(
    100,
    signals.reduce((total, item) => total + item.score, 0)
  );
  const decision = risk(score);

  return {
    score,
    ...decision,
    signals
  };
}

export function chargeOtpWallet(state: OtpWalletState, input: OtpChargeInput) {
  assertMoneyAmount(input.amount, "OTP wallet charge must be a positive minor-unit amount.", {
    positive: true
  });
  const existingCharge = state.charges.find(
    (charge) =>
      charge.idempotencyKey === input.idempotencyKey || charge.otpOrderId === input.otpOrderId
  );

  if (existingCharge) {
    return {
      state,
      charge: existingCharge,
      ledgerEntry: state.ledgerEntries.find(
        (entry) => entry.id === existingCharge.debitLedgerEntryId
      ),
      idempotent: true
    };
  }

  const availableBalance = calculateAvailableBalance(state.ledgerEntries);

  if (availableBalance.currency !== input.amount.currency) {
    throw new Error(
      `Wallet currency ${availableBalance.currency} cannot pay ${input.amount.currency}.`
    );
  }
  if (availableBalance.amountMinor < input.amount.amountMinor) {
    throw new Error("Insufficient wallet balance for OTP order.");
  }

  const timestamp = now();
  const ledgerEntry: LedgerEntry = {
    id: makeId("ledger"),
    walletId: input.walletId,
    kind: "DEBIT",
    amount: input.amount,
    reference: `otp:${input.otpOrderId}`,
    description: "OTP marketplace instant wallet charge",
    idempotencyKey: input.idempotencyKey,
    sourceType: "OtpOrder",
    sourceId: input.otpOrderId,
    metadata: {
      providerName: input.providerName ?? null,
      providerReference: input.providerReference ?? null
    },
    createdAt: timestamp,
    updatedAt: timestamp
  };
  const charge: OtpWalletCharge = {
    id: makeId("otp_charge"),
    workspaceId: input.workspaceId,
    walletId: input.walletId,
    otpOrderId: input.otpOrderId,
    idempotencyKey: input.idempotencyKey,
    amount: input.amount,
    status: "CHARGED",
    debitLedgerEntryId: ledgerEntry.id,
    ...(input.providerName === undefined ? {} : { providerName: input.providerName }),
    ...(input.providerReference === undefined
      ? {}
      : { providerReference: input.providerReference }),
    createdAt: timestamp,
    updatedAt: timestamp
  };

  return {
    state: {
      ...state,
      ledgerEntries: [...state.ledgerEntries, ledgerEntry],
      charges: [...state.charges, charge]
    },
    charge,
    ledgerEntry,
    idempotent: false
  };
}

export function refundOtpWallet(
  state: OtpWalletState,
  input: { otpOrderId: string }
): {
  state: OtpWalletState;
  refund: OtpRefundResult;
  idempotent: boolean;
} {
  const charge = state.charges.find((item) => item.otpOrderId === input.otpOrderId);

  if (!charge) {
    throw new Error(`Cannot refund missing OTP charge for ${input.otpOrderId}.`);
  }
  assertMoneyAmount(charge.amount, "OTP refund amount must be a positive minor-unit amount.", {
    positive: true
  });
  if (charge.status === "REFUNDED" && charge.refundLedgerEntryId) {
    return {
      state,
      refund: {
        otpOrderId: input.otpOrderId,
        status: "SKIPPED",
        amount: charge.amount,
        ledgerEntryId: charge.refundLedgerEntryId
      },
      idempotent: true
    };
  }

  const timestamp = now();
  const ledgerEntry: LedgerEntry = {
    id: makeId("ledger"),
    walletId: charge.walletId,
    kind: "REVERSAL",
    amount: charge.amount,
    reference: `otp_refund:${input.otpOrderId}`,
    description: "OTP marketplace automatic refund",
    idempotencyKey: `refund:${charge.idempotencyKey}`,
    sourceType: "OtpOrder",
    sourceId: input.otpOrderId,
    metadata: { originalChargeId: charge.id },
    createdAt: timestamp,
    updatedAt: timestamp
  };
  const updatedCharge: OtpWalletCharge = {
    ...charge,
    status: "REFUNDED",
    refundLedgerEntryId: ledgerEntry.id,
    updatedAt: timestamp
  };

  return {
    state: {
      ...state,
      ledgerEntries: [...state.ledgerEntries, ledgerEntry],
      charges: state.charges.map((item) => (item.id === charge.id ? updatedCharge : item))
    },
    refund: {
      otpOrderId: input.otpOrderId,
      status: "REFUNDED",
      amount: charge.amount,
      ledgerEntryId: ledgerEntry.id
    },
    idempotent: false
  };
}

export function summarizeOtpProviderHealth(health: OtpProviderHealth[]) {
  if (health.length === 0 || health.every((item) => item.status === "DOWN")) {
    return "down";
  }
  if (health.some((item) => item.status === "DEGRADED" || item.status === "DOWN")) {
    return "degraded";
  }

  return "healthy";
}
