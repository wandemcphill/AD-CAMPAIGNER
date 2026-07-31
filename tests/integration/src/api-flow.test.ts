import { describe, expect, it } from "vitest";

import { PlatformService } from "../../../apps/api/src/modules/platform.service";
import { PrismaService } from "../../../apps/api/src/modules/prisma.service";
import type { AuthenticatedRequestContext } from "../../../apps/api/src/modules/request-context";

const workspace: AuthenticatedRequestContext = {
  workspaceId: "workspace_integration",
  userId: "user_integration"
};

describe("core API service flow", () => {
  it("runs campaign, SMM, analytics, and support foundations", async () => {
    const prisma = new PrismaService();
    const service = new PlatformService(prisma);
    const campaign = await service.createCampaign(workspace, { destinationKind: "TIKTOK_LIVE" });
    const smm = await service.createSmmOrder(workspace, { serviceKind: "FOLLOWERS", quantity: 500 });
    const ticket = service.createSupportTicket(workspace, { subject: "Need review" });
    const { metrics } = await service.getAnalyticsOverview(workspace);

    expect(campaign.status).toBe("QUEUED");
    expect(smm.status).toBe("QUEUED");
    expect(ticket.status).toBe("OPEN");
    expect(metrics).toHaveLength(4);
  });
});
