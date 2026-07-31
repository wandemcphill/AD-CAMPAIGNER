import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

import { Prisma, type PrismaClient } from "@fliptrybe/database";

import { PrismaService } from "../prisma.service";
import type { AuthenticatedRequestContext } from "../request-context";
import { OutgoingWebhooksService } from "../webhooks/outgoing-webhooks.service";

type VoucherProductSeed = {
  name: string;
  category: "CAMPAIGN" | "TELECOM";
  handler: "WALLET_CREDIT" | "VTU_TOPUP";
  provider?: string;
  providerServiceId?: string;
  targetWalletType?: "CAMPAIGN";
  inputSchema: Record<string, unknown>;
};

const productSeeds: VoucherProductSeed[] = [
  {
    name: "Campaign Credit",
    category: "CAMPAIGN",
    handler: "WALLET_CREDIT",
    targetWalletType: "CAMPAIGN",
    inputSchema: { type: "object", properties: {}, additionalProperties: false }
  },
  {
    name: "Airtime & Data Voucher",
    category: "TELECOM",
    handler: "VTU_TOPUP",
    provider: "vtu",
    providerServiceId: "airtime-data",
    inputSchema: {
      type: "object",
      properties: {
        phoneNumber: { type: "string" },
        network: { type: "string" }
      },
      required: ["phoneNumber", "network"],
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
    private readonly webhooks: OutgoingWebhooksService
  ) {}

  async listProducts() {
    await this.seedProducts();
    return this.prisma.client.voucherProduct.findMany({
      where: { active: true },
      orderBy: [{ category: "asc" }, { name: "asc" }]
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

    const pin = voucherPin();
    const voucher = await this.prisma.client.voucher.create({
      data: {
        serialNumber: serialNumber(),
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
        ...(input.metadata === undefined ? {} : { metadata: jsonValue(input.metadata) })
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

  async redeemVoucher(voucherId: string, input: Record<string, unknown>, context?: AuthenticatedRequestContext) {
    const scope = requireContext(context);
    const voucher = await this.getOwnedVoucher(voucherId, scope.userId, scope.workspaceId);

    if (voucher.status !== "REVEALED" && voucher.status !== "CLAIMED") {
      throw new ConflictException("Voucher must be revealed before redemption.");
    }

    const redeemed = await this.prisma.client.voucher.update({
      where: { id: voucher.id },
      data: {
        redemptionInput: jsonValue(input),
        status: "REDEEMED",
        redeemedAt: new Date()
      },
      include: { product: true, purchaser: true, owner: true, claimTokens: true }
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
      const existing = await this.prisma.client.voucherProduct.findFirst({ where: { name: seed.name } });

      if (existing) {
        await this.prisma.client.voucherProduct.update({
          where: { id: existing.id },
          data: { active: true }
        });
        continue;
      }

      await this.prisma.client.voucherProduct.create({
        data: {
          name: seed.name,
          category: seed.category,
          handler: seed.handler,
          ...(seed.provider === undefined ? {} : { provider: seed.provider }),
          ...(seed.providerServiceId === undefined ? {} : { providerServiceId: seed.providerServiceId }),
          ...(seed.targetWalletType === undefined ? {} : { targetWalletType: seed.targetWalletType }),
          inputSchema: jsonValue(seed.inputSchema)
        }
      });
    }
  }
}
