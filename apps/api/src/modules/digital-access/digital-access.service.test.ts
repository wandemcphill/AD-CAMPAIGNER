import { BadRequestException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../prisma.service";
import { DigitalAccessHubService } from "./digital-access.service";

const prisma = {
  client: new Proxy(
    {},
    {
      get() {
        throw new Error("Prisma should not be called for preflight validation failures.");
      }
    }
  )
} as unknown as PrismaService;

describe("DigitalAccessHubService", () => {
  beforeEach(() => {
    process.env.ENABLE_DIGITAL_ACCESS = "true";
    process.env.ENABLE_DIGITAL_ACCESS_ADMIN = "true";
  });

  it("blocks user routes before touching Prisma when the feature flag is off", async () => {
    process.env.ENABLE_DIGITAL_ACCESS = "false";
    const service = new DigitalAccessHubService(prisma);

    await expect(service.listServices()).rejects.toBeInstanceOf(BadRequestException);
  });

  it("blocks admin routes when the admin flag is off", async () => {
    process.env.ENABLE_DIGITAL_ACCESS_ADMIN = "false";
    const service = new DigitalAccessHubService(prisma);

    await expect(
      service.getAdminOverview({ userId: "user_test", workspaceId: "workspace_test" })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("requires a logged-in user before opening a wallet transaction", async () => {
    const service = new DigitalAccessHubService(prisma);

    await expect(
      service.createRequest({
        serviceId: "dasvc_chatgpt",
        planId: "dasvc_chatgpt_starter",
        contactType: "email",
        contactValue: "creator@example.com",
        idempotencyKey: "da-idem-1"
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects negative admin plan prices before creating catalog rows", async () => {
    const digitalAccessPlanCreate = vi.fn();
    const service = new DigitalAccessHubService({
      client: {
        workspace: {
          findFirst: vi.fn(() =>
            Promise.resolve({
              id: "workspace_test",
              defaultCurrency: "NGN",
              organization: {
                id: "organization_test",
                members: [{ role: "OWNER", permissions: ["digital_access:manage"] }]
              }
            })
          )
        },
        digitalAccessService: {
          findFirst: vi.fn(() => Promise.resolve({ id: "service_test", deletedAt: null }))
        },
        digitalAccessPlan: {
          create: digitalAccessPlanCreate
        }
      }
    } as unknown as PrismaService);

    await expect(
      service.createPlan(
        {
          serviceId: "service_test",
          planName: "Starter",
          duration: "7 days",
          priceMinor: -100
        },
        { userId: "user_test", workspaceId: "workspace_test" }
      )
    ).rejects.toThrow("Digital Access plan price must be a non-negative minor-unit amount.");
    expect(digitalAccessPlanCreate).not.toHaveBeenCalled();
  });

  it("gates a refund-triggering status transition behind approval instead of executing it", async () => {
    const transactionSpy = vi.fn();
    const approvalsRequest = vi.fn(() => Promise.resolve({ id: "appr_1" }));
    const db = {
      workspace: {
        findFirst: vi.fn(() =>
          Promise.resolve({
            id: "workspace_test",
            defaultCurrency: "NGN",
            organization: {
              id: "organization_test",
              members: [{ role: "OWNER", permissions: ["digital_access:manage"] }]
            }
          })
        )
      },
      digitalAccessRequest: {
        findFirst: vi.fn(() =>
          Promise.resolve({
            id: "dar_1",
            status: "PENDING",
            workspaceId: "workspace_test",
            deletedAt: null,
            service: {},
            plan: {},
            walletCharges: []
          })
        )
      },
      $transaction: transactionSpy
    };
    const service = new DigitalAccessHubService(
      { client: db } as unknown as PrismaService,
      undefined,
      { request: approvalsRequest } as unknown as import("../approvals/approvals.service").ApprovalsService
    );

    const result = await service.updateRequestStatus("dar_1", "failed", {
      userId: "user_test",
      workspaceId: "workspace_test"
    });

    expect(result).toEqual({ pending: true, approvalRequestId: "appr_1" });
    expect(approvalsRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "digital_access.refund",
        entityType: "DigitalAccessRequest",
        entityId: "dar_1",
        requestedByUserId: "user_test"
      })
    );
    expect(transactionSpy).not.toHaveBeenCalled();
  });
});
