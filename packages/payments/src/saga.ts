import type { CurrencyCode } from "@fliptrybe/types";

// ─── Saga outcome types ──────────────────────────────────────────────────────

export type SagaOutcome =
  | { status: "completed"; result: unknown }
  | { status: "compensated"; error: unknown }
  | { status: "held"; error: unknown };

export interface ChargeRecord {
  chargeId: string;
  walletId: string;
  amountMinor: number;
  currency: CurrencyCode;
  debitLedgerEntryId: string | null;
}

// ─── Failure policy ──────────────────────────────────────────────────────────

/**
 * What the coordinator does when the execute step fails.
 *
 * - compensate: automatically reverse the charge (virtual numbers — the
 *   provider either gave you the resource or didn't).
 * - hold_and_flag: leave the charge in place and return "held" so the
 *   caller can enqueue ops review (VTU — the airtime may have been
 *   delivered even though the API timed out).
 *
 * hold_and_flag is the default. Choosing compensate requires confidence
 * that a provider failure means the resource was NOT delivered.
 */
export type FailurePolicy = "compensate" | "hold_and_flag";

// ─── Step callbacks ──────────────────────────────────────────────────────────

/**
 * Debit step — runs inside the caller's transaction.
 * Must create the DEBIT LedgerEntry and the domain WalletCharge,
 * then return the charge record so the coordinator can reverse it
 * if needed.
 */
export type DebitStep<TOrder> = () => Promise<{
  order: TOrder;
  charge: ChargeRecord;
}>;

/**
 * Execute step — runs OUTSIDE any transaction. This is the provider
 * call. Network timeout must not roll back the debit — that's the
 * whole point of the two-phase split.
 */
export type ExecuteStep<TOrder, TResult> = (order: TOrder) => Promise<TResult>;

/**
 * Compensate step — reverses the charge. Runs inside a NEW transaction
 * the caller provides. Must create a REVERSAL LedgerEntry and update the
 * WalletCharge to REFUNDED.
 *
 * The coordinator calls this only when failurePolicy is "compensate".
 * Must be idempotent (use upsert on the reversal idempotencyKey).
 */
export type CompensateStep = (charge: ChargeRecord) => Promise<void>;

// ─── The coordinator ─────────────────────────────────────────────────────────

export interface SagaSteps<TOrder, TResult> {
  /** Runs inside the caller's transaction. */
  debit: DebitStep<TOrder>;
  /** Runs outside any transaction — the provider call. */
  execute: ExecuteStep<TOrder, TResult>;
  /** Reverses the charge. Only called when policy is "compensate". */
  compensate: CompensateStep;
  /** What to do when execute fails. Default: "hold_and_flag". */
  failurePolicy?: FailurePolicy;
}

/**
 * Run a charge-execute-compensate saga.
 *
 * 1. debit() — inside the caller's DB transaction
 * 2. execute(order) — outside any transaction (provider call)
 * 3. On failure:
 *    - "compensate" → compensate(charge), return { status: "compensated" }
 *    - "hold_and_flag" → return { status: "held" } (caller enqueues ops review)
 *
 * The coordinator never swallows errors silently. The caller receives the
 * original error in the "compensated" and "held" outcomes so it can log,
 * enqueue, or surface it.
 */
export async function runChargeSaga<TOrder, TResult>(
  steps: SagaSteps<TOrder, TResult>
): Promise<SagaOutcome> {
  const policy = steps.failurePolicy ?? "hold_and_flag";

  const { order, charge } = await steps.debit();

  try {
    const result = await steps.execute(order);
    return { status: "completed", result };
  } catch (err: unknown) {
    if (policy === "compensate") {
      await steps.compensate(charge);
      return { status: "compensated", error: err };
    }
    return { status: "held", error: err };
  }
}
