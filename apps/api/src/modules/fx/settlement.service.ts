/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access */
import { Injectable, Logger, BadRequestException, NotFoundException } from "@nestjs/common";

import type { DatabaseClient, Prisma } from "@fliptrybe/database";
import type { SettlementProvider, SettlementTransferRequest } from "@fliptrybe/providers";
import { createMockSettlementProvider, createFincraSettlementProvider } from "@fliptrybe/providers";

import { PrismaService } from "../prisma.service";
import type { CreateSettlementInstructionDto } from "./settlement.dtos";

// Derive a stable ledger idempotency key from the settlement instruction id
function ledgerKey(instructionId: string, kind: "hold" | "debit" | "reversal"): string {
  return `settlement:${kind}:${instructionId}`;
}

const uid = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 12)}`;

@Injectable()
export class SettlementService {
  private readonly logger = new Logger(SettlementService.name);
  private settlementProvider: SettlementProvider;

  constructor(private readonly prismaService: PrismaService) {
    const fincraApiKey = process.env["FINCRA_API_KEY"];
    const fincraBusinessId = process.env["FINCRA_BUSINESS_ID"];

    if (fincraApiKey && fincraBusinessId) {
      const isProduction = process.env["FINCRA_ENV"] === "production";
      this.settlementProvider = createFincraSettlementProvider({
        apiKey: fincraApiKey,
        businessId: fincraBusinessId,
        ...(isProduction ? { baseUrl: "https://api.fincra.com" } : {}),
      });
    } else {
      this.settlementProvider = createMockSettlementProvider();
    }
  }

  private get db(): DatabaseClient {
    return this.prismaService.client;
  }

  // ─── Ledger Helpers ────────────────────────────────────────────────────

  private async requireWallet(tx: DatabaseClient | Prisma.TransactionClient, workspaceId: string, currency: string) {
    const wallet = await tx.wallet.findUnique({
      where: { workspaceId_currency: { workspaceId, currency } }
    });
    if (!wallet) {
      throw new BadRequestException(
        `No ${currency} wallet found for workspace ${workspaceId}. Fund the wallet before settling.`
      );
    }
    return wallet;
  }

  private async holdLedgerEntry(
    tx: DatabaseClient | Prisma.TransactionClient,
    walletId: string,
    instructionId: string,
    amountMinor: bigint,
    currency: string
  ) {
    return tx.ledgerEntry.create({
      data: {
        id: uid("le"),
        walletId,
        kind: "HOLD",
        amountMinor: Number(amountMinor),
        currency,
        reference: `settlement:${instructionId}`,
        description: `Settlement hold: ${instructionId}`,
        idempotencyKey: ledgerKey(instructionId, "hold"),
        sourceType: "SettlementInstruction",
        sourceId: instructionId,
      }
    });
  }

  private async debitLedgerEntry(
    tx: DatabaseClient | Prisma.TransactionClient,
    walletId: string,
    instructionId: string,
    amountMinor: bigint,
    currency: string
  ) {
    return tx.ledgerEntry.create({
      data: {
        id: uid("le"),
        walletId,
        kind: "DEBIT",
        amountMinor: Number(amountMinor),
        currency,
        reference: `settlement:${instructionId}`,
        description: `Settlement debit: ${instructionId}`,
        idempotencyKey: ledgerKey(instructionId, "debit"),
        sourceType: "SettlementInstruction",
        sourceId: instructionId,
      }
    });
  }

  private async reversalLedgerEntry(
    tx: DatabaseClient | Prisma.TransactionClient,
    walletId: string,
    instructionId: string,
    amountMinor: bigint,
    currency: string,
    reason: string
  ) {
    return tx.ledgerEntry.create({
      data: {
        id: uid("le"),
        walletId,
        kind: "REVERSAL",
        amountMinor: Number(amountMinor),
        currency,
        reference: `settlement_reversal:${instructionId}`,
        description: `Settlement reversal: ${reason}`,
        idempotencyKey: ledgerKey(instructionId, "reversal"),
        sourceType: "SettlementInstruction",
        sourceId: instructionId,
      }
    });
  }

  // ─── Settlement Instruction Management ───────────────────────────────────

  async createSettlementInstruction(
    quoteId: string,
    dto: CreateSettlementInstructionDto
  ): Promise<any> {
    const quote = await this.db.fxQuote.findUnique({ where: { id: quoteId } });
    if (!quote) {
      throw new NotFoundException(`Quote not found: ${quoteId}`);
    }

    if (quote.status !== "USED") {
      throw new BadRequestException(`Quote must be USED to settle, currently: ${quote.status}`);
    }

    if (!dto.destinationAmountMinor || dto.destinationAmountMinor <= 0) {
      throw new BadRequestException("destinationAmountMinor must be positive");
    }

    const feesMinor = dto.feesMinor ?? 0;
    const netAmountMinor = dto.destinationAmountMinor - feesMinor;

    if (netAmountMinor <= 0) {
      throw new BadRequestException("Net amount (destination - fees) must be positive");
    }

    const idempotencyKey = `settlement_${quoteId}_${dto.transactionId}`;

    return this.db.$transaction(async (tx) => {
      const wallet = await this.requireWallet(tx, dto.workspaceId, quote.baseCurrency);

      const instruction = await tx.settlementInstruction.create({
        data: {
          id: uid("settle"),
          quoteId,
          workspaceId: dto.workspaceId,
          partnerId: dto.partnerId,
          ...(dto.beneficiaryId ? { beneficiaryId: dto.beneficiaryId } : {}),

          sourceAmountMinor: quote.sourceAmountMinor,
          sourceCurrency: quote.baseCurrency,

          destinationAmountMinor: dto.destinationAmountMinor,
          destinationCurrency: quote.quoteCurrency,

          fxRateMicros: quote.customerRateMicros,
          spreadBps: quote.spreadBps,
          bufferBps: quote.bufferBps,
          feesMinor: BigInt(feesMinor),
          netAmountMinor: BigInt(netAmountMinor),

          ...(dto.beneficiaryName ? { beneficiaryName: dto.beneficiaryName } : {}),
          beneficiaryReference: dto.beneficiaryReference,
          metadata: (dto.metadata ?? {}) as Prisma.InputJsonObject,

          status: "PENDING",
          provider: this.settlementProvider.name,
          idempotencyKey,
          ...(dto.createdBy ? { createdBy: dto.createdBy } : {})
        }
      });

      // HOLD the source amount in the workspace wallet
      await this.holdLedgerEntry(tx, wallet.id, instruction.id, quote.sourceAmountMinor, quote.baseCurrency);

      this.logger.log(`Settlement instruction created: ${instruction.id}, HOLD ${Number(quote.sourceAmountMinor)} ${quote.baseCurrency}`);

      return instruction;
    });
  }

  // ─── Settlement Submission ──────────────────────────────────────────────

  async submitSettlement(instructionId: string): Promise<any> {
    const instruction = await this.db.settlementInstruction.findUnique({
      where: { id: instructionId }
    });

    if (!instruction) {
      throw new NotFoundException(`Settlement instruction not found: ${instructionId}`);
    }

    if (instruction.status !== "PENDING") {
      throw new BadRequestException(`Can only submit PENDING settlements, current status: ${instruction.status}`);
    }

    if (!instruction.beneficiaryReference) {
      throw new BadRequestException("Settlement instruction missing beneficiary reference");
    }

    const request: SettlementTransferRequest = {
      idempotencyKey: instruction.idempotencyKey,
      sourceAmountMinor: instruction.sourceAmountMinor,
      sourceCurrency: instruction.sourceCurrency,
      destinationAmountMinor: instruction.destinationAmountMinor,
      destinationCurrency: instruction.destinationCurrency,
      fxRateMicros: instruction.fxRateMicros,
      beneficiaryName: instruction.beneficiaryName ?? undefined,
      beneficiaryReference: instruction.beneficiaryReference,
      metadata: (instruction.metadata as Record<string, any>) ?? {}
    };

    try {
      const transfer = await this.settlementProvider.createTransfer(request);
      const failed = !!transfer.errorReason;

      await this.db.$transaction(async (tx) => {
        const wallet = await this.requireWallet(tx, instruction.workspaceId, instruction.sourceCurrency);

        if (failed) {
          // Release the HOLD via REVERSAL — funds return to available balance
          await this.reversalLedgerEntry(
            tx, wallet.id, instruction.id,
            instruction.sourceAmountMinor, instruction.sourceCurrency,
            transfer.errorReason ?? "Provider rejected transfer"
          );
        } else {
          // Convert HOLD to firm DEBIT now that provider has accepted
          await this.debitLedgerEntry(
            tx, wallet.id, instruction.id,
            instruction.sourceAmountMinor, instruction.sourceCurrency
          );
        }

        await tx.settlementInstruction.update({
          where: { id: instructionId },
          data: {
            status: failed ? "FAILED" : "SUBMITTED",
            providerReference: transfer.providerReference,
            providerStatus: transfer.status,
            submittedAt: new Date(),
            ...(transfer.providerTimestamp ? { providerTimestamp: transfer.providerTimestamp } : {}),
            ...(failed ? { errorReason: transfer.errorReason, failedAt: new Date() } : {})
          }
        });
      });

      this.logger.log(`Settlement submitted: ${instructionId} → provider ref: ${transfer.providerReference}${failed ? " (FAILED)" : ""}`);

      return this.db.settlementInstruction.findUnique({ where: { id: instructionId } });
    } catch (err) {
      const errorReason = err instanceof Error ? err.message : String(err);

      // Best-effort reversal — if ledger entry already exists (idempotency key clash), this is a no-op
      try {
        const wallet = await this.db.wallet.findUnique({
          where: { workspaceId_currency: { workspaceId: instruction.workspaceId, currency: instruction.sourceCurrency } }
        });
        if (wallet) {
          await this.reversalLedgerEntry(
            this.db, wallet.id, instruction.id,
            instruction.sourceAmountMinor, instruction.sourceCurrency,
            errorReason
          );
        }
      } catch (reversalErr) {
        this.logger.warn(`Could not create reversal ledger entry for ${instructionId}: ${reversalErr instanceof Error ? reversalErr.message : String(reversalErr)}`);
      }

      await this.db.settlementInstruction.update({
        where: { id: instructionId },
        data: {
          status: "FAILED",
          errorReason,
          failedAt: new Date(),
          retryCount: instruction.retryCount + 1
        }
      });

      throw err;
    }
  }

  // ─── Status Polling ─────────────────────────────────────────────────────

  async pollSettlementStatus(instructionId: string): Promise<any> {
    const instruction = await this.db.settlementInstruction.findUnique({
      where: { id: instructionId }
    });

    if (!instruction) {
      throw new NotFoundException(`Settlement instruction not found: ${instructionId}`);
    }

    if (!instruction.providerReference) {
      throw new BadRequestException("Settlement has not been submitted yet");
    }

    try {
      const transfer = await this.settlementProvider.getTransferStatus(instruction.providerReference);
      const statusChanged = instruction.providerStatus !== transfer.status;
      const nowFailed = transfer.status === "FAILED" && !instruction.failedAt;

      if (nowFailed) {
        // Provider confirmed failure — reverse the debit
        await this.db.$transaction(async (tx) => {
          const wallet = await this.requireWallet(tx, instruction.workspaceId, instruction.sourceCurrency);
          await this.reversalLedgerEntry(
            tx, wallet.id, instruction.id,
            instruction.sourceAmountMinor, instruction.sourceCurrency,
            transfer.errorReason ?? "Provider reported failure"
          );
          await tx.settlementInstruction.update({
            where: { id: instructionId },
            data: {
              providerStatus: transfer.status,
              status: "FAILED",
              failedAt: new Date(),
              ...(transfer.errorReason ? { errorReason: transfer.errorReason } : {})
            }
          });
        });
      } else {
        await this.db.settlementInstruction.update({
          where: { id: instructionId },
          data: {
            providerStatus: transfer.status,
            ...(transfer.status === "COMPLETED" && !instruction.completedAt ? { status: "COMPLETED", completedAt: new Date() } : {}),
            ...(transfer.status === "PROCESSING" ? { status: "PROCESSING" } : {})
          }
        });
      }

      if (statusChanged) {
        this.logger.log(`Settlement status updated: ${instructionId} → ${transfer.status}`);
      }

      return this.db.settlementInstruction.findUnique({ where: { id: instructionId } });
    } catch (err) {
      this.logger.error(`Failed to poll settlement status for ${instructionId}: ${err instanceof Error ? err.message : String(err)}`);
      throw err;
    }
  }

  // ─── Webhook Handling ───────────────────────────────────────────────────

  async handleSettlementWebhook(provider: string, eventId: string, eventType: string, payload: any): Promise<void> {
    const event = await this.db.settlementWebhookEvent.create({
      data: {
        id: uid("whook"),
        provider,
        providerEventId: eventId,
        eventType,
        rawPayload: payload,
        parsedData: {}
      }
    });

    this.logger.log(`Webhook received: ${provider} / ${eventType} / ${eventId}`);

    if (provider === "fincra" && payload.data) {
      const d = payload.data;
      const reference = d.reference as string | undefined;
      if (reference) {
        const instruction = await this.db.settlementInstruction.findFirst({
          where: { providerReference: reference }
        });

        if (instruction) {
          const fincraStatus = (d.status as string) ?? "";
          const mapped = fincraStatus === "successful" ? "COMPLETED"
            : fincraStatus === "failed" ? "FAILED"
            : fincraStatus === "processing" ? "PROCESSING"
            : null;

          if (mapped) {
            const nowFailed = mapped === "FAILED" && !instruction.failedAt;

            await this.db.$transaction(async (tx) => {
              if (nowFailed) {
                // Reverse the debit — funds back to available balance
                const wallet = await tx.wallet.findUnique({
                  where: { workspaceId_currency: { workspaceId: instruction.workspaceId, currency: instruction.sourceCurrency } }
                });
                if (wallet) {
                  await this.reversalLedgerEntry(
                    tx, wallet.id, instruction.id,
                    instruction.sourceAmountMinor, instruction.sourceCurrency,
                    d.failureReason ?? "Payout failed (webhook)"
                  );
                }
              }

              await tx.settlementInstruction.update({
                where: { id: instruction.id },
                data: {
                  providerStatus: fincraStatus,
                  status: mapped,
                  ...(mapped === "COMPLETED" && !instruction.completedAt ? { completedAt: new Date() } : {}),
                  ...(nowFailed ? { failedAt: new Date(), errorReason: d.failureReason ?? "Payout failed" } : {}),
                }
              });
            });

            this.logger.log(`Settlement ${instruction.id} updated via webhook → ${mapped}${nowFailed ? " (REVERSAL written)" : ""}`);
          }

          await this.db.settlementWebhookEvent.update({
            where: { id: event.id },
            data: { processed: true, processedAt: new Date(), parsedData: { instructionId: instruction.id, mapped } }
          });
          return;
        }
      }
    }

    await this.db.settlementWebhookEvent.update({
      where: { id: event.id },
      data: { processed: true, processedAt: new Date() }
    });
  }

  // ─── Reconciliation ────────────────────────────────────────────────────

  async reconcileSettlement(instructionId: string): Promise<any> {
    const instruction = await this.db.settlementInstruction.findUnique({
      where: { id: instructionId }
    });

    if (!instruction) {
      throw new NotFoundException(`Settlement instruction not found: ${instructionId}`);
    }

    const providerReference = instruction.providerReference;
    if (!providerReference) {
      throw new BadRequestException("Settlement has not been submitted to provider");
    }

    // Poll current provider status
    const transfer = await this.settlementProvider.getTransferStatus(providerReference);

    // Check for discrepancies
    const statusMatch = instruction.providerStatus === transfer.status;
    const amountMatch = instruction.destinationAmountMinor === transfer.destination.amount;

    // Store reconciliation record
    const reconData = {
      ftStatus: instruction.status,
      ftAmountMinor: instruction.destinationAmountMinor,
      ftProviderReference: instruction.providerReference,
      ftTimestamp: instruction.submittedAt,
      providerStatus: transfer.status,
      providerAmountMinor: transfer.destination.amount,
      providerTimestamp: transfer.providerTimestamp ?? null,
      statusMatch,
      amountMatch,
      resolved: statusMatch && amountMatch
    };

    const reconciliation = await this.db.settlementReconciliation.upsert({
      where: { settlementInstructionId: instructionId },
      create: {
        id: uid("recon"),
        settlementInstructionId: instructionId,
        ...reconData
      },
      update: reconData
    });

    if (!statusMatch || !amountMatch) {
      // Mark instruction as requiring review
      await this.db.settlementInstruction.update({
        where: { id: instructionId },
        data: {
          status: "REQUIRES_REVIEW",
          reconciliationState: "DIVERGED",
          reconciliationNote: `Status match: ${statusMatch}, Amount match: ${amountMatch}`
        }
      });

      this.logger.warn(`Reconciliation divergence detected for ${instructionId}: status=${statusMatch}, amount=${amountMatch}`);
    } else {
      // Mark as synced
      await this.db.settlementInstruction.update({
        where: { id: instructionId },
        data: {
          reconciliationState: "SYNCED"
        }
      });
    }

    return reconciliation;
  }

  // ─── Query ────────────────────────────────────────────────────────────

  async getSettlementInstruction(id: string): Promise<any> {
    return this.db.settlementInstruction.findUnique({ where: { id } });
  }

  async listSettlementInstructions(filters: {
    partnerId?: string;
    status?: string;
    limit?: number;
  }): Promise<any[]> {
    return this.db.settlementInstruction.findMany({
      where: {
        ...(filters.partnerId ? { partnerId: filters.partnerId } : {}),
        ...(filters.status ? { status: filters.status as any } : {})
      },
      orderBy: { createdAt: "desc" },
      take: filters.limit ?? 50
    });
  }
}
