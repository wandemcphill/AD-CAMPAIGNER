/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access */
import { Injectable, Logger, BadRequestException, NotFoundException } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import type { DatabaseClient, Prisma } from "@fliptrybe/database";
import type { SettlementProvider, SettlementTransferRequest } from "@fliptrybe/providers";
import { createMockSettlementProvider, createFincraSettlementProvider } from "@fliptrybe/providers";

import { PrismaService } from "../prisma.service";
import type {
  AlertListFiltersDto,
  CreateSettlementBeneficiaryDto,
  CreateSettlementInstructionDto,
  RejectBeneficiaryDto,
  VerifyBeneficiaryDto
} from "./settlement.dtos";

// Derive a stable ledger idempotency key from the settlement instruction id
function ledgerKey(instructionId: string, kind: "hold" | "debit" | "reversal"): string {
  return `settlement:${kind}:${instructionId}`;
}

const uid = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 12)}`;

// Settlements at or above this amount require a KYC-verified beneficiary on file.
// Below it, an unverified/first-time beneficiary is allowed through (small-value
// trust-tiered limit, matching the pattern used elsewhere for new/unverified actors).
const KYC_REQUIRED_THRESHOLD_MINOR = BigInt(
  process.env["SETTLEMENT_KYC_THRESHOLD_MINOR"] ?? 100_000 // ₦1,000 / $1,000 equivalent by default
);

// Best-effort delivery of CRITICAL alerts to an ops Slack channel (or any
// Slack-compatible incoming webhook). Never throws — a failed page must not
// break the settlement flow; the alert is already durably stored either way.
async function notifyOpsChannel(logger: Logger, text: string) {
  const webhookUrl = process.env["SETTLEMENT_ALERTS_WEBHOOK_URL"];
  if (!webhookUrl) {
    return;
  }

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text })
    });
    if (!res.ok) {
      logger.warn(`Ops alert webhook returned ${res.status}`);
    }
  } catch (err) {
    logger.warn(`Ops alert webhook delivery failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

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

  // ─── Alerting ──────────────────────────────────────────────────────────

  private async writeAlert(input: {
    settlementInstructionId: string;
    kind: "RECONCILIATION_DIVERGED" | "SETTLEMENT_FAILED";
    severity?: "WARNING" | "CRITICAL";
    message: string;
    metadata?: Record<string, unknown>;
  }) {
    const severity = input.severity ?? "WARNING";

    await this.db.settlementAlert.create({
      data: {
        id: uid("alrt"),
        settlementInstructionId: input.settlementInstructionId,
        kind: input.kind,
        severity,
        message: input.message,
        metadata: (input.metadata ?? {}) as Prisma.InputJsonObject
      }
    });
    this.logger.warn(`Settlement alert [${input.kind}] ${input.settlementInstructionId}: ${input.message}`);

    if (severity === "CRITICAL") {
      await notifyOpsChannel(
        this.logger,
        `🚨 Settlement alert [${input.kind}] on ${input.settlementInstructionId}: ${input.message}`
      );
    }
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

    // The beneficiary is checked against dto.workspaceId below; the quote must
    // be too, or one workspace could settle against another's locked rate.
    if (quote.workspaceId && dto.workspaceId && quote.workspaceId !== dto.workspaceId) {
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

    if (BigInt(dto.destinationAmountMinor) >= KYC_REQUIRED_THRESHOLD_MINOR) {
      if (!dto.beneficiaryId) {
        throw new BadRequestException(
          `Settlements of ${dto.destinationAmountMinor} ${quote.quoteCurrency} or more require a KYC-verified beneficiary. Create one via POST /admin/settlements/beneficiaries and pass beneficiaryId.`
        );
      }

      const beneficiary = await this.db.settlementBeneficiary.findUnique({ where: { id: dto.beneficiaryId } });
      if (!beneficiary || beneficiary.workspaceId !== dto.workspaceId) {
        throw new NotFoundException(`Beneficiary not found: ${dto.beneficiaryId}`);
      }
      if (beneficiary.kycStatus !== "VERIFIED") {
        throw new BadRequestException(
          `Beneficiary ${beneficiary.id} is not KYC-verified (status: ${beneficiary.kycStatus}). Settlements of ${dto.destinationAmountMinor} ${quote.quoteCurrency} or more require verification.`
        );
      }
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

      if (failed) {
        await this.writeAlert({
          settlementInstructionId: instructionId,
          kind: "SETTLEMENT_FAILED",
          severity: "CRITICAL",
          message: transfer.errorReason ?? "Provider rejected transfer",
          metadata: { stage: "submit", providerReference: transfer.providerReference }
        });
      }

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

      await this.writeAlert({
        settlementInstructionId: instructionId,
        kind: "SETTLEMENT_FAILED",
        severity: "CRITICAL",
        message: errorReason,
        metadata: { stage: "submit_exception", retryCount: instruction.retryCount + 1 }
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

        await this.writeAlert({
          settlementInstructionId: instructionId,
          kind: "SETTLEMENT_FAILED",
          severity: "CRITICAL",
          message: transfer.errorReason ?? "Provider reported failure",
          metadata: { stage: "poll" }
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

            if (nowFailed) {
              await this.writeAlert({
                settlementInstructionId: instruction.id,
                kind: "SETTLEMENT_FAILED",
                severity: "CRITICAL",
                message: (d.failureReason as string | undefined) ?? "Payout failed (webhook)",
                metadata: { stage: "webhook", eventId }
              });
            }
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

      await this.writeAlert({
        settlementInstructionId: instructionId,
        kind: "RECONCILIATION_DIVERGED",
        severity: "WARNING",
        message: `Status match: ${statusMatch}, amount match: ${amountMatch}`,
        metadata: {
          ftStatus: instruction.status,
          providerStatus: transfer.status,
          ftAmountMinor: instruction.destinationAmountMinor.toString(),
          providerAmountMinor: transfer.destination.amount.toString()
        }
      });
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

  // ─── Beneficiary KYC/KYB ─────────────────────────────────────────────────

  async createBeneficiary(dto: CreateSettlementBeneficiaryDto) {
    if (!dto.name?.trim()) {
      throw new BadRequestException("Beneficiary name is required.");
    }
    if (!dto.reference?.trim()) {
      throw new BadRequestException("Beneficiary reference (bank account, payout email, etc.) is required.");
    }

    return this.db.settlementBeneficiary.create({
      data: {
        id: uid("bene"),
        workspaceId: dto.workspaceId,
        name: dto.name.trim(),
        reference: dto.reference.trim(),
        ...(dto.country ? { country: dto.country } : {}),
        ...(dto.currency ? { currency: dto.currency } : {}),
        metadata: (dto.metadata ?? {}) as Prisma.InputJsonObject
      }
    });
  }

  async getBeneficiary(id: string) {
    const beneficiary = await this.db.settlementBeneficiary.findUnique({ where: { id } });
    if (!beneficiary) {
      throw new NotFoundException(`Beneficiary not found: ${id}`);
    }
    return beneficiary;
  }

  async listBeneficiaries(workspaceId: string) {
    return this.db.settlementBeneficiary.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" }
    });
  }

  async verifyBeneficiary(id: string, dto: VerifyBeneficiaryDto) {
    const beneficiary = await this.getBeneficiary(id);

    const updated = await this.db.settlementBeneficiary.update({
      where: { id: beneficiary.id },
      data: {
        kycStatus: "VERIFIED",
        kycTier: dto.kycTier ?? beneficiary.kycTier,
        verifiedAt: new Date(),
        verifiedByUserId: dto.verifiedByUserId,
        rejectedReason: null
      }
    });

    await this.db.auditLog.create({
      data: {
        id: uid("aud"),
        workspaceId: beneficiary.workspaceId,
        actorUserId: dto.verifiedByUserId,
        action: "settlement_beneficiary.verified",
        entityType: "SettlementBeneficiary",
        entityId: beneficiary.id,
        metadata: { kycTier: updated.kycTier }
      }
    });

    return updated;
  }

  async rejectBeneficiary(id: string, dto: RejectBeneficiaryDto) {
    const beneficiary = await this.getBeneficiary(id);

    const updated = await this.db.settlementBeneficiary.update({
      where: { id: beneficiary.id },
      data: {
        kycStatus: "REJECTED",
        rejectedReason: dto.reason,
        verifiedAt: null,
        verifiedByUserId: null
      }
    });

    await this.db.auditLog.create({
      data: {
        id: uid("aud"),
        workspaceId: beneficiary.workspaceId,
        actorUserId: dto.rejectedByUserId,
        action: "settlement_beneficiary.rejected",
        entityType: "SettlementBeneficiary",
        entityId: beneficiary.id,
        metadata: { reason: dto.reason }
      }
    });

    return updated;
  }

  // ─── Alert Query ──────────────────────────────────────────────────────

  async listAlerts(filters: AlertListFiltersDto) {
    return this.db.settlementAlert.findMany({
      where: {
        ...(filters.acknowledged === undefined ? {} : { acknowledged: filters.acknowledged })
      },
      orderBy: { createdAt: "desc" },
      take: filters.limit ?? 50
    });
  }

  async acknowledgeAlert(id: string, acknowledgedByUserId: string) {
    const alert = await this.db.settlementAlert.findUnique({ where: { id } });
    if (!alert) {
      throw new NotFoundException(`Alert not found: ${id}`);
    }

    return this.db.settlementAlert.update({
      where: { id },
      data: { acknowledged: true, acknowledgedByUserId, acknowledgedAt: new Date() }
    });
  }

  // ─── Automated Reconciliation (scheduled) ────────────────────────────────

  @Cron(CronExpression.EVERY_10_MINUTES)
  async reconcileInFlightSettlements(): Promise<void> {
    if (!process.env["ENABLE_SETTLEMENT_RECONCILIATION_SCHEDULER"]) {
      return;
    }

    try {
      const inFlight = await this.db.settlementInstruction.findMany({
        where: {
          status: { in: ["SUBMITTED", "PROCESSING"] },
          reconciliationState: { notIn: ["SYNCED"] }
        },
        take: 100, // Batch limit to avoid overwhelming the provider
        orderBy: { submittedAt: "asc" }
      });

      let reconciled = 0;
      let diverged = 0;

      for (const instruction of inFlight) {
        try {
          const result = await this.reconcileSettlement(instruction.id);
          if (result.resolved) {
            reconciled++;
          } else {
            diverged++;
          }
        } catch (err) {
          this.logger.warn(
            `Scheduled reconciliation failed for ${instruction.id}: ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }

      if (inFlight.length > 0) {
        this.logger.log(
          `Scheduled settlement reconciliation: ${inFlight.length} in-flight, ${reconciled} reconciled, ${diverged} diverged`
        );
      }
    } catch (err) {
      this.logger.error(
        `Scheduled reconciliation job failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
}
