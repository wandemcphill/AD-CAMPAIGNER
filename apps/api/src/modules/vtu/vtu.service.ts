import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException
} from "@nestjs/common";

import { Prisma, type DatabaseClient } from "@fliptrybe/database";
import { calculateAvailableBalance, runChargeSaga } from "@fliptrybe/payments";
import type { CurrencyCode, LedgerEntry } from "@fliptrybe/types";
import {
  createMockVtuAdapter,
  createClubKonnectAdapter,
  createGsubzAdapter,
  createTopupWizardAdapter,
  createSirpDataAdapter,
  type VtuProviderAdapter,
  type VtuNetwork
} from "@fliptrybe/providers";

import { PrismaService } from "../prisma.service";
import { QueueProducerService } from "../queue-producer.service";
import { PricingRuleService, type PricingRuleFilter } from "../providers/pricing-rule.service";
import { VtuRouterService } from "./vtu-router.service";
import { VtuQuoteService } from "./vtu-quote.service";
import { featureFlags } from "@fliptrybe/feature-flags";
import type { AuthenticatedRequestContext } from "../request-context";
import type {
  BuyAirtimeDto,
  BuyAirtimeEpinDto,
  BuyDataDto,
  BuyDataEpinDto,
  BillsOrderQueryDto,
  BuyBetFundingDto,
  BuyCableDto,
  BuyEducationDto,
  BuyElectricityDto,
  GetVtuQuoteDto,
  ValidateMeterDto
} from "./vtu.dtos";
import type { VtuEpin } from "@fliptrybe/providers";

type DbClient = DatabaseClient | Prisma.TransactionClient;

const uid = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 12)}`;

// 2% margin over wholesale.
// What the upstream EPIN providers actually mint. Voucher denominations are
// admin-configurable but still have to land inside this set, so it is exported
// and checked at configuration time rather than only at purchase.
export const AIRTIME_EPIN_DENOMINATIONS_MINOR = [10_000, 20_000, 50_000];

const MARKUP_BPS = 200;
const VTU_NETWORKS: VtuNetwork[] = ["MTN", "GLO", "AIRTEL", "NINE_MOBILE"];
const DEFAULT_VTU_PROVIDER = "clubkonnect";
const DEFAULT_DATA_PROVIDER = "gsubz";
const BILLS_ROUTE_PRIORITY = {
  clubkonnect: 10
};
const EDUCATION_ROUTE_PRIORITY = {
  topupwizard: 10,
  sirpdata: 20
};

function isProductionRuntime() {
  return process.env.NODE_ENV === "production";
}

function isMockProviderName(providerName: string) {
  return providerName.trim().toLowerCase() === "mock";
}

// Verified DStv package list from ClubKonnect docs (2026-08-05). GOtv/StarTimes/Showmax
// packages are populated live by the cable_catalog_sync worker job — not hand-verified
// here, so they're intentionally omitted from this bootstrap set.
const DEFAULT_CABLE_PACKAGES: Array<{
  cableProvider: string;
  packageCode: string;
  displayName: string;
  costMinor: number;
}> = [
  { cableProvider: "dstv", packageCode: "dstv-padi", displayName: "DStv Padi", costMinor: 440000 },
  { cableProvider: "dstv", packageCode: "dstv-yanga", displayName: "DStv Yanga", costMinor: 600000 },
  { cableProvider: "dstv", packageCode: "dstv-confam", displayName: "DStv Confam", costMinor: 1100000 },
  { cableProvider: "dstv", packageCode: "dstv79", displayName: "DStv Compact", costMinor: 1900000 },
  { cableProvider: "dstv", packageCode: "dstv7", displayName: "DStv Compact Plus", costMinor: 3000000 },
  { cableProvider: "dstv", packageCode: "dstv3", displayName: "DStv Premium", costMinor: 4450000 },
  { cableProvider: "dstv", packageCode: "dstv10", displayName: "DStv Premium-Asia", costMinor: 5050000 },
  { cableProvider: "dstv", packageCode: "dstv9", displayName: "DStv Premium-French", costMinor: 6900000 }
];

// Verified via /APIBettingTypeV2.asp (2026-08-06) — PRODUCT_CODE values, not display names.
const BETTING_COMPANIES: Array<{ code: string; name: string }> = [
  { code: "product-nairabet", name: "NairaBet" },
  { code: "product-bang-bet", name: "BangBet" },
  { code: "product-bet-way", name: "BetWay" },
  { code: "product-bet-land", name: "BetLand" },
  { code: "product-bet-king", name: "BetKing" },
  { code: "product-1x-bet", name: "1xBet" },
  { code: "product-naija-bet", name: "NaijaBet" },
  { code: "prd-sporty-bet", name: "Sporty Bet" },
  { code: "product-merry-bet", name: "MerryBet" }
];

// Verified via /APIWAECPackagesV2.asp (2026-08-06). JAMB exam types (de, utme-mock,
// utme-no-mock) come back empty from /APIJAMBPackagesV2.asp at this account tier —
// keep the JAMB code path but its ExamType list is not currently priced here.
//
// NECO/NABTEB are not listed here on purpose. They ARE mapped by the adapters,
// and the ClubKonnect listEducationPlans() extraction no longer drops non-WAEC
// exam types (it read only the "WAEC" key before, which is why NECO never
// surfaced), so education_catalog_sync will populate them with real prices when
// the provider returns any. This bootstrap set exists for the pre-first-sync
// case only, and a guessed price here would be charged as if it were verified.
// Education product codes a provider documents, used to reject an unusable exam
// type when an admin configures a price rather than when a customer tries to buy
// one. Providers absent from this map are not validated — theirs come from
// education_catalog_sync, which can only return codes they actually sell.
const PROVIDER_EDUCATION_CODES: Record<string, string[]> = {
  // "Native API Documentation | SIRP DATA", Educational PINs (retrieved
  // 2026-08-15): examType "can be either 'waec_pin', 'neco_pin', 'utme_pin' or
  // 'nabteb_pin'". Matches the examMap in createSirpDataAdapter.
  sirpdata: ["waec_pin", "neco_pin", "utme_pin", "nabteb_pin"]
};

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
    private readonly queue: QueueProducerService,
    private readonly pricingRules: PricingRuleService,
    private readonly vtuRouter: VtuRouterService,
    private readonly vtuQuote: VtuQuoteService
  ) {}

  private get db(): DatabaseClient {
    return this.prismaService.client;
  }

  // A PricingRule row (domain=VTU) overrides MARKUP_BPS when one matches; otherwise
  // this falls back to the same 2% margin that was hardcoded before.
  private async applyMarkup(costMinor: number, filter: PricingRuleFilter = {}): Promise<number> {
    const bps = await this.pricingRules.resolveMarkupBps("VTU", filter, MARKUP_BPS);
    return Math.ceil(costMinor * (1 + bps / 10_000));
  }

  // ─── Adapter factory ────────────────────────────────────────────────────────

  private buildAdapter(providerName: string): VtuProviderAdapter {
    switch (providerName) {
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
      case "topupwizard":
        return createTopupWizardAdapter({
          apiKey: process.env["TOPUPWIZARD_API_KEY"] ?? "",
          ...(process.env["TOPUPWIZARD_BASE_URL"] ? { baseUrl: process.env["TOPUPWIZARD_BASE_URL"] } : {})
        });
      case "sirpdata":
        return createSirpDataAdapter({
          apiKey: process.env["SIRPDATA_API_KEY"] ?? "",
          ...(process.env["SIRPDATA_BASE_URL"] ? { baseUrl: process.env["SIRPDATA_BASE_URL"] } : {})
        });
      case "gsubz":
        return createGsubzAdapter({
          apiKey: process.env["GSUBZ_API_KEY"] ?? "",
          ...(process.env["GSUBZ_BASE_URL"] ? { baseUrl: process.env["GSUBZ_BASE_URL"] } : {})
        });
      default:
        if (isProductionRuntime()) {
          throw new BadRequestException(
            `Unknown VTU provider "${providerName}" is not allowed in production.`
          );
        }
        return createMockVtuAdapter(providerName);
    }
  }

  // ─── Provider routing ────────────────────────────────────────────────────────
  // Uses the multi-provider cost-comparison router (VtuRouterService) when
  // VtuProviderConfig rows exist. Falls back to the legacy VtuProviderRoute
  // priority table for accounts that haven't been migrated to the new model yet.

  private async selectAdapter(
    productType: "AIRTIME" | "DATA",
    network: VtuNetwork,
    db: DbClient = this.db
  ): Promise<VtuProviderAdapter> {
    await this.ensureDefaultCatalog(db);

    // Try cost-comparison router first.
    const configCount = await db.vtuProviderConfig.count({
      where: { status: { in: ["ACTIVE", "PRODUCTION_READY"] } }
    });

    if (configCount > 0) {
      try {
        const result = await this.vtuRouter.route({ productType, network });
        return this.buildAdapter(result.winner.providerName);
      } catch {
        // Router found no eligible provider — fall through to legacy table.
      }
    }

    // Legacy: VtuProviderRoute priority table.
    const routes = await db.vtuProviderRoute.findMany({
      where: { productType, network, active: true },
      orderBy: { priority: "asc" }
    });

    if (routes.length === 0) {
      throw new BadRequestException(
        `No VTU provider route is configured for ${productType} on ${network}.`
      );
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

  // ─── Price-locked quote ──────────────────────────────────────────────────────
  // GET /vtu/quote — returns a 15-minute price-locked quote the client can then
  // submit alongside their buy request to guarantee no price slippage.

  async createQuoteForProduct(dto: GetVtuQuoteDto) {
    if (dto.productType === "AIRTIME") {
      if (!dto.faceValueMinor || !Number.isInteger(dto.faceValueMinor) || dto.faceValueMinor <= 0) {
        throw new BadRequestException("faceValueMinor is required for AIRTIME quotes.");
      }
      const result = await this.vtuRouter.route({
        productType: "AIRTIME",
        network: dto.network,
        faceValueMinor: dto.faceValueMinor
      });
      const adapter = this.buildAdapter(result.winner.providerName);
      const discountBps = await adapter.getAirtimeDiscountBps(dto.network);
      const costMinor = Math.ceil(dto.faceValueMinor * (1 - discountBps / 10_000));
      return this.vtuQuote.createQuote({
        productType: "AIRTIME",
        network: dto.network,
        providerName: result.winner.providerName,
        providerSku: "airtime",
        costMinor
      });
    }

    if (dto.productType === "DATA") {
      if (!dto.canonicalSkuId) {
        throw new BadRequestException("canonicalSkuId is required for DATA quotes.");
      }
      const result = await this.vtuRouter.route({
        productType: "DATA",
        network: dto.network,
        canonicalSkuId: dto.canonicalSkuId
      });
      return this.vtuQuote.createQuote({
        productType: "DATA",
        network: dto.network,
        canonicalSkuId: dto.canonicalSkuId,
        providerName: result.winner.providerName,
        providerSku: result.winner.providerSku,
        costMinor: result.winner.costMinor
      });
    }

    throw new BadRequestException("Unsupported productType for quote.");
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

    const orderId = uid("vtu");
    let adapter: VtuProviderAdapter;
    let wholesaleCost: number;
    let chargeMinor: number;

    if (dto.quoteId) {
      // Quote flow: frozen pricing — consume the quote now, linking it to this orderId.
      // If the downstream transaction fails the quote is consumed but idempotent retry
      // with a fresh quote is always an option (quote TTL protects against stale prices).
      const q = await this.vtuQuote.consumeQuote(dto.quoteId, orderId);
      adapter = this.buildAdapter(q.providerName);
      wholesaleCost = q.costMinor;
      chargeMinor = q.customerPriceMinor;
    } else {
      adapter = await this.selectAdapter("AIRTIME", dto.network);
      const discountBps = await adapter.getAirtimeDiscountBps(dto.network);
      wholesaleCost = Math.ceil(dto.faceValueMinor * (1 - discountBps / 10_000));
      chargeMinor = await this.applyMarkup(wholesaleCost, {
        network: dto.network,
        productType: "AIRTIME",
        providerName: adapter.name
      });
    }

    const reference = adapter.buildReference({ id: orderId, createdAt: new Date() });
    const msisdnMasked = dto.msisdn.slice(0, 4) + "****" + dto.msisdn.slice(-3);

    const outcome = await runChargeSaga({
      debit: async () => {
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
              msisdnEncrypted: dto.msisdn,
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

          const { charge } = await this.debitWallet(
            wallet.id,
            workspaceId,
            chargeMinor,
            `Airtime ${dto.network} ₦${(dto.faceValueMinor / 100).toFixed(0)} → ${msisdnMasked}`,
            orderId,
            tx
          );

          return { order: newOrder, charge: {
            chargeId: charge.id,
            walletId: charge.walletId,
            amountMinor: charge.amountMinor,
            currency: charge.currency as CurrencyCode,
            debitLedgerEntryId: charge.debitLedgerEntryId
          }};
        });
        return order;
      },

      execute: async (order) => {
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
          await this.queue.enqueueVtuPollStatus(order.id);
        }

        return result;
      },

      compensate: async () => {}
    });

    if (outcome.status === "held") {
      this.logger.error(`VTU airtime submit error for ${orderId}: ${String(outcome.error)}`);
      await this.db.vtuOrder.update({
        where: { id: orderId },
        data: { status: "AMBIGUOUS" }
      });
      await this.queue.enqueueVtuOpsReview(orderId);
    }

    return this.db.vtuOrder.findUniqueOrThrow({ where: { id: orderId } });
  }

  // ─── Data purchase ───────────────────────────────────────────────────────────

  async buyData(ctx: AuthenticatedRequestContext, dto: BuyDataDto) {
    const { workspaceId } = ctx;

    if (!dto.msisdn.match(/^\+?[1-9]\d{6,14}$/)) {
      throw new BadRequestException("Invalid MSISDN format.");
    }

    const orderId = uid("vtu");
    let adapter: VtuProviderAdapter;
    let chargeMinor: number;
    let planCostMinor: number;
    let planId: string | undefined;
    let providerPlanId: string;

    if (dto.quoteId) {
      // Quote flow: pricing frozen at quote time; provider and SKU resolved by router.
      const q = await this.vtuQuote.consumeQuote(dto.quoteId, orderId);
      adapter = this.buildAdapter(q.providerName);
      planCostMinor = q.costMinor;
      chargeMinor = q.customerPriceMinor;
      providerPlanId = q.providerSku;
      // Look up the plan row by providerSku so we can link planId on the order.
      const planRow = await this.db.vtuDataPlan.findFirst({
        where: { providerName: q.providerName, providerPlanId: q.providerSku, active: true }
      });
      planId = planRow?.id;
    } else {
      if (!dto.providerPlanId) throw new BadRequestException("providerPlanId is required.");
      adapter = await this.selectAdapter("DATA", dto.network);
      const plan = await this.db.vtuDataPlan.findFirst({
        where: {
          providerName: adapter.name,
          providerPlanId: dto.providerPlanId,
          network: dto.network,
          active: true
        }
      });
      if (!plan) throw new NotFoundException("Data plan not found or unavailable.");
      planCostMinor = plan.costMinor;
      planId = plan.id;
      providerPlanId = dto.providerPlanId;
      chargeMinor = await this.applyMarkup(plan.costMinor, {
        network: dto.network,
        productType: "DATA",
        providerName: adapter.name
      });
    }

    const reference = adapter.buildReference({ id: orderId, createdAt: new Date() });
    const msisdnMasked = dto.msisdn.slice(0, 4) + "****" + dto.msisdn.slice(-3);

    const outcome = await runChargeSaga({
      debit: async () => {
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
              ...(planId ? { planId } : {}),
              amountMinor: chargeMinor,
              costMinor: planCostMinor,
              currency: "NGN",
              providerName: adapter.name,
              providerReference: reference,
              status: "SUBMITTED",
              idempotencyKey: `vtu_order_${orderId}`
            }
          });

          const { charge } = await this.debitWallet(
            wallet.id,
            workspaceId,
            chargeMinor,
            `Data ${dto.network} → ${msisdnMasked}`,
            orderId,
            tx
          );

          return { order: newOrder, charge: {
            chargeId: charge.id,
            walletId: charge.walletId,
            amountMinor: charge.amountMinor,
            currency: charge.currency as CurrencyCode,
            debitLedgerEntryId: charge.debitLedgerEntryId
          }};
        });
        return order;
      },

      execute: async (order) => {
        const result = await adapter.purchaseData({
          network: dto.network,
          msisdn: dto.msisdn,
          providerPlanId,
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
          await this.queue.enqueueVtuPollStatus(order.id);
        }

        return result;
      },

      compensate: async () => {}
    });

    if (outcome.status === "held") {
      this.logger.error(`VTU data submit error for ${orderId}: ${String(outcome.error)}`);
      await this.db.vtuOrder.update({
        where: { id: orderId },
        data: { status: "AMBIGUOUS" }
      });
      await this.queue.enqueueVtuOpsReview(orderId);
    }

    return this.db.vtuOrder.findUniqueOrThrow({ where: { id: orderId } });
  }

  // ─── Airtime EPIN (printed recharge PIN) ─────────────────────────────────────
  // Distinct from buyAirtime: no msisdn, provider returns pin+serialNumber instead of
  // crediting a phone directly. Used by the voucher engine to seal a real ClubKonnect
  // PIN into a Voucher instead of FlipTrybe's own locally-generated code.

  async buyAirtimeEpin(
    ctx: AuthenticatedRequestContext,
    dto: BuyAirtimeEpinDto
  ): Promise<{ order: Prisma.VtuOrderGetPayload<Record<string, never>>; epins: VtuEpin[] }> {
    const { workspaceId } = ctx;

    if (!AIRTIME_EPIN_DENOMINATIONS_MINOR.includes(dto.valueMinor)) {
      throw new BadRequestException(
        `Airtime EPIN value must be one of ${AIRTIME_EPIN_DENOMINATIONS_MINOR.map((v) => `₦${v / 100}`).join(", ")}.`
      );
    }
    if (!Number.isInteger(dto.quantity) || dto.quantity < 1 || dto.quantity > 100) {
      throw new BadRequestException("quantity must be between 1 and 100.");
    }

    const adapter = await this.selectAdapter("AIRTIME", dto.network);
    if (!adapter.purchaseAirtimeEpin) {
      throw new BadRequestException("Selected provider does not support airtime EPIN issuance.");
    }

    // No wholesale-discount API for EPIN (unlike direct recharge) — charge face value + markup.
    const costMinor = dto.valueMinor * dto.quantity;
    const chargeMinor = await this.applyMarkup(costMinor, {
      network: dto.network,
      productType: "AIRTIME",
      providerName: adapter.name
    });
    const orderId = uid("vtu");
    const reference = adapter.buildReference({ id: orderId, createdAt: new Date() });

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
          productType: "AIRTIME_EPIN",
          network: dto.network,
          msisdnMasked: "EPIN",
          msisdnEncrypted: "",
          faceValueMinor: dto.valueMinor,
          amountMinor: chargeMinor,
          costMinor,
          currency: "NGN",
          providerName: adapter.name,
          providerReference: reference,
          status: "SUBMITTED",
          idempotencyKey: `vtu_order_${orderId}`,
          metadata: { quantity: dto.quantity }
        }
      });

      await this.debitWallet(
        wallet.id,
        workspaceId,
        chargeMinor,
        `Airtime EPIN ${dto.network} ₦${(dto.valueMinor / 100).toFixed(0)} x${dto.quantity}`,
        orderId,
        tx
      );

      return newOrder;
    });

    try {
      const result = await adapter.purchaseAirtimeEpin({
        network: dto.network,
        valueMinor: dto.valueMinor,
        quantity: dto.quantity,
        reference: order.providerReference!
      });

      if (result.status === "DELIVERED" && result.epins?.length) {
        await this.db.vtuOrder.update({
          where: { id: order.id },
          data: { status: "DELIVERED", metadata: { quantity: dto.quantity, epins: result.epins } as unknown as Prisma.InputJsonValue }
        });
        return { order: await this.db.vtuOrder.findUniqueOrThrow({ where: { id: order.id } }), epins: result.epins };
      }

      // Failed or no PINs — reverse the charge, this purchase did not deliver.
      await this.reverseVtuCharge(order.id, ctx.userId);
      await this.db.vtuOrder.update({
        where: { id: order.id },
        data: { status: "REVERSED", failureReason: result.failureReason ?? "No EPINs returned." }
      });
      throw new BadRequestException(result.failureReason ?? "Airtime EPIN purchase failed.");
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      this.logger.error(`VTU airtime EPIN submit error for ${order.id}: ${String(err)}`);
      await this.db.vtuOrder.update({
        where: { id: order.id },
        data: { status: "AMBIGUOUS" }
      });
      await this.queue.enqueueVtuOpsReview(order.id);
      throw new BadRequestException("Airtime EPIN purchase could not be confirmed. It has been queued for review.");
    }
  }

  // ─── Data EPIN (printed data-bundle recharge PIN) ────────────────────────────

  async buyDataEpin(
    ctx: AuthenticatedRequestContext,
    dto: BuyDataEpinDto
  ): Promise<{ order: Prisma.VtuOrderGetPayload<Record<string, never>>; epins: VtuEpin[] }> {
    const { workspaceId } = ctx;

    if (!dto.providerPlanId) throw new BadRequestException("providerPlanId is required.");
    if (!Number.isInteger(dto.quantity) || dto.quantity < 1 || dto.quantity > 100) {
      throw new BadRequestException("quantity must be between 1 and 100.");
    }

    const adapter = await this.selectAdapter("DATA", dto.network);
    if (!adapter.purchaseDataEpin) {
      throw new BadRequestException("Selected provider does not support data EPIN issuance.");
    }

    const plan = await this.db.vtuDataPlan.findFirst({
      where: {
        providerName: adapter.name,
        providerPlanId: dto.providerPlanId,
        network: dto.network,
        active: true
      }
    });
    if (!plan) throw new NotFoundException("Data plan not found or unavailable.");

    const costMinor = plan.costMinor * dto.quantity;
    const chargeMinor = await this.applyMarkup(costMinor, {
      network: dto.network,
      productType: "DATA",
      providerName: adapter.name
    });
    const orderId = uid("vtu");
    const reference = adapter.buildReference({ id: orderId, createdAt: new Date() });

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
          productType: "DATA_EPIN",
          network: dto.network,
          msisdnMasked: "EPIN",
          msisdnEncrypted: "",
          planId: plan.id,
          amountMinor: chargeMinor,
          costMinor,
          currency: "NGN",
          providerName: adapter.name,
          providerReference: reference,
          status: "SUBMITTED",
          idempotencyKey: `vtu_order_${orderId}`,
          metadata: { quantity: dto.quantity }
        }
      });

      await this.debitWallet(
        wallet.id,
        workspaceId,
        chargeMinor,
        `Data EPIN ${plan.displayName} x${dto.quantity}`,
        orderId,
        tx
      );

      return newOrder;
    });

    try {
      const result = await adapter.purchaseDataEpin({
        network: dto.network,
        providerPlanId: dto.providerPlanId,
        quantity: dto.quantity,
        reference: order.providerReference!
      });

      if (result.status === "DELIVERED" && result.epins?.length) {
        await this.db.vtuOrder.update({
          where: { id: order.id },
          data: { status: "DELIVERED", metadata: { quantity: dto.quantity, epins: result.epins } as unknown as Prisma.InputJsonValue }
        });
        return { order: await this.db.vtuOrder.findUniqueOrThrow({ where: { id: order.id } }), epins: result.epins };
      }

      if (result.status === "SUBMITTED") {
        // Data EPIN can queue (ORDER_RECEIVED) before rows are ready — poll like other
        // asynchronous ClubKonnect products rather than treating this as a failure.
        await this.db.vtuOrder.update({ where: { id: order.id }, data: { status: "SUBMITTED" } });
        await this.queue.enqueueVtuPollStatus(order.id);
        throw new BadRequestException(
          "Data EPIN purchase was queued by the provider. Check order status shortly."
        );
      }

      await this.reverseVtuCharge(order.id, ctx.userId);
      await this.db.vtuOrder.update({
        where: { id: order.id },
        data: { status: "REVERSED", failureReason: result.failureReason ?? "No EPINs returned." }
      });
      throw new BadRequestException(result.failureReason ?? "Data EPIN purchase failed.");
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      this.logger.error(`VTU data EPIN submit error for ${order.id}: ${String(err)}`);
      await this.db.vtuOrder.update({
        where: { id: order.id },
        data: { status: "AMBIGUOUS" }
      });
      await this.queue.enqueueVtuOpsReview(order.id);
      throw new BadRequestException("Data EPIN purchase could not be confirmed. It has been queued for review.");
    }
  }

  // `actorUserId` is null for system-initiated reversals (e.g. the VTU webhook
  // handler, which has no authenticated user in the request). This method is
  // idempotent by construction: it only acts when a CHARGED VtuWalletCharge still
  // exists for the order, so calling it twice for the same order (poll-based
  // resolution racing a webhook, or a retried webhook delivery) is a safe no-op
  // on the second call — the `findFirst({ status: "CHARGED" })` lookup returns
  // nothing once the charge has already moved to REFUNDED.
  private async reverseVtuCharge(orderId: string, actorUserId: string | null) {
    const charge = await this.db.vtuWalletCharge.findFirst({
      where: { orderId, status: "CHARGED" }
    });
    if (!charge) return;

    const ledgerId = uid("led");
    const idemKey = `vtu_reversal_${orderId}`;

    const reversalEntry = await this.db.ledgerEntry.create({
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

    await this.db.vtuWalletCharge.update({
      where: { id: charge.id },
      data: { status: "REFUNDED", refundLedgerEntryId: reversalEntry.id }
    });

    await this.db.auditLog.create({
      data: {
        id: uid("aud"),
        action: "VTU_EPIN_REVERSED",
        actorUserId,
        entityType: "VtuOrder",
        entityId: orderId,
        metadata: {}
      }
    });
  }

  // ─── VTU inbound webhook ─────────────────────────────────────────────────────
  // The provider's dashboard is configured to POST both `transaction.created` and
  // `transaction.status_changed` events to /webhooks/vtu (see VtuWebhookController).
  // This is additive to — not a replacement for — the existing poll/requery path:
  // whichever of (webhook, poll) resolves an order first wins, and the other is a
  // safe no-op because every state transition here is guarded to be idempotent.
  //
  // `request_id` in the payload is the provider's own request_id, which is exactly the
  // `providerReference` we generated via the outbound purchase call and sent
  // on the outbound purchase call — so we look the order up by providerReference,
  // not by re-deriving the `vtu_order_<id>` idempotencyKey.
  async handleVtuWebhook(payload: Record<string, unknown>): Promise<{
    received: true;
    matched: boolean;
    processed: boolean;
  }> {
    const event = typeof payload["event"] === "string" ? payload["event"] : "unknown";
    const requestId = typeof payload["request_id"] === "string" ? payload["request_id"] : undefined;
    const status = typeof payload["status"] === "string" ? payload["status"] : undefined;
    const orderIdRaw = payload["order_id"];
    const providerOrderId =
      typeof orderIdRaw === "string" || typeof orderIdRaw === "number" ? String(orderIdRaw) : "unknown";

    // ProviderWebhookEvent is unique on (provider, domain, providerEventId).
    // The provider may retry deliveries, and `transaction.status_changed` can legitimately
    // fire more than once for the same order_id with different `status` values, so
    // the dedup key includes both the order id and the status/event so a genuine
    // status transition is still recorded, while an exact retry upserts in place.
    const providerEventId = `${providerOrderId}_${event}${status ? `_${status}` : ""}`;

    const webhookEvent = await this.db.providerWebhookEvent.upsert({
      where: {
        provider_domain_providerEventId: {
          provider: "clubkonnect",
          domain: "VTU",
          providerEventId
        }
      },
      create: {
        provider: "clubkonnect",
        domain: "VTU",
        providerEventId,
        eventType: event,
        // Signature verification for this endpoint is an interim shared-secret
        // check at the controller layer (see VtuWebhookController), not a
        // per-payload signature from the provider — there is nothing to record here
        // that corresponds to `signature`/`signatureValid` on other providers'
        // rows, so this is left at its default (no signature, signatureValid=false)
        // and authenticity for this row is really vouched for by the fact the
        // request reached this code at all (i.e. cleared the shared-secret gate).
        rawPayload: payload as never
      },
      update: {
        eventType: event,
        rawPayload: payload as never
      }
    });

    if (webhookEvent.processed) {
      this.logger.log(`VTU webhook ${providerEventId} already processed — acknowledging.`);
      return { received: true, matched: true, processed: true };
    }

    if (!requestId) {
      this.logger.warn(`VTU webhook ${providerEventId} had no request_id — cannot match an order.`);
      await this.db.providerWebhookEvent.update({
        where: { id: webhookEvent.id },
        data: { processed: true, processedAt: new Date(), processError: "Missing request_id" }
      });
      return { received: true, matched: false, processed: true };
    }

    const order = await this.db.vtuOrder.findFirst({ where: { providerReference: requestId } });
    if (!order) {
      this.logger.warn(`VTU webhook ${providerEventId}: no VtuOrder for providerReference=${requestId}.`);
      await this.db.providerWebhookEvent.update({
        where: { id: webhookEvent.id },
        data: { processed: true, processedAt: new Date(), processError: "No matching VtuOrder" }
      });
      return { received: true, matched: false, processed: true };
    }

    try {
      if (event === "transaction.created") {
        // The order already exists — it was created by the initiating purchase
        // request. Nothing to mutate; this event is audit-only.
        this.logger.log(`VTU transaction.created for order ${order.id} (request_id=${requestId}).`);
      } else if (event === "transaction.status_changed") {
        if (status === "completed-api") {
          if (order.status !== "DELIVERED") {
            await this.db.vtuOrder.update({
              where: { id: order.id },
              data: { status: "DELIVERED", providerName: order.providerName ?? DEFAULT_VTU_PROVIDER }
            });
          }
        } else if (status === "refunded-api") {
          // Double-refund risk: the provider may auto-refund on ITS side when a transaction
          // fails, and our own poll/requery path may already have reversed this
          // order's charge (see reverseVtuCharge / adminResolveOrder). Reuse the
          // exact same reversal method the poll path uses rather than a second
          // parallel reversal — it is idempotent because it only acts on a charge
          // still in status CHARGED, so if the poll path already reversed it, this
          // call is a no-op.
          await this.reverseVtuCharge(order.id, null);
          if (order.status !== "REVERSED" && order.status !== "REFUNDED") {
            await this.db.vtuOrder.update({
              where: { id: order.id },
              data: {
                status: "REVERSED",
                failureReason:
                  typeof payload["refund_reason"] === "string"
                    ? payload["refund_reason"]
                    : (order.failureReason ?? "Provider reported refunded-api via webhook.")
              }
            });
          }
        } else if (status === "processing-api") {
          this.logger.log(`VTU order ${order.id} still processing-api.`);
        } else {
          this.logger.warn(`VTU webhook: unrecognized status "${String(status)}" for order ${order.id}.`);
        }
      } else {
        this.logger.warn(`VTU webhook: unrecognized event "${event}" for order ${order.id}.`);
      }

      await this.db.providerWebhookEvent.update({
        where: { id: webhookEvent.id },
        data: { processed: true, processedAt: new Date(), relatedOrderId: order.id }
      });
      return { received: true, matched: true, processed: true };
    } catch (err) {
      this.logger.error(`VTU webhook ${providerEventId} processing failed: ${String(err)}`);
      await this.db.providerWebhookEvent.update({
        where: { id: webhookEvent.id },
        data: { processError: err instanceof Error ? err.message : String(err), relatedOrderId: order.id }
      });
      // Acknowledge with 200 regardless — the provider may add products/event shapes we
      // don't recognize yet, and this must never 500 into a retry storm. Genuine
      // failures are captured in ProviderWebhookEvent.processError for ops review.
      return { received: true, matched: true, processed: false };
    }
  }

  // ─── Data plan catalog ───────────────────────────────────────────────────────

  /**
   * Data plans a customer can actually buy right now.
   *
   * Scoped to the provider that would serve each network, because buyData
   * resolves its adapter by route and then looks the plan up under
   * `providerName: adapter.name`. Listing every provider's catalog meant most
   * of what was shown could not be purchased at all — a plan belonging to a
   * provider the router would not pick fails with "Data plan not found or
   * unavailable" after the customer has chosen it. The catalog holds hundreds of
   * rows for providers that are seeded but have no credentials.
   *
   * Selection uses the same path as purchase, so the list and the buy agree even
   * as health or priority moves traffic between providers.
   */
  async listDataPlans(network?: VtuNetwork) {
    await this.ensureDefaultCatalog();

    const networks: VtuNetwork[] = network ? [network] : [...VTU_NETWORKS];
    const plansByNetwork = await Promise.all(
      networks.map(async (net) => {
        let providerName: string;
        try {
          providerName = (await this.selectAdapter("DATA", net)).name;
        } catch {
          return [];
        }

        if (isProductionRuntime() && isMockProviderName(providerName)) {
          return [];
        }

        return this.db.vtuDataPlan.findMany({
          where: {
            active: true,
            network: net,
            providerName,
            ...(isProductionRuntime() ? { displayName: { not: { contains: "Mock" } } } : {})
          },
          orderBy: { costMinor: "asc" }
        });
      })
    );

    return plansByNetwork.flat();
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
      for (const [productType, provider] of [
        ["AIRTIME", DEFAULT_VTU_PROVIDER],
        ["DATA", DEFAULT_DATA_PROVIDER]
      ] as const) {
        const existing = await db.vtuProviderRoute.findFirst({
          where: { productType, network, provider }
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
              provider,
              priority: 10,
              active: true,
              note: "Default production route"
            }
          });
        }
      }
    }

    for (const [provider, priority] of Object.entries(BILLS_ROUTE_PRIORITY)) {
      for (const productType of ["CABLE", "ELECTRICITY", "BETTING"] as const) {
        const existing = await db.vtuProviderRoute.findFirst({
          where: { productType, network: null, provider }
        });

        if (existing) {
          if (existing.priority !== priority) {
            await db.vtuProviderRoute.update({ where: { id: existing.id }, data: { priority } });
          }
          await db.vtuProviderRoute.update({ where: { id: existing.id }, data: { active: true } });
        } else {
          await db.vtuProviderRoute.create({
            data: {
              id: uid("vroute"),
              productType,
              network: null,
              provider,
              priority,
              active: true,
              note: "Default production route"
            }
          });
        }
      }
    }

    for (const [provider, priority] of Object.entries(EDUCATION_ROUTE_PRIORITY)) {
      const existing = await db.vtuProviderRoute.findFirst({
        where: { productType: "EDUCATION", network: null, provider }
      });

      if (existing) {
        if (existing.priority !== priority) {
          await db.vtuProviderRoute.update({ where: { id: existing.id }, data: { priority } });
        }
      } else {
        await db.vtuProviderRoute.create({
          data: {
            id: uid("vroute"),
            productType: "EDUCATION",
            network: null,
            provider,
            priority,
            active: true,
            note: `Default education route (${provider})`
          }
        });
      }
    }
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
  // separate routing query with no network filter. ClubKonnect is primary for all
  // Nigerian DISCOs and cable billers; VTpass is configured as fallback via
  // VtuProviderRoute rows with productType=ELECTRICITY / productType=CABLE and no network.

  private async selectBillsAdapter(
    productType: "ELECTRICITY" | "CABLE" | "BETTING" | "EDUCATION",
    db: DbClient = this.db
  ): Promise<VtuProviderAdapter> {
    // Try cost-comparison router first.
    const configCount = await db.vtuProviderConfig.count({
      where: { status: { in: ["ACTIVE", "PRODUCTION_READY"] } }
    });

    if (configCount > 0) {
      try {
        const result = await this.vtuRouter.route({ productType });
        return this.buildAdapter(result.winner.providerName);
      } catch {
        // No eligible provider from router — fall through.
      }
    }

    // Legacy: VtuProviderRoute priority table (network=null for bills).
    const routes = await db.vtuProviderRoute.findMany({
      where: { productType: productType as never, network: null, active: true },
      orderBy: { priority: "asc" }
    });

    if (routes.length === 0) {
      if (isProductionRuntime()) {
        throw new BadRequestException(`No VTU provider route is configured for ${productType}.`);
      }
      return this.buildAdapter(DEFAULT_VTU_PROVIDER);
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

    if (!healthy && isProductionRuntime()) {
      throw new BadRequestException(`All VTU providers for ${productType} are currently unavailable.`);
    }

    return this.buildAdapter(healthy?.provider ?? DEFAULT_VTU_PROVIDER);
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
    if (!dto.phoneNumber.match(/^\+?[1-9]\d{6,14}$/)) {
      throw new BadRequestException("Invalid phone number format.");
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
        phoneNumber: dto.phoneNumber,
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

  async listCablePackages(cableProvider?: string) {
    await this.ensureDefaultCablePackages();
    let providerName: string;
    try {
      providerName = (await this.selectBillsAdapter("CABLE")).name;
    } catch {
      return [];
    }
    if (isProductionRuntime() && isMockProviderName(providerName)) {
      return [];
    }

    return this.db.vtuCablePackage.findMany({
      where: {
        active: true,
        providerName,
        ...(cableProvider ? { cableProvider } : {}),
        ...(isProductionRuntime() ? { displayName: { not: { contains: "Mock" } } } : {})
      },
      orderBy: [{ cableProvider: "asc" }, { costMinor: "asc" }]
    });
  }

  async verifyCable(dto: { provider: string; smartCardNumber: string }) {
    if (!featureFlags.billsCable) {
      throw new BadRequestException("Cable subscriptions are not yet available.");
    }

    const adapter = await this.selectBillsAdapter("CABLE");
    if (!adapter.verifyCableCustomer) {
      throw new BadRequestException("Selected provider does not support smartcard verification.");
    }

    return adapter.verifyCableCustomer({
      provider: dto.provider,
      smartCardNumber: dto.smartCardNumber
    });
  }

  async buyCable(ctx: AuthenticatedRequestContext, dto: BuyCableDto) {
    if (!featureFlags.billsCable) {
      throw new BadRequestException("Cable subscriptions are not yet available.");
    }

    const { workspaceId } = ctx;
    if (!dto.provider) throw new BadRequestException("provider is required.");
    if (!dto.smartCardNumber.match(/^\d{5,12}$/)) {
      throw new BadRequestException("Invalid smartcard/IUC number format.");
    }
    if (!dto.packageCode) throw new BadRequestException("packageCode is required.");
    if (!dto.phoneNumber.match(/^\+?[1-9]\d{6,14}$/)) {
      throw new BadRequestException("Invalid phone number format.");
    }

    const adapter = await this.selectBillsAdapter("CABLE");
    if (!adapter.purchaseCable) {
      throw new BadRequestException("Selected provider does not support cable purchase.");
    }

    await this.ensureDefaultCablePackages();
    const pkg = await this.db.vtuCablePackage.findFirst({
      where: {
        providerName: adapter.name,
        packageCode: dto.packageCode,
        cableProvider: dto.provider,
        active: true
      }
    });
    if (!pkg) throw new NotFoundException("Cable package not found or unavailable.");

    // Pre-flight verification before charging the wallet.
    if (adapter.verifyCableCustomer) {
      const validation = await adapter.verifyCableCustomer({
        provider: dto.provider,
        smartCardNumber: dto.smartCardNumber
      });
      if (!validation.valid) {
        throw new BadRequestException(
          "Smartcard verification failed. Verify the smartcard/IUC number and try again."
        );
      }
    }

    const chargeMinor = await this.applyMarkup(pkg.costMinor, { productType: "CABLE" });
    const orderId = uid("vtu");
    const reference = adapter.buildReference({ id: orderId, createdAt: new Date() });
    const cardMasked = dto.smartCardNumber.slice(0, 3) + "****" + dto.smartCardNumber.slice(-2);

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
          productType: "CABLE",
          msisdnMasked: cardMasked,
          msisdnEncrypted: dto.smartCardNumber,
          amountMinor: chargeMinor,
          costMinor: pkg.costMinor,
          currency: "NGN",
          providerName: adapter.name,
          providerReference: reference,
          status: "SUBMITTED",
          idempotencyKey: `vtu_order_${orderId}`,
          metadata: { cableProvider: dto.provider, packageCode: dto.packageCode }
        }
      });

      await this.debitWallet(
        wallet.id,
        workspaceId,
        chargeMinor,
        `Cable ${pkg.displayName} → ${cardMasked}`,
        orderId,
        tx
      );

      return newOrder;
    });

    // Submit outside the transaction — network timeout must not roll back the debit.
    try {
      const result = await adapter.purchaseCable({
        provider: dto.provider,
        smartCardNumber: dto.smartCardNumber,
        packageCode: dto.packageCode,
        phoneNumber: dto.phoneNumber,
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
        await this.queue.enqueueVtuPollStatus(order.id);
      }
    } catch (err) {
      this.logger.error(`VTU cable submit error for ${order.id}: ${String(err)}`);
      await this.db.vtuOrder.update({
        where: { id: order.id },
        data: { status: "AMBIGUOUS" }
      });
      await this.queue.enqueueVtuOpsReview(order.id);
    }

    return this.db.vtuOrder.findUniqueOrThrow({ where: { id: order.id } });
  }

  private async ensureDefaultCablePackages(db: DbClient = this.db) {
    const existing = await db.vtuCablePackage.count({
      where: { providerName: DEFAULT_VTU_PROVIDER }
    });
    if (existing > 0) return;

    await Promise.all(
      DEFAULT_CABLE_PACKAGES.map((pkg) =>
        db.vtuCablePackage.upsert({
          where: {
            providerName_packageCode: {
              providerName: DEFAULT_VTU_PROVIDER,
              packageCode: pkg.packageCode
            }
          },
          update: {},
          create: {
            id: uid("vcpkg"),
            providerName: DEFAULT_VTU_PROVIDER,
            cableProvider: pkg.cableProvider,
            packageCode: pkg.packageCode,
            displayName: pkg.displayName,
            costMinor: pkg.costMinor,
            currency: "NGN",
            active: true
          }
        })
      )
    );
  }

  // ─── Bet funding ──────────────────────────────────────────────────────────────

  async verifyBetting(dto: { bettingCompany: string; customerId: string }) {
    if (!featureFlags.billsBetting) {
      throw new BadRequestException("Bet funding is not yet available.");
    }

    const adapter = await this.selectBillsAdapter("BETTING");
    if (!adapter.verifyBettingCustomer) {
      throw new BadRequestException("Selected provider does not support betting verification.");
    }

    return adapter.verifyBettingCustomer({
      bettingCompany: dto.bettingCompany,
      customerId: dto.customerId
    });
  }

  async buyBetFunding(ctx: AuthenticatedRequestContext, dto: BuyBetFundingDto) {
    if (!featureFlags.billsBetting) {
      throw new BadRequestException("Bet funding is not yet available.");
    }

    const { workspaceId } = ctx;
    if (!dto.bettingCompany) throw new BadRequestException("bettingCompany is required.");
    if (!dto.customerId) throw new BadRequestException("customerId is required.");
    if (dto.amountMinor < 10_000) {
      throw new BadRequestException("Minimum bet funding is ₦100.");
    }

    const adapter = await this.selectBillsAdapter("BETTING");
    if (!adapter.purchaseBetFunding) {
      throw new BadRequestException("Selected provider does not support bet funding.");
    }

    if (adapter.verifyBettingCustomer) {
      const validation = await adapter.verifyBettingCustomer({
        bettingCompany: dto.bettingCompany,
        customerId: dto.customerId
      });
      if (!validation.valid) {
        throw new BadRequestException(
          "Betting account verification failed. Verify the customer ID and try again."
        );
      }
    }

    const chargeMinor = await this.applyMarkup(dto.amountMinor, { productType: "BETTING" });
    const orderId = uid("vtu");
    const reference = adapter.buildReference({ id: orderId, createdAt: new Date() });
    const customerIdMasked =
      dto.customerId.length > 4
        ? dto.customerId.slice(0, 2) + "****" + dto.customerId.slice(-2)
        : "****";

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
          productType: "BETTING",
          msisdnMasked: customerIdMasked,
          msisdnEncrypted: dto.customerId,
          amountMinor: chargeMinor,
          costMinor: dto.amountMinor,
          currency: "NGN",
          providerName: adapter.name,
          providerReference: reference,
          status: "SUBMITTED",
          idempotencyKey: `vtu_order_${orderId}`,
          metadata: { bettingCompany: dto.bettingCompany }
        }
      });

      await this.debitWallet(
        wallet.id,
        workspaceId,
        chargeMinor,
        `Bet funding ${dto.bettingCompany} ₦${(dto.amountMinor / 100).toFixed(0)} → ${customerIdMasked}`,
        orderId,
        tx
      );

      return newOrder;
    });

    try {
      const result = await adapter.purchaseBetFunding({
        bettingCompany: dto.bettingCompany,
        customerId: dto.customerId,
        amountMinor: dto.amountMinor,
        reference: order.providerReference!
      });

      const finalStatus =
        result.status === "DELIVERED"
          ? "DELIVERED"
          : result.status === "SUBMITTED"
            ? "SUBMITTED"
            : "AMBIGUOUS";

      await this.db.vtuOrder.update({ where: { id: order.id }, data: { status: finalStatus } });

      if (finalStatus === "AMBIGUOUS") {
        await this.queue.enqueueVtuOpsReview(order.id);
      } else if (finalStatus === "SUBMITTED") {
        await this.queue.enqueueVtuPollStatus(order.id);
      }
    } catch (err) {
      this.logger.error(`VTU bet funding submit error for ${order.id}: ${String(err)}`);
      await this.db.vtuOrder.update({ where: { id: order.id }, data: { status: "AMBIGUOUS" } });
      await this.queue.enqueueVtuOpsReview(order.id);
    }

    return this.db.vtuOrder.findUniqueOrThrow({ where: { id: order.id } });
  }

  // ─── Education (WAEC / JAMB) ────────────────────────────────────────────────

  async verifyJamb(dto: { profileId: string }) {
    if (!featureFlags.billsEducation) {
      throw new BadRequestException("Education services are not yet available.");
    }

    const adapter = await this.selectBillsAdapter("EDUCATION");
    if (!adapter.verifyJambProfile) {
      throw new BadRequestException("Selected provider does not support JAMB verification.");
    }

    return adapter.verifyJambProfile({ profileId: dto.profileId });
  }

  async buyEducation(ctx: AuthenticatedRequestContext, dto: BuyEducationDto) {
    if (!featureFlags.billsEducation) {
      throw new BadRequestException("Education services are not yet available.");
    }

    const { workspaceId } = ctx;
    if (!dto.examType) throw new BadRequestException("examType is required.");
    if (!dto.phoneNumber.match(/^\+?[1-9]\d{6,14}$/)) {
      throw new BadRequestException("Invalid phone number format.");
    }

    const isJamb = dto.examType === "de" || dto.examType.startsWith("utme");
    const adapter = await this.selectBillsAdapter("EDUCATION");
    if (!adapter.purchaseEducation) {
      throw new BadRequestException("Selected provider does not support education purchases.");
    }

    // Price lookup BEFORE JAMB profile verification. Verification is a live
    // provider call, and an exam type we cannot price is going to fail either
    // way — no reason to spend a round trip (and make the customer wait) before
    // telling them so.
    await this.ensureDefaultEducationPlans();
    const plan = await this.db.vtuEducationPlan.findFirst({
      where: { providerName: adapter.name, productCode: dto.examType, active: true }
    });
    if (!plan) {
      // Deliberately specific: "not found" here nearly always means the exam
      // type is real and supported by the adapter but has no price yet — either
      // education_catalog_sync has not run for TopupWizard, or the provider
      // requires a manual price entry (SirpData). Both are operator-actionable.
      throw new NotFoundException(
        `No price is available for exam type "${dto.examType}" from ${adapter.name}. ` +
          `Run education_catalog_sync for this provider, or select a different exam type.`
      );
    }

    if (isJamb) {
      if (!dto.profileId) throw new BadRequestException("profileId is required for JAMB.");
      if (adapter.verifyJambProfile) {
        const validation = await adapter.verifyJambProfile({ profileId: dto.profileId });
        if (!validation.valid) {
          throw new BadRequestException(
            "JAMB profile verification failed. Verify the profile ID and try again."
          );
        }
      }
    }

    const chargeMinor = await this.applyMarkup(plan.costMinor, { productType: "EDUCATION" });
    const orderId = uid("vtu");
    const reference = adapter.buildReference({ id: orderId, createdAt: new Date() });
    const phoneMasked = dto.phoneNumber.slice(0, 4) + "****" + dto.phoneNumber.slice(-3);

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
          productType: "EDUCATION",
          msisdnMasked: phoneMasked,
          msisdnEncrypted: dto.phoneNumber,
          amountMinor: chargeMinor,
          costMinor: plan.costMinor,
          currency: "NGN",
          providerName: adapter.name,
          providerReference: reference,
          status: "SUBMITTED",
          idempotencyKey: `vtu_order_${orderId}`,
          metadata: { examType: dto.examType, ...(dto.profileId ? { profileId: dto.profileId } : {}) }
        }
      });

      await this.debitWallet(
        wallet.id,
        workspaceId,
        chargeMinor,
        `Education ${plan.displayName} → ${phoneMasked}`,
        orderId,
        tx
      );

      return newOrder;
    });

    try {
      const result = await adapter.purchaseEducation({
        examType: dto.examType,
        phoneNumber: dto.phoneNumber,
        ...(dto.profileId ? { profileId: dto.profileId } : {}),
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
          ...(result.pin
            ? { metadata: { examType: dto.examType, pin: result.pin, serialNumber: result.serialNumber } }
            : {})
        }
      });

      if (finalStatus === "AMBIGUOUS") {
        await this.queue.enqueueVtuOpsReview(order.id);
      } else if (finalStatus === "SUBMITTED") {
        await this.queue.enqueueVtuPollStatus(order.id);
      }
    } catch (err) {
      this.logger.error(`VTU education submit error for ${order.id}: ${String(err)}`);
      await this.db.vtuOrder.update({ where: { id: order.id }, data: { status: "AMBIGUOUS" } });
      await this.queue.enqueueVtuOpsReview(order.id);
    }

    return this.db.vtuOrder.findUniqueOrThrow({ where: { id: order.id } });
  }

  async listBettingCompanies() {
    await this.ensureDefaultBettingCompanies();
    return this.db.vtuBettingCompany.findMany({
      where: { active: true },
      orderBy: { displayName: "asc" }
    });
  }

  async listEducationPlans() {
    await this.ensureDefaultEducationPlans();
    const plans = await this.db.vtuEducationPlan.findMany({
      where: { active: true, providerName: { in: ["topupwizard", "sirpdata"] } },
      orderBy: { costMinor: "asc" }
    });
    const bps = await this.pricingRules.resolveMarkupBps("VTU", { productType: "EDUCATION" }, MARKUP_BPS);
    return plans.map((p) => ({ ...p, costMinor: Math.ceil(p.costMinor * (1 + bps / 10_000)) }));
  }

  private async ensureDefaultBettingCompanies(db: DbClient = this.db) {
    const existing = await db.vtuBettingCompany.count({
      where: { providerName: DEFAULT_VTU_PROVIDER }
    });
    if (existing > 0) return;

    await Promise.all(
      BETTING_COMPANIES.map((company) =>
        db.vtuBettingCompany.upsert({
          where: {
            providerName_productCode: {
              providerName: DEFAULT_VTU_PROVIDER,
              productCode: company.code
            }
          },
          update: {},
          create: {
            id: uid("vbet"),
            providerName: DEFAULT_VTU_PROVIDER,
            productCode: company.code,
            displayName: company.name,
            active: true
          }
        })
      )
    );
  }

  private async ensureDefaultEducationPlans(db: DbClient = this.db) {
    const existing = await db.vtuEducationPlan.count({
      where: { providerName: "topupwizard" }
    });
    if (existing > 0) return;

    const adapter = this.buildAdapter("topupwizard");
    if (!adapter.listEducationPlans) return;

    const offers = await adapter.listEducationPlans();
    await Promise.all(
      offers.map((plan) =>
        db.vtuEducationPlan.upsert({
          where: {
            providerName_productCode: {
              providerName: "topupwizard",
              productCode: plan.productCode
            }
          },
          update: {
            displayName: plan.displayName,
            costMinor: plan.costMinor,
            currency: plan.currency,
            active: true,
            pricingSource: "SYNC"
          },
          create: {
            id: uid("vedu"),
            providerName: "topupwizard",
            productCode: plan.productCode,
            displayName: plan.displayName,
            costMinor: plan.costMinor,
            currency: plan.currency,
            active: true,
            pricingSource: "SYNC"
          }
        })
      )
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
        : { in: ["ELECTRICITY", "CABLE", "BETTING", "EDUCATION"] as never[] },
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

  // ─── Admin: Provider Control Center ─────────────────────────────────────────

  async adminListProviderConfigs() {
    const [configs, balances, healthRows] = await Promise.all([
      this.db.vtuProviderConfig.findMany({ orderBy: { priority: "asc" } }),
      this.db.vtuProviderBalance.findMany({ orderBy: { checkedAt: "desc" } }),
      this.db.providerHealth.findMany({
        where: { domain: "VTU" },
        orderBy: { checkedAt: "desc" },
        distinct: ["providerName"]
      })
    ]);

    const balanceMap = new Map(balances.map((b) => [b.providerName, b]));
    const healthMap = new Map(healthRows.map((h) => [h.providerName, h]));

    return configs.map((cfg) => ({
      ...cfg,
      balance: balanceMap.get(cfg.providerName) ?? null,
      health: healthMap.get(cfg.providerName) ?? null
    }));
  }

  async adminUpdateProviderConfig(
    providerName: string,
    dto: {
      status?: string;
      maintenanceMode?: boolean;
      minBalanceMinor?: number;
      maxTransactionMinor?: number;
      costWeight?: number;
      successRateWeight?: number;
      latencyWeight?: number;
      balanceWeight?: number;
      trafficAllocationPct?: number;
      enabledServices?: string[];
    },
    ctx: AuthenticatedRequestContext
  ) {
    const cfg = await this.db.vtuProviderConfig.findUnique({ where: { providerName } });
    if (!cfg) throw new NotFoundException(`Provider config not found for "${providerName}".`);

    const updated = await this.db.vtuProviderConfig.update({
      where: { providerName },
      data: {
        ...(dto.status !== undefined ? { status: dto.status as never } : {}),
        ...(dto.maintenanceMode !== undefined ? { maintenanceMode: dto.maintenanceMode } : {}),
        ...(dto.minBalanceMinor !== undefined ? { minBalanceMinor: dto.minBalanceMinor } : {}),
        ...(dto.maxTransactionMinor !== undefined
          ? { maxTransactionMinor: dto.maxTransactionMinor }
          : {}),
        ...(dto.costWeight !== undefined ? { costWeight: dto.costWeight } : {}),
        ...(dto.successRateWeight !== undefined ? { successRateWeight: dto.successRateWeight } : {}),
        ...(dto.latencyWeight !== undefined ? { latencyWeight: dto.latencyWeight } : {}),
        ...(dto.balanceWeight !== undefined ? { balanceWeight: dto.balanceWeight } : {}),
        ...(dto.trafficAllocationPct !== undefined
          ? { trafficAllocationPct: dto.trafficAllocationPct }
          : {}),
        ...(dto.enabledServices !== undefined ? { enabledServices: dto.enabledServices } : {})
      }
    });

    await this.db.auditLog.create({
      data: {
        id: uid("aud"),
        action: "VTU_PROVIDER_CONFIG_UPDATED",
        actorUserId: ctx.userId,
        entityType: "VtuProviderConfig",
        entityId: cfg.id,
        metadata: dto
      }
    });

    return updated;
  }

  async adminGetProviderBalance(providerName: string) {
    const balance = await this.db.vtuProviderBalance.findUnique({ where: { providerName } });
    if (!balance) throw new NotFoundException(`No balance snapshot for provider "${providerName}".`);
    return balance;
  }

  async adminGetRoutingMatrix() {
    const productTypes = ["AIRTIME", "DATA", "ELECTRICITY", "CABLE", "BETTING", "EDUCATION"];
    const networks = ["MTN", "GLO", "AIRTEL", "NINE_MOBILE"];

    const matrix: Array<{
      productType: string;
      network: string | null;
      winner: string | null;
      allCandidates: Array<{ providerName: string; score: number; costMinor: number }>;
    }> = [];

    for (const productType of productTypes) {
      const isNetworked = productType === "AIRTIME" || productType === "DATA";
      const networkList = isNetworked ? networks : [null];

      for (const network of networkList) {
        try {
          const result = await this.vtuRouter.route({
            productType,
            ...(network ? { network } : {})
          });
          matrix.push({
            productType,
            network,
            winner: result.winner.providerName,
            allCandidates: result.allCandidates.map((c) => ({
              providerName: c.providerName,
              score: c.score,
              costMinor: c.costMinor
            }))
          });
        } catch {
          matrix.push({ productType, network, winner: null, allCandidates: [] });
        }
      }
    }

    return matrix;
  }

  // ─── Admin: canonical SKU management ─────────────────────────────────────────

  async adminListCanonicalSkus(query: { network?: string; category?: string }) {
    const skus = await this.db.vtuCanonicalSku.findMany({
      where: {
        ...(query.network ? { network: query.network } : {}),
        ...(query.category ? { category: query.category } : {})
      },
      orderBy: [{ network: "asc" }, { sizeMb: "asc" }, { validityDays: "asc" }]
    });

    // For each SKU, load its provider mappings.
    const skuIds = skus.map((s) => s.id);
    const mappings = await this.db.vtuProviderSkuMapping.findMany({
      where: { canonicalSkuId: { in: skuIds } },
      orderBy: { costMinor: "asc" }
    });
    const mappingsBySkuId = new Map<string, typeof mappings>();
    for (const m of mappings) {
      const list = mappingsBySkuId.get(m.canonicalSkuId) ?? [];
      list.push(m);
      mappingsBySkuId.set(m.canonicalSkuId, list);
    }

    return skus.map((sku) => ({
      ...sku,
      providerMappings: mappingsBySkuId.get(sku.id) ?? []
    }));
  }

  async adminApproveSkuMapping(mappingId: string, approved: boolean, ctx: AuthenticatedRequestContext) {
    const mapping = await this.db.vtuProviderSkuMapping.findUnique({ where: { id: mappingId } });
    if (!mapping) throw new NotFoundException("SKU mapping not found.");

    const updated = await this.db.vtuProviderSkuMapping.update({
      where: { id: mappingId },
      data: { adminApproved: approved }
    });

    await this.db.auditLog.create({
      data: {
        id: uid("aud"),
        actorUserId: ctx.userId,
        action: approved ? "VTU_SKU_MAPPING_APPROVED" : "VTU_SKU_MAPPING_REJECTED",
        entityType: "VtuProviderSkuMapping",
        entityId: mappingId,
        metadata: {
          providerName: mapping.providerName,
          providerSku: mapping.providerSku,
          costMinor: mapping.costMinor,
          approved
        }
      }
    });

    return updated;
  }

  async adminUpdateSkuMapping(
    mappingId: string,
    patch: { costMinor?: number; active?: boolean; adminApproved?: boolean },
    ctx: AuthenticatedRequestContext
  ) {
    const mapping = await this.db.vtuProviderSkuMapping.findUnique({ where: { id: mappingId } });
    if (!mapping) throw new NotFoundException("SKU mapping not found.");

    if (patch.costMinor !== undefined && (!Number.isInteger(patch.costMinor) || patch.costMinor <= 0)) {
      throw new BadRequestException("costMinor must be a positive integer.");
    }

    const updated = await this.db.vtuProviderSkuMapping.update({
      where: { id: mappingId },
      data: {
        ...(patch.costMinor !== undefined ? { costMinor: patch.costMinor, pricingSourceType: "MANUAL_OVERRIDE" } : {}),
        ...(patch.active !== undefined ? { active: patch.active } : {}),
        ...(patch.adminApproved !== undefined ? { adminApproved: patch.adminApproved } : {})
      }
    });

    await this.db.auditLog.create({
      data: {
        id: uid("aud"),
        actorUserId: ctx.userId,
        action: "VTU_SKU_MAPPING_UPDATED",
        entityType: "VtuProviderSkuMapping",
        entityId: mappingId,
        metadata: patch
      }
    });

    return updated;
  }

  // ─── Admin: education plan pricing ───────────────────────────────────────────
  //
  // Education is the one bills vertical where a provider may be unable to price
  // itself. education_catalog_sync covers ClubKonnect and TopupWizard, which both
  // expose a catalog endpoint. SirpData does not: its documented API returns the
  // cost only as `amountCharged` on the purchase response, so the price is not
  // knowable until after the money is spent. Since buyEducation requires a plan
  // row before it will charge anything, SirpData can never serve an order without
  // a price entered here.
  //
  // A MANUAL row is authoritative — the sync will neither reprice nor deactivate
  // it (see processEducationCatalogSync).

  async adminListEducationPlans(query: { providerName?: string } = {}) {
    return this.db.vtuEducationPlan.findMany({
      where: query.providerName ? { providerName: query.providerName } : {},
      orderBy: [{ providerName: "asc" }, { productCode: "asc" }]
    });
  }

  async adminUpsertEducationPlan(
    input: {
      providerName: string;
      productCode: string;
      displayName: string;
      costMinor: number;
      currency?: string;
      active?: boolean;
    },
    ctx: AuthenticatedRequestContext
  ) {
    const providerName = input.providerName?.trim().toLowerCase();
    const productCode = input.productCode?.trim();

    if (!providerName) throw new BadRequestException("providerName is required.");
    if (!productCode) throw new BadRequestException("productCode is required.");
    if (!input.displayName?.trim()) throw new BadRequestException("displayName is required.");
    if (!Number.isInteger(input.costMinor) || input.costMinor <= 0) {
      throw new BadRequestException("costMinor must be a positive integer of minor units (kobo).");
    }

    // Reject an exam type the provider does not sell at the point it is
    // configured, rather than letting a customer discover it at purchase.
    const known = PROVIDER_EDUCATION_CODES[providerName];
    if (known && !known.includes(productCode)) {
      throw new BadRequestException(
        `${providerName} does not sell education product "${productCode}". ` +
          `Supported: ${known.join(", ")}.`
      );
    }

    const plan = await this.db.vtuEducationPlan.upsert({
      where: { providerName_productCode: { providerName, productCode } },
      update: {
        displayName: input.displayName.trim(),
        costMinor: input.costMinor,
        ...(input.currency ? { currency: input.currency } : {}),
        ...(input.active !== undefined ? { active: input.active } : {}),
        pricingSource: "MANUAL"
      },
      create: {
        id: uid("vedu"),
        providerName,
        productCode,
        displayName: input.displayName.trim(),
        costMinor: input.costMinor,
        currency: input.currency ?? "NGN",
        active: input.active ?? true,
        pricingSource: "MANUAL"
      }
    });

    await this.db.auditLog.create({
      data: {
        id: uid("aud"),
        actorUserId: ctx.userId,
        action: "VTU_EDUCATION_PLAN_PRICED",
        entityType: "VtuEducationPlan",
        entityId: plan.id,
        metadata: { providerName, productCode, costMinor: input.costMinor, active: plan.active }
      }
    });

    return plan;
  }

  async adminDeleteEducationPlan(id: string, ctx: AuthenticatedRequestContext) {
    const plan = await this.db.vtuEducationPlan.findUnique({ where: { id } });
    if (!plan) throw new NotFoundException("Education plan not found.");

    // Deactivate rather than delete: a synced row would simply reappear on the
    // next run, and an order history referencing it stays readable either way.
    const updated = await this.db.vtuEducationPlan.update({
      where: { id },
      data: { active: false }
    });

    await this.db.auditLog.create({
      data: {
        id: uid("aud"),
        actorUserId: ctx.userId,
        action: "VTU_EDUCATION_PLAN_DEACTIVATED",
        entityType: "VtuEducationPlan",
        entityId: id,
        metadata: { providerName: plan.providerName, productCode: plan.productCode }
      }
    });

    return updated;
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
          : { in: ["ELECTRICITY", "CABLE", "BETTING", "EDUCATION"] as never[] },
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
