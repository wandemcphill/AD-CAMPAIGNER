import { describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";

import { ManagedAdsService } from "./managed-ads.service";
import type { PrismaService } from "./prisma.service";
import type { AuthenticatedRequestContext } from "./request-context";

const workspace: AuthenticatedRequestContext = {
  workspaceId: "workspace_a",
  userId: "user_a"
};

const uploadEnvKeys = [
  "NODE_ENV",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
  "MEDIA_UPLOAD_ALLOW_MOCK_STORAGE",
  "PAYMENT_PROVIDER",
  "KORAPAY_SECRET_KEY"
] as const;

type UploadEnvKey = (typeof uploadEnvKeys)[number];

type MediaAssetCreateInput = {
  data: {
    byteSize?: number;
    contentType?: string;
    status: string;
    storageProvider?: string;
    workspaceId?: string;
  };
};

type MediaAssetUpdateInput = {
  data: {
    id?: string;
    providerPublicId?: string;
    status?: string;
  };
};

type PaymentIntentCreateInput = {
  data: {
    idempotencyKey?: string;
    workspaceId?: string;
    walletId?: string;
  };
};

type CampaignFindFirstInput = {
  where?: {
    deletedAt?: null;
    id?: string;
    workspaceId?: string;
  };
};

function snapshotUploadEnv() {
  return Object.fromEntries(uploadEnvKeys.map((key) => [key, process.env[key]])) as Record<
    UploadEnvKey,
    string | undefined
  >;
}

function restoreUploadEnv(snapshot: Record<UploadEnvKey, string | undefined>) {
  for (const key of uploadEnvKeys) {
    const value = snapshot[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

function clearCloudinarySigningEnv() {
  delete process.env.CLOUDINARY_CLOUD_NAME;
  delete process.env.CLOUDINARY_API_KEY;
  delete process.env.CLOUDINARY_API_SECRET;
}

function createService() {
  const campaignFindFirst = vi.fn((input?: CampaignFindFirstInput) => {
    void input;

    return Promise.resolve({
      id: "campaign_123",
      workspaceId: workspace.workspaceId,
      currency: "NGN",
      budgetMinor: 500000,
      creatives: [],
      notes: [],
      statusHistory: [],
      assignments: [],
      manualPlacements: [],
      reports: [],
      invoices: [],
      budgetHolds: []
    });
  });
  const campaignBudgetHoldCreate = vi.fn();
  const campaignBudgetHoldFindUnique = vi.fn(
    (): Promise<Record<string, unknown> | null> => Promise.resolve(null)
  );
  const eventOutboxUpsert = vi.fn();
  const ledgerEntryCreate = vi.fn();
  const mediaAssetCreate = vi.fn((input: MediaAssetCreateInput) =>
    Promise.resolve({
      id: "asset_123",
      status: input.data.status
    })
  );
  const mediaAssetFindFirst = vi.fn((): Promise<Record<string, unknown> | null> => Promise.resolve(null));
  const mediaAssetUpdate = vi.fn((input: MediaAssetUpdateInput) => Promise.resolve(input.data));
  const paymentIntentCreate = vi.fn((input: PaymentIntentCreateInput) =>
    Promise.resolve({
      id: "payment_123",
      workspaceId: input.data.workspaceId,
      walletId: input.data.walletId,
      gateway: "mock",
      amountMinor: 1000,
      currency: "NGN",
      status: "PENDING",
      providerReference: "mock_ref_123",
      checkoutUrl: "https://payments.mock/checkout/mock_ref_123",
      campaignId: null,
      campaignInvoiceId: null,
      completedAt: null,
      creditedAt: null,
      metadata: {},
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z")
    })
  );
  const transaction = vi.fn((callback: (tx: Record<string, unknown>) => unknown) =>
    callback({
      auditLog: { create: vi.fn() },
      campaignBudgetHold: {
        create: campaignBudgetHoldCreate,
        findUnique: campaignBudgetHoldFindUnique
      },
      eventOutbox: { upsert: eventOutboxUpsert },
      ledgerEntry: { create: ledgerEntryCreate },
      wallet: {
        findUnique: vi.fn(() => Promise.resolve({ id: "wallet_123", workspaceId: workspace.workspaceId }))
      }
    })
  );
  const walletUpsert = vi.fn(() =>
    Promise.resolve({
      id: "wallet_123",
      workspaceId: workspace.workspaceId,
      currency: "NGN"
    })
  );
  const service = new ManagedAdsService({
    client: {
      $transaction: transaction,
      campaign: {
        findFirst: campaignFindFirst
      },
      campaignBudgetHold: {
        create: campaignBudgetHoldCreate,
        findUnique: campaignBudgetHoldFindUnique
      },
      eventOutbox: {
        upsert: eventOutboxUpsert
      },
      ledgerEntry: {
        create: ledgerEntryCreate
      },
      mediaAsset: {
        create: mediaAssetCreate,
        findFirst: mediaAssetFindFirst,
        update: mediaAssetUpdate
      },
      paymentIntent: {
        create: paymentIntentCreate
      },
      wallet: {
        upsert: walletUpsert
      }
    }
  } as unknown as PrismaService);

  return {
    campaignBudgetHoldCreate,
    campaignBudgetHoldFindUnique,
    campaignFindFirst,
    ledgerEntryCreate,
    mediaAssetCreate,
    mediaAssetFindFirst,
    mediaAssetUpdate,
    paymentIntentCreate,
    service,
    transaction,
    walletUpsert
  };
}

describe("ManagedAdsService media upload intents", () => {
  it("fails closed in production when Cloudinary signing is not configured", async () => {
    const env = snapshotUploadEnv();
    process.env.NODE_ENV = "production";
    clearCloudinarySigningEnv();
    delete process.env.MEDIA_UPLOAD_ALLOW_MOCK_STORAGE;
    const { mediaAssetCreate, service } = createService();

    try {
      await expect(
        service.createUploadIntent(workspace, {
          mimeType: "image/png",
          sizeBytes: 1024
        })
      ).rejects.toThrow("Media uploads are unavailable because Cloudinary signing is not configured.");
      expect(mediaAssetCreate).not.toHaveBeenCalled();
    } finally {
      restoreUploadEnv(env);
    }
  });

  it("keeps the explicit mock-storage escape hatch in production", async () => {
    const env = snapshotUploadEnv();
    process.env.NODE_ENV = "production";
    process.env.MEDIA_UPLOAD_ALLOW_MOCK_STORAGE = "true";
    clearCloudinarySigningEnv();
    const { mediaAssetCreate, service } = createService();

    try {
      const result = await service.createUploadIntent(workspace, {
        mimeType: "image/png",
        sizeBytes: 1024
      });

      expect(result).toEqual(
        expect.objectContaining({
          assetId: "asset_123",
          fields: {},
          status: "PENDING_UPLOAD"
        })
      );
      expect(result.uploadUrl).toMatch(
        /^https:\/\/storage\.mock\/upload\/workspace_a\/campaign-assets\/asset_/
      );
      const createArg = mediaAssetCreate.mock.calls[0]?.[0];
      expect(createArg).toBeDefined();
      if (!createArg) {
        throw new Error("Expected media asset create input.");
      }
      expect(createArg.data.byteSize).toBe(1024);
      expect(createArg.data.contentType).toBe("image/png");
      expect(createArg.data.storageProvider).toBe("mock-storage");
      expect(createArg.data.workspaceId).toBe(workspace.workspaceId);
    } finally {
      restoreUploadEnv(env);
    }
  });
});

describe("ManagedAdsService production payment and media guards", () => {
  it("rejects payment intents in production when Korapay live payments are not configured", async () => {
    const env = snapshotUploadEnv();
    process.env.NODE_ENV = "production";
    process.env.PAYMENT_PROVIDER = "mock";
    delete process.env.KORAPAY_SECRET_KEY;
    const { service } = createService();

    try {
      await expect(
        service.createPaymentIntent(workspace, {
          amountMinor: 1000,
          currency: "NGN"
        })
      ).rejects.toThrow("Payments are unavailable because Korapay live configuration is missing.");
    } finally {
      restoreUploadEnv(env);
    }
  });

  it("rejects Cloudinary upload completion without a valid signed upload response", async () => {
    const env = snapshotUploadEnv();
    process.env.CLOUDINARY_API_SECRET = "cloudinary-secret";
    const { mediaAssetFindFirst, mediaAssetUpdate, service } = createService();
    mediaAssetFindFirst.mockResolvedValue({
      id: "asset_123",
      workspaceId: workspace.workspaceId,
      storageProvider: "cloudinary",
      providerPublicId: "fliptrybe/workspace_a/campaign-assets/asset_123",
      byteSize: 1024,
      metadata: {}
    });

    try {
      await expect(
        service.completeUpload(workspace, "asset_123", {
          public_id: "fliptrybe/workspace_a/campaign-assets/asset_123",
          version: "1710000000",
          signature: "bad-signature"
        })
      ).rejects.toThrow("Cloudinary upload completion could not be verified.");
      expect(mediaAssetUpdate).not.toHaveBeenCalled();
    } finally {
      restoreUploadEnv(env);
    }
  });

  it("scopes Cloudinary upload completion lookup to the active workspace", async () => {
    const { mediaAssetFindFirst, service } = createService();

    await expect(service.completeUpload(workspace, "asset_foreign", {})).rejects.toThrow(
      "Media asset was not found in the active workspace."
    );
    expect(mediaAssetFindFirst).toHaveBeenCalledWith({
      where: { id: "asset_foreign", workspaceId: workspace.workspaceId }
    });
  });

  it("accepts Cloudinary upload completion when the response signature matches the asset", async () => {
    const env = snapshotUploadEnv();
    process.env.CLOUDINARY_API_SECRET = "cloudinary-secret";
    const providerPublicId = "fliptrybe/workspace_a/campaign-assets/asset_123";
    const version = "1710000000";
    const signature = createHash("sha1")
      .update(`public_id=${providerPublicId}&version=${version}cloudinary-secret`)
      .digest("hex");
    const { mediaAssetFindFirst, mediaAssetUpdate, service } = createService();
    mediaAssetFindFirst.mockResolvedValue({
      id: "asset_123",
      workspaceId: workspace.workspaceId,
      storageProvider: "cloudinary",
      providerPublicId,
      byteSize: 1024,
      metadata: {}
    });
    mediaAssetUpdate.mockResolvedValue({ id: "asset_123", status: "READY" });

    try {
      await expect(
        service.completeUpload(workspace, "asset_123", {
          bytes: 2048,
          public_id: providerPublicId,
          secure_url: "https://res.cloudinary.com/demo/image/upload/v1710000000/asset_123.png",
          signature,
          version
        })
      ).resolves.toEqual({ id: "asset_123", status: "READY" });
      const updateArg = mediaAssetUpdate.mock.calls[0]?.[0];
      expect(updateArg).toBeDefined();
      if (!updateArg) {
        throw new Error("Expected media asset update input.");
      }
      expect(updateArg.data.providerPublicId).toBe(providerPublicId);
      expect(updateArg.data.status).toBe("READY");
    } finally {
      restoreUploadEnv(env);
    }
  });

  it("persists caller idempotency keys on payment intents within the workspace wallet", async () => {
    const env = snapshotUploadEnv();
    process.env.NODE_ENV = "test";
    process.env.PAYMENT_PROVIDER = "mock";
    const { paymentIntentCreate, service, walletUpsert } = createService();

    try {
      await expect(
        service.createPaymentIntent(workspace, {
          amountMinor: 1000,
          currency: "NGN",
          idempotencyKey: "checkout:workspace_a:campaign_123"
        })
      ).resolves.toEqual(
        expect.objectContaining({
          id: "payment_123",
          workspaceId: workspace.workspaceId
        })
      );
      expect(walletUpsert).toHaveBeenCalledWith({
        where: { workspaceId_currency: { workspaceId: workspace.workspaceId, currency: "NGN" } },
        update: {},
        create: { workspaceId: workspace.workspaceId, currency: "NGN" }
      });
      const paymentIntentInput = paymentIntentCreate.mock.calls.at(-1)?.[0];
      expect(paymentIntentInput?.data).toMatchObject({
        idempotencyKey: "checkout:workspace_a:campaign_123",
        workspaceId: workspace.workspaceId,
        walletId: "wallet_123"
      });
    } finally {
      restoreUploadEnv(env);
    }
  });

  it("returns an existing budget hold without duplicating ledger writes for the same idempotency key", async () => {
    const existingHold = {
      id: "hold_123",
      amountMinor: 500000,
      currency: "NGN",
      idempotencyKey: "campaign:campaign_123:hold:500000",
      status: "ACTIVE"
    };
    const {
      campaignBudgetHoldCreate,
      campaignBudgetHoldFindUnique,
      campaignFindFirst,
      ledgerEntryCreate,
      service
    } = createService();
    campaignBudgetHoldFindUnique.mockResolvedValue(existingHold);

    await expect(
      service.createBudgetHold(workspace, "campaign_123", {
        amountMinor: 500000,
        idempotencyKey: "campaign:campaign_123:hold:500000"
      })
    ).resolves.toBe(existingHold);

    const campaignQuery = campaignFindFirst.mock.calls.at(-1)?.[0];
    expect(campaignQuery?.where).toMatchObject({
      id: "campaign_123",
      workspaceId: workspace.workspaceId,
      deletedAt: null
    });
    expect(campaignBudgetHoldFindUnique).toHaveBeenCalledWith({
      where: { idempotencyKey: "campaign:campaign_123:hold:500000" }
    });
    expect(ledgerEntryCreate).not.toHaveBeenCalled();
    expect(campaignBudgetHoldCreate).not.toHaveBeenCalled();
  });
});
