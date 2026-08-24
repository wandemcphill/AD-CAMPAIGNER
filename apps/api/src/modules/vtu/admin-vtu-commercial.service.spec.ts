import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { AdminVtuCommercialService } from "./admin-vtu-commercial.service";

describe("AdminVtuCommercialService", () => {
  it("rejects a selling price below cost plus the configured minimum margin", async () => {
    const prisma = {
      client: {
        vtuCanonicalSku: {
          findUnique: vi.fn().mockResolvedValue({
            id: "sku_1",
            minMarginBps: 500,
            sellingPriceMinor: null,
            providerMappings: [{ costMinor: 10_000 }]
          }),
          update: vi.fn()
        }
      }
    } as never;

    const service = new AdminVtuCommercialService(prisma);

    await expect(
      service.updateCanonicalProduct("sku_1", { sellingPriceMinor: 10_400 }, {
        userId: "admin",
        workspaceId: "workspace"
      })
    ).rejects.toThrow(BadRequestException);
  });

  it("accepts a price at or above the protected floor", async () => {
    const updated = {
      id: "sku_1",
      sellingPriceMinor: 10_500,
      minMarginBps: 500,
      active: true,
      adminApproved: true,
      providerMappings: []
    };
    const prisma = {
      client: {
        vtuCanonicalSku: {
          findUnique: vi.fn().mockResolvedValue({
            id: "sku_1",
            minMarginBps: 500,
            sellingPriceMinor: null,
            providerMappings: [{ costMinor: 10_000 }]
          }),
          update: vi.fn().mockResolvedValue(updated)
        }
      }
    } as never;

    const service = new AdminVtuCommercialService(prisma);
    const result = await service.updateCanonicalProduct(
      "sku_1",
      { sellingPriceMinor: 10_500 },
      { userId: "admin", workspaceId: "workspace" }
    );

    expect(result).toEqual(updated);
  });
});