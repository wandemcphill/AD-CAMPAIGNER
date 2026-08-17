import { describe, expect, it } from "vitest";

import { ClientIpThrottlerGuard } from "./client-ip.throttler-guard";
import { clientIpFromHeaders } from "./request-context";

// getTracker is protected; these tests exercise it the way Nest does at runtime.
function track(req: { headers?: Record<string, string | string[] | undefined>; ip?: string }) {
  const guard = new ClientIpThrottlerGuard(
    [] as never,
    {} as never,
    {} as never
  ) as unknown as {
    getTracker: (request: unknown) => Promise<string>;
  };

  return guard.getTracker(req);
}

describe("clientIpFromHeaders", () => {
  it("prefers cf-connecting-ip, the one header the edge overwrites", () => {
    expect(
      clientIpFromHeaders({
        "cf-connecting-ip": "102.89.1.1",
        "x-forwarded-for": "1.2.3.4, 10.0.0.1"
      })
    ).toBe("102.89.1.1");
  });

  it("falls back to true-client-ip", () => {
    expect(clientIpFromHeaders({ "true-client-ip": "102.89.1.2" })).toBe("102.89.1.2");
  });

  it("falls back to the leftmost x-forwarded-for entry", () => {
    expect(clientIpFromHeaders({ "x-forwarded-for": " 1.2.3.4 , 10.0.0.1 " })).toBe("1.2.3.4");
  });

  it("returns undefined when no forwarding header identifies the caller", () => {
    expect(clientIpFromHeaders({})).toBeUndefined();
    expect(clientIpFromHeaders({ "x-forwarded-for": "" })).toBeUndefined();
    expect(clientIpFromHeaders({ "x-forwarded-for": "  ,  " })).toBeUndefined();
  });
});

describe("ClientIpThrottlerGuard", () => {
  /**
   * The bug this guard exists for: with the stock tracker every request from one
   * client landed in whichever Render front-end forwarded it, so the counters
   * never accumulated. Two requests from the same customer must share a bucket.
   */
  it("gives the same client one bucket across different proxy addresses", async () => {
    const first = await track({
      headers: { "cf-connecting-ip": "102.89.1.1" },
      ip: "10.0.0.7"
    });
    const second = await track({
      headers: { "cf-connecting-ip": "102.89.1.1" },
      ip: "10.0.0.9"
    });

    expect(first).toBe("102.89.1.1");
    expect(second).toBe(first);
  });

  it("gives different clients behind one proxy address separate buckets", async () => {
    const attacker = await track({ headers: { "cf-connecting-ip": "102.89.1.1" }, ip: "10.0.0.7" });
    const bystander = await track({ headers: { "cf-connecting-ip": "197.210.5.5" }, ip: "10.0.0.7" });

    expect(attacker).not.toBe(bystander);
  });

  it("falls back to the socket address when no forwarding header is present", async () => {
    await expect(track({ headers: {}, ip: "10.0.0.7" })).resolves.toBe("10.0.0.7");
  });

  it("buckets unidentifiable callers together rather than handing out fresh buckets", async () => {
    await expect(track({})).resolves.toBe("unknown");
  });
});
