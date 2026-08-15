import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

import { Prisma, type PrismaClient } from "@fliptrybe/database";
import type { VtuNetwork } from "@fliptrybe/providers";

import { PrismaService } from "../prisma.service";
import type { AuthenticatedRequestContext } from "../request-context";
import { OutgoingWebhooksService } from "../webhooks/outgoing-webhooks.service";
import { AIRTIME_EPIN_DENOMINATIONS_MINOR, VtuService } from "../vtu/vtu.service";

type VoucherProductSeed = {
  id: string;
  name: string;
  category: "CAMPAIGN" | "TELECOM";
  handler: "WALLET_CREDIT" | "PROVIDER_EPIN";
  provider?: string;
  providerServiceId?: string;
  targetWalletType?: "CAMPAIGN";
  inputSchema: Record<string, unknown>;
  denominationsMinor?: number[];
};

const CAMPAIGN_CREDIT_VOUCHER_AMOUNT_MINOR = 500_000;

const productSeeds: VoucherProductSeed[] = [
  {
    id: "campaign-credit",
    name: "Campaign Credit",
    category: "CAMPAIGN",
    handler: "WALLET_CREDIT",
    targetWalletType: "CAMPAIGN",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    denominationsMinor: [CAMPAIGN_CREDIT_VOUCHER_AMOUNT_MINOR]
  },
  {
    id: "airtime-epin-voucher",
    name: "Airtime EPIN Voucher",
    category: "TELECOM",
    handler: "PROVIDER_EPIN",
    provider: "clubkonnect",
    providerServiceId: "airtime-epin",
    inputSchema: {
      type: "object",
      properties: {
        network: { type: "string", enum: ["MTN", "GLO", "AIRTEL", "NINE_MOBILE"] },
        // enum is derived from denominationsMinor when the catalog is served.
        valueMinor: { type: "number" }
      },
      required: ["network", "valueMinor"],
      additionalProperties: false
    },
    denominationsMinor: [...AIRTIME_EPIN_DENOMINATIONS_MINOR]
  },
  {
    id: "data-epin-voucher",
    name: "Data EPIN Voucher",
    category: "TELECOM",
    handler: "PROVIDER_EPIN",
    provider: "clubkonnect",
    providerServiceId: "data-epin",
    inputSchema: {
      type: "object",
      properties: {
        network: { type: "string", enum: ["MTN", "GLO", "AIRTEL", "NINE_MOBILE"] },
        providerPlanId: { type: "string" }
      },
      required: ["network", "providerPlanId"],
      additionalProperties: false
    }
  }
];

function baseUrl() {
  const value = process.env.PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return value.replace(/\/+$/, "");
}

function voucherSecretKey() {
  return createHash("sha256")
    .update(process.env.VOUCHER_PIN_SECRET ?? process.env.SESSION_SECRET ?? "fliptrybe-voucher-secret")
    .digest();
}

function encryptPin(pin: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", voucherSecretKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(pin, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(".");
}

function decryptPin(payload: string) {
  const [ivValue, tagValue, ciphertextValue] = payload.split(".");

  if (!ivValue || !tagValue || !ciphertextValue) {
    throw new BadRequestException("Voucher PIN payload is invalid.");
  }

  const decipher = createDecipheriv("aes-256-gcm", voucherSecretKey(), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextValue, "base64url")),
    decipher.final()
  ]).toString("utf8");
}

function voucherPin() {
  return randomBytes(3).toString("hex").toUpperCase();
}

function serialNumber() {
  return `FTC${new Date().toISOString().slice(0, 10).replace(/-/g, "")}${randomBytes(3).toString("hex").toUpperCase()}`;
}

function id(prefix: string) {
  return `${prefix}_${randomBytes(6).toString("hex")}`;
}

function requireContext(context?: AuthenticatedRequestContext) {
  if (!context?.userId || !context.workspaceId) {
    throw new BadRequestException("Voucher engine requires an authenticated user and workspace context.");
  }

  return context;
}

function jsonValue(input?: Record<string, unknown>) {
  return input as Prisma.InputJsonValue;
}

type TransactionClient = Parameters<PrismaClient["$transaction"]>[0] extends (prisma: infer Client) => Promise<unknown>
  ? Client
  : never;

@Injectable()
export class VouchersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly webhooks: OutgoingWebhooksService,
    private readonly vtu: VtuService
  ) {}

  async listProducts() {
    await this.seedProducts();
    const products = await this.prisma.client.voucherProduct.findMany({
      where: { active: true },
      orderBy: [{ category: "asc" }, { name: "asc" }]
    });

    // Publish the enum from denominationsMinor rather than storing it twice —
    // the stored schema and the enforced rule would otherwise drift.
    return products.map((product) => {
      const schema = (product.inputSchema ?? {}) as Record<string, unknown>;
      const properties = schema["properties"] as Record<string, unknown> | undefined;
      const valueMinor = properties?.["valueMinor"] as Record<string, unknown> | undefined;

      if (!valueMinor || product.denominationsMinor.length === 0) {
        return product;
      }

      return {
        ...product,
        inputSchema: {
          ...schema,
          properties: {
            ...properties,
            valueMinor: { ...valueMinor, enum: product.denominationsMinor }
          }
        }
      };
    });
  }

  async createVoucher(
    input: { productId: string; giftNote?: string; redemptionDestination?: string; metadata?: Record<string, unknown> },
    context?: AuthenticatedRequestContext
  ) {
    const scope = requireContext(context);
    await this.seedProducts();

    const product = await this.prisma.client.voucherProduct.findFirst({
      where: { id: input.productId, active: true }
    });

    if (!product) {
      throw new NotFoundException("Voucher product not found.");
    }

    let pin: string;
    let sealedSerialNumber: string;
    let sealedMetadata: Record<string, unknown> | undefined = input.metadata;

    if (product.handler === "PROVIDER_EPIN") {
      const epin = await this.purchaseProviderEpin(product, input.metadata ?? {}, scope);
      pin = epin.pin;
      sealedSerialNumber = epin.serialNumber;
      sealedMetadata = {
        ...(input.metadata ?? {}),
        providerBatchNo: epin.batchNo,
        providerOrderId: epin.providerOrderId
      };
    } else {
      pin = voucherPin();
      sealedSerialNumber = serialNumber();
    }

    const voucher = await this.prisma.client.voucher.create({
      data: {
        serialNumber: sealedSerialNumber,
        pinEncrypted: encryptPin(pin),
        workspaceId: scope.workspaceId,
        productId: product.id,
        purchaserUserId: scope.userId,
        ownerUserId: scope.userId,
        status: "SEALED",
        activatedAt: new Date(),
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365),
        ...(input.giftNote === undefined ? {} : { giftNote: input.giftNote }),
        ...(input.redemptionDestination === undefined ? {} : { redemptionDestination: input.redemptionDestination }),
        ...(sealedMetadata === undefined ? {} : { metadata: jsonValue(sealedMetadata) })
      },
      include: { product: true, purchaser: true, owner: true, claimTokens: true }
    });

    return { ...voucher, pin };
  }

  async shareVoucher(voucherId: string, context?: AuthenticatedRequestContext) {
    const scope = requireContext(context);
    const voucher = await this.getOwnedVoucher(voucherId, scope.userId, scope.workspaceId);

    const existing = await this.prisma.client.voucherClaimToken.findFirst({
      where: { voucherId: voucher.id, claimedAt: null, tokenExpiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" }
    });

    const claim =
      existing ??
      (await this.prisma.client.voucherClaimToken.create({
        data: {
          token: randomBytes(12).toString("base64url"),
          voucherId: voucher.id,
          channel: "copy-link",
          tokenExpiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14)
        }
      }));

    return {
      claimUrl: `${baseUrl()}/claim/${claim.token}`,
      shareImageUrl: `${baseUrl()}/api/vouchers/${voucher.id}/share-image`,
      claim
    };
  }

  async getClaimPreview(token: string) {
    const claim = await this.prisma.client.voucherClaimToken.findUnique({
      where: { token },
      include: { voucher: { include: { product: true, purchaser: true, owner: true, claimTokens: true } } }
    });

    if (!claim || claim.tokenExpiresAt < new Date()) {
      throw new NotFoundException("Claim link not found.");
    }

    return {
      ...claim.voucher,
      sealedPinPreview: "••••••"
    };
  }

  async claimVoucher(token: string, context?: AuthenticatedRequestContext) {
    const scope = requireContext(context);

    const result = await this.prisma.client.$transaction(async (tx: TransactionClient) => {
      const record = await tx.voucherClaimToken.findUnique({
        where: { token },
        include: { voucher: true }
      });

      if (!record || record.tokenExpiresAt < new Date()) {
        throw new NotFoundException("Claim link not found.");
      }
      if (record.claimedAt) {
        return record;
      }

      await tx.voucherClaimToken.updateMany({
        where: { voucherId: record.voucherId, claimedAt: null, tokenExpiresAt: { gt: new Date() } },
        data: {
          claimedAt: new Date(),
          claimedByUserId: scope.userId
        }
      });

      const voucher = await tx.voucher.update({
        where: { id: record.voucherId },
        data: {
          ownerUserId: scope.userId,
          status: "CLAIMED"
        },
        include: { product: true, purchaser: true, owner: true, claimTokens: true }
      });

      return { ...record, voucher };
    });

    return result.voucher;
  }

  async revealVoucher(voucherId: string, context?: AuthenticatedRequestContext) {
    const scope = requireContext(context);
    const voucher = await this.getOwnedVoucher(voucherId, scope.userId, scope.workspaceId);

    const revealed = await this.prisma.client.voucher.update({
      where: { id: voucher.id },
      data: { status: "REVEALED", revealedAt: new Date() },
      include: { product: true, purchaser: true, owner: true, claimTokens: true }
    });

    return {
      ...revealed,
      pin: decryptPin(revealed.pinEncrypted)
    };
  }

  // ─── Admin: product configuration ─────────────────────────────────────────

  async adminListProducts() {
    return this.prisma.client.voucherProduct.findMany({
      orderBy: [{ category: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        category: true,
        handler: true,
        provider: true,
        providerServiceId: true,
        denominationsMinor: true,
        active: true
      }
    });
  }

  async adminSetDenominations(
    productId: string,
    denominationsMinor: number[],
    context?: AuthenticatedRequestContext
  ) {
    const product = await this.prisma.client.voucherProduct.findUnique({ where: { id: productId } });
    if (!product) {
      throw new NotFoundException(`Voucher product ${productId} not found.`);
    }

    if (!Array.isArray(denominationsMinor) || denominationsMinor.length === 0) {
      throw new BadRequestException("At least one denomination is required.");
    }

    for (const value of denominationsMinor) {
      if (!Number.isInteger(value) || value <= 0) {
        throw new BadRequestException("Every denomination must be a positive whole minor-unit amount.");
      }
    }

    const unique = [...new Set(denominationsMinor)].sort((a, b) => a - b);

    // A WALLET_CREDIT voucher pays out its single face value on redemption, so
    // a list would be ambiguous about what a holder actually receives.
    if (product.handler === "WALLET_CREDIT" && unique.length !== 1) {
      throw new BadRequestException(
        "A wallet-credit voucher takes exactly one denomination — its redemption value."
      );
    }

    // Fail here rather than at purchase: an EPIN denomination the upstream
    // provider does not mint would be configurable but unusable.
    if (product.providerServiceId === "airtime-epin") {
      const unsupported = unique.filter((v: number) => !AIRTIME_EPIN_DENOMINATIONS_MINOR.includes(v));
      if (unsupported.length > 0) {
        throw new BadRequestException(
          `Airtime EPIN providers only mint ${AIRTIME_EPIN_DENOMINATIONS_MINOR.map((v) => `₦${v / 100}`).join(", ")}. ` +
            `Unsupported: ${unsupported.map((v) => `₦${v / 100}`).join(", ")}.`
        );
      }
    }

    const updated = await this.prisma.client.voucherProduct.update({
      where: { id: productId },
      data: { denominationsMinor: unique }
    });

    await this.prisma.client.auditLog.create({
      data: {
        ...(context?.workspaceId ? { workspaceId: context.workspaceId } : {}),
        ...(context?.userId ? { actorUserId: context.userId } : {}),
        action: "voucher_product.denominations_updated",
        entityType: "VoucherProduct",
        entityId: productId,
        metadata: {
          name: product.name,
          previous: product.denominationsMinor,
          next: unique
        }
      }
    });

    return {
      id: updated.id,
      name: updated.name,
      denominationsMinor: updated.denominationsMinor
    };
  }

  async redeemVoucher(voucherId: string, input: Record<string, unknown>, context?: AuthenticatedRequestContext) {
    const scope = requireContext(context);
    const voucher = await this.getOwnedVoucher(voucherId, scope.userId, scope.workspaceId);

    if (voucher.status === "REDEEMED") {
      throw new ConflictException("Voucher has already been redeemed.");
    }
    if (voucher.status !== "REVEALED" && voucher.status !== "CLAIMED") {
      throw new ConflictException("Voucher must be revealed before redemption.");
    }

    const redeemed = await this.prisma.client.$transaction(async (tx: TransactionClient) => {
      if (voucher.product.handler === "WALLET_CREDIT") {
        const currency = "NGN";
        // Face value comes from the product's configured denomination; the
        // constant remains only as a fallback for a row that has none.
        const creditAmountMinor =
          voucher.product.denominationsMinor?.[0] ?? CAMPAIGN_CREDIT_VOUCHER_AMOUNT_MINOR;
        const wallet = await tx.wallet.upsert({
          where: { workspaceId_currency: { workspaceId: scope.workspaceId, currency } },
          update: {},
          create: { workspaceId: scope.workspaceId, currency }
        });

        await tx.ledgerEntry.create({
          data: {
            id: id("led"),
            walletId: wallet.id,
            kind: "CREDIT",
            amountMinor: creditAmountMinor,
            currency,
            reference: `voucher_redeem_${voucher.id}`,
            description: `Voucher redemption: ${voucher.product.name}`,
            idempotencyKey: `voucher_redeem_${voucher.id}`,
            sourceType: "Voucher",
            sourceId: voucher.id
          }
        });
      }

      // PROVIDER_EPIN vouchers already had their real PIN purchased and sealed at
      // creation time (see purchaseProviderEpin) — redemption is just the buyer
      // revealing/using a PIN they already hold, so no further provider call here.

      return tx.voucher.update({
        where: { id: voucher.id },
        data: {
          redemptionInput: jsonValue(input),
          status: "REDEEMED",
          redeemedAt: new Date()
        },
        include: { product: true, purchaser: true, owner: true, claimTokens: true }
      });
    });

    void this.webhooks.dispatchEvent(scope.workspaceId, "voucher.redeemed", {
      voucherId: redeemed.id,
      serialNumber: redeemed.serialNumber,
      productId: redeemed.productId,
      redeemedAt: redeemed.redeemedAt
    });

    return redeemed;
  }

  async listWalletVouchers(context?: AuthenticatedRequestContext) {
    const scope = requireContext(context);
    await this.seedProducts();

    return this.prisma.client.voucher.findMany({
      where: {
        workspaceId: scope.workspaceId,
        deletedAt: null
      },
      include: { product: true, purchaser: true, owner: true, claimTokens: true },
      orderBy: { createdAt: "desc" }
    });
  }

  // Buys a real ClubKonnect airtime/data EPIN and returns it for sealing into the voucher's
  // own pinEncrypted field — this is the moment the provider is actually charged and the
  // PIN is "printed"; redemption later is just the buyer using a PIN they already hold.
  private async purchaseProviderEpin(
    product: { providerServiceId: string | null; denominationsMinor?: number[] },
    rawInput: Record<string, unknown>,
    scope: AuthenticatedRequestContext
  ): Promise<{ pin: string; serialNumber: string; batchNo?: string; providerOrderId: string }> {
    const network = rawInput["network"];
    if (typeof network !== "string" || !["MTN", "GLO", "AIRTEL", "NINE_MOBILE"].includes(network)) {
      throw new BadRequestException("A valid network (MTN, GLO, AIRTEL, NINE_MOBILE) is required.");
    }

    if (product.providerServiceId === "airtime-epin") {
      const valueMinor = rawInput["valueMinor"];
      if (typeof valueMinor !== "number") {
        throw new BadRequestException("valueMinor is required for an airtime EPIN voucher.");
      }

      // The inputSchema enum was declarative only — nothing enforced it here, so
      // the configured denominations are checked explicitly.
      const allowed = product.denominationsMinor ?? [];
      if (allowed.length > 0 && !allowed.includes(valueMinor)) {
        throw new BadRequestException(
          `valueMinor must be one of ${allowed.map((v) => `₦${v / 100}`).join(", ")}.`
        );
      }

      const { order, epins } = await this.vtu.buyAirtimeEpin(scope, {
        network: network as VtuNetwork,
        valueMinor,
        quantity: 1
      });
      const epin = epins[0];
      if (!epin) throw new BadRequestException("Provider did not return an airtime EPIN.");

      return {
        pin: epin.pin,
        serialNumber: epin.serialNumber,
        ...(epin.batchNo === undefined ? {} : { batchNo: epin.batchNo }),
        providerOrderId: order.id
      };
    }

    if (product.providerServiceId === "data-epin") {
      const providerPlanId = rawInput["providerPlanId"];
      if (typeof providerPlanId !== "string" || !providerPlanId) {
        throw new BadRequestException("providerPlanId is required for a data EPIN voucher.");
      }

      const { order, epins } = await this.vtu.buyDataEpin(scope, {
        network: network as VtuNetwork,
        providerPlanId,
        quantity: 1
      });
      const epin = epins[0];
      if (!epin) throw new BadRequestException("Provider did not return a data EPIN.");

      return {
        pin: epin.pin,
        serialNumber: epin.serialNumber,
        ...(epin.batchNo === undefined ? {} : { batchNo: epin.batchNo }),
        providerOrderId: order.id
      };
    }

    throw new BadRequestException("This voucher product is not configured with a known EPIN service.");
  }

  private async getOwnedVoucher(voucherId: string, userId: string, workspaceId: string) {
    const voucher = await this.prisma.client.voucher.findFirst({
      where: {
        id: voucherId,
        workspaceId,
        deletedAt: null,
        OR: [{ purchaserUserId: userId }, { ownerUserId: userId }]
      },
      include: { product: true, purchaser: true, owner: true, claimTokens: true }
    });

    if (!voucher) {
      throw new NotFoundException("Voucher not found.");
    }

    return voucher;
  }

  private async seedProducts() {
    for (const seed of productSeeds) {
      const existing = await this.prisma.client.voucherProduct.findFirst({
        where: { name: seed.name },
        select: { id: true, providerServiceId: true, denominationsMinor: true }
      });

      if (existing) {
        await this.prisma.client.voucherProduct.update({
          where: { id: existing.id },
          data: {
            active: true,
            handler: seed.handler,
            ...(seed.provider === undefined ? {} : { provider: seed.provider }),
            ...(seed.providerServiceId === undefined ? {} : { providerServiceId: seed.providerServiceId }),
            inputSchema: jsonValue(seed.inputSchema),
            // Only seed denominations into an empty row. Overwriting here would
            // silently revert an operator's configuration on every restart.
            ...(existing.denominationsMinor.length === 0 && seed.denominationsMinor
              ? { denominationsMinor: seed.denominationsMinor }
              : {})
          }
        });
        continue;
      }

      await this.prisma.client.voucherProduct.create({
        data: {
          id: seed.id,
          name: seed.name,
          category: seed.category,
          handler: seed.handler,
          ...(seed.provider === undefined ? {} : { provider: seed.provider }),
          ...(seed.providerServiceId === undefined ? {} : { providerServiceId: seed.providerServiceId }),
          ...(seed.targetWalletType === undefined ? {} : { targetWalletType: seed.targetWalletType }),
          ...(seed.denominationsMinor ? { denominationsMinor: seed.denominationsMinor } : {}),
          inputSchema: jsonValue(seed.inputSchema)
        }
      });
    }

    // Superseded by airtime-epin-voucher / data-epin-voucher (real ClubKonnect EPINs
    // instead of a VTU_TOPUP handler that always threw on redemption).
    await this.prisma.client.voucherProduct.updateMany({
      where: { name: "Airtime & Data Voucher" },
      data: { active: false }
    });
  }
}
