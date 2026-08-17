/* eslint-disable @typescript-eslint/no-unsafe-assignment -- Vitest asymmetric matchers are typed as any. */
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../prisma.service";
import { VtuService } from "./vtu.service";

/**
 * The data-plan list must only contain plans that can actually be bought.
 *
 * buyData resolves its adapter from the routing table and then looks the plan up
 * under `providerName: adapter.name`. listDataPlans previously returned every
 * active plan regardless of provider, so a catalog holding rows for a seeded but
 * uncredentialed provider offered customers plans that failed with "Data plan
 * not found or unavailable" only after they had picked one.
 */

function buildService(opts: { routedProvider: string; plans: Array<Record<string, unknown>> }) {
  const findMany = vi.fn((args: { where: Record<string, unknown> }) =>
    Promise.resolve(
      opts.plans.filter(
        (p) =>
          p["providerName"] === args.where["providerName"] && p["network"] === args.where["network"]
      )
    )
  );

  const db = { vtuDataPlan: { findMany } };
  const service = new VtuService(
    { client: db } as unknown as PrismaService,
    undefined as never,
    undefined as never,
    undefined as never,
    undefined as never
  );

  // ensureDefaultCatalog writes routes/plans; not what this test is about.
  (service as unknown as { ensureDefaultCatalog: () => Promise<void> }).ensureDefaultCatalog = () =>
    Promise.resolve();
  (service as unknown as { selectAdapter: () => Promise<{ name: string }> }).selectAdapter = () =>
    Promise.resolve({ name: opts.routedProvider });

  return { service, findMany };
}

afterEach(() => {
  process.env.NODE_ENV = "test";
});

const PLANS = [
  { id: "ck1", providerName: "clubkonnect", network: "MTN", costMinor: 30_000 },
  { id: "vt1", providerName: "swiftlink", network: "MTN", costMinor: 28_000 },
  { id: "vt2", providerName: "swiftlink", network: "MTN", costMinor: 29_000 }
];

describe("VtuService.listDataPlans", () => {
  it("returns only plans belonging to the provider that would serve the order", async () => {
    const { service } = buildService({ routedProvider: "clubkonnect", plans: PLANS });

    const listed = await service.listDataPlans("MTN");

    expect(listed.map((p) => (p as unknown as { id: string }).id)).toEqual(["ck1"]);
  });

  it("follows the router when a different provider would serve it", async () => {
    // If health or priority moves MTN traffic to swiftlink, the list has to move too
    // or it would offer plans the selected provider cannot fulfil.
    const { service } = buildService({ routedProvider: "swiftlink", plans: PLANS });

    const listed = await service.listDataPlans("MTN");

    expect(listed.map((p) => (p as unknown as { id: string }).id)).toEqual(["vt1", "vt2"]);
  });

  it("returns nothing for a network with no routable provider", async () => {
    const { service } = buildService({ routedProvider: "clubkonnect", plans: PLANS });
    (service as unknown as { selectAdapter: () => Promise<never> }).selectAdapter = () =>
      Promise.reject(new Error("no route"));

    await expect(service.listDataPlans("MTN")).resolves.toEqual([]);
  });

  it("does not expose mock data plans in production", async () => {
    process.env.NODE_ENV = "production";
    const { service } = buildService({
      routedProvider: "mock",
      plans: [{ id: "mock1", providerName: "mock", network: "MTN", displayName: "1GB SME (Mock)" }]
    });

    await expect(service.listDataPlans("MTN")).resolves.toEqual([]);
  });
});

describe("VtuService.listCablePackages", () => {
  it("lists only packages for the provider that would serve cable", async () => {
    const findMany = vi.fn(() => Promise.resolve([{ id: "swift-dstv", providerName: "swiftlink" }]));
    const service = new VtuService(
      { client: { vtuCablePackage: { findMany } } } as unknown as PrismaService,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never
    );
    (service as unknown as { ensureDefaultCablePackages: () => Promise<void> }).ensureDefaultCablePackages =
      () => Promise.resolve();
    (service as unknown as { selectBillsAdapter: () => Promise<{ name: string }> }).selectBillsAdapter =
      () => Promise.resolve({ name: "swiftlink" });

    await service.listCablePackages("dstv");

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ providerName: "swiftlink", cableProvider: "dstv" })
      })
    );
  });

  it("does not expose mock cable packages in production", async () => {
    process.env.NODE_ENV = "production";
    const findMany = vi.fn();
    const service = new VtuService(
      { client: { vtuCablePackage: { findMany } } } as unknown as PrismaService,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never
    );
    (service as unknown as { ensureDefaultCablePackages: () => Promise<void> }).ensureDefaultCablePackages =
      () => Promise.resolve();
    (service as unknown as { selectBillsAdapter: () => Promise<{ name: string }> }).selectBillsAdapter =
      () => Promise.resolve({ name: "mock" });

    await expect(service.listCablePackages("dstv")).resolves.toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });
});
