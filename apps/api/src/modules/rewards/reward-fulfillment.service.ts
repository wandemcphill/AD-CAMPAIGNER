/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { Injectable, Logger } from "@nestjs/common";
import { Prisma, type DatabaseClient } from "@fliptrybe/database";
import type { CurrencyCode, LedgerEntry } from "@fliptrybe/types";

import { PrismaService } from "../prisma.service";
import { QueueProducerService } from "../queue-producer.service";

const uid = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 12)}`;

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
export class RewardFulfillmentService {
  private readonly logger = new Logger(RewardFulfillmentService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly queue: QueueProducerService
  ) {}

  private get db(): DatabaseClient {
    return this.prismaService.client;
  }

  async fulfillEntitlement(entitlementId: string): Promise<void> {
    const entitlement = await this.db.rewardEntitlement.findUniqueOrThrow({
      where: { id: entitlementId },
      include: {
        rewardProduct: true,
        participant: true,
        campaign: true
      }
    });

    if (entitlement.status !== "RESERVED" && entitlement.status !== "FULFILLMENT_PENDING") {
      this.logger.warn(`Entitlement ${entitlementId} in unexpected status: ${entitlement.status}`);
      return;
    }

    await this.db.rewardEntitlement.update({
      where: { id: entitlementId },
      data: { status: "FULFILLMENT_PENDING" }
    });

    const handler = entitlement.rewardProduct.handler;

    try {
      switch (handler) {
        case "WALLET_CREDIT":
          await this.fulfillWalletCredit(entitlement);
          break;
        case "VTU_TOPUP":
          await this.fulfillVtuTopup(entitlement);
          break;
        default:
          this.logger.warn(`Unsupported fulfillment handler: ${handler} for entitlement ${entitlementId}`);
          await this.markAmbiguous(entitlementId, `Unsupported handler: ${handler}`);
          return;
      }
    } catch (error) {
      this.logger.error(`Fulfillment failed for entitlement ${entitlementId}`, {
        error: error instanceof Error ? error.message : String(error)
      });
      await this.markAmbiguous(entitlementId, error instanceof Error ? error.message : String(error));
    }
  }

  private async fulfillWalletCredit(entitlement: {
    id: string;
    rewardValueMinor: number;
    currency: string;
    campaign: { workspaceId: string; name: string };
    rewardProduct: { handler: string };
  }) {
    const idemKey = `reward_credit_${entitlement.id}`;
    const ledgerId = uid("led");
    const fulfillmentId = uid("rfl");

    await this.db.$transaction(async (tx) => {
      const wallet = await tx.wallet.findFirst({
        where: { workspaceId: entitlement.campaign.workspaceId, currency: entitlement.currency }
      });

      if (!wallet) {
        throw new Error(`No wallet found for workspace ${entitlement.campaign.workspaceId}`);
      }

      await tx.ledgerEntry.create({
        data: {
          id: ledgerId,
          walletId: wallet.id,
          kind: "CREDIT",
          amountMinor: entitlement.rewardValueMinor,
          currency: entitlement.currency,
          reference: idemKey,
          description: `Reward: ${entitlement.campaign.name}`,
          idempotencyKey: idemKey,
          sourceType: "RewardFulfillment",
          sourceId: fulfillmentId
        }
      });

      await tx.rewardFulfillment.create({
        data: {
          id: fulfillmentId,
          entitlementId: entitlement.id,
          handler: "WALLET_CREDIT",
          ledgerEntryId: ledgerId,
          status: "SUCCESS",
          idempotencyKey: idemKey
        }
      });

      await tx.rewardEntitlement.update({
        where: { id: entitlement.id },
        data: { status: "FULFILLED", fulfilledAt: new Date() }
      });
    });

    this.logger.log(`Wallet credit fulfilled for entitlement ${entitlement.id}`);
  }

  private async fulfillVtuTopup(entitlement: {
    id: string;
    rewardValueMinor: number;
    currency: string;
    rewardProduct: { handler: string; providerServiceId: string | null; metadata: any };
  }) {
    const fulfillmentId = uid("rfl");
    const idemKey = `reward_vtu_${entitlement.id}`;

    await this.db.rewardFulfillment.create({
      data: {
        id: fulfillmentId,
        entitlementId: entitlement.id,
        handler: "VTU_TOPUP",
        status: "PENDING",
        idempotencyKey: idemKey
      }
    });

    // VTU fulfillment is handled by the existing vtu-fulfilment queue.
    // The reward engine processor will coordinate creating the VTU order
    // and linking it back to this fulfillment record.
    this.logger.log(`VTU fulfillment queued for entitlement ${entitlement.id}`);
  }

  private async markAmbiguous(entitlementId: string, reason: string) {
    const existing = await this.db.rewardFulfillment.findFirst({
      where: { entitlementId }
    });

    if (existing) {
      await this.db.rewardFulfillment.update({
        where: { id: existing.id },
        data: { status: "AMBIGUOUS", failureReason: reason }
      });
    } else {
      await this.db.rewardFulfillment.create({
        data: {
          entitlementId,
          handler: "WALLET_CREDIT",
          status: "AMBIGUOUS",
          failureReason: reason,
          idempotencyKey: `reward_ambiguous_${entitlementId}`
        }
      });
    }

    await this.db.rewardEntitlement.update({
      where: { id: entitlementId },
      data: { status: "FAILED" }
    });

    await this.queue.enqueueRewardOpsReview(entitlementId);
  }

  async adminResolveFulfillment(
    entitlementId: string,
    resolution: "FULFILLED" | "REVERSED",
    reason?: string
  ) {
    const entitlement = await this.db.rewardEntitlement.findUniqueOrThrow({
      where: { id: entitlementId },
      include: { fulfillment: true, campaign: true }
    });

    if (resolution === "FULFILLED") {
      await this.db.$transaction(async (tx) => {
        if (entitlement.fulfillment) {
          await tx.rewardFulfillment.update({
            where: { id: entitlement.fulfillment.id },
            data: { status: "SUCCESS" }
          });
        }
        await tx.rewardEntitlement.update({
          where: { id: entitlementId },
          data: { status: "FULFILLED", fulfilledAt: new Date() }
        });
      });
    } else {
      await this.db.$transaction(async (tx) => {
        if (entitlement.fulfillment) {
          await tx.rewardFulfillment.update({
            where: { id: entitlement.fulfillment.id },
            data: { status: "FAILED", failureReason: reason ?? "Admin reversed" }
          });
        }

        await tx.rewardEntitlement.update({
          where: { id: entitlementId },
          data: { status: "REVERSED" }
        });

        // Return the slot
        await tx.$executeRaw`
          UPDATE "RewardCampaign"
          SET "claimedSlots" = GREATEST("claimedSlots" - 1, 0)
          WHERE id = ${entitlement.campaignId}
        `;
      });
    }

    return this.db.rewardEntitlement.findUniqueOrThrow({
      where: { id: entitlementId },
      include: { fulfillment: true }
    });
  }
}
