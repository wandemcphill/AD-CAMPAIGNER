import { describe, expect, it } from "vitest";

import { PlatformService } from "../../../apps/api/src/modules/platform.service";
import type { AuthenticatedRequestContext } from "../../../apps/api/src/modules/request-context";

const workspace: AuthenticatedRequestContext = {
  workspaceId: "workspace_integration",
  userId: "user_integration"
};

describe("core API service flow", () => {
  it("runs campaign, payment, SMM, analytics, and support foundations", async () => {
    const service = new PlatformService();
    const campaign = await service.createCampaign(workspace, { destinationKind: "TIKTOK_LIVE" });
    const payment = await service.createPaymentIntent(workspace, {
      amountMinor: 100000,
      currency: "NGN"
    });
    const smm = await service.createSmmOrder(workspace, { serviceKind: "FOLLOWERS", quantity: 500 });
    const ticket = service.createSupportTicket(workspace, { subject: "Need review" });

    expect(campaign.status).toBe("QUEUED");
    expect(payment.gateway).toBe("MOCK");
    expect(smm.status).toBe("QUEUED");
    expect(ticket.status).toBe("OPEN");
    expect(service.getAnalyticsOverview(workspace).metrics).toHaveLength(4);
  });
});
