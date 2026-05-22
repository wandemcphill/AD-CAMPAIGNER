import { BadRequestException } from "@nestjs/common";
import { beforeEach, describe, expect, it } from "vitest";

import { DigitalAccessHubService } from "./digital-access.service";

describe("DigitalAccessHubService", () => {
  beforeEach(() => {
    process.env.ENABLE_DIGITAL_ACCESS = "true";
    process.env.ENABLE_DIGITAL_ACCESS_ADMIN = "true";
  });

  it("blocks user routes when the feature flag is off", () => {
    process.env.ENABLE_DIGITAL_ACCESS = "false";
    const service = new DigitalAccessHubService();

    expect(() => service.listServices()).toThrow(BadRequestException);
  });

  it("keeps seeded services inactive until admin activation", () => {
    const service = new DigitalAccessHubService();

    expect(service.listServices().items).toHaveLength(0);
    expect(service.listAdminServices().items.map((item) => item.name)).toContain("ChatGPT");
  });

  it("creates one wallet-paid request for an active service and plan", () => {
    const service = new DigitalAccessHubService();

    service.updateService("dasvc_chatgpt", {
      isActive: true,
      startingPriceMinor: 650000,
      deliveryEta: "5-30 mins"
    });
    service.updatePlan("dasvc_chatgpt_starter", {
      isActive: true,
      priceMinor: 650000,
      description: "Confirmed owner-managed ChatGPT access."
    });

    const created = service.createRequest(
      {
        serviceId: "dasvc_chatgpt",
        planId: "dasvc_chatgpt_starter",
        contactType: "email",
        contactValue: "creator@example.com",
        idempotencyKey: "da-idem-1"
      },
      { userId: "user_demo" }
    );
    const repeated = service.createRequest(
      {
        serviceId: "dasvc_chatgpt",
        planId: "dasvc_chatgpt_starter",
        contactType: "email",
        contactValue: "creator@example.com",
        idempotencyKey: "da-idem-1"
      },
      { userId: "user_demo" }
    );

    expect(created.request.status).toBe("pending");
    expect(created.walletCharge?.status).toBe("CHARGED");
    expect(repeated.idempotent).toBe(true);
    expect(service.listRequests({ userId: "user_demo" })).toHaveLength(1);
  });

  it("auto-refunds failed and cancelled requests exactly once", () => {
    const service = new DigitalAccessHubService();

    service.updateService("dasvc_spotify", { isActive: true, startingPriceMinor: 300000 });
    service.updatePlan("dasvc_spotify_starter", {
      isActive: true,
      priceMinor: 300000,
      description: "Confirmed owner-managed Spotify access."
    });
    const created = service.createRequest(
      {
        serviceId: "dasvc_spotify",
        planId: "dasvc_spotify_starter",
        contactType: "whatsapp",
        contactValue: "2348010000000",
        idempotencyKey: "da-idem-2"
      },
      { userId: "user_demo" }
    );
    const failed = service.updateRequestStatus(created.request.id, "failed");
    const failedAgain = service.updateRequestStatus(created.request.id, "failed");

    expect(failed.refund?.status).toBe("REFUNDED");
    expect(failedAgain.refund).toBeUndefined();
    expect(service.getAdminOverview().totals.failed).toBe(1);
  });

  it("lets admin manage category, service, plan, assignment, and fulfillment state", () => {
    const service = new DigitalAccessHubService();
    const category = service.createCategory({
      name: "Creator Ops",
      slug: "creator-ops",
      description: "Internal creator tooling",
      sortOrder: 50
    });
    const access = service.createService({
      name: "Creator Suite",
      category: category.slug,
      slug: "creator-suite",
      description: "Owner-managed creator tools bundle.",
      deliveryEta: "30 mins",
      isActive: true
    });
    const plan = service.createPlan({
      serviceId: access.id,
      planName: "Launch",
      duration: "1 month",
      priceMinor: 450000,
      description: "Confirmed creator suite access.",
      isActive: true
    });
    const request = service.createRequest(
      {
        serviceId: access.id,
        planId: plan.id,
        contactType: "email",
        contactValue: "ops@example.com",
        idempotencyKey: "da-idem-3"
      },
      { userId: "user_demo" }
    );

    expect(service.assignRequest(request.request.id, "support_lead").assignedTo).toBe(
      "support_lead"
    );
    expect(service.updateRequestStatus(request.request.id, "processing").request.status).toBe(
      "processing"
    );
    expect(service.updateRequestStatus(request.request.id, "fulfilled").request.status).toBe(
      "fulfilled"
    );
  });
});
