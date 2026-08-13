/* eslint-disable @typescript-eslint/unbound-method -- expect(mock.method) is the vitest pattern; see guest-checkout.integration.test.ts */
import { BadRequestException, ConflictException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../prisma.service";
import type { QueueProducerService } from "../queue-producer.service";
import { RewardVerificationService } from "./reward-verification.service";
import { RewardFulfillmentService } from "./reward-fulfillment.service";
import { RewardsService } from "./rewards.service";

const ctx = { userId: "user_1", workspaceId: "workspace_1" };

function buildService(db: Record<string, unknown>, queueOverrides: Record<string, unknown> = {}) {
  const prisma = { client: db } as unknown as PrismaService;
  const queue = {
    enqueueRewardFulfillment: vi.fn(),
    enqueueRewardOpsReview: vi.fn(),
    enqueueLeaderboardRefresh: vi.fn(),
    ...queueOverrides
  } as unknown as QueueProducerService;

  const verification = new RewardVerificationService(prisma);
  const fulfillment = new RewardFulfillmentService(prisma, queue);

  return {
    service: new RewardsService(prisma, queue, verification, fulfillment),
    queue,
    fulfillment
  };
}

describe("RewardsService.submitTaskCompletion", () => {
  it("rejects a duplicate submission for the same task/participant", async () => {
    const db = {
      rewardTask: {
        findUniqueOrThrow: vi.fn(() =>
          Promise.resolve({
            id: "task_1",
            campaignId: "camp_1",
            taskType: "REFERRAL",
            verificationConfig: {},
            campaign: {
              id: "camp_1",
              status: "ACTIVE",
              startsAt: new Date(Date.now() - 1000),
              endsAt: null,
              claimedSlots: 0,
              totalSlots: 10
            }
          })
        )
      },
      rewardParticipant: {
        findUnique: vi.fn(() => Promise.resolve({ id: "part_1", campaignId: "camp_1", userId: "user_1" }))
      },
      taskCompletion: {
        findUnique: vi.fn(() => Promise.resolve({ id: "tc_existing" }))
      }
    };

    const { service } = buildService(db);

    await expect(service.submitTaskCompletion(ctx, "task_1", {})).rejects.toBeInstanceOf(
      ConflictException
    );
  });

  it("rejects submissions once the campaign's slots are already claimed", async () => {
    const db = {
      rewardTask: {
        findUniqueOrThrow: vi.fn(() =>
          Promise.resolve({
            id: "task_1",
            campaignId: "camp_1",
            taskType: "REFERRAL",
            verificationConfig: {},
            campaign: {
              id: "camp_1",
              status: "ACTIVE",
              startsAt: new Date(Date.now() - 1000),
              endsAt: null,
              claimedSlots: 10,
              totalSlots: 10
            }
          })
        )
      }
    };

    const { service } = buildService(db);

    await expect(service.submitTaskCompletion(ctx, "task_1", {})).rejects.toBeInstanceOf(
      BadRequestException
    );
  });

  it("reserves exactly one slot when the last required task is verified, and is idempotent on re-check", async () => {
    let claimedSlots = 9;
    const totalSlots = 10;
    let entitlementCreated: Record<string, unknown> | null = null;

    const db = {
      rewardTask: {
        findUniqueOrThrow: vi.fn(() =>
          Promise.resolve({
            id: "task_1",
            campaignId: "camp_1",
            taskType: "REFERRAL",
            verificationConfig: {},
            campaign: {
              id: "camp_1",
              status: "ACTIVE",
              startsAt: new Date(Date.now() - 1000),
              endsAt: null,
              claimedSlots,
              totalSlots
            }
          })
        ),
        findMany: vi.fn(() => Promise.resolve([{ id: "task_1", required: true }]))
      },
      rewardParticipant: {
        findUnique: vi.fn(() => Promise.resolve({ id: "part_1", campaignId: "camp_1", userId: "user_1" })),
        update: vi.fn(() => Promise.resolve({}))
      },
      taskCompletion: {
        findUnique: vi.fn(() => Promise.resolve(null)),
        create: vi.fn(() => Promise.resolve({ id: "tc_1" })),
        update: vi.fn(() => Promise.resolve({})),
        findUniqueOrThrow: vi.fn(() => Promise.resolve({ id: "tc_1", status: "VERIFIED" })),
        findMany: vi.fn(() => Promise.resolve([{ id: "tc_1" }]))
      },
      referralAccount: {
        findFirst: vi.fn(() => Promise.resolve({ id: "ref_acct_1" }))
      },
      verificationEvent: {
        create: vi.fn(() => Promise.resolve({}))
      },
      rewardEntitlement: {
        findUnique: vi.fn(() => Promise.resolve(null)),
        create: vi.fn((args: { data: Record<string, unknown> }) => {
          entitlementCreated = args.data;
          return Promise.resolve(args.data);
        })
      },
      $executeRaw: vi.fn(() => {
        // Simulate the atomic UPDATE ... WHERE claimedSlots < totalSlots guard.
        if (claimedSlots >= totalSlots) return Promise.resolve(0);
        claimedSlots += 1;
        return Promise.resolve(1);
      }),
      rewardCampaign: {
        findUniqueOrThrow: vi.fn(() =>
          Promise.resolve({
            id: "camp_1",
            claimedSlots,
            totalSlots,
            rewardProductId: "product_1",
            rewardValueMinor: 50000,
            currency: "NGN"
          })
        ),
        update: vi.fn(() => Promise.resolve({}))
      }
    };

    const { service, queue } = buildService(db);

    const result = await service.submitTaskCompletion(ctx, "task_1", {
      proofPayload: { referralCode: "REF123" }
    });

    expect(result).toBeDefined();
    expect(claimedSlots).toBe(10);
    expect(entitlementCreated).toMatchObject({
      campaignId: "camp_1",
      participantId: "part_1",
      idempotencyKey: "reward_ent_camp_1_part_1"
    });
    expect(queue.enqueueRewardFulfillment).toHaveBeenCalledTimes(1);
    expect(queue.enqueueLeaderboardRefresh).toHaveBeenCalledTimes(1);
    // Campaign should have been marked COMPLETED since this was the last slot.
    expect(db.rewardCampaign.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "COMPLETED" } })
    );
  });

  it("does not reserve a second slot for a participant who already holds an entitlement", async () => {
    const existingEntitlement = { id: "rent_existing", campaignId: "camp_1", participantId: "part_1" };
    const db = {
      rewardTask: {
        findUniqueOrThrow: vi.fn(() =>
          Promise.resolve({
            id: "task_1",
            campaignId: "camp_1",
            taskType: "REFERRAL",
            verificationConfig: {},
            campaign: {
              id: "camp_1",
              status: "ACTIVE",
              startsAt: new Date(Date.now() - 1000),
              endsAt: null,
              claimedSlots: 1,
              totalSlots: 10
            }
          })
        ),
        findMany: vi.fn(() => Promise.resolve([{ id: "task_1", required: true }]))
      },
      rewardParticipant: {
        findUnique: vi.fn(() => Promise.resolve({ id: "part_1", campaignId: "camp_1", userId: "user_1" })),
        update: vi.fn(() => Promise.resolve({}))
      },
      taskCompletion: {
        findUnique: vi.fn(() => Promise.resolve(null)),
        create: vi.fn(() => Promise.resolve({ id: "tc_1" })),
        update: vi.fn(() => Promise.resolve({})),
        findUniqueOrThrow: vi.fn(() => Promise.resolve({ id: "tc_1", status: "VERIFIED" })),
        findMany: vi.fn(() => Promise.resolve([{ id: "tc_1" }]))
      },
      referralAccount: { findFirst: vi.fn(() => Promise.resolve({ id: "ref_acct_1" })) },
      verificationEvent: { create: vi.fn(() => Promise.resolve({})) },
      rewardEntitlement: {
        findUnique: vi.fn(() => Promise.resolve(existingEntitlement)),
        create: vi.fn()
      },
      $executeRaw: vi.fn()
    };

    const { service, queue } = buildService(db);

    await service.submitTaskCompletion(ctx, "task_1", { proofPayload: { referralCode: "REF123" } });

    expect(db.rewardEntitlement.create).not.toHaveBeenCalled();
    expect(db.$executeRaw).not.toHaveBeenCalled();
    expect(queue.enqueueRewardFulfillment).not.toHaveBeenCalled();
  });
});

describe("RewardFulfillmentService.fulfillEntitlement", () => {
  it("credits the wallet with a stable idempotency key derived from the entitlement id", async () => {
    let ledgerEntryCreated: Record<string, unknown> | null = null;
    let fulfillmentCreated: Record<string, unknown> | null = null;

    const db = {
      rewardEntitlement: {
        findUniqueOrThrow: vi.fn(() =>
          Promise.resolve({
            id: "rent_1",
            status: "RESERVED",
            rewardValueMinor: 50000,
            currency: "NGN",
            campaign: { workspaceId: "workspace_1", name: "Launch Week" },
            rewardProduct: { handler: "WALLET_CREDIT" }
          })
        ),
        update: vi.fn(() => Promise.resolve({}))
      },
      $transaction: vi.fn((fn: (tx: Record<string, unknown>) => Promise<unknown>) =>
        fn({
          wallet: { findFirst: vi.fn(() => Promise.resolve({ id: "wallet_1" })) },
          ledgerEntry: {
            create: vi.fn((args: { data: Record<string, unknown> }) => {
              ledgerEntryCreated = args.data;
              return Promise.resolve(args.data);
            })
          },
          rewardFulfillment: {
            create: vi.fn((args: { data: Record<string, unknown> }) => {
              fulfillmentCreated = args.data;
              return Promise.resolve(args.data);
            })
          },
          rewardEntitlement: { update: vi.fn(() => Promise.resolve({})) }
        })
      )
    };

    const queue = { enqueueRewardOpsReview: vi.fn() } as unknown as QueueProducerService;
    const service = new RewardFulfillmentService({ client: db } as unknown as PrismaService, queue);

    await service.fulfillEntitlement("rent_1");

    expect(ledgerEntryCreated).toMatchObject({
      kind: "CREDIT",
      amountMinor: 50000,
      idempotencyKey: "reward_credit_rent_1"
    });
    expect(fulfillmentCreated).toMatchObject({
      entitlementId: "rent_1",
      handler: "WALLET_CREDIT",
      status: "SUCCESS",
      idempotencyKey: "reward_credit_rent_1"
    });
  });

  it("marks the entitlement ambiguous (not silently dropped) when the workspace has no matching wallet", async () => {
    const db = {
      rewardEntitlement: {
        findUniqueOrThrow: vi.fn(() =>
          Promise.resolve({
            id: "rent_2",
            status: "RESERVED",
            rewardValueMinor: 50000,
            currency: "NGN",
            campaign: { workspaceId: "workspace_1", name: "Launch Week" },
            rewardProduct: { handler: "WALLET_CREDIT" }
          })
        ),
        update: vi.fn(() => Promise.resolve({}))
      },
      $transaction: vi.fn((fn: (tx: Record<string, unknown>) => Promise<unknown>) =>
        fn({
          wallet: { findFirst: vi.fn(() => Promise.resolve(null)) },
          ledgerEntry: { create: vi.fn() },
          rewardFulfillment: { create: vi.fn() },
          rewardEntitlement: { update: vi.fn() }
        })
      ),
      rewardFulfillment: {
        findFirst: vi.fn(() => Promise.resolve(null)),
        create: vi.fn(() => Promise.resolve({}))
      }
    };

    const queue = { enqueueRewardOpsReview: vi.fn() } as unknown as QueueProducerService;
    const service = new RewardFulfillmentService({ client: db } as unknown as PrismaService, queue);

    await service.fulfillEntitlement("rent_2");

    expect(db.rewardFulfillment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        data: expect.objectContaining({ status: "AMBIGUOUS", entitlementId: "rent_2" })
      })
    );
    expect(db.rewardEntitlement.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "FAILED" } })
    );
    expect(queue.enqueueRewardOpsReview).toHaveBeenCalledWith("rent_2");
  });

  it("does not re-process an entitlement that is already FULFILLED", async () => {
    const db = {
      rewardEntitlement: {
        findUniqueOrThrow: vi.fn(() =>
          Promise.resolve({
            id: "rent_3",
            status: "FULFILLED",
            rewardValueMinor: 50000,
            currency: "NGN",
            campaign: { workspaceId: "workspace_1", name: "Launch Week" },
            rewardProduct: { handler: "WALLET_CREDIT" }
          })
        ),
        update: vi.fn()
      },
      $transaction: vi.fn()
    };

    const queue = { enqueueRewardOpsReview: vi.fn() } as unknown as QueueProducerService;
    const service = new RewardFulfillmentService({ client: db } as unknown as PrismaService, queue);

    await service.fulfillEntitlement("rent_3");

    expect(db.rewardEntitlement.update).not.toHaveBeenCalled();
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});
