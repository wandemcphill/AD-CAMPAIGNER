import type {
  DigitalAccessCategory,
  DigitalAccessContactType,
  DigitalAccessPlan,
  DigitalAccessRefundResult,
  DigitalAccessRequest,
  DigitalAccessRequestStatus,
  DigitalAccessService,
  DigitalAccessWalletCharge,
  LedgerEntry,
  Money,
  Wallet
} from "@fliptrybe/types";

const timestamp = "2026-05-22T00:00:00.000Z";
const terminalStatuses = new Set<DigitalAccessRequestStatus>(["fulfilled", "cancelled", "failed"]);

export interface DigitalAccessCatalog {
  categories: DigitalAccessCategory[];
  services: DigitalAccessService[];
  plans: DigitalAccessPlan[];
}

export interface DigitalAccessWalletState {
  wallet: Wallet;
  ledgerEntries: LedgerEntry[];
  charges: DigitalAccessWalletCharge[];
}

export interface DigitalAccessChargeInput {
  requestId: string;
  idempotencyKey: string;
  workspaceId: string;
  walletId: string;
  amount: Money;
}

export interface DigitalAccessAbuseAssessment {
  allowed: boolean;
  score: number;
  signals: string[];
  reason?: string;
}

function money(amountMinor: number): Money {
  return { amountMinor, currency: "NGN" };
}

function category(
  id: string,
  name: string,
  slug: string,
  description: string,
  sortOrder: number
): DigitalAccessCategory {
  return {
    id,
    name,
    slug,
    description,
    sortOrder,
    isActive: true,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

function service(
  id: string,
  name: string,
  categorySlug: string,
  slug: string,
  description: string,
  deliveryEta: string,
  isFeatured = false
): DigitalAccessService {
  return {
    id,
    name,
    category: categorySlug,
    slug,
    description,
    startingPrice: money(0),
    deliveryEta,
    isActive: false,
    isFeatured,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

function plan(
  id: string,
  serviceId: string,
  planName: string,
  duration: string,
  description: string
): DigitalAccessPlan {
  return {
    id,
    serviceId,
    planName,
    duration,
    price: money(0),
    description,
    isActive: false,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

export const defaultDigitalAccessCategories: DigitalAccessCategory[] = [
  category(
    "dacat_ai_creator_tools",
    "AI & Creator Tools",
    "ai-creator-tools",
    "Premium productivity and creator software access requests.",
    10
  ),
  category(
    "dacat_streaming_entertainment",
    "Streaming & Entertainment",
    "streaming-entertainment",
    "Entertainment access plans fulfilled by FlipTrybe operations.",
    20
  ),
  category(
    "dacat_gaming_coins",
    "Gaming & Coins",
    "gaming-coins",
    "Gaming coins, topups, and subscription request workflows.",
    30
  ),
  category(
    "dacat_infrastructure",
    "Infrastructure",
    "infrastructure",
    "VPN, virtual number, and infrastructure access requests.",
    40
  )
];

export const defaultDigitalAccessServices: DigitalAccessService[] = [
  service(
    "dasvc_chatgpt",
    "ChatGPT",
    "ai-creator-tools",
    "chatgpt",
    "AI productivity access for research, writing, and creator workflows.",
    "5-30 mins",
    true
  ),
  service(
    "dasvc_gemini",
    "Gemini",
    "ai-creator-tools",
    "gemini",
    "AI workspace access for creative and operational teams.",
    "5-30 mins"
  ),
  service(
    "dasvc_canva_pro",
    "Canva Pro",
    "ai-creator-tools",
    "canva-pro",
    "Design access for creators, sellers, and campaign teams.",
    "10-45 mins",
    true
  ),
  service(
    "dasvc_capcut_pro",
    "CapCut Pro",
    "ai-creator-tools",
    "capcut-pro",
    "Creator video editing access request workflow.",
    "10-45 mins"
  ),
  service(
    "dasvc_netflix",
    "Netflix",
    "streaming-entertainment",
    "netflix",
    "Entertainment access request handled by FlipTrybe support.",
    "15-60 mins"
  ),
  service(
    "dasvc_amazon_prime",
    "Amazon Prime",
    "streaming-entertainment",
    "amazon-prime",
    "Streaming and entertainment access request.",
    "15-60 mins"
  ),
  service(
    "dasvc_crunchyroll",
    "Crunchyroll",
    "streaming-entertainment",
    "crunchyroll",
    "Anime streaming access request for entertainment customers.",
    "15-60 mins"
  ),
  service(
    "dasvc_spotify",
    "Spotify",
    "streaming-entertainment",
    "spotify",
    "Music access request with manual fulfillment tracking.",
    "10-45 mins",
    true
  ),
  service(
    "dasvc_fc26_coins",
    "FC26 Coins",
    "gaming-coins",
    "fc26-coins",
    "Game coin request workflow with admin fulfillment queue.",
    "30-120 mins"
  ),
  service(
    "dasvc_game_topups",
    "Game Topups",
    "gaming-coins",
    "game-topups",
    "Topup requests for supported games and creator communities.",
    "30-120 mins"
  ),
  service(
    "dasvc_gaming_subscriptions",
    "Gaming Subscriptions",
    "gaming-coins",
    "gaming-subscriptions",
    "Gaming subscription access requests.",
    "30-120 mins"
  ),
  service(
    "dasvc_vpns",
    "VPNs",
    "infrastructure",
    "vpns",
    "VPN access requests for secure creator and business workflows.",
    "10-60 mins"
  ),
  service(
    "dasvc_otp_services",
    "OTP Services",
    "infrastructure",
    "otp-services",
    "Manual infrastructure access request without automated OTP routing.",
    "10-60 mins"
  ),
  service(
    "dasvc_virtual_numbers",
    "Virtual Numbers",
    "infrastructure",
    "virtual-numbers",
    "Virtual number access requests fulfilled by operations.",
    "10-60 mins"
  )
];

export const defaultDigitalAccessPlans: DigitalAccessPlan[] = defaultDigitalAccessServices.flatMap(
  (item) => [
    plan(`${item.id}_starter`, item.id, "Starter Access", "1 month", "Owner-priced starter plan."),
    plan(
      `${item.id}_extended`,
      item.id,
      "Extended Access",
      "3 months",
      "Owner-priced extended plan."
    )
  ]
);

export const defaultDigitalAccessCatalog: DigitalAccessCatalog = {
  categories: defaultDigitalAccessCategories,
  services: defaultDigitalAccessServices,
  plans: defaultDigitalAccessPlans
};

export function normalizeDigitalAccessContact(
  contactType: DigitalAccessContactType,
  contactValue: string
) {
  const value = contactValue.trim();

  if (contactType === "email") {
    const normalized = value.toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      throw new Error("Enter a valid email address for this request.");
    }

    return normalized;
  }

  const normalized = value.replace(/[\s().-]/g, "");

  if (!/^\+?[0-9]{7,20}$/.test(normalized)) {
    throw new Error("Enter a valid WhatsApp number for this request.");
  }

  return normalized.startsWith("+") ? normalized : `+${normalized}`;
}

export function getDigitalAccessStartingPrice(
  service: DigitalAccessService,
  plans: DigitalAccessPlan[]
) {
  const activePlanPrices = plans
    .filter((item) => item.serviceId === service.id && item.isActive)
    .map((item) => item.price.amountMinor)
    .filter((amount) => amount > 0);

  return activePlanPrices.length > 0 ? money(Math.min(...activePlanPrices)) : service.startingPrice;
}

export function canRequestDigitalAccess(service: DigitalAccessService, plan: DigitalAccessPlan) {
  return (
    service.isActive &&
    plan.isActive &&
    plan.serviceId === service.id &&
    plan.price.currency === "NGN" &&
    plan.price.amountMinor > 0
  );
}

export function assessDigitalAccessAbuse(input: {
  userId: string;
  serviceId: string;
  contactValue: string;
  requests: DigitalAccessRequest[];
  now?: Date;
}): DigitalAccessAbuseAssessment {
  const nowMs = input.now?.getTime() ?? Date.now();
  const oneHourAgo = nowMs - 60 * 60 * 1_000;
  const thirtyMinutesAgo = nowMs - 30 * 60 * 1_000;
  const activeDuplicate = input.requests.find(
    (request) =>
      request.userId === input.userId &&
      request.serviceId === input.serviceId &&
      !terminalStatuses.has(request.status)
  );
  const contactCooldown = input.requests.find(
    (request) =>
      request.contactValue === input.contactValue &&
      request.serviceId === input.serviceId &&
      Date.parse(request.createdAt) >= thirtyMinutesAgo
  );
  const recentUserRequests = input.requests.filter(
    (request) => request.userId === input.userId && Date.parse(request.createdAt) >= oneHourAgo
  );
  const signals: string[] = [];

  if (activeDuplicate) {
    signals.push("active_duplicate_request");
  }
  if (contactCooldown) {
    signals.push("contact_cooldown");
  }
  if (recentUserRequests.length >= 5) {
    signals.push("high_velocity");
  }

  const score = Math.min(100, signals.length * 35 + Math.max(0, recentUserRequests.length - 2) * 8);
  const allowed =
    !signals.includes("active_duplicate_request") && !signals.includes("high_velocity");

  return {
    allowed,
    score,
    signals,
    ...(allowed ? {} : { reason: signals.join(", ") })
  };
}

export function assertDigitalAccessStatusTransition(
  current: DigitalAccessRequestStatus,
  next: DigitalAccessRequestStatus
) {
  if (current === next) {
    return;
  }
  if (terminalStatuses.has(current)) {
    throw new Error(`Digital Access request is already ${current}.`);
  }
  if (next === "pending") {
    throw new Error("Digital Access request cannot move back to pending.");
  }
}

function calculateAvailableBalance(entries: LedgerEntry[]): Money {
  return entries.reduce<Money>(
    (balance, entry) => {
      if (balance.currency !== entry.amount.currency) {
        return balance;
      }

      switch (entry.kind) {
        case "CREDIT":
        case "RELEASE":
        case "REVERSAL":
          return { ...balance, amountMinor: balance.amountMinor + entry.amount.amountMinor };
        case "DEBIT":
        case "HOLD":
          return { ...balance, amountMinor: balance.amountMinor - entry.amount.amountMinor };
      }
    },
    { amountMinor: 0, currency: "NGN" }
  );
}

const makeId = (prefix: string) =>
  globalThis.crypto?.randomUUID?.() ?? `${prefix}_${Math.random().toString(36).slice(2, 12)}`;

const now = () => new Date().toISOString();

export function chargeDigitalAccessWallet(
  state: DigitalAccessWalletState,
  input: DigitalAccessChargeInput
) {
  const existingCharge = state.charges.find(
    (charge) =>
      charge.idempotencyKey === input.idempotencyKey || charge.requestId === input.requestId
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
    throw new Error("Insufficient wallet balance for Digital Access request.");
  }

  const createdAt = now();
  const ledgerEntry: LedgerEntry = {
    id: makeId("ledger"),
    walletId: input.walletId,
    kind: "DEBIT",
    amount: input.amount,
    reference: `digital_access:${input.requestId}`,
    description: "Digital Access upfront wallet payment",
    idempotencyKey: input.idempotencyKey,
    sourceType: "DigitalAccessRequest",
    sourceId: input.requestId,
    metadata: { requestId: input.requestId },
    createdAt,
    updatedAt: createdAt
  };
  const charge: DigitalAccessWalletCharge = {
    id: makeId("da_charge"),
    workspaceId: input.workspaceId,
    walletId: input.walletId,
    requestId: input.requestId,
    idempotencyKey: input.idempotencyKey,
    amount: input.amount,
    status: "CHARGED",
    debitLedgerEntryId: ledgerEntry.id,
    createdAt,
    updatedAt: createdAt
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

export function refundDigitalAccessWallet(
  state: DigitalAccessWalletState,
  input: { requestId: string }
): {
  state: DigitalAccessWalletState;
  refund: DigitalAccessRefundResult;
  idempotent: boolean;
} {
  const charge = state.charges.find((item) => item.requestId === input.requestId);

  if (!charge) {
    throw new Error(`Cannot refund missing Digital Access charge for ${input.requestId}.`);
  }
  if (charge.status === "REFUNDED" && charge.refundLedgerEntryId) {
    return {
      state,
      refund: {
        requestId: input.requestId,
        status: "SKIPPED",
        amount: charge.amount,
        ledgerEntryId: charge.refundLedgerEntryId
      },
      idempotent: true
    };
  }

  const createdAt = now();
  const ledgerEntry: LedgerEntry = {
    id: makeId("ledger"),
    walletId: charge.walletId,
    kind: "REVERSAL",
    amount: charge.amount,
    reference: `digital_access_refund:${input.requestId}`,
    description: "Digital Access automatic wallet refund",
    idempotencyKey: `refund:${charge.idempotencyKey}`,
    sourceType: "DigitalAccessRequest",
    sourceId: input.requestId,
    metadata: { originalChargeId: charge.id },
    createdAt,
    updatedAt: createdAt
  };
  const updatedCharge: DigitalAccessWalletCharge = {
    ...charge,
    status: "REFUNDED",
    refundLedgerEntryId: ledgerEntry.id,
    updatedAt: createdAt
  };

  return {
    state: {
      ...state,
      ledgerEntries: [...state.ledgerEntries, ledgerEntry],
      charges: state.charges.map((item) => (item.id === charge.id ? updatedCharge : item))
    },
    refund: {
      requestId: input.requestId,
      status: "REFUNDED",
      amount: charge.amount,
      ledgerEntryId: ledgerEntry.id
    },
    idempotent: false
  };
}
