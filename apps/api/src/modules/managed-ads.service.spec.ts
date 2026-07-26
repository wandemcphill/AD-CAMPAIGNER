import { describe, expect, it, vi } from "vitest";
import { createHash, createHmac } from "node:crypto";

import { ManagedAdsService } from "./managed-ads.service";
import type { PrismaService } from "./prisma.service";
import type { AuthenticatedRequestContext } from "./request-context";

const workspace: AuthenticatedRequestContext = {
  workspaceId: "workspace_a",
  userId: "user_a",
  permissions: [
    "admin:access",
    "audit:read",
    "campaign:approve",
    "campaign:create",
    "campaign:manage",
    "payment:manage"
  ]
};

const defaultMembership = {
  permissions: [
    "admin:access",
    "audit:read",
    "campaign:approve",
    "campaign:create",
    "campaign:manage",
    "payment:manage"
  ],
  role: "OWNER"
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
    amountMinor?: number;
    campaignId?: string | null;
    campaignInvoiceId?: string | null;
    currency?: string;
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

type MockCampaignSpendEntry = {
  amountMinor: number;
  createdAt?: Date;
  currency?: string;
  id?: string;
  metadata?: Record<string, unknown>;
  notes?: string;
  recordedForDate?: Date;
  updatedAt?: Date;
};

type MockCampaign = {
  assignments: Array<{
    assignee?: { email?: string | null; id?: string; name?: string | null } | null;
    assigneeUserId: string;
    role: string;
    status: string;
  }>;
  budgetHolds: unknown[];
  budgetMinor: number;
  createdAt: Date;
  creatives: unknown[];
  creatorUserId: string;
  currency: string;
  id: string;
  invoices: unknown[];
  ledgerEntries: unknown[];
  manualPlacements: unknown[];
  name: string;
  notes: unknown[];
  reports: unknown[];
  spendEntries: MockCampaignSpendEntry[];
  status: string;
  statusHistory: unknown[];
  updatedAt: Date;
  workspaceId: string;
};

type CampaignUpdateInput = {
  data: Partial<MockCampaign> & {
    cancelledAt?: Date | null;
    completedAt?: Date | null;
    pausedAt?: Date | null;
  };
  where?: {
    id?: string;
  };
};

type AuditLogCreateInput = {
  data: {
    action?: string;
    actorUserId?: string | null;
    metadata?: {
      newStatus?: unknown;
      previousStatus?: unknown;
    } & Record<string, unknown>;
  };
};

type CampaignLedgerEntryUpsertInput = {
  create?: {
    amountMinor?: number;
    category?: string;
    direction?: string;
    type?: string;
  } & Record<string, unknown>;
};

type CampaignSpendEntryCreateInput = {
  data: {
    amountMinor?: number;
    notes?: string | null;
    source?: string;
  } & Record<string, unknown>;
};

type NotificationUpsertInput = {
  create?: {
    recipientUserId?: string | null;
    title?: string;
  } & Record<string, unknown>;
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

function createService(
  options: {
    membership?: { permissions: string[]; role: string } | null;
    workspaceRecord?: { organizationId: string } | null;
  } = {}
) {
  const membership = options.membership === undefined ? defaultMembership : options.membership;
  const workspaceRecord =
    options.workspaceRecord === undefined ? { organizationId: "organization_123" } : options.workspaceRecord;
  const baseCampaign: MockCampaign = {
    id: "campaign_123",
    workspaceId: workspace.workspaceId,
    creatorUserId: workspace.userId,
    name: "Launch campaign",
    status: "RUNNING",
    currency: "NGN",
    budgetMinor: 500000,
    creatives: [],
    notes: [],
    statusHistory: [],
    assignments: [
      {
        assigneeUserId: "operator_123",
        role: "OPERATOR",
        status: "ACTIVE"
      }
    ],
    manualPlacements: [],
    reports: [],
    invoices: [],
    budgetHolds: [],
    spendEntries: [],
    ledgerEntries: [],
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z")
  };
  const campaignFindFirst = vi.fn((input?: CampaignFindFirstInput): Promise<unknown> => {
    void input;

    return Promise.resolve(baseCampaign);
  });
  const campaignUpdate = vi.fn((input: CampaignUpdateInput) =>
    Promise.resolve({
      ...baseCampaign,
      ...input.data,
      updatedAt: new Date("2026-01-01T01:00:00.000Z")
    })
  );
  const campaignBudgetHoldCreate = vi.fn((input: Record<string, any>) =>
    Promise.resolve({
      id: "hold_123",
      status: "ACTIVE",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      ...input.data
    })
  );
  const activeHold = {
    id: "hold_123",
    campaignId: "campaign_123",
    walletId: "wallet_123",
    invoiceId: null,
    amountMinor: 500000,
    currency: "NGN",
    status: "ACTIVE",
    campaign: { workspaceId: workspace.workspaceId }
  };
  const campaignBudgetHoldFindFirst = vi.fn(
    (): Promise<Record<string, unknown> | null> => Promise.resolve(activeHold)
  );
  const campaignBudgetHoldFindUnique = vi.fn(
    (): Promise<Record<string, unknown> | null> => Promise.resolve(null)
  );
  const campaignBudgetHoldFindMany = vi.fn(() => Promise.resolve([]));
  const campaignBudgetHoldUpdate = vi.fn((input: Record<string, any>) =>
    Promise.resolve({ ...activeHold, ...input.data })
  );
  const auditLogCreate = vi.fn((input: AuditLogCreateInput) => Promise.resolve({ id: "audit_123", ...input.data }));
  const campaignLedgerEntryUpsert = vi.fn((input: CampaignLedgerEntryUpsertInput) =>
    Promise.resolve({ id: "campaign_ledger_123", ...input.create })
  );
  const campaignSpendEntryCreate = vi.fn((input: CampaignSpendEntryCreateInput) =>
    Promise.resolve({
      id: "spend_123",
      amountMinor: input.data.amountMinor,
      currency: input.data.currency,
      metadata: input.data.metadata,
      notes: input.data.notes,
      recordedForDate: input.data.recordedForDate,
      source: input.data.source,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z")
    })
  );
  const analyticsMetricCreate = vi.fn();
  const eventOutboxFindUnique = vi.fn(
    (): Promise<Record<string, unknown> | null> => Promise.resolve(null)
  );
  const eventOutboxUpsert = vi.fn();
  const eventOutboxUpdate = vi.fn();
  const walletLedgerEntries = [
    {
      id: "ledger_opening",
      walletId: "wallet_123",
      kind: "CREDIT",
      amountMinor: 1000000,
      currency: "NGN",
      reference: "opening_balance",
      description: "Opening balance",
      idempotencyKey: "wallet:opening",
      sourceType: null,
      sourceId: null,
      metadata: {},
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z")
    }
  ];
  const ledgerEntryCreate = vi.fn((input: Record<string, any>) =>
    Promise.resolve({ id: "ledger_123", ...input.data })
  );
  const ledgerEntryFindMany = vi.fn(() => Promise.resolve(walletLedgerEntries));
  const ledgerEntryUpsert = vi.fn((input: Record<string, any>) =>
    Promise.resolve({ id: "ledger_123", ...input.create })
  );
  const mediaAssetCreate = vi.fn((input: MediaAssetCreateInput) =>
    Promise.resolve({
      id: "asset_123",
      status: input.data.status
    })
  );
  const mediaAssetFindFirst = vi.fn((): Promise<Record<string, unknown> | null> => Promise.resolve(null));
  const mediaAssetUpdate = vi.fn((input: MediaAssetUpdateInput) => Promise.resolve(input.data));
  const notificationUpsert = vi.fn((input: NotificationUpsertInput) =>
    Promise.resolve({ id: "notification_123", ...input.create })
  );
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
  const paymentIntentFindUnique = vi.fn(
    (): Promise<Record<string, any> | null> => Promise.resolve(null)
  );
  const paymentIntentFindFirst = vi.fn(
    (): Promise<Record<string, any> | null> => Promise.resolve(null)
  );
  const paymentIntentUpdate = vi.fn((input: Record<string, any>) =>
    Promise.resolve({
      id: input.where.id,
      workspaceId: workspace.workspaceId,
      walletId: "wallet_123",
      gateway: "mock",
      amountMinor: 1000,
      currency: "NGN",
      status: input.data.status,
      providerReference: input.data.providerReference,
      checkoutUrl: "https://payments.mock/checkout/mock_ref_123",
      campaignId: null,
      campaignInvoiceId: null,
      completedAt: input.data.completedAt,
      creditedAt: input.data.creditedAt,
      metadata: {},
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z")
    })
  );
  const campaignInvoiceRecord = {
    id: "invoice_123",
    workspaceId: workspace.workspaceId,
    campaignId: "campaign_123",
    companyProfileId: null,
    number: "INV-123",
    status: "ISSUED",
    subtotalMinor: 500000,
    taxMinor: 0,
    totalMinor: 500000,
    amountPaidMinor: 0,
    currency: "NGN",
    lineItems: [],
    issuedAt: new Date("2026-01-01T00:00:00.000Z"),
    dueAt: null,
    paidAt: null,
    voidedAt: null,
    metadata: {},
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    deletedAt: null
  };
  const campaignInvoiceCreate = vi.fn((input: Record<string, any>) =>
    Promise.resolve({ id: "invoice_123", amountPaidMinor: 0, ...input.data })
  );
  const campaignInvoiceFindFirst = vi.fn(
    (): Promise<Record<string, any> | null> => Promise.resolve(campaignInvoiceRecord)
  );
  const campaignInvoiceFindMany = vi.fn(() => Promise.resolve([campaignInvoiceRecord]));
  const campaignInvoiceUpdate = vi.fn((input: Record<string, any>) =>
    Promise.resolve({ ...campaignInvoiceRecord, ...input.data })
  );
  const walletUpsert = vi.fn(() =>
    Promise.resolve({
      id: "wallet_123",
      workspaceId: workspace.workspaceId,
      currency: "NGN"
    })
  );
  const transaction = vi.fn((callback: (tx: Record<string, unknown>) => unknown) =>
    callback({
      $queryRaw: vi.fn(() => Promise.resolve()),
      analyticsMetric: { create: analyticsMetricCreate },
      auditLog: { create: auditLogCreate },
      campaign: { findFirst: campaignFindFirst, update: campaignUpdate },
      campaignBudgetHold: {
        create: campaignBudgetHoldCreate,
        findFirst: campaignBudgetHoldFindFirst,
        findMany: campaignBudgetHoldFindMany,
        findUnique: campaignBudgetHoldFindUnique,
        update: campaignBudgetHoldUpdate
      },
      campaignNote: { create: vi.fn() },
      campaignInvoice: {
        create: campaignInvoiceCreate,
        findFirst: campaignInvoiceFindFirst,
        findMany: campaignInvoiceFindMany,
        update: campaignInvoiceUpdate
      },
      campaignLedgerEntry: { upsert: campaignLedgerEntryUpsert },
      campaignSpendEntry: { create: campaignSpendEntryCreate },
      campaignStatusHistory: { create: vi.fn() },
      eventOutbox: {
        findUnique: eventOutboxFindUnique,
        upsert: eventOutboxUpsert,
        update: eventOutboxUpdate
      },
      ledgerEntry: {
        create: ledgerEntryCreate,
        findMany: ledgerEntryFindMany,
        upsert: ledgerEntryUpsert
      },
      notification: { upsert: notificationUpsert },
      paymentIntent: {
        create: paymentIntentCreate,
        findFirst: paymentIntentFindFirst,
        findUnique: paymentIntentFindUnique,
        update: paymentIntentUpdate
      },
      wallet: {
        findUnique: vi.fn(() => Promise.resolve({ id: "wallet_123", workspaceId: workspace.workspaceId, currency: "NGN" })),
        upsert: walletUpsert
      }
    })
  );
  const teamMemberFindFirst = vi.fn(() => Promise.resolve(membership));
  const workspaceFindFirst = vi.fn(() => Promise.resolve(workspaceRecord));
  const service = new ManagedAdsService({
    client: {
      $transaction: transaction,
      campaign: {
        findFirst: campaignFindFirst,
        update: campaignUpdate
      },
      campaignBudgetHold: {
        create: campaignBudgetHoldCreate,
        findFirst: campaignBudgetHoldFindFirst,
        findMany: campaignBudgetHoldFindMany,
        findUnique: campaignBudgetHoldFindUnique,
        update: campaignBudgetHoldUpdate
      },
      campaignInvoice: {
        create: campaignInvoiceCreate,
        findFirst: campaignInvoiceFindFirst,
        findMany: campaignInvoiceFindMany,
        update: campaignInvoiceUpdate
      },
      campaignLedgerEntry: {
        upsert: campaignLedgerEntryUpsert
      },
      campaignSpendEntry: {
        create: campaignSpendEntryCreate
      },
      analyticsMetric: {
        create: analyticsMetricCreate
      },
      eventOutbox: {
        findUnique: eventOutboxFindUnique,
        upsert: eventOutboxUpsert,
        update: eventOutboxUpdate
      },
      ledgerEntry: {
        create: ledgerEntryCreate,
        findMany: ledgerEntryFindMany,
        upsert: ledgerEntryUpsert
      },
      mediaAsset: {
        create: mediaAssetCreate,
        findFirst: mediaAssetFindFirst,
        update: mediaAssetUpdate
      },
      paymentIntent: {
        create: paymentIntentCreate,
        findFirst: paymentIntentFindFirst,
        findUnique: paymentIntentFindUnique,
        update: paymentIntentUpdate
      },
      teamMember: {
        findFirst: teamMemberFindFirst
      },
      wallet: {
        findUnique: vi.fn(() => Promise.resolve({ id: "wallet_123", workspaceId: workspace.workspaceId, currency: "NGN" })),
        upsert: walletUpsert
      },
      workspace: {
        findFirst: workspaceFindFirst
      }
    }
  } as unknown as PrismaService);

  return {
    analyticsMetricCreate,
    auditLogCreate,
    baseCampaign,
    campaignBudgetHoldCreate,
    campaignBudgetHoldFindFirst,
    campaignBudgetHoldFindMany,
    campaignBudgetHoldFindUnique,
    campaignBudgetHoldUpdate,
    campaignFindFirst,
    campaignInvoiceCreate,
    campaignInvoiceFindFirst,
    campaignInvoiceFindMany,
    campaignInvoiceUpdate,
    campaignUpdate,
    campaignLedgerEntryUpsert,
    campaignSpendEntryCreate,
    eventOutboxFindUnique,
    eventOutboxUpsert,
    eventOutboxUpdate,
    ledgerEntryCreate,
    ledgerEntryFindMany,
    ledgerEntryUpsert,
    mediaAssetCreate,
    mediaAssetFindFirst,
    mediaAssetUpdate,
    notificationUpsert,
    paymentIntentCreate,
    paymentIntentFindFirst,
    paymentIntentFindUnique,
    paymentIntentUpdate,
    service,
    teamMemberFindFirst,
    transaction,
    walletUpsert,
    workspaceFindFirst
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

  it("rejects negative payment intent amounts before creating provider or database records", async () => {
    const env = snapshotUploadEnv();
    process.env.NODE_ENV = "test";
    process.env.PAYMENT_PROVIDER = "mock";
    const { paymentIntentCreate, paymentIntentFindUnique, service, walletUpsert } = createService();

    try {
      await expect(
        service.createPaymentIntent(workspace, {
          amountMinor: -1000,
          currency: "NGN"
        })
      ).rejects.toThrow("Payment amount must be a positive minor-unit integer.");
      expect(paymentIntentFindUnique).not.toHaveBeenCalled();
      expect(paymentIntentCreate).not.toHaveBeenCalled();
      expect(walletUpsert).not.toHaveBeenCalled();
    } finally {
      restoreUploadEnv(env);
    }
  });

  it("returns an existing payment intent for a reused idempotency key", async () => {
    const env = snapshotUploadEnv();
    process.env.NODE_ENV = "test";
    process.env.PAYMENT_PROVIDER = "mock";
    const { paymentIntentCreate, paymentIntentFindUnique, service, walletUpsert } = createService();
    paymentIntentFindUnique.mockResolvedValue({
      id: "payment_existing",
      workspaceId: workspace.workspaceId,
      walletId: "wallet_123",
      gateway: "mock",
      amountMinor: 1000,
      currency: "NGN",
      status: "PENDING",
      providerReference: "mock_existing",
      checkoutUrl: "https://payments.mock/checkout/mock_existing",
      campaignId: null,
      campaignInvoiceId: null,
      completedAt: null,
      creditedAt: null,
      metadata: {},
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z")
    });

    try {
      await expect(
        service.createPaymentIntent(workspace, {
          amountMinor: 1000,
          currency: "NGN",
          idempotencyKey: "checkout:workspace_a:campaign_123"
        })
      ).resolves.toEqual(expect.objectContaining({ id: "payment_existing" }));
      expect(paymentIntentFindUnique).toHaveBeenCalledWith({
        where: { idempotencyKey: "checkout:workspace_a:campaign_123" }
      });
      expect(paymentIntentCreate).not.toHaveBeenCalled();
      expect(walletUpsert).not.toHaveBeenCalled();
    } finally {
      restoreUploadEnv(env);
    }
  });

  it("rejects payment idempotency keys that already belong to another workspace", async () => {
    const env = snapshotUploadEnv();
    process.env.NODE_ENV = "test";
    process.env.PAYMENT_PROVIDER = "mock";
    const { paymentIntentCreate, paymentIntentFindUnique, service } = createService();
    paymentIntentFindUnique.mockResolvedValue({
      id: "payment_foreign",
      workspaceId: "workspace_foreign",
      walletId: "wallet_foreign",
      gateway: "mock",
      amountMinor: 1000,
      currency: "NGN",
      status: "PENDING",
      providerReference: "mock_foreign",
      checkoutUrl: "https://payments.mock/checkout/mock_foreign",
      campaignId: null,
      campaignInvoiceId: null,
      completedAt: null,
      creditedAt: null,
      metadata: {},
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z")
    });

    try {
      await expect(
        service.createPaymentIntent(workspace, {
          amountMinor: 1000,
          currency: "NGN",
          idempotencyKey: "checkout:reused"
        })
      ).rejects.toThrow("Idempotency key was already used for another workspace.");
      expect(paymentIntentCreate).not.toHaveBeenCalled();
    } finally {
      restoreUploadEnv(env);
    }
  });

  it("credits the wallet once for a signed Korapay webhook and treats replay as duplicate", async () => {
    const env = snapshotUploadEnv();
    process.env.NODE_ENV = "test";
    process.env.PAYMENT_PROVIDER = "live";
    process.env.KORAPAY_SECRET_KEY = "korapay-test-secret";
    process.env.KORAPAY_WEBHOOK_SECRET = "korapay-webhook-secret";
    const {
      eventOutboxFindUnique,
      eventOutboxUpdate,
      eventOutboxUpsert,
      ledgerEntryUpsert,
      paymentIntentFindFirst,
      paymentIntentFindUnique,
      paymentIntentUpdate,
      service
    } = createService();
    const pendingIntent = {
      id: "payment_123",
      workspaceId: workspace.workspaceId,
      walletId: "wallet_123",
      gateway: "KORAPAY",
      amountMinor: 1000,
      currency: "NGN",
      status: "PENDING",
      providerReference: "ft_pay_webhook_123",
      checkoutUrl: "https://checkout.korapay.com/ft_pay_webhook_123/pay",
      campaignId: null,
      campaignInvoiceId: null,
      completedAt: null,
      creditedAt: null,
      metadata: {},
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z")
    };
    const data = {
      amount: 10,
      currency: "NGN",
      reference: "ft_pay_webhook_123",
      status: "success"
    };
    const payload = { event: "charge.success", data };
    const signature = createHmac("sha256", "korapay-webhook-secret")
      .update(JSON.stringify(data))
      .digest("hex");
    paymentIntentFindFirst.mockResolvedValue(pendingIntent);
    paymentIntentFindUnique.mockResolvedValue(pendingIntent);
    eventOutboxFindUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "event_123",
        idempotencyKey: "korapay:webhook:charge.success:hash",
        processedAt: new Date("2026-01-01T00:00:00.000Z")
      });

    try {
      await expect(service.handleKorapayWebhook(payload, signature)).resolves.toEqual({
        accepted: true,
        reference: "ft_pay_webhook_123",
        status: "COMPLETED"
      });

      expect(eventOutboxUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            name: "KorapayWebhookReceived",
            entityId: "ft_pay_webhook_123"
          })
        })
      );
      expect(ledgerEntryUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { idempotencyKey: "payment:payment_123:credit" },
          create: expect.objectContaining({
            amountMinor: 1000,
            kind: "CREDIT",
            reference: "ft_pay_webhook_123",
            sourceId: "payment_123"
          })
        })
      );
      expect(paymentIntentUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "payment_123" },
          data: expect.objectContaining({
            status: "COMPLETED",
            providerReference: "ft_pay_webhook_123"
          })
        })
      );
      expect(eventOutboxUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "PROCESSED" })
        })
      );
      const ledgerWritesAfterFirstWebhook = ledgerEntryUpsert.mock.calls.length;

      await expect(service.handleKorapayWebhook(payload, signature)).resolves.toEqual({
        accepted: true,
        duplicate: true,
        reference: "ft_pay_webhook_123",
        status: "success"
      });
      expect(ledgerEntryUpsert).toHaveBeenCalledTimes(ledgerWritesAfterFirstWebhook);
    } finally {
      restoreUploadEnv(env);
    }
  });

  it("does not credit the wallet again when a completed payment is verified twice", async () => {
    const env = snapshotUploadEnv();
    process.env.NODE_ENV = "test";
    process.env.PAYMENT_PROVIDER = "mock";
    const {
      ledgerEntryUpsert,
      paymentIntentFindFirst,
      paymentIntentFindUnique,
      paymentIntentUpdate,
      service
    } = createService();
    const completedAt = new Date("2026-01-01T00:00:00.000Z");
    const completedIntent = {
      id: "payment_123",
      workspaceId: workspace.workspaceId,
      walletId: "wallet_123",
      gateway: "KORAPAY",
      amountMinor: 1000,
      currency: "NGN",
      status: "COMPLETED",
      providerReference: "mock_ref_123",
      checkoutUrl: "https://payments.mock/checkout/mock_ref_123",
      campaignId: null,
      campaignInvoiceId: null,
      completedAt,
      creditedAt: completedAt,
      metadata: {},
      createdAt: completedAt,
      updatedAt: completedAt
    };
    paymentIntentFindFirst.mockResolvedValue(completedIntent);
    paymentIntentFindUnique.mockResolvedValue(completedIntent);

    try {
      await expect(service.verifyPayment(workspace, "mock_ref_123")).resolves.toEqual(
        expect.objectContaining({
          id: "payment_123",
          status: "COMPLETED"
        })
      );
      await expect(service.verifyPayment(workspace, "mock_ref_123")).resolves.toEqual(
        expect.objectContaining({
          id: "payment_123",
          status: "COMPLETED"
        })
      );

      expect(ledgerEntryUpsert).not.toHaveBeenCalled();
      expect(paymentIntentUpdate).not.toHaveBeenCalled();
    } finally {
      restoreUploadEnv(env);
    }
  });

  it("rejects negative invoice totals before issuing campaign invoices", async () => {
    const { campaignInvoiceCreate, service } = createService();

    await expect(
      service.createCampaignInvoice(workspace, "campaign_123", { totalMinor: -5000 })
    ).rejects.toThrow("Invoice subtotal must be a positive minor-unit amount.");
    expect(campaignInvoiceCreate).not.toHaveBeenCalled();
  });

  it("rejects negative manual spend entries before writing spend or ledger records", async () => {
    const { campaignLedgerEntryUpsert, campaignSpendEntryCreate, service } = createService();

    await expect(
      service.addManualMetric(workspace, "campaign_123", {
        amountMinor: -100,
        metricName: "manual_spend"
      })
    ).rejects.toThrow("Spend must be recorded as a non-negative amount.");
    expect(campaignSpendEntryCreate).not.toHaveBeenCalled();
    expect(campaignLedgerEntryUpsert).not.toHaveBeenCalled();
  });

  it("prevents budget capture amounts from exceeding the active hold", async () => {
    const {
      campaignBudgetHoldUpdate,
      campaignSpendEntryCreate,
      ledgerEntryUpsert,
      service
    } = createService();

    await expect(
      service.captureBudgetHold(workspace, "campaign_123", "hold_123", { amountMinor: 600000 })
    ).rejects.toThrow("Budget capture cannot exceed the active hold amount.");
    expect(ledgerEntryUpsert).not.toHaveBeenCalled();
    expect(campaignSpendEntryCreate).not.toHaveBeenCalled();
    expect(campaignBudgetHoldUpdate).not.toHaveBeenCalled();
  });

  it("returns a locked paid invoice during concurrent wallet settlement without duplicate debits", async () => {
    const paidInvoice = {
      id: "invoice_123",
      workspaceId: workspace.workspaceId,
      campaignId: "campaign_123",
      number: "INV-123",
      status: "PAID",
      subtotalMinor: 500000,
      taxMinor: 0,
      totalMinor: 500000,
      amountPaidMinor: 500000,
      currency: "NGN",
      paidAt: new Date("2026-01-01T00:05:00.000Z"),
      deletedAt: null
    };
    const { campaignInvoiceFindFirst, ledgerEntryUpsert, service } = createService();
    campaignInvoiceFindFirst
      .mockResolvedValueOnce({
        ...paidInvoice,
        status: "ISSUED",
        amountPaidMinor: 0,
        paidAt: null
      })
      .mockResolvedValueOnce(paidInvoice);

    await expect(service.payInvoice(workspace, "invoice_123", { method: "wallet" })).resolves.toBe(
      paidInvoice
    );
    expect(ledgerEntryUpsert).not.toHaveBeenCalled();
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

  it("returns wallet consistency using opening balance plus credits minus debits", async () => {
    const { service } = createService();

    await expect(service.getWallet(workspace)).resolves.toMatchObject({
      availableBalance: { amountMinor: 1000000, currency: "NGN" },
      consistency: {
        openingBalance: { amountMinor: 1000000, currency: "NGN" },
        credits: { amountMinor: 0, currency: "NGN" },
        debits: { amountMinor: 0, currency: "NGN" },
        currentBalance: { amountMinor: 1000000, currency: "NGN" },
        consistent: true
      }
    });
  });
});

describe("ManagedAdsService client campaign controls", () => {
  it("pauses active campaigns with audit, event, and assigned-operator notification records", async () => {
    const { auditLogCreate, campaignUpdate, notificationUpsert, service } = createService();

    await expect(
      service.pauseCampaign(workspace, "campaign_123", { reason: "Pause for product restock." })
    ).resolves.toEqual(
      expect.objectContaining({
        id: "campaign_123",
        status: "PAUSED"
      })
    );

    const updateInput = campaignUpdate.mock.calls.at(-1)?.[0];
    expect(updateInput?.data.status).toBe("PAUSED");
    expect(updateInput?.where).toEqual({ id: "campaign_123" });

    const auditInput = auditLogCreate.mock.calls.at(-1)?.[0];
    expect(auditInput?.data.action).toBe("campaign.client_control.paused");
    expect(auditInput?.data.actorUserId).toBe(workspace.userId);
    expect(auditInput?.data.metadata?.newStatus).toBe("PAUSED");
    expect(auditInput?.data.metadata?.previousStatus).toBe("RUNNING");

    const notificationInput = notificationUpsert.mock.calls.at(-1)?.[0];
    expect(notificationInput?.create?.recipientUserId).toBe("operator_123");
    expect(notificationInput?.create?.title).toBe("Campaign paused by client");
  });

  it("rejects budget decreases below recorded spend", async () => {
    const { baseCampaign, campaignFindFirst, campaignUpdate, service } = createService();
    campaignFindFirst.mockResolvedValueOnce({
      ...baseCampaign,
      spendEntries: [{ amountMinor: 400000 }]
    });

    await expect(
      service.decreaseCampaignBudget(workspace, "campaign_123", { amountMinor: 200000 })
    ).rejects.toThrow("Campaign budget cannot be reduced below recorded spend.");
    expect(campaignUpdate).not.toHaveBeenCalled();
  });
});

describe("ManagedAdsService campaign financial ledger", () => {
  it("derives a budget summary from historical invoices, holds, spends, and payments", async () => {
    const { campaignFindFirst, service } = createService();
    const baseDate = new Date("2026-02-01T10:00:00.000Z");
    campaignFindFirst.mockResolvedValue({
      id: "campaign_123",
      workspaceId: workspace.workspaceId,
      currency: "NGN",
      budgetMinor: 500000,
      updatedAt: baseDate,
      ledgerEntries: [],
      paymentIntents: [
        {
          id: "payment_123",
          walletId: "wallet_123",
          status: "COMPLETED",
          creditedAt: baseDate,
          completedAt: baseDate,
          amountMinor: 500000,
          currency: "NGN",
          metadata: {},
          createdAt: baseDate,
          updatedAt: baseDate
        }
      ],
      invoices: [
        {
          id: "invoice_123",
          number: "INV-123",
          amountPaidMinor: 500000,
          currency: "NGN",
          status: "PAID",
          paidAt: baseDate,
          createdAt: baseDate,
          updatedAt: baseDate
        }
      ],
      budgetHolds: [
        {
          id: "hold_123",
          walletId: "wallet_123",
          invoiceId: "invoice_123",
          holdLedgerEntryId: "ledger_hold_123",
          amountMinor: 300000,
          currency: "NGN",
          status: "ACTIVE",
          reason: "Launch reserve",
          createdAt: baseDate,
          updatedAt: baseDate
        }
      ],
      spendEntries: [
        {
          id: "spend_123",
          amountMinor: 120000,
          currency: "NGN",
          metadata: { category: "AD_SPEND" },
          notes: "Meta placement spend",
          recordedForDate: baseDate,
          createdAt: baseDate,
          updatedAt: baseDate
        },
        {
          id: "fee_123",
          amountMinor: 50000,
          currency: "NGN",
          metadata: { category: "AGENCY_FEE" },
          notes: "Management fee",
          recordedForDate: baseDate,
          createdAt: baseDate,
          updatedAt: baseDate
        }
      ],
      reports: []
    });

    await expect(service.getCampaignBudgetSummary(workspace, "campaign_123")).resolves.toMatchObject({
      allocatedBudget: { amountMinor: 300000, currency: "NGN" },
      fundsUsed: { amountMinor: 170000, currency: "NGN" },
      invoicePaid: { amountMinor: 500000, currency: "NGN" },
      pendingSpend: { amountMinor: 130000, currency: "NGN" },
      remainingBalance: { amountMinor: 330000, currency: "NGN" }
    });
    const spendBreakdown = await service.getCampaignSpendBreakdown(workspace, "campaign_123");
    expect(spendBreakdown.totalSpend).toEqual({ amountMinor: 170000, currency: "NGN" });
    expect(spendBreakdown.categories).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "AD_SPEND", amount: { amountMinor: 120000, currency: "NGN" } }),
        expect.objectContaining({ type: "AGENCY_FEE", amount: { amountMinor: 50000, currency: "NGN" } })
      ])
    );
  });

  it("writes a canonical campaign ledger entry when operators record manual spend", async () => {
    const {
      analyticsMetricCreate,
      campaignLedgerEntryUpsert,
      campaignSpendEntryCreate,
      service
    } = createService();

    await expect(
      service.addManualMetric(workspace, "campaign_123", {
        amountMinor: 125000,
        category: "CREATIVE_COST",
        metricName: "creative_cost",
        notes: "Short-form video edit"
      })
    ).resolves.toEqual(expect.objectContaining({ id: "spend_123", amountMinor: 125000 }));

    const spendInput = campaignSpendEntryCreate.mock.calls.at(-1)?.[0];
    expect(spendInput?.data.amountMinor).toBe(125000);
    expect(spendInput?.data.notes).toBe("Short-form video edit");
    expect(spendInput?.data.source).toBe("MANUAL");
    expect(analyticsMetricCreate).toHaveBeenCalled();
    const ledgerInput = campaignLedgerEntryUpsert.mock.calls.at(-1)?.[0];
    expect(ledgerInput?.create?.amountMinor).toBe(125000);
    expect(ledgerInput?.create?.category).toBe("Creative cost");
    expect(ledgerInput?.create?.direction).toBe("DEBIT");
    expect(ledgerInput?.create?.type).toBe("CREATIVE_COST");
  });
});

describe("ManagedAdsService authorization gates", () => {
  it("rejects payment actions for members without finance permissions", async () => {
    const { campaignBudgetHoldCreate, campaignFindFirst, service } = createService({
      membership: { permissions: [], role: "VIEWER" }
    });

    await expect(
      service.createBudgetHold(workspace, "campaign_123", { amountMinor: 100000 })
    ).rejects.toThrow("Missing required permission: payment:manage");
    expect(campaignFindFirst).not.toHaveBeenCalled();
    expect(campaignBudgetHoldCreate).not.toHaveBeenCalled();
  });

  it("rejects admin overview for authenticated non-admin members", async () => {
    const { service } = createService({
      membership: { permissions: [], role: "FINANCE" }
    });

    await expect(service.getAdminOverview(workspace)).rejects.toThrow(
      "Missing required permission: admin:access"
    );
  });

  it("rejects admin status changes without campaign approval permission", async () => {
    const { campaignUpdate, service } = createService({
      membership: { permissions: ["admin:access"], role: "MANAGER" }
    });

    await expect(
      service.updateAdminStatus(workspace, "campaign_123", { status: "APPROVED" })
    ).rejects.toThrow("Missing required permission: campaign:approve");
    expect(campaignUpdate).not.toHaveBeenCalled();
  });

  it("rejects privileged service calls when workspace membership cannot be verified", async () => {
    const { service, teamMemberFindFirst } = createService({ workspaceRecord: null });

    await expect(service.createCampaign(workspace, { name: "Launch" })).rejects.toThrow(
      "Workspace membership could not be verified."
    );
    expect(teamMemberFindFirst).not.toHaveBeenCalled();
  });
});

describe("ManagedAdsService.getCampaignLaunchSpec", () => {
  it("builds a Meta launch spec from a wizard-created campaign's stored goal and targeting", async () => {
    const { campaignFindFirst, service } = createService();
    campaignFindFirst.mockResolvedValueOnce({
      id: "campaign_123",
      name: "Amaka's Thrift Store",
      objective: "LEADS",
      budgetMinor: 2_500_000,
      currency: "NGN",
      startsAt: new Date("2026-01-01T00:00:00.000Z"),
      destination: { url: "https://wa.me/2348012345678", kind: "WHATSAPP_CHANNEL" },
      companyProfile: null,
      targetAudience: { countries: ["NG"], cities: ["Lagos"], ageMin: 18, ageMax: 45, gender: "ALL", interests: ["thrift"] },
      metadata: { wizard: true, goal: "WHATSAPP_MESSAGES", warnings: [] }
    });

    const launchSpec = await service.getCampaignLaunchSpec(workspace, "campaign_123");

    expect(launchSpec.platform).toBe("META");
    expect(launchSpec.campaign.objective).toBe("OUTCOME_LEADS");
    expect(launchSpec.campaign.name).toContain("Amaka's Thrift Store");
    expect(launchSpec.adSet.dailyBudgetMinor).toBe(2_500_000);
    expect(launchSpec.adSet.targeting.cities).toEqual(["Lagos"]);
    expect(launchSpec.ad.destinationUrl).toBe("https://wa.me/2348012345678");
    expect(launchSpec.ad.callToAction).toBe("SEND_WHATSAPP_MESSAGE");
  });

  it("falls back to a goal inferred from objective for non-wizard campaigns", async () => {
    const { campaignFindFirst, service } = createService();
    campaignFindFirst.mockResolvedValueOnce({
      id: "campaign_456",
      name: "Company Q1 Push",
      objective: "TRAFFIC",
      budgetMinor: 5_000_000,
      currency: "NGN",
      destination: { url: "https://mysite.example.com", kind: "WEBSITE" },
      companyProfile: { name: "Acme Ltd" },
      targetAudience: { country: "NG", city: "Abuja" },
      metadata: {}
    });

    const launchSpec = await service.getCampaignLaunchSpec(workspace, "campaign_456");

    expect(launchSpec.campaign.objective).toBe("OUTCOME_TRAFFIC");
    expect(launchSpec.campaign.name).toContain("Acme Ltd");
    expect(launchSpec.adSet.targeting.cities).toEqual(["Abuja"]);
    expect(launchSpec.ad.callToAction).toBe("LEARN_MORE");
  });
});

describe("ManagedAdsService.createCampaignFromWizard", () => {
  it("normalizes wizard input into a CampaignSpec and delegates to createCampaign", async () => {
    const { service } = createService();
    const createCampaignSpy = vi
      .spyOn(service, "createCampaign")
      .mockResolvedValue({ id: "campaign_123", status: "DRAFT" } as never);

    const result = await service.createCampaignFromWizard(workspace, {
      goal: "Get more WhatsApp messages",
      link: "https://wa.me/2348012345678",
      budgetMinor: 2_500_000,
      city: "Lagos"
    });

    expect(createCampaignSpy).toHaveBeenCalledTimes(1);
    const [, createInput] = createCampaignSpy.mock.calls[0] as [unknown, Record<string, any>];
    expect(createInput.objective).toBe("LEADS");
    expect(createInput.destinationUrl).toBe("https://wa.me/2348012345678");
    expect(createInput.destinationKind).toBe("WHATSAPP_CHANNEL");
    expect(createInput.budgetMinor).toBe(2_500_000);
    expect(createInput.currency).toBe("NGN");
    expect(createInput.targetAudience.cities).toEqual(["Lagos"]);
    expect(createInput.targetAudience.countries).toEqual(["NG"]);
    expect(createInput.metadata).toEqual(
      expect.objectContaining({ wizard: true, goal: "WHATSAPP_MESSAGES" })
    );
    expect(result).toEqual({ campaign: { id: "campaign_123", status: "DRAFT" }, warnings: [] });
  });

  it("surfaces a warning for goals that are not yet supported without blocking creation", async () => {
    const { service } = createService();
    vi.spyOn(service, "createCampaign").mockResolvedValue({ id: "campaign_456" } as never);

    const result = await service.createCampaignFromWizard(workspace, {
      goal: "LIVE_VIEWERS",
      link: "https://www.tiktok.com/@seller/live",
      budgetMinor: 2_500_000
    });

    expect(result.warnings.join(" ")).toMatch(/LIVE-promotion/i);
  });

  it("rejects an invalid destination link before calling createCampaign", async () => {
    const { service } = createService();
    const createCampaignSpy = vi.spyOn(service, "createCampaign");

    await expect(
      service.createCampaignFromWizard(workspace, {
        goal: "WEBSITE_VISITS",
        link: "not-a-url",
        budgetMinor: 2_500_000
      })
    ).rejects.toThrow(/valid public/i);
    expect(createCampaignSpy).not.toHaveBeenCalled();
  });
});
