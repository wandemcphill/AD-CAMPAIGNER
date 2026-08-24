import type { CurrencyCode, LedgerEntry, Money } from "@fliptrybe/types";

export {
  runChargeSaga,
  type SagaOutcome,
  type SagaSteps,
  type ChargeRecord,
  type FailurePolicy,
  type DebitStep,
  type ExecuteStep,
  type CompensateStep
} from "./saga.js";

export {
  assertProviderAmount,
  buildProviderIdempotencyKey,
  classifyProviderFailure,
  type ProviderFailure,
  type ProviderFailureClass,
  type ProviderOperation,
  type ProviderRequestContext,
  type ProviderResult
} from "./provider-resilience.js";

export {
  buildNotificationDedupeKey,
  createOperationalNotification,
  notificationSeverity,
  supportActionForFailure,
  type OperationalEvent,
  type OperationalNotification,
  type OperationalSeverity,
  type SupportContext
} from "./operations.js";

export function money(amountMinor: number, currency: CurrencyCode): Money {
  if (!Number.isInteger(amountMinor)) {
    throw new Error("Money values must be stored in minor units");
  }

  return { amountMinor, currency };
}

export function assertSameCurrency(entries: LedgerEntry[]) {
  const [first] = entries;

  if (!first) {
    return;
  }

  for (const entry of entries) {
    if (entry.amount.currency !== first.amount.currency) {
      throw new Error("Ledger entries must share the same currency for balance calculations");
    }
  }
}

export function calculateAvailableBalance(entries: LedgerEntry[]): Money {
  assertSameCurrency(entries);

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
