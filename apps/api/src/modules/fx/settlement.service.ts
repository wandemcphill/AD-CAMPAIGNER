import { Injectable, Logger, BadRequestException, NotFoundException } from "@nestjs/common";

import type { DatabaseClient, Prisma } from "@fliptrybe/database";
import type { SettlementProvider, SettlementTransferRequest } from "@fliptrybe/providers";
import { createMockSettlementProvider } from "@fliptrybe/providers";

import { PrismaService } from "../prisma.service";
import type { CreateSettlementInstructionDto } from "./settlement.dtos";

const uid = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 12)}`;

@Injectable()
export class SettlementService {
  private readonly logger = new Logger(SettlementService.name);
  private settlementProvider: SettlementProvider;

  constructor(private readonly prismaService: PrismaService) {
    this.settlementProvider = createMockSettlementProvider();
  }

  private get db(): DatabaseClient {
    return this.prismaService.client;
  }

  // ─── Settlement Instruction Management ───────────────────────────────────

  async createSettlementInstruction(
    quoteId: string,
    dto: CreateSettlementInstructionDto
  ): Promise<any> {
    // Fetch the FxQuote
    const quote = await this.db.fxQuote.findUnique({ where: { id: quoteId } });
    if (!quote) {
      throw new NotFoundException(`Quote not found: ${quoteId}`);
    }

    if (quote.status !== "USED") {
      throw new BadRequestException(`Quote must be USED to settle, currently: ${quote.status}`);
    }

    // Validate amounts
    if (!dto.destinationAmountMinor || dto.destinationAmountMinor <= 0) {
      throw new BadRequestException("destinationAmountMinor must be positive");
    }

    // Calculate net amount (destination - fees)
    const feesMinor = dto.feesMinor ?? 0;
    const netAmountMinor = dto.destinationAmountMinor - feesMinor;

    if (netAmountMinor <= 0) {
      throw new BadRequestException("Net amount (destination - fees) must be positive");
    }

    // Generate idempotency key based on quote + transaction ID
    const idempotencyKey = `settlement_${quoteId}_${dto.transactionId}_${Date.now()}`;

    // Create settlement instruction
    const instruction = await this.db.settlementInstruction.create({
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
        metadata: dto.metadata ?? {},

        status: "PENDING",
        provider: this.settlementProvider.name,
        idempotencyKey,
        ...(dto.createdBy ? { createdBy: dto.createdBy } : {})
      }
    });

    return instruction;
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

    // Call provider to create transfer
    try {
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

      const transfer = await this.settlementProvider.createTransfer(request);

      // Update instruction with provider reference
      const updateData: any = {
        status: transfer.errorReason ? "FAILED" : "SUBMITTED",
        providerReference: transfer.providerReference,
        providerStatus: transfer.status,
        submittedAt: new Date()
      };

      if (transfer.providerTimestamp) {
        updateData.providerTimestamp = transfer.providerTimestamp;
      }

      if (transfer.errorReason) {
        updateData.errorReason = transfer.errorReason;
        updateData.failedAt = new Date();
      }

      const updated = await this.db.settlementInstruction.update({
        where: { id: instructionId },
        data: updateData
      });

      this.logger.log(`Settlement submitted: ${instructionId} → provider ref: ${transfer.providerReference}`);

      return updated;
    } catch (err) {
      const errorReason = err instanceof Error ? err.message : String(err);

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

      // Update instruction with latest status
      const statusChanged = instruction.providerStatus !== transfer.status;

      const updated = await this.db.settlementInstruction.update({
        where: { id: instructionId },
        data: {
          providerStatus: transfer.status,
          ...(transfer.status === "COMPLETED" && !instruction.completedAt ? { status: "COMPLETED", completedAt: new Date() } : {}),
          ...(transfer.status === "FAILED" && !instruction.failedAt ? { status: "FAILED", failedAt: new Date(), errorReason: transfer.errorReason } : {}),
          ...(transfer.status === "PROCESSING" ? { status: "PROCESSING" } : {})
        }
      });

      if (statusChanged) {
        this.logger.log(`Settlement status updated: ${instructionId} → ${transfer.status}`);
      }

      return updated;
    } catch (err) {
      this.logger.error(`Failed to poll settlement status for ${instructionId}: ${err instanceof Error ? err.message : String(err)}`);
      throw err;
    }
  }

  // ─── Webhook Handling ───────────────────────────────────────────────────

  async handleSettlementWebhook(provider: string, eventId: string, eventType: string, payload: any): Promise<void> {
    // Store webhook event for audit/replay
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

    // TODO: Implement provider-specific webhook parsing
    // Map provider webhook payload to SettlementInstruction update
    // For now, mark as processed

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
