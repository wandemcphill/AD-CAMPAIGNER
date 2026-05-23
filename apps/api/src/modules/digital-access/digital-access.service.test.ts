import { BadRequestException } from "@nestjs/common";
import { beforeEach, describe, expect, it } from "vitest";

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
});
