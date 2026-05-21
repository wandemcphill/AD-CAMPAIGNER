import { describe, expect, it } from "vitest";

import { PlatformService } from "../../../apps/api/src/modules/platform.service";

describe("core API service flow", () => {
  it("runs campaign, payment, SMM, analytics, and support foundations", async () => {
    const service = new PlatformService();
    const campaign = await service.createCampaign({ destinationKind: "TIKTOK_LIVE" });
    const payment = await service.createPaymentIntent({ amountMinor: 100000, currency: "NGN" });
    const smm = await service.createSmmOrder({ serviceKind: "FOLLOWERS", quantity: 500 });
    const ticket = service.createSupportTicket({ subject: "Need review" });

    expect(campaign.status).toBe("QUEUED");
    expect(payment.gateway).toBe("MOCK");
    expect(smm.status).toBe("QUEUED");
    expect(ticket.status).toBe("OPEN");
    expect(service.getAnalyticsOverview().metrics).toHaveLength(4);
  });
});
