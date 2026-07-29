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

type MockDataInput = {
  data: Record<string, unknown>;
};

type MockCreateInput = {
  create: Record<string, unknown>;
};

type MockUpsertInput = MockCreateInput & {
  update?: Record<string, unknown>;
  where?: Record<string, unknown>;
};

type MockDestinationCreateInput = {
  handle?: string | null;
  kind?: string;
  metadata?: Record<string, unknown>;
  url?: string | null;
};

type CampaignCreateInput = {
  data?: Record<string, unknown> & {
    destination?: {
      create?: MockDestinationCreateInput;
    };
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

type CampaignRiskAssessmentUpsertInput = {
  create?: Record<string, unknown>;
  update?: Record<string, unknown>;
};

type CampaignSpendEntryCreateInput = {
  data: {
    amountMinor?: number;
    notes?: string | null;
    source?: string;
  } & Record<string, unknown>;
};

/** Shapes for asserting on a Prisma-style mock call's arguments in tests. */
type DataCallArgs = { data: Record<string, unknown> };
type CreateCallArgs = { create: Record<string, unknown> };

/** The plain input object createCampaignFromWizard passes to createCampaign (no {data} wrapper). */
interface WizardCreateCampaignInput {
  objective: string;
  destinationUrl: string;
  destinationKind: string;
  budgetMinor: number;
  currency: string;
  targetAudience: { cities: string[]; countries: string[] };
  metadata: Record<string, unknown>;
}

type NotificationUpsertInput = {
  create?: {
    recipientUserId?: string | null;
    title?: string;
  } & Record<string, unknown>;
};

type MockPaymentIntent = {
  amountMinor: number;
  campaignId: string | null;
  campaignInvoiceId: string | null;
  checkoutUrl: string;
  completedAt: Date | null;
  createdAt: Date;
  creditedAt: Date | null;
  currency: string;
  gateway: string;
  id: string;
  metadata: Record<string, unknown>;
  providerReference: string | null;
  status: string;
  updatedAt: Date;
  walletId: string | null;
  workspaceId: string;
};

type PaymentIntentUpdateInput = {
  data: {
    completedAt?: Date | null;
    creditedAt?: Date | null;
    providerReference?: string | null;
    status?: string;
  };
  where: {
    id: string;
  };
};

type MockCampaignInvoice = {
  campaignId: string;
  id: string;
} & Record<string, unknown>;

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
  const campaignCount = vi.fn(() => Promise.resolve(0));
  const campaignUpdate = vi.fn((input: CampaignUpdateInput) =>
    Promise.resolve({
      ...baseCampaign,
      ...input.data,
      updatedAt: new Date("2026-01-01T01:00:00.000Z")
    })
  );
  const campaignCreate = vi.fn((input: CampaignCreateInput) => {
    const data = input.data ?? {};
    const destinationCreate = data.destination?.create;

    return Promise.resolve({
      ...baseCampaign,
      ...data,
      id: "campaign_123",
      destination: destinationCreate
        ? {
            url: destinationCreate.url,
            kind: destinationCreate.kind,
            handle: destinationCreate.handle,
            metadata: destinationCreate.metadata ?? {}
          }
        : undefined,
      statusHistory: []
    });
  });
  const campaignBudgetHoldCreate = vi.fn((input: MockDataInput) =>
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
  const campaignBudgetHoldUpdate = vi.fn((input: MockDataInput) =>
    Promise.resolve({ ...activeHold, ...input.data })
  );
  const auditLogCreate = vi.fn((input: AuditLogCreateInput) => Promise.resolve({ id: "audit_123", ...input.data }));
  const adAccountFindFirst = vi.fn(
    (): Promise<Record<string, unknown> | null> => Promise.resolve(null)
  );
  const adAccountCreate = vi.fn((input: MockDataInput) =>
    Promise.resolve({
      id: "ad_account_123",
      workspaceId: workspace.workspaceId,
      status: "PENDING",
      kycStatus: "UNVERIFIED",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      ...input.data
    })
  );
  const adAccountUpdate = vi.fn((input: MockDataInput) =>
    Promise.resolve({ id: "ad_account_123", ...input.data })
  );
  const campaignOutcomeUpsert = vi.fn((input: MockUpsertInput) =>
    Promise.resolve({ id: "outcome_123", campaignId: "campaign_123", ...input.create, ...input.update })
  );
  const campaignOutcomeFindUnique = vi.fn(
    (): Promise<Record<string, unknown> | null> => Promise.resolve(null)
  );
  const campaignRiskAssessmentUpsert = vi.fn((input: CampaignRiskAssessmentUpsertInput) =>
    Promise.resolve({ id: "risk_123", campaignId: "campaign_123", ...input.create, ...input.update })
  );
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
  const eventOutboxUpsert = vi.fn((input: MockUpsertInput) =>
    Promise.resolve({ id: "event_123", ...input.create })
  );
  const eventOutboxUpdate = vi.fn((input: MockDataInput) =>
    Promise.resolve({ id: "event_123", ...input.data })
  );
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
  const ledgerEntryCreate = vi.fn((input: MockDataInput) =>
    Promise.resolve({ id: "ledger_123", ...input.data })
  );
  const ledgerEntryFindMany = vi.fn(() => Promise.resolve(walletLedgerEntries));
  const ledgerEntryUpsert = vi.fn((input: MockUpsertInput) =>
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
    (): Promise<MockPaymentIntent | null> => Promise.resolve(null)
  );
  const paymentIntentFindFirst = vi.fn(
    (): Promise<MockPaymentIntent | null> => Promise.resolve(null)
  );
  const paymentIntentUpdate = vi.fn((input: PaymentIntentUpdateInput) =>
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
  const campaignInvoiceCreate = vi.fn((input: MockDataInput) =>
    Promise.resolve({ id: "invoice_123", amountPaidMinor: 0, ...input.data })
  );
  const campaignInvoiceFindFirst = vi.fn(
    (): Promise<MockCampaignInvoice | null> => Promise.resolve(campaignInvoiceRecord)
  );
  const campaignInvoiceFindMany = vi.fn(() => Promise.resolve([campaignInvoiceRecord]));
  const campaignInvoiceUpdate = vi.fn((input: MockDataInput) =>
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
      campaign: {
        findFirst: campaignFindFirst,
        update: campaignUpdate,
        create: campaignCreate,
        count: campaignCount
      },
      campaignRiskAssessment: {
        upsert: campaignRiskAssessmentUpsert
      },
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
      adAccount: { findFirst: adAccountFindFirst, create: adAccountCreate, update: adAccountUpdate },
      campaignLedgerEntry: { upsert: campaignLedgerEntryUpsert },
      campaignOutcome: { upsert: campaignOutcomeUpsert, findUnique: campaignOutcomeFindUnique },
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
        count: campaignCount,
        update: campaignUpdate
      },
      campaignRiskAssessment: {
        upsert: campaignRiskAssessmentUpsert
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
      adAccount: {
        findFirst: adAccountFindFirst,
        findMany: vi.fn(() => Promise.resolve([])),
        create: adAccountCreate,
        update: adAccountUpdate
      },
      campaignLedgerEntry: {
        upsert: campaignLedgerEntryUpsert
      },
      campaignOutcome: {
        upsert: campaignOutcomeUpsert,
        findUnique: campaignOutcomeFindUnique
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
    adAccountFindFirst,
    adAccountCreate,
    adAccountUpdate,
    campaignFindFirst,
    campaignCount,
    campaignCreate,
    campaignInvoiceCreate,
    campaignInvoiceFindFirst,
    campaignInvoiceFindMany,
    campaignInvoiceUpdate,
    campaignUpdate,
    campaignLedgerEntryUpsert,
    campaignOutcomeUpsert,
    campaignOutcomeFindUnique,
    campaignRiskAssessmentUpsert,
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

      const eventUpsertInput = eventOutboxUpsert.mock.calls
        .map(([input]) => input)
        .find((input) => input.create.name === "KorapayWebhookReceived");
      expect(eventUpsertInput?.create).toMatchObject({
        name: "KorapayWebhookReceived",
        entityId: "ft_pay_webhook_123"
      });
      const ledgerUpsertInput = ledgerEntryUpsert.mock.calls.at(-1)?.[0];
      expect(ledgerUpsertInput?.where).toEqual({ idempotencyKey: "payment:payment_123:credit" });
      expect(ledgerUpsertInput?.create).toMatchObject({
        amountMinor: 1000,
        kind: "CREDIT",
        reference: "ft_pay_webhook_123",
        sourceId: "payment_123"
      });
      const paymentUpdateInput = paymentIntentUpdate.mock.calls.at(-1)?.[0];
      expect(paymentUpdateInput?.where).toEqual({ id: "payment_123" });
      expect(paymentUpdateInput?.data).toMatchObject({
        status: "COMPLETED",
        providerReference: "ft_pay_webhook_123"
      });
      const eventUpdateInput = eventOutboxUpdate.mock.calls.at(-1)?.[0];
      expect(eventUpdateInput?.data).toMatchObject({ status: "PROCESSED" });
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

  it("reserves the campaign budget and advances to review when Studio submits a draft", async () => {
    const {
      campaignBudgetHoldCreate,
      campaignFindFirst,
      campaignCount,
      campaignUpdate,
      baseCampaign,
      service
    } = createService();

    campaignCount.mockResolvedValue(5);
    campaignFindFirst.mockResolvedValue({
      ...baseCampaign,
      adAccount: { type: "MANAGED", kycStatus: "VERIFIED" },
      brief: "Women's thrift fashion in Lagos",
      budgetMinor: 1000000,
      destination: { kind: "INSTAGRAM_REEL", url: "https://instagram.com/reel/abc123" },
      name: "Women's thrift fashion in Lagos",
      status: "DRAFT"
    });

    await expect(service.submitCampaign(workspace, "campaign_123")).resolves.toMatchObject({
      id: "campaign_123",
      status: "PENDING_REVIEW"
    });

    expect(campaignBudgetHoldCreate).toHaveBeenCalledTimes(1);
    expect(campaignBudgetHoldCreate.mock.calls.at(-1)?.[0]?.data).toMatchObject({
      amountMinor: 1000000,
      campaignId: "campaign_123",
      reason: "Campaign submitted from Studio"
    });
    expect(campaignUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "campaign_123" },
        data: expect.objectContaining({ status: "PENDING_REVIEW" })
      })
    );
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

describe("ManagedAdsService AdAccount management", () => {
  it("rejects a CONNECTED account without an externalAccountId", async () => {
    const { adAccountCreate, service } = createService();

    await expect(
      service.createAdAccount(workspace, { type: "CONNECTED", label: "My Meta Account" })
    ).rejects.toThrow(/externalAccountId/i);
    expect(adAccountCreate).not.toHaveBeenCalled();
  });

  it("creates a CONNECTED account without provisioning a wallet, kycTier defaults LIGHT", async () => {
    const { adAccountCreate, walletUpsert, service } = createService();

    await service.createAdAccount(workspace, {
      type: "CONNECTED",
      label: "My Meta Account",
      externalAccountId: "act_123"
    });

    const [call] = adAccountCreate.mock.calls[0] as [DataCallArgs];
    expect(call.data.type).toBe("CONNECTED");
    expect(call.data.kycTier).toBe("LIGHT");
    expect(call.data.walletId).toBeUndefined();
    expect(walletUpsert).not.toHaveBeenCalled();
  });

  it("creates a MANAGED account with a wallet, kycTier defaults STANDARD", async () => {
    const { adAccountCreate, walletUpsert, service } = createService();

    await service.createAdAccount(workspace, { type: "MANAGED", label: "Shared pool" });

    const [call] = adAccountCreate.mock.calls[0] as [DataCallArgs];
    expect(call.data.kycTier).toBe("STANDARD");
    expect(call.data.walletId).toBe("wallet_123");
    expect(walletUpsert).toHaveBeenCalledTimes(1);
  });

  it("creates a DEDICATED account with kycTier defaulting to ENHANCED", async () => {
    const { adAccountCreate, service } = createService();

    await service.createAdAccount(workspace, { type: "DEDICATED", label: "Acme Ltd" });

    const [call] = adAccountCreate.mock.calls[0] as [DataCallArgs];
    expect(call.data.kycTier).toBe("ENHANCED");
    expect(call.data.status).toBe("PENDING");
  });

  it("updates an ad account's label", async () => {
    const { adAccountFindFirst, adAccountUpdate, service } = createService();
    adAccountFindFirst.mockResolvedValueOnce({ id: "ad_account_123", workspaceId: workspace.workspaceId });

    await service.updateAdAccount(workspace, "ad_account_123", { label: "New Label" });

    const [call] = adAccountUpdate.mock.calls[0] as [DataCallArgs];
    expect(call.data.label).toBe("New Label");
  });

  it("rejects updating an ad account that doesn't exist in the workspace", async () => {
    const { adAccountFindFirst, service } = createService();
    adAccountFindFirst.mockResolvedValueOnce(null);

    await expect(service.updateAdAccount(workspace, "missing", { label: "X" })).rejects.toThrow(
      /not found/i
    );
  });

  it("activates an account on VERIFIED KYC review", async () => {
    const { adAccountFindFirst, adAccountUpdate, service } = createService();
    adAccountFindFirst.mockResolvedValueOnce({
      id: "ad_account_123",
      workspaceId: workspace.workspaceId,
      status: "PENDING"
    });

    await service.reviewAdAccountKyc(workspace, "ad_account_123", { kycStatus: "verified" });

    const [call] = adAccountUpdate.mock.calls[0] as [DataCallArgs];
    expect(call.data.kycStatus).toBe("VERIFIED");
    expect(call.data.status).toBe("ACTIVE");
  });

  it("suspends an account on REJECTED KYC review", async () => {
    const { adAccountFindFirst, adAccountUpdate, service } = createService();
    adAccountFindFirst.mockResolvedValueOnce({
      id: "ad_account_123",
      workspaceId: workspace.workspaceId,
      status: "PENDING"
    });

    await service.reviewAdAccountKyc(workspace, "ad_account_123", { kycStatus: "rejected" });

    const [call] = adAccountUpdate.mock.calls[0] as [DataCallArgs];
    expect(call.data.kycStatus).toBe("REJECTED");
    expect(call.data.status).toBe("SUSPENDED");
  });

  it("requires admin+approval permissions to review KYC", async () => {
    const { service } = createService({ membership: { permissions: ["campaign:manage"], role: "MANAGER" } });

    await expect(
      service.reviewAdAccountKyc(workspace, "ad_account_123", { kycStatus: "verified" })
    ).rejects.toThrow(/Missing required permission/i);
  });
});

describe("ManagedAdsService.transferCampaignBudget", () => {
  it("moves unspent budget from one campaign to another and records both ledger entries", async () => {
    const { campaignFindFirst, campaignUpdate, campaignLedgerEntryUpsert, service } = createService();
    campaignFindFirst
      .mockResolvedValueOnce({
        id: "campaign_from",
        workspaceId: workspace.workspaceId,
        name: "Slow campaign",
        currency: "NGN",
        budgetMinor: 500_000,
        spendEntries: [],
        manualPlacements: []
      })
      .mockResolvedValueOnce({
        id: "campaign_to",
        workspaceId: workspace.workspaceId,
        name: "Winning campaign",
        currency: "NGN",
        budgetMinor: 200_000,
        spendEntries: [],
        manualPlacements: []
      });

    const result = (await service.transferCampaignBudget(workspace, "campaign_from", {
      toCampaignId: "campaign_to",
      amountMinor: 150_000
    })) as { from: { budget: { amountMinor: number } }; to: { budget: { amountMinor: number } } };

    expect(result.from.budget.amountMinor).toBe(350_000);
    expect(result.to.budget.amountMinor).toBe(350_000);
    expect(campaignUpdate).toHaveBeenCalledTimes(2);
    expect(campaignLedgerEntryUpsert).toHaveBeenCalledTimes(2);
    const [debitCall, creditCall] = campaignLedgerEntryUpsert.mock.calls as [
      [CampaignLedgerEntryUpsertInput],
      [CampaignLedgerEntryUpsertInput]
    ];
    expect(debitCall[0].create?.direction).toBe("DEBIT");
    expect(creditCall[0].create?.direction).toBe("CREDIT");
  });

  it("rejects transferring more than the unspent (available) amount", async () => {
    const { campaignFindFirst, service } = createService();
    campaignFindFirst
      .mockResolvedValueOnce({
        id: "campaign_from",
        workspaceId: workspace.workspaceId,
        name: "Spent campaign",
        currency: "NGN",
        budgetMinor: 500_000,
        spendEntries: [{ amountMinor: 450_000 }],
        manualPlacements: []
      })
      .mockResolvedValueOnce({
        id: "campaign_to",
        workspaceId: workspace.workspaceId,
        name: "Target",
        currency: "NGN",
        budgetMinor: 200_000,
        spendEntries: [],
        manualPlacements: []
      });

    await expect(
      service.transferCampaignBudget(workspace, "campaign_from", {
        toCampaignId: "campaign_to",
        amountMinor: 100_000
      })
    ).rejects.toThrow(/unspent/i);
  });

  it("rejects transferring a campaign's budget to itself", async () => {
    const { service } = createService();

    await expect(
      service.transferCampaignBudget(workspace, "campaign_123", {
        toCampaignId: "campaign_123",
        amountMinor: 1000
      })
    ).rejects.toThrow(/itself/i);
  });

  it("rejects a non-positive transfer amount", async () => {
    const { service } = createService();

    await expect(
      service.transferCampaignBudget(workspace, "campaign_from", {
        toCampaignId: "campaign_to",
        amountMinor: 0
      })
    ).rejects.toThrow(/positive/i);
  });

  it("rejects transfers between campaigns in different currencies", async () => {
    const { campaignFindFirst, service } = createService();
    campaignFindFirst
      .mockResolvedValueOnce({
        id: "campaign_from",
        workspaceId: workspace.workspaceId,
        name: "NGN campaign",
        currency: "NGN",
        budgetMinor: 500_000,
        spendEntries: [],
        manualPlacements: []
      })
      .mockResolvedValueOnce({
        id: "campaign_to",
        workspaceId: workspace.workspaceId,
        name: "USD campaign",
        currency: "USD",
        budgetMinor: 200_000,
        spendEntries: [],
        manualPlacements: []
      });

    await expect(
      service.transferCampaignBudget(workspace, "campaign_from", {
        toCampaignId: "campaign_to",
        amountMinor: 1000
      })
    ).rejects.toThrow(/different currencies/i);
  });

  it("requires payment:manage permission", async () => {
    const { service } = createService({ membership: { permissions: ["campaign:manage"], role: "MANAGER" } });

    await expect(
      service.transferCampaignBudget(workspace, "campaign_from", {
        toCampaignId: "campaign_to",
        amountMinor: 1000
      })
    ).rejects.toThrow(/Missing required permission/i);
  });
});

describe("ManagedAdsService.getCampaignRecommendations", () => {
  it("delegates to recommendCampaignTargeting and returns multiple options", async () => {
    const { service } = createService();

    const recs = await service.getCampaignRecommendations(workspace, {
      goal: "WHATSAPP_MESSAGES",
      budgetMinor: 2_500_000,
      productDescription: "I sell wigs in Lagos",
      city: "Lagos"
    });

    expect(Array.isArray(recs)).toBe(true);
    expect(recs.length).toBeGreaterThan(1);
  });

  it("requires campaign:create permission", async () => {
    const { service } = createService({ membership: { permissions: [], role: "VIEWER" } });

    await expect(
      service.getCampaignRecommendations(workspace, { goal: "SALES", budgetMinor: 100_000 })
    ).rejects.toThrow(/Missing required permission/i);
  });
});

describe("ManagedAdsService.createCampaign ad-account auto-provisioning", () => {
  it("auto-provisions a shared MANAGED ad account when none exists and none was passed", async () => {
    const { adAccountFindFirst, adAccountCreate, transaction, service } = createService();
    void transaction;

    const campaign = (await service.createCampaign(workspace, {
      name: "Launch",
      destinationUrl: "https://instagram.com/reel/abc",
      platform: "instagram"
    })) as { id: string };

    expect(adAccountFindFirst).toHaveBeenCalledTimes(1);
    expect(adAccountCreate).toHaveBeenCalledTimes(1);
    const [call] = adAccountCreate.mock.calls[0] as [DataCallArgs];
    expect(call.data.type).toBe("MANAGED");
    expect(call.data.platform).toBe("META");
    expect(campaign.id).toBe("campaign_123");
  });

  it("reuses an existing shared MANAGED ad account instead of creating a duplicate", async () => {
    const { adAccountFindFirst, adAccountCreate, service } = createService();
    adAccountFindFirst.mockResolvedValueOnce({ id: "ad_account_existing", type: "MANAGED", platform: "META" });

    await service.createCampaign(workspace, { name: "Launch", destinationUrl: "https://instagram.com/x" });

    expect(adAccountCreate).not.toHaveBeenCalled();
  });

  it("uses an explicitly provided adAccountId without touching auto-provisioning", async () => {
    const { adAccountFindFirst, adAccountCreate, campaignUpdate: _unused, service } = createService();
    void _unused;

    await service.createCampaign(workspace, {
      name: "Launch",
      destinationUrl: "https://instagram.com/x",
      adAccountId: "ad_account_explicit"
    });

    expect(adAccountFindFirst).not.toHaveBeenCalled();
    expect(adAccountCreate).not.toHaveBeenCalled();
  });

  it("resolves platform TIKTOK for a TikTok destination", async () => {
    const { adAccountCreate, service } = createService();

    await service.createCampaign(workspace, {
      name: "Launch",
      destinationUrl: "https://www.tiktok.com/@seller/video/123",
      destinationKind: "TIKTOK_PROFILE"
    });

    const [call] = adAccountCreate.mock.calls[0] as [DataCallArgs];
    expect(call.data.platform).toBe("TIKTOK");
  });
});

describe("ManagedAdsService campaign outcome (Layer 3)", () => {
  it("records a one-tap outcome with just wouldRunAgain", async () => {
    const { campaignOutcomeUpsert, service } = createService();

    const outcome = (await service.recordCampaignOutcome(workspace, "campaign_123", {
      wouldRunAgain: true
    })) as { campaignId: string };

    expect(campaignOutcomeUpsert).toHaveBeenCalledTimes(1);
    const [call] = campaignOutcomeUpsert.mock.calls[0] as [CreateCallArgs];
    expect(call.create.wouldRunAgain).toBe(true);
    expect(call.create.source).toBe("CUSTOMER_PROMPT");
    expect(call.create.capturedByUserId).toBe(workspace.userId);
    expect(outcome.campaignId).toBe("campaign_123");
  });

  it("records full outcome detail from ops with an OPERATOR source", async () => {
    const { campaignOutcomeUpsert, service } = createService();

    await service.recordCampaignOutcome(workspace, "campaign_123", {
      messagesCount: 42,
      ordersCount: 5,
      estRevenueMinor: 15_000_00,
      rating: 5,
      wouldRunAgain: true,
      source: "operator",
      notes: "Great response over the weekend."
    });

    const [call] = campaignOutcomeUpsert.mock.calls[0] as [CreateCallArgs];
    expect(call.create).toEqual(
      expect.objectContaining({
        messagesCount: 42,
        ordersCount: 5,
        estRevenueMinor: 1_500_000,
        rating: 5,
        source: "OPERATOR"
      })
    );
  });

  it("rejects a request with no outcome signal at all", async () => {
    const { campaignOutcomeUpsert, service } = createService();

    await expect(service.recordCampaignOutcome(workspace, "campaign_123", {})).rejects.toThrow(
      /at least one outcome signal/i
    );
    expect(campaignOutcomeUpsert).not.toHaveBeenCalled();
  });

  it("rejects a rating outside 1-5", async () => {
    const { service } = createService();

    await expect(
      service.recordCampaignOutcome(workspace, "campaign_123", { rating: 9 })
    ).rejects.toThrow(/between 1 and 5/i);
  });

  it("rejects recording an outcome before the campaign has launched", async () => {
    const { campaignFindFirst, campaignOutcomeUpsert, service } = createService();
    campaignFindFirst.mockResolvedValueOnce({
      id: "campaign_draft",
      workspaceId: workspace.workspaceId,
      status: "DRAFT",
      manualPlacements: []
    });

    await expect(
      service.recordCampaignOutcome(workspace, "campaign_draft", { wouldRunAgain: true })
    ).rejects.toThrow(/before campaign launch/i);
    expect(campaignOutcomeUpsert).not.toHaveBeenCalled();
  });

  it("reads back a recorded outcome", async () => {
    const { campaignOutcomeFindUnique, service } = createService();
    campaignOutcomeFindUnique.mockResolvedValueOnce({
      campaignId: "campaign_123",
      wouldRunAgain: true,
      messagesCount: 10
    });

    const outcome: unknown = await service.getCampaignOutcome(workspace, "campaign_123");

    expect(outcome).toEqual({ campaignId: "campaign_123", wouldRunAgain: true, messagesCount: 10 });
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
      .mockResolvedValue({ id: "campaign_123", status: "DRAFT" });

    const result = await service.createCampaignFromWizard(workspace, {
      goal: "Get more WhatsApp messages",
      link: "https://wa.me/2348012345678",
      budgetMinor: 2_500_000,
      city: "Lagos"
    });

    expect(createCampaignSpy).toHaveBeenCalledTimes(1);
    const [, createInput] = createCampaignSpy.mock.calls[0] as [unknown, WizardCreateCampaignInput];
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
    vi.spyOn(service, "createCampaign").mockResolvedValue({ id: "campaign_456" });

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
