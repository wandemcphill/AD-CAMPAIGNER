import { BadRequestException, Injectable, Logger } from "@nestjs/common";

import { createMockCryptoSellProvider, createSogoCryptoAdapter, type CryptoSellProvider } from "@fliptrybe/providers";
import { featureFlags } from "@fliptrybe/feature-flags";

import { PrismaService } from "../prisma.service";
import type { AuthenticatedRequestContext } from "../request-context";
import type { CreateDepositAddressDto } from "./crypto.dtos";

@Injectable()
export class CryptoService {
  private readonly logger = new Logger(CryptoService.name);
  private readonly provider: CryptoSellProvider;

  constructor(private readonly prismaService: PrismaService) {
    const apiKey = process.env["SOGO_API_KEY"] ?? process.env["SOGO_SECRET_KEY"];
    this.provider =
      featureFlags.cryptoSell && apiKey
        ? createSogoCryptoAdapter({
            apiKey,
            sandbox: process.env["SOGO_SANDBOX"] === "true",
            ...(process.env["SOGO_BASE_URL"] ? { baseUrl: process.env["SOGO_BASE_URL"] } : {})
          })
        : createMockCryptoSellProvider();
  }

  private get db() {
    return this.prismaService.client;
  }

  async listAssets() {
    return this.provider.listAssets();
  }

  async getRate(asset: string, amount: number) {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException("amount must be a positive number.");
    }
    return this.provider.getEstimatedRate(asset, amount);
  }

  async getDepositAddress(ctx: AuthenticatedRequestContext, asset: string, network?: string) {
    if (!featureFlags.cryptoSell) {
      throw new BadRequestException("Crypto sell is not yet available.");
    }

    const existing = await this.db.cryptoDepositAddress.findFirst({
      where: { workspaceId: ctx.workspaceId, asset, network: network ?? this.provider.name, isActive: true }
    });

    return existing ?? null;
  }

  async createDepositAddress(ctx: AuthenticatedRequestContext, dto: CreateDepositAddressDto) {
    if (!featureFlags.cryptoSell) {
      throw new BadRequestException("Crypto sell is not yet available.");
    }
    if (!dto.asset) throw new BadRequestException("asset is required.");

    const result = await this.provider.getOrCreateDepositAddress({
      asset: dto.asset,
      ...(dto.network ? { network: dto.network } : {}),
      idempotencyKey: dto.idempotencyKey
    });

    const row = await this.db.cryptoDepositAddress.upsert({
      where: {
        workspaceId_asset_network: {
          workspaceId: ctx.workspaceId,
          asset: result.asset,
          network: result.network
        }
      },
      update: { address: result.address, isActive: result.isActive },
      create: {
        workspaceId: ctx.workspaceId,
        providerName: this.provider.name,
        asset: result.asset,
        network: result.network,
        address: result.address,
        ...(result.destinationTag ? { destinationTag: result.destinationTag } : {}),
        isActive: result.isActive
      }
    });

    return { ...row, maskedAddress: result.maskedAddress };
  }

  async listTransactions(ctx: AuthenticatedRequestContext) {
    return this.db.cryptoSellTransaction.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: { createdAt: "desc" },
      take: 50
    });
  }
}
