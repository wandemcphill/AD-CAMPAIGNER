import { describe, expect, it } from "vitest";

import { processQueueJob, shouldStartQueueWorker } from "./processors";
import { createQueueJobOptions, queueNames } from "./queues";
import type { QueueName } from "./queues";

const enabledOtpFlags = {
  managedAdsWorkerEnabled: false,
  managedAdsAutomationEnabled: false,
  digitalAccessWorkerEnabled: false,
  digitalAccessAutomationEnabled: false,
  otpWorkerEnabled: true,
  otpAllocationEnabled: true,
  otpPollingEnabled: true,
  otpRefundsEnabled: true,
  otpProviderHealthEnabled: true
};

const enabledDigitalAccessFlags = {
  managedAdsWorkerEnabled: false,
  managedAdsAutomationEnabled: false,
  digitalAccessWorkerEnabled: true,
  digitalAccessAutomationEnabled: true,
  otpWorkerEnabled: false,
  otpAllocationEnabled: false,
  otpPollingEnabled: false,
  otpRefundsEnabled: false,
  otpProviderHealthEnabled: false
};

const enabledManagedAdsFlags = {
  managedAdsWorkerEnabled: true,
  managedAdsAutomationEnabled: true,
  digitalAccessWorkerEnabled: false,
  digitalAccessAutomationEnabled: false,
  otpWorkerEnabled: false,
  otpAllocationEnabled: false,
  otpPollingEnabled: false,
  otpRefundsEnabled: false,
  otpProviderHealthEnabled: false
};

describe("queue processors", () => {
  it("processes campaign jobs", () => {
    const result = processQueueJob("campaigns", {
      data: { campaignId: "cmp_123", action: "start" }
    } as never);

    expect(result.status).toBe("processed");
    expect(result.detail).toContain("cmp_123");
  });

  it("processes media jobs", () => {
    const result = processQueueJob("media-processing", {
      data: { assetId: "asset_123", operations: ["thumbnail-generation"] }
    } as never);

    expect(result.detail).toContain("thumbnail-generation");
  });

  it("holds risky SMM jobs for review", () => {
    const result = processQueueJob("smm-fulfillment", {
      data: {
        orderId: "smm_123",
        supplier: "live",
        fulfillment: {
          orderId: "smm_123",
          workspaceId: "workspace",
          serviceKind: "FOLLOWERS",
          destinationKind: "INSTAGRAM_PROFILE",
          destinationUrl: "https://instagram.com/fliptrybe",
          quantity: 10000,
          supplierCost: { amountMinor: 1000, currency: "NGN" },
          customerPrice: { amountMinor: 1600, currency: "NGN" },
          grossMargin: { amountMinor: 600, currency: "NGN" },
          fraudRiskLevel: "HIGH",
          retryPolicy: {
            attempts: 5,
            baseDelayMs: 30000,
            maxDelayMs: 900000,
            jitterRatio: 0.2
          },
          enqueuedAt: "2026-05-21T12:00:00.000Z"
        }
      }
    } as never);

    expect(result.status).toBe("skipped");
    expect(result.detail).toContain("risk review");
  });

  it("creates durable BullMQ job options", () => {
    const options = createQueueJobOptions("smm-fulfillment");

    expect(options.attempts).toBe(5);
    expect(options.removeOnFail.count).toBeGreaterThan(options.removeOnComplete.count);
  });

  it("defines BullMQ job options for every queue", () => {
    for (const queue of queueNames) {
      const options = createQueueJobOptions(queue);

      expect(options.attempts).toBeGreaterThanOrEqual(3);
      expect(options.backoff.type).toBe("exponential");
      expect(options.backoff.delay).toBeGreaterThan(0);
      expect(options.removeOnComplete.count).toBeGreaterThan(0);
      expect(options.removeOnFail.count).toBeGreaterThan(0);
    }
  });

  it("uses short retry delays for OTP polling jobs", () => {
    const options = createQueueJobOptions("otp-polling");

    expect(options.attempts).toBe(8);
    expect(options.backoff.delay).toBe(3000);
  });

  it("uses durable retry settings for Digital Access automation jobs", () => {
    const options = createQueueJobOptions("digital-access-automation");

    expect(options.attempts).toBe(6);
    expect(options.removeOnFail.count).toBe(50000);
  });

  it("uses durable retry settings for Managed Ads automation jobs", () => {
    const options = createQueueJobOptions("managed-ads-automation");

    expect(options.attempts).toBe(6);
    expect(options.removeOnComplete.count).toBe(20000);
    expect(options.removeOnFail.count).toBe(50000);
  });

  it("does not subscribe to disabled feature queues so jobs stay durable", () => {
    expect(shouldStartQueueWorker("campaigns")).toBe(true);
    expect(shouldStartQueueWorker("managed-ads-automation")).toBe(false);
    expect(shouldStartQueueWorker("digital-access-automation")).toBe(false);
    expect(shouldStartQueueWorker("otp-allocation")).toBe(false);
    expect(
      shouldStartQueueWorker("managed-ads-automation", { flags: enabledManagedAdsFlags })
    ).toBe(true);
    expect(
      shouldStartQueueWorker("digital-access-automation", { flags: enabledDigitalAccessFlags })
    ).toBe(true);
    expect(shouldStartQueueWorker("otp-refunds", { flags: enabledOtpFlags })).toBe(true);
  });

  it("skips Digital Access automation jobs when worker flags are disabled", () => {
    const result = processQueueJob(
      "digital-access-automation",
      {
        data: {
          id: "da_job_123",
          kind: "request_created",
          workspaceId: "workspace_123",
          requestId: "da_req_123",
          idempotencyKey: "digital_access:request_created:da_req_123",
          queuedAt: "2026-05-23T12:00:00.000Z"
        }
      } as never,
      { flags: { digitalAccessWorkerEnabled: false } }
    );

    expect(result.status).toBe("skipped");
    expect(result.details).toMatchObject({
      reason: "digital_access_worker_disabled",
      sideEffects: false
    });
  });

  it("skips Managed Ads automation jobs when worker flags are disabled", () => {
    const result = processQueueJob(
      "managed-ads-automation",
      {
        data: {
          id: "ma_job_123",
          kind: "request_submitted",
          workspaceId: "workspace_123",
          requestId: "mads_req_123",
          idempotencyKey: "managed_ads:request_submitted:mads_req_123",
          queuedAt: "2026-05-23T12:00:00.000Z"
        }
      } as never,
      { flags: { managedAdsWorkerEnabled: false } }
    );

    expect(result.status).toBe("skipped");
    expect(result.details).toMatchObject({
      reason: "managed_ads_worker_disabled",
      sideEffects: false
    });
  });

  it("processes Managed Ads automation without exposing provider references", () => {
    const result = processQueueJob(
      "managed-ads-automation",
      {
        data: {
          id: "ma_job_123",
          kind: "campaign_launch",
          workspaceId: "workspace_123",
          requestId: "mads_req_123",
          campaignId: "cmp_123",
          provider: "TIKTOK",
          providerReference: "provider_secret_123",
          objective: "LIVE_VIEWERS",
          destinationKind: "TIKTOK_LIVE",
          previousStatus: "approved",
          nextStatus: "launching",
          amountMinor: 500000,
          currency: "NGN",
          idempotencyKey: "managed_ads:campaign_launch:mads_req_123:launching:cmp_123:tiktok",
          queuedAt: "2026-05-23T12:00:00.000Z"
        }
      } as never,
      { flags: enabledManagedAdsFlags }
    );

    expect(result).toMatchObject({
      queue: "managed-ads-automation",
      status: "processed",
      details: {
        kind: "campaign_launch",
        workspaceId: "workspace_123",
        requestId: "mads_req_123",
        campaignId: "cmp_123",
        provider: "TIKTOK",
        objective: "LIVE_VIEWERS",
        destinationKind: "TIKTOK_LIVE",
        previousStatus: "approved",
        nextStatus: "launching",
        amountMinor: 500000,
        currency: "NGN",
        sideEffects: false
      }
    });
    expect(JSON.stringify(result)).not.toContain("managed_ads:campaign_launch");
    expect(JSON.stringify(result)).not.toContain("provider_secret_123");
  });

  it("processes Digital Access automation without exposing idempotency keys", () => {
    const result = processQueueJob(
      "digital-access-automation",
      {
        data: {
          id: "da_job_123",
          kind: "status_changed",
          workspaceId: "workspace_123",
          requestId: "da_req_123",
          userId: "user_secret_123",
          actorUserId: "admin_secret_123",
          serviceId: "dasvc_chatgpt",
          planId: "dasvc_chatgpt_starter",
          previousStatus: "pending",
          nextStatus: "processing",
          amountMinor: 650000,
          currency: "NGN",
          idempotencyKey: "digital_access:status_changed:da_req_123:processing",
          queuedAt: "2026-05-23T12:00:00.000Z"
        }
      } as never,
      { flags: enabledDigitalAccessFlags }
    );

    expect(result).toMatchObject({
      queue: "digital-access-automation",
      status: "processed",
      details: {
        kind: "status_changed",
        workspaceId: "workspace_123",
        requestId: "da_req_123",
        serviceId: "dasvc_chatgpt",
        planId: "dasvc_chatgpt_starter",
        previousStatus: "pending",
        nextStatus: "processing",
        amountMinor: 650000,
        currency: "NGN",
        sideEffects: false
      }
    });
    expect(JSON.stringify(result)).not.toContain("digital_access:status_changed");
    expect(JSON.stringify(result)).not.toContain("user_secret_123");
    expect(JSON.stringify(result)).not.toContain("admin_secret_123");
  });

  it.each<QueueName>(["otp-allocation", "otp-polling", "otp-refunds", "otp-provider-health"])(
    "skips %s jobs when OTP worker flags are disabled",
    (queue) => {
      const result = processQueueJob(
        queue,
        {
          data: {
            requestId: "otp_req_123",
            workspaceId: "workspace_123",
            orderId: "otp_order_123",
            countryCode: "NG",
            serviceCode: "whatsapp",
            provider: "sandbox",
            maxPriceMinor: 300,
            currency: "NGN",
            requestedAt: "2026-05-22T12:00:00.000Z"
          }
        } as never,
        { flags: { otpWorkerEnabled: false } }
      );

      expect(result.status).toBe("skipped");
      expect(result.details).toMatchObject({
        reason: "otp_worker_disabled",
        sideEffects: false
      });
    }
  );

  it("processes OTP allocation jobs with deterministic realtime-safe details", () => {
    const result = processQueueJob(
      "otp-allocation",
      {
        data: {
          requestId: "otp_req_123",
          workspaceId: "workspace_123",
          orderId: "otp_order_123",
          countryCode: "NG",
          serviceCode: "whatsapp",
          provider: "sandbox",
          maxPriceMinor: 300,
          currency: "NGN",
          requestedAt: "2026-05-22T12:00:00.000Z",
          phoneNumber: "+2348000000000",
          otpCode: "123456"
        }
      } as never,
      { flags: enabledOtpFlags }
    );

    expect(result).toMatchObject({
      queue: "otp-allocation",
      status: "processed",
      details: {
        requestId: "otp_req_123",
        orderId: "otp_order_123",
        workspaceId: "workspace_123",
        countryCode: "NG",
        serviceCode: "whatsapp",
        provider: "sandbox",
        maxPriceMinor: 300,
        currency: "NGN",
        sideEffects: false
      }
    });
    expect(JSON.stringify(result)).not.toContain("+2348000000000");
    expect(JSON.stringify(result)).not.toContain("123456");
  });

  it("processes OTP polling jobs without exposing provider order identifiers", () => {
    const result = processQueueJob(
      "otp-polling",
      {
        data: {
          allocationId: "otp_alloc_123",
          orderId: "otp_order_123",
          provider: "live",
          providerOrderId: "provider_secret_123",
          attempt: 2,
          pollAfter: "2026-05-22T12:01:00.000Z"
        }
      } as never,
      { flags: enabledOtpFlags }
    );

    expect(result.details).toMatchObject({
      allocationId: "otp_alloc_123",
      orderId: "otp_order_123",
      provider: "live",
      attempt: 2,
      pollAfter: "2026-05-22T12:01:00.000Z",
      sideEffects: false
    });
    expect(JSON.stringify(result)).not.toContain("provider_secret_123");
  });

  it("processes OTP refunds without exposing idempotency keys", () => {
    const result = processQueueJob(
      "otp-refunds",
      {
        data: {
          refundId: "otp_refund_123",
          orderId: "otp_order_123",
          allocationId: "otp_alloc_123",
          reason: "expired",
          amountMinor: 300,
          currency: "NGN",
          idempotencyKey: "idem_secret_123"
        }
      } as never,
      { flags: enabledOtpFlags }
    );

    expect(result.details).toMatchObject({
      refundId: "otp_refund_123",
      orderId: "otp_order_123",
      allocationId: "otp_alloc_123",
      reason: "expired",
      amountMinor: 300,
      currency: "NGN",
      sideEffects: false
    });
    expect(JSON.stringify(result)).not.toContain("idem_secret_123");
  });

  it("processes OTP provider health jobs", () => {
    const result = processQueueJob(
      "otp-provider-health",
      {
        data: {
          checkId: "otp_health_123",
          provider: "sandbox",
          region: "ng",
          sampledAt: "2026-05-22T12:00:00.000Z",
          degradedThresholdMs: 2500
        }
      } as never,
      { flags: enabledOtpFlags }
    );

    expect(result).toMatchObject({
      queue: "otp-provider-health",
      status: "processed",
      details: {
        checkId: "otp_health_123",
        provider: "sandbox",
        region: "ng",
        sampledAt: "2026-05-22T12:00:00.000Z",
        degradedThresholdMs: 2500,
        sideEffects: false
      }
    });
  });
});
