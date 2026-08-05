import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException
} from "@nestjs/common";

import { Prisma, type DatabaseClient } from "@fliptrybe/database";
import { calculateAvailableBalance } from "@fliptrybe/payments";
import type { CurrencyCode, LedgerEntry } from "@fliptrybe/types";
import {
  createMockVtuAdapter,
  createVtpassAdapter,
  createClubKonnectAdapter,
  type VtuProviderAdapter,
  type VtuNetwork
} from "@fliptrybe/providers";

import { PrismaService } from "../prisma.service";
import { QueueProducerService } from "../queue-producer.service";
import { featureFlags } from "@fliptrybe/feature-flags";
import type { AuthenticatedRequestContext } from "../request-context";
import type {
  BuyAirtimeDto,
  BuyDataDto,
  BillsOrderQueryDto,
  BuyCableDto,
  BuyElectricityDto,
  ValidateMeterDto
} from "./vtu.dtos";

type DbClient = DatabaseClient | Prisma.TransactionClient;

const uid = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 12)}`;

// 2% margin over wholesale.
const MARKUP_BPS = 200;
const VTU_NETWORKS: VtuNetwork[] = ["MTN", "GLO", "AIRTEL", "NINE_MOBILE"];
const DEFAULT_VTU_PROVIDER = "clubkonnect";
const DEFAULT_DATA_PLANS: Array<{
  network: VtuNetwork;
  providerPlanId: string;
  displayName: string;
  sizeMb: number;
  validityDays: number;
  costMinor: number;
}> = VTU_NETWORKS.flatMap((network) => [
  {
    network,
    providerPlanId: `${network.toLowerCase()}_1gb_30d`,
    displayName: `${network.replace("_", " ")} 1GB - 30 days`,
    sizeMb: 1024,
    validityDays: 30,
    costMinor: 45000
  },
  {
    network,
    providerPlanId: `${network.toLowerCase()}_2gb_30d`,
    displayName: `${network.replace("_", " ")} 2GB - 30 days`,
    sizeMb: 2048,
    validityDays: 30,
    costMinor: 85000
  },
  {
    network,
    providerPlanId: `${network.toLowerCase()}_5gb_30d`,
    displayName: `${network.replace("_", " ")} 5GB - 30 days`,
    sizeMb: 5120,
    validityDays: 30,
    costMinor: 200000
  }
]);

function applyMarkup(costMinor: number): number {
  return Math.ceil(costMinor * (1 + MARKUP_BPS / 10_000));
}

interface DbLedgerEntryRow {
  id: string;
  walletId: string;
  kind: string;
  amountMinor: number;
  currency: string;
  reference: string;
  description: string;
  idempotencyKey: string | null;
  sourceType: string | null;
  sourceId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function toTypedEntry(e: DbLedgerEntryRow): LedgerEntry {
  return {
    id: e.id,
    walletId: e.walletId,
    kind: e.kind as LedgerEntry["kind"],
    amount: { amountMinor: e.amountMinor, currency: e.currency as CurrencyCode },
    reference: e.reference,
    description: e.description,
    ...(e.idempotencyKey ? { idempotencyKey: e.idempotencyKey } : {}),
    ...(e.sourceType ? { sourceType: e.sourceType } : {}),
    ...(e.sourceId ? { sourceId: e.sourceId } : {}),
    metadata: {},
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString()
  };
}

@Injectable()
export class VtuService {
  private readonly logger = new Logger(VtuService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly queue: QueueProducerService
  ) {}

  private get db(): DatabaseClient {
    return this.prismaService.client;
  }

  // ─── Adapter factory ────────────────────────────────────────────────────────

  private buildAdapter(providerName: string): VtuProviderAdapter {
    switch (providerName) {
      case "vtpass":
        return createVtpassAdapter({
          baseUrl: process.env["VTPASS_BASE_URL"] ?? "https://sandbox.vtpass.com/api",
          apiKey: process.env["VTPASS_API_KEY"] ?? "",
          publicKey: process.env["VTPASS_PUBLIC_KEY"] ?? "",
          secretKey: process.env["VTPASS_SECRET_KEY"] ?? ""
        });
      case "clubkonnect":
        return createClubKonnectAdapter({
          userId: process.env["CLUBKONNECT_USER_ID"] ?? "",
          apiKey: process.env["CLUBKONNECT_API_KEY"] ?? "",
          ...((process.env["CLUBKONNECT_BASE_URL"] ?? process.env["CLUBKONNECT_API_URL"])
            ? { baseUrl: process.env["CLUBKONNECT_BASE_URL"] ?? process.env["CLUBKONNECT_API_URL"] }
            : {}),
          ...(process.env["CLUBKONNECT_CALLBACK_URL"]
            ? { callbackUrl: process.env["CLUBKONNECT_CALLBACK_URL"] }
            : {})
        });
      default:
        return createMockVtuAdapter(providerName);
    }
  }

  // ─── Provider routing ────────────────────────────────────────────────────────

  private async selectAdapter(
    productType: "AIRTIME" | "DATA",
    network: VtuNetwork,
    db: DbClient = this.db
  ): Promise<VtuProviderAdapter> {
    await this.ensureDefaultCatalog(db);
    const routes = await db.vtuProviderRoute.findMany({
      where: { productType, network, active: true },
      orderBy: { priority: "asc" }
    });

    if (routes.length === 0) {
      throw new BadRequestException(
        `No VTU provider route is configured for ${productType} on ${network}.`
      );
    }

    // Latest health check per provider (VTU domain). Missing health = treat as usable —
    // a freshly seeded route shouldn't be blocked before the first health-check job runs.
    const healthRows = await db.providerHealth.findMany({
      where: { providerName: { in: routes.map((r) => r.provider) }, domain: "VTU" },
      orderBy: { checkedAt: "desc" },
      distinct: ["providerName"]
    });
    const latestStatus = new Map(healthRows.map((h) => [h.providerName, h.status]));

    const healthy = routes.find((r) => {
      const status = latestStatus.get(r.provider);
      return status !== "DOWN" && status !== "DISABLED";
    });

    if (!healthy) {
      throw new BadRequestException(
        `All VTU providers for ${productType} on ${network} are currently unhealthy. Try again shortly.`
      );
    }

    return this.buildAdapter(healthy.provider);
  }

  // ─── Wallet helpers ──────────────────────────────────────────────────────────

  private async getWallet(workspaceId: string, db: DbClient = this.db) {
    return db.wallet.upsert({
      where: { workspaceId_currency: { workspaceId, currency: "NGN" } },
      update: {},
      create: { workspaceId, currency: "NGN" }
    });
  }

  private async debitWallet(
    walletId: string,
    workspaceId: string,
    amountMinor: number,
    description: string,
    orderId: string,
    db: DbClient
  ) {
    const chargeId = uid("vwc");
    const ledgerId = uid("led");
    const idemKey = `vtu_debit_${orderId}`;

    const ledgerEntry = await db.ledgerEntry.create({
      data: {
        id: ledgerId,
        walletId,
        kind: "DEBIT",
        amountMinor,
        currency: "NGN",
        reference: idemKey,
        description,
        idempotencyKey: idemKey,
        sourceType: "VtuWalletCharge",
        sourceId: chargeId
      }
    });

    const charge = await db.vtuWalletCharge.create({
      data: {
        id: chargeId,
        workspaceId,
        walletId,
        orderId,
        idempotencyKey: idemKey,
        amountMinor,
        currency: "NGN",
        status: "CHARGED",
        debitLedgerEntryId: ledgerEntry.id
      }
    });

    return { charge, ledgerEntry };
  }

  // ─── Airtime purchase ────────────────────────────────────────────────────────

  async buyAirtime(ctx: AuthenticatedRequestContext, dto: BuyAirtimeDto) {
    const { workspaceId } = ctx;

    if (!dto.msisdn.match(/^\+?[1-9]\d{6,14}$/)) {
      throw new BadRequestException("Invalid MSISDN format.");
    }
    if (!Number.isInteger(dto.faceValueMinor) || dto.faceValueMinor <= 0) {
      throw new BadRequestException("faceValueMinor must be a positive integer.");
    }
    if (dto.faceValueMinor < 5_000 || dto.faceValueMinor > 50_000_000) {
      throw new BadRequestException("Airtime amount must be between ₦50 and ₦500,000.");
    }

    const adapter = await this.selectAdapter("AIRTIME", dto.network);
    const discountBps = await adapter.getAirtimeDiscountBps(dto.network);
    const wholesaleCost = Math.ceil(dto.faceValueMinor * (1 - discountBps / 10_000));
    const chargeMinor = applyMarkup(wholesaleCost);

    const orderId = uid("vtu");
    const reference = adapter.buildReference({ id: orderId, createdAt: new Date() });
    const msisdnMasked = dto.msisdn.slice(0, 4) + "****" + dto.msisdn.slice(-3);

    const order = await this.db.$transaction(async (tx) => {
      const wallet = await this.getWallet(workspaceId, tx);
      const entries = (await tx.ledgerEntry.findMany({
        where: { walletId: wallet.id }
      })) as DbLedgerEntryRow[];
      const available = calculateAvailableBalance(entries.map(toTypedEntry));

      if (available.amountMinor < chargeMinor) {
        throw new ForbiddenException(
          `Insufficient balance. Required ₦${(chargeMinor / 100).toFixed(2)}.`
        );
      }

      const newOrder = await tx.vtuOrder.create({
        data: {
          id: orderId,
          workspaceId,
          productType: "AIRTIME",
          network: dto.network,
          msisdnMasked,
          msisdnEncrypted: dto.msisdn, // encrypt-at-rest in Phase 4
          faceValueMinor: dto.faceValueMinor,
          amountMinor: chargeMinor,
          costMinor: wholesaleCost,
          currency: "NGN",
          providerName: adapter.name,
          providerReference: reference,
          status: "SUBMITTED",
          idempotencyKey: `vtu_order_${orderId}`
        }
      });

      await this.debitWallet(
        wallet.id,
        workspaceId,
        chargeMinor,
        `Airtime ${dto.network} ₦${(dto.faceValueMinor / 100).toFixed(0)} → ${msisdnMasked}`,
        orderId,
        tx
      );

      return newOrder;
    });

    // Submit outside the transaction — network timeout must not roll back the debit.
    try {
      const result = await adapter.purchaseAirtime({
        network: dto.network,
        msisdn: dto.msisdn,
        faceValueMinor: dto.faceValueMinor,
        reference: order.providerReference!
      });

      const finalStatus =
        result.status === "DELIVERED"
          ? "DELIVERED"
          : result.status === "SUBMITTED"
            ? "SUBMITTED"
            : "AMBIGUOUS";

      await this.db.vtuOrder.update({
        where: { id: order.id },
        data: { status: finalStatus }
      });

      if (finalStatus === "AMBIGUOUS") {
        await this.queue.enqueueVtuOpsReview(order.id);
      } else if (finalStatus === "SUBMITTED") {
        // Async delivery — poll the provider until it reports a terminal state.
        await this.queue.enqueueVtuPollStatus(order.id);
      }
    } catch (err) {
      this.logger.error(`VTU airtime submit error for ${order.id}: ${String(err)}`);
      await this.db.vtuOrder.update({
        where: { id: order.id },
        data: { status: "AMBIGUOUS" }
      });
      await this.queue.enqueueVtuOpsReview(order.id);
    }

    return this.db.vtuOrder.findUniqueOrThrow({ where: { id: order.id } });
  }

  // ─── Data purchase ───────────────────────────────────────────────────────────

  async buyData(ctx: AuthenticatedRequestContext, dto: BuyDataDto) {
    const { workspaceId } = ctx;

    if (!dto.msisdn.match(/^\+?[1-9]\d{6,14}$/)) {
      throw new BadRequestException("Invalid MSISDN format.");
    }
    if (!dto.providerPlanId) throw new BadRequestException("providerPlanId is required.");

    const adapter = await this.selectAdapter("DATA", dto.network);

    const plan = await this.db.vtuDataPlan.findFirst({
      where: {
        providerName: adapter.name,
        providerPlanId: dto.providerPlanId,
        network: dto.network,
        active: true
      }
    });
    if (!plan) throw new NotFoundException("Data plan not found or unavailable.");

    const chargeMinor = applyMarkup(plan.costMinor);
    const orderId = uid("vtu");
    const reference = adapter.buildReference({ id: orderId, createdAt: new Date() });
    const msisdnMasked = dto.msisdn.slice(0, 4) + "****" + dto.msisdn.slice(-3);

    const order = await this.db.$transaction(async (tx) => {
      const wallet = await this.getWallet(workspaceId, tx);
      const entries = (await tx.ledgerEntry.findMany({
        where: { walletId: wallet.id }
      })) as DbLedgerEntryRow[];
      const available = calculateAvailableBalance(entries.map(toTypedEntry));

      if (available.amountMinor < chargeMinor) {
        throw new ForbiddenException(
          `Insufficient balance. Required ₦${(chargeMinor / 100).toFixed(2)}.`
        );
      }

      const newOrder = await tx.vtuOrder.create({
        data: {
          id: orderId,
          workspaceId,
          productType: "DATA",
          network: dto.network,
          msisdnMasked,
          msisdnEncrypted: dto.msisdn,
          planId: plan.id,
          amountMinor: chargeMinor,
          costMinor: plan.costMinor,
          currency: "NGN",
          providerName: adapter.name,
          providerReference: reference,
          status: "SUBMITTED",
          idempotencyKey: `vtu_order_${orderId}`
        }
      });

      await this.debitWallet(
        wallet.id,
        workspaceId,
        chargeMinor,
        `Data ${plan.displayName} ${dto.network} → ${msisdnMasked}`,
        orderId,
        tx
      );

      return newOrder;
    });

    try {
      const result = await adapter.purchaseData({
        network: dto.network,
        msisdn: dto.msisdn,
        providerPlanId: dto.providerPlanId,
        reference: order.providerReference!
      });

      const finalStatus =
        result.status === "DELIVERED"
          ? "DELIVERED"
          : result.status === "SUBMITTED"
            ? "SUBMITTED"
            : "AMBIGUOUS";

      await this.db.vtuOrder.update({
        where: { id: order.id },
        data: { status: finalStatus }
      });

      if (finalStatus === "AMBIGUOUS") {
        await this.queue.enqueueVtuOpsReview(order.id);
      } else if (finalStatus === "SUBMITTED") {
        // Async delivery — poll the provider until it reports a terminal state.
        await this.queue.enqueueVtuPollStatus(order.id);
      }
    } catch (err) {
      this.logger.error(`VTU data submit error for ${order.id}: ${String(err)}`);
      await this.db.vtuOrder.update({
        where: { id: order.id },
        data: { status: "AMBIGUOUS" }
      });
      await this.queue.enqueueVtuOpsReview(order.id);
    }

    return this.db.vtuOrder.findUniqueOrThrow({ where: { id: order.id } });
  }

  // ─── Data plan catalog ───────────────────────────────────────────────────────

  async listDataPlans(network?: VtuNetwork) {
    await this.ensureDefaultCatalog();
    return this.db.vtuDataPlan.findMany({
      where: { active: true, ...(network ? { network } : {}) },
      orderBy: [{ network: "asc" }, { costMinor: "asc" }]
    });
  }

  // ─── Order history ───────────────────────────────────────────────────────────

  async listOrders(
    ctx: AuthenticatedRequestContext,
    query: { page?: number; limit?: number; network?: VtuNetwork; status?: string }
  ) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(50, Math.max(1, query.limit ?? 20));
    const where = {
      workspaceId: ctx.workspaceId,
      ...(query.network ? { network: query.network } : {}),
      ...(query.status ? { status: query.status as never } : {})
    };

    const [orders, total] = await Promise.all([
      this.db.vtuOrder.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit
      }),
      this.db.vtuOrder.count({ where })
    ]);

    return { orders, total, page, limit };
  }

  // ─── Admin: routes ───────────────────────────────────────────────────────────

  async adminListRoutes() {
    await this.ensureDefaultCatalog();
    return this.db.vtuProviderRoute.findMany({ orderBy: { priority: "asc" } });
  }

  private async ensureDefaultCatalog(db: DbClient = this.db) {
    for (const network of VTU_NETWORKS) {
      for (const productType of ["AIRTIME", "DATA"] as const) {
        const existing = await db.vtuProviderRoute.findFirst({
          where: { productType, network, provider: DEFAULT_VTU_PROVIDER }
        });

        if (existing) {
          await db.vtuProviderRoute.update({
            where: { id: existing.id },
            data: { active: true }
          });
        } else {
          await db.vtuProviderRoute.create({
            data: {
              id: uid("vroute"),
              productType,
              network,
              provider: DEFAULT_VTU_PROVIDER,
              priority: 10,
              active: true,
              note: "Default production route"
            }
          });
        }
      }
    }

    await Promise.all(
      DEFAULT_DATA_PLANS.map((plan) =>
        db.vtuDataPlan.upsert({
          where: {
            providerName_providerPlanId: {
              providerName: DEFAULT_VTU_PROVIDER,
              providerPlanId: plan.providerPlanId
            }
          },
          update: {
            network: plan.network,
            displayName: plan.displayName,
            sizeMb: plan.sizeMb,
            validityDays: plan.validityDays,
            costMinor: plan.costMinor,
            active: true,
            lastSyncedAt: new Date()
          },
          create: {
            id: uid("vplan"),
            providerName: DEFAULT_VTU_PROVIDER,
            providerPlanId: plan.providerPlanId,
            network: plan.network,
            planType: "SME",
            displayName: plan.displayName,
            sizeMb: plan.sizeMb,
            validityDays: plan.validityDays,
            costMinor: plan.costMinor,
            currency: "NGN",
            active: true
          }
        })
      )
    );
  }

  async adminUpdateRoute(
    routeId: string,
    dto: { priority?: number; enabled?: boolean },
    ctx: AuthenticatedRequestContext
  ) {
    const route = await this.db.vtuProviderRoute.findUnique({ where: { id: routeId } });
    if (!route) throw new NotFoundException("Route not found.");

    const updated = await this.db.vtuProviderRoute.update({
      where: { id: routeId },
      data: {
        ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
        ...(dto.enabled !== undefined ? { active: dto.enabled } : {})
      }
    });

    await this.db.auditLog.create({
      data: {
        id: uid("aud"),
        action: "VTU_ROUTE_UPDATED",
        actorUserId: ctx.userId,
        entityType: "VtuProviderRoute",
        entityId: routeId,
        metadata: dto
      }
    });

    return updated;
  }

  // ─── Bills adapter selector ──────────────────────────────────────────────────
  // Bills (electricity/cable) don't route by VtuNetwork (mobile carrier); they use a
  // separate routing query with no network filter. VTpass is primary for all Nigerian
  // DISCOs; ClubKonnect is configured as fallback via VtuProviderRoute rows with
  // productType=ELECTRICITY / productType=CABLE and no network.

  private async selectBillsAdapter(
    productType: "ELECTRICITY" | "CABLE",
    db: DbClient = this.db
  ): Promise<VtuProviderAdapter> {
    const routes = await db.vtuProviderRoute.findMany({
      where: { productType: productType as never, network: null, active: true },
      orderBy: { priority: "asc" }
    });

    if (routes.length === 0) {
      // Fall back to vtpass which is the standard Nigerian bills provider
      return this.buildAdapter("vtpass");
    }

    const healthRows = await db.providerHealth.findMany({
      where: { providerName: { in: routes.map((r) => r.provider) }, domain: "VTU" },
      orderBy: { checkedAt: "desc" },
      distinct: ["providerName"]
    });
    const latestStatus = new Map(healthRows.map((h) => [h.providerName, h.status]));

    const healthy = routes.find((r) => {
      const status = latestStatus.get(r.provider);
      return status !== "DOWN" && status !== "DISABLED";
    });

    return this.buildAdapter(healthy?.provider ?? "vtpass");
  }

  // ─── Meter validation (pre-flight, free) ────────────────────────────────────

  async validateMeter(dto: ValidateMeterDto) {
    if (!featureFlags.billsElectricity) {
      throw new BadRequestException("Electricity bills are not yet available.");
    }

    const adapter = await this.selectBillsAdapter("ELECTRICITY");
    if (!adapter.validateMeter) {
      throw new BadRequestException("Selected provider does not support meter validation.");
    }

    return adapter.validateMeter({
      disco: dto.disco,
      meterNumber: dto.meterNumber,
      meterType: dto.meterType
    });
  }

  // ─── Electricity purchase ────────────────────────────────────────────────────

  async buyElectricity(ctx: AuthenticatedRequestContext, dto: BuyElectricityDto) {
    if (!featureFlags.billsElectricity) {
      throw new BadRequestException("Electricity bills are not yet available.");
    }

    const { workspaceId } = ctx;
    if (!dto.disco) throw new BadRequestException("disco is required.");
    if (!dto.meterNumber.match(/^\d{10,13}$/)) {
      throw new BadRequestException("Invalid meter number format (10-13 digits).");
    }
    if (dto.amountMinor < 50_000) {
      throw new BadRequestException("Minimum electricity purchase is ₦500.");
    }

    const adapter = await this.selectBillsAdapter("ELECTRICITY");
    if (!adapter.purchaseElectricity) {
      throw new BadRequestException("Selected provider does not support electricity purchase.");
    }

    // Step 1: validate meter before charging wallet
    if (adapter.validateMeter) {
      const validation = await adapter.validateMeter({
        disco: dto.disco,
        meterNumber: dto.meterNumber,
        meterType: dto.meterType
      });
      if (!validation.valid) {
        throw new BadRequestException(
          `Meter validation failed. Verify the meter number and DISCO code.`
        );
      }
      if (validation.minAmountMinor && dto.amountMinor < validation.minAmountMinor) {
        throw new BadRequestException(
          `Minimum purchase for this meter is ₦${(validation.minAmountMinor / 100).toFixed(0)}.`
        );
      }
    }

    // Bills are pass-through (no markup for electricity — regulatory)
    const chargeMinor = dto.amountMinor;
    const orderId = uid("vtu");
    const reference = adapter.buildReference({ id: orderId, createdAt: new Date() });
    const meterMasked = dto.meterNumber.slice(0, 3) + "****" + dto.meterNumber.slice(-2);

    const order = await this.db.$transaction(async (tx) => {
      const wallet = await this.getWallet(workspaceId, tx);
      const entries = (await tx.ledgerEntry.findMany({
        where: { walletId: wallet.id }
      })) as DbLedgerEntryRow[];
      const available = calculateAvailableBalance(entries.map(toTypedEntry));

      if (available.amountMinor < chargeMinor) {
        throw new ForbiddenException(
          `Insufficient balance. Required ₦${(chargeMinor / 100).toFixed(2)}.`
        );
      }

      const newOrder = await tx.vtuOrder.create({
        data: {
          id: orderId,
          workspaceId,
          productType: "ELECTRICITY",
          msisdnMasked: meterMasked,
          msisdnEncrypted: dto.meterNumber,
          amountMinor: chargeMinor,
          costMinor: chargeMinor,
          currency: "NGN",
          providerName: adapter.name,
          providerReference: reference,
          status: "SUBMITTED",
          idempotencyKey: `vtu_order_${orderId}`,
          metadata: { disco: dto.disco, meterType: dto.meterType }
        }
      });

      await this.debitWallet(
        wallet.id,
        workspaceId,
        chargeMinor,
        `Electricity ${dto.disco.toUpperCase()} ₦${(chargeMinor / 100).toFixed(0)} → ${meterMasked}`,
        orderId,
        tx
      );

      return newOrder;
    });

    // Submit outside the transaction — network timeout must not roll back the debit.
    try {
      const result = await adapter.purchaseElectricity({
        disco: dto.disco,
        meterNumber: dto.meterNumber,
        meterType: dto.meterType,
        amountMinor: dto.amountMinor,
        reference: order.providerReference!
      });

      const finalStatus =
        result.status === "DELIVERED"
          ? "DELIVERED"
          : result.status === "SUBMITTED"
            ? "SUBMITTED"
            : "AMBIGUOUS";

      await this.db.vtuOrder.update({
        where: { id: order.id },
        data: {
          status: finalStatus,
          ...(result.token ? { token: result.token } : {}),
          ...(result.units
            ? { metadata: { disco: dto.disco, meterType: dto.meterType, units: result.units } }
            : {})
        }
      });

      if (finalStatus === "AMBIGUOUS") {
        await this.queue.enqueueVtuOpsReview(order.id);
      } else if (finalStatus === "SUBMITTED") {
        await this.queue.enqueueVtuPollStatus(order.id);
      }
    } catch (err) {
      this.logger.error(`VTU electricity submit error for ${order.id}: ${String(err)}`);
      await this.db.vtuOrder.update({
        where: { id: order.id },
        data: { status: "AMBIGUOUS" }
      });
      await this.queue.enqueueVtuOpsReview(order.id);
    }

    return this.db.vtuOrder.findUniqueOrThrow({ where: { id: order.id } });
  }

  // ─── Cable subscription ──────────────────────────────────────────────────────

  async buyCable(ctx: AuthenticatedRequestContext, dto: BuyCableDto) {
    if (!featureFlags.billsCable) {
      throw new BadRequestException("Cable subscriptions are not yet available.");
    }

    if (!dto.provider) throw new BadRequestException("provider is required.");
    if (!dto.smartCardNumber) throw new BadRequestException("smartCardNumber is required.");
    if (!dto.packageCode) throw new BadRequestException("packageCode is required.");

    const adapter = await this.selectBillsAdapter("CABLE");
    if (!adapter.purchaseCable) {
      throw new BadRequestException("Selected provider does not support cable purchase.");
    }

    // Look up the cable package cost from provider catalog (VtuDataPlan reused for cable bundles)
    // If no catalog entry found, caller must specify amountMinor separately (not yet implemented
    // in DTOs — for now we require a catalog-backed amount to prevent overcharging).
    // NOTE: cable package catalog sync is a follow-up worker job; for now throw if no catalog.
    throw new BadRequestException(
      "Cable subscription requires package catalog. Contact support to enable cable for your account."
    );
  }

  // ─── Bills order list ────────────────────────────────────────────────────────

  async listBillsOrders(ctx: AuthenticatedRequestContext, query: BillsOrderQueryDto) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(50, Math.max(1, query.limit ?? 20));
    const where = {
      workspaceId: ctx.workspaceId,
      productType: query.productType
        ? { in: [query.productType] as never[] }
        : { in: ["ELECTRICITY", "CABLE"] as never[] },
      ...(query.status ? { status: query.status as never } : {})
    };

    const [orders, total] = await Promise.all([
      this.db.vtuOrder.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit
      }),
      this.db.vtuOrder.count({ where })
    ]);

    return { orders, total, page, limit };
  }

  // ─── Admin: bills ops queue ──────────────────────────────────────────────────

  async adminBillsOrders(query: {
    status?: string;
    productType?: string;
    days?: number;
    limit?: number;
  }) {
    const limit = Math.min(200, query.limit ?? 50);
    const since = query.days
      ? new Date(Date.now() - query.days * 86_400_000)
      : new Date(Date.now() - 30 * 86_400_000);

    return this.db.vtuOrder.findMany({
      where: {
        productType: query.productType
          ? { in: [query.productType as never] }
          : { in: ["ELECTRICITY", "CABLE"] as never[] },
        ...(query.status ? { status: query.status as never } : {}),
        createdAt: { gte: since }
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { workspace: { select: { id: true, name: true } } }
    });
  }

  // ─── Admin: ops resolve ──────────────────────────────────────────────────────

  async adminResolveOrder(
    orderId: string,
    resolution: "DELIVERED" | "REVERSED",
    ctx: AuthenticatedRequestContext
  ) {
    const order = await this.db.vtuOrder.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException("Order not found.");
    if (order.status !== "AMBIGUOUS") {
      throw new BadRequestException("Only AMBIGUOUS orders can be manually resolved.");
    }

    return this.db.$transaction(async (tx) => {
      const updated = await tx.vtuOrder.update({
        where: { id: orderId },
        data: { status: resolution }
      });

      if (resolution === "REVERSED") {
        const charge = await tx.vtuWalletCharge.findFirst({
          where: { orderId, status: "CHARGED" }
        });

        if (charge) {
          const ledgerId = uid("led");
          const idemKey = `vtu_reversal_${orderId}`;

          const reversalEntry = await tx.ledgerEntry.create({
            data: {
              id: ledgerId,
              walletId: charge.walletId,
              kind: "REVERSAL",
              amountMinor: charge.amountMinor,
              currency: "NGN",
              reference: idemKey,
              description: `Reversal: VTU order ${orderId}`,
              idempotencyKey: idemKey,
              sourceType: "VtuWalletCharge",
              sourceId: charge.id
            }
          });

          await tx.vtuWalletCharge.update({
            where: { id: charge.id },
            data: { status: "REFUNDED", refundLedgerEntryId: reversalEntry.id }
          });
        }
      }

      await tx.auditLog.create({
        data: {
          id: uid("aud"),
          action: "VTU_ORDER_RESOLVED",
          actorUserId: ctx.userId,
          entityType: "VtuOrder",
          entityId: orderId,
          metadata: { resolution }
        }
      });

      return updated;
    });
  }
}
