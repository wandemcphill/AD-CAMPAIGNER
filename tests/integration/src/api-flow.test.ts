import { describe, expect, it } from "vitest";

import { PlatformService } from "../../../apps/api/src/modules/platform.service";
import { PrismaService } from "../../../apps/api/src/modules/prisma.service";
import { NotificationsService } from "../../../apps/api/src/modules/notifications/notifications.service";
import type { QueueProducerService } from "../../../apps/api/src/modules/queue-producer.service";
import type { AuthenticatedRequestContext } from "../../../apps/api/src/modules/request-context";

const workspace: AuthenticatedRequestContext = {
  workspaceId: "workspace_integration",
  userId: "user_integration"
};

describe("core API service flow", () => {
  it("runs campaign, SMM, analytics, and support foundations", async () => {
    const prisma = new PrismaService();
    const notifications = new NotificationsService(prisma, {} as unknown as QueueProducerService);
    const service = new PlatformService(prisma, notifications);
    const campaign = await service.createCampaign(workspace, { destinationKind: "TIKTOK_LIVE" });
    const growth = await service.createGrowthOrder(workspace, {
      serviceCode: "tiktok-views",
      quantity: 100,
      destinationUrl: "https://www.tiktok.com/@fliptrybe/video/integration",
      idempotencyKey: "integration-test-growth-order"
    });
    const ticket = service.createSupportTicket(workspace, { subject: "Need review" });
    const { metrics } = await service.getAnalyticsOverview(workspace);

    expect(campaign.status).toBe("QUEUED");
    expect(growth.order.status).toBeDefined();
    expect(ticket.status).toBe("OPEN");
    expect(metrics).toHaveLength(4);
  });
});
