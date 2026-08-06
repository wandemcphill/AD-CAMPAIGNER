import { describe, expect, it, vi } from "vitest";
import { runChargeSaga, type ChargeRecord, type SagaSteps } from "./saga";

const CHARGE: ChargeRecord = {
  chargeId: "chg_1",
  walletId: "wal_1",
  amountMinor: 50000,
  currency: "NGN",
  debitLedgerEntryId: "led_1"
};

function makeSteps(
  overrides: Partial<SagaSteps<{ id: string }, string>> = {}
): SagaSteps<{ id: string }, string> {
  return {
    debit: vi.fn().mockResolvedValue({ order: { id: "ord_1" }, charge: CHARGE }),
    execute: vi.fn().mockResolvedValue("provider-ref-123"),
    compensate: vi.fn().mockResolvedValue(undefined),
    ...overrides
  };
}

describe("runChargeSaga", () => {
  it("returns completed when execute succeeds", async () => {
    const steps = makeSteps();
    const outcome = await runChargeSaga(steps);

    expect(outcome.status).toBe("completed");
    if (outcome.status !== "completed") throw new Error("unreachable");
    expect(outcome.result).toBe("provider-ref-123");
    expect(steps.debit).toHaveBeenCalledOnce();
    expect(steps.execute).toHaveBeenCalledWith({ id: "ord_1" });
    expect(steps.compensate).not.toHaveBeenCalled();
  });

  it("holds and flags by default when execute fails", async () => {
    const steps = makeSteps({
      execute: vi.fn().mockRejectedValue(new Error("timeout"))
    });

    const outcome = await runChargeSaga(steps);

    expect(outcome.status).toBe("held");
    expect((outcome as { error: Error }).error).toBeInstanceOf(Error);
    expect(steps.compensate).not.toHaveBeenCalled();
  });

  it("compensates when policy is compensate and execute fails", async () => {
    const steps = makeSteps({
      execute: vi.fn().mockRejectedValue(new Error("no number")),
      failurePolicy: "compensate"
    });

    const outcome = await runChargeSaga(steps);

    expect(outcome.status).toBe("compensated");
    expect(steps.compensate).toHaveBeenCalledWith(CHARGE);
  });

  it("passes the order from debit to execute", async () => {
    const order = { id: "custom_order" };
    const steps = makeSteps({
      debit: vi.fn().mockResolvedValue({ order, charge: CHARGE })
    });

    await runChargeSaga(steps);

    expect(steps.execute).toHaveBeenCalledWith(order);
  });

  it("propagates debit errors without catching", async () => {
    const steps = makeSteps({
      debit: vi.fn().mockRejectedValue(new Error("insufficient balance"))
    });

    await expect(runChargeSaga(steps)).rejects.toThrow("insufficient balance");
    expect(steps.execute).not.toHaveBeenCalled();
    expect(steps.compensate).not.toHaveBeenCalled();
  });

  it("propagates compensate errors without swallowing", async () => {
    const steps = makeSteps({
      execute: vi.fn().mockRejectedValue(new Error("provider down")),
      compensate: vi.fn().mockRejectedValue(new Error("db error")),
      failurePolicy: "compensate"
    });

    await expect(runChargeSaga(steps)).rejects.toThrow("db error");
  });
});
