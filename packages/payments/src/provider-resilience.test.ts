import { describe, expect, it } from "vitest";
import { assertProviderAmount, buildProviderIdempotencyKey, classifyProviderFailure } from "./provider-resilience";

describe("provider resilience", () => {
  it("creates deterministic idempotency keys", () => {
    expect(buildProviderIdempotencyKey("remittance", "user_1", "req_42")).toBe("ft:remittance:user_1:req_42");
    expect(buildProviderIdempotencyKey("remittance", "user_1", "req_42")).toBe(buildProviderIdempotencyKey("remittance", "user_1", "req_42"));
  });
  it("rejects missing idempotency identity", () => {
    expect(() => buildProviderIdempotencyKey("rmb", "", "req_42")).toThrow();
    expect(() => buildProviderIdempotencyKey("rmb", "user_1", "")).toThrow();
  });
  it("treats timeouts and possibly-executed status codes as unknown delivery", () => {
    expect(classifyProviderFailure({ timedOut: true }).class).toBe("unknown_delivery");
    expect(classifyProviderFailure({ statusCode: 408 }).retryable).toBe(false);
    expect(classifyProviderFailure({ statusCode: 429 }).class).toBe("unknown_delivery");
    expect(classifyProviderFailure({ statusCode: 503 }).class).toBe("unknown_delivery");
  });
  it("allows only explicitly safe retry responses to retry", () => {
    expect(classifyProviderFailure({ statusCode: 425 }).retryable).toBe(true);
    expect(classifyProviderFailure({ statusCode: 422 }).retryable).toBe(false);
    expect(classifyProviderFailure({ statusCode: 422 }).class).toBe("rejected");
  });
  it("rejects unsafe provider amounts", () => {
    expect(() => assertProviderAmount(0)).toThrow();
    expect(() => assertProviderAmount(-1)).toThrow();
    expect(() => assertProviderAmount(1.5)).toThrow();
    expect(() => assertProviderAmount(Number.MAX_SAFE_INTEGER + 1)).toThrow();
    expect(() => assertProviderAmount(100)).not.toThrow();
  });
});
