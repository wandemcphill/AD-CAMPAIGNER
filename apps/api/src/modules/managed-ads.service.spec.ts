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
  const mediaAssetCreate = vi.fn((input: MediaAssetCreateInput) =>
    Promise.resolve({
      id: "asset_123",
      status: input.data.status
    })
  );
  const mediaAssetFindFirst = vi.fn((): Promise<Record<string, unknown> | null> => Promise.resolve(null));
  const mediaAssetUpdate = vi.fn((input: MediaAssetUpdateInput) => Promise.resolve(input.data));
  const service = new ManagedAdsService({
    client: {
      mediaAsset: {
        create: mediaAssetCreate,
        findFirst: mediaAssetFindFirst,
        update: mediaAssetUpdate
      }
    }
  } as unknown as PrismaService);

  return { mediaAssetCreate, mediaAssetFindFirst, mediaAssetUpdate, service };
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
});
