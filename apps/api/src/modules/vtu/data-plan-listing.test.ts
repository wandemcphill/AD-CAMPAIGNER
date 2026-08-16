import { describe, expect, it, vi } from "vitest";

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

const PLANS = [
  { id: "ck1", providerName: "clubkonnect", network: "MTN", costMinor: 30_000 },
  { id: "vt1", providerName: "vtpass", network: "MTN", costMinor: 28_000 },
  { id: "vt2", providerName: "vtpass", network: "MTN", costMinor: 29_000 }
];

describe("VtuService.listDataPlans", () => {
  it("returns only plans belonging to the provider that would serve the order", async () => {
    const { service } = buildService({ routedProvider: "clubkonnect", plans: PLANS });

    const listed = await service.listDataPlans("MTN");

    expect(listed.map((p) => (p as unknown as { id: string }).id)).toEqual(["ck1"]);
  });

  it("follows the router when a different provider would serve it", async () => {
    // If health or priority moves MTN traffic to vtpass, the list has to move too
    // or it would offer plans the selected provider cannot fulfil.
    const { service } = buildService({ routedProvider: "vtpass", plans: PLANS });

    const listed = await service.listDataPlans("MTN");

    expect(listed.map((p) => (p as unknown as { id: string }).id)).toEqual(["vt1", "vt2"]);
  });

  it("returns nothing for a network with no routable provider", async () => {
    const { service } = buildService({ routedProvider: "clubkonnect", plans: PLANS });
    (service as unknown as { selectAdapter: () => Promise<never> }).selectAdapter = () =>
      Promise.reject(new Error("no route"));

    await expect(service.listDataPlans("MTN")).resolves.toEqual([]);
  });
});
