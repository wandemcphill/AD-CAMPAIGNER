/**
 * Opens and resolves financial reconciliation exceptions.
 *
 * Core rule (FINTECH governance §15/§23): an ambiguous money-moving failure is
 * NEVER collapsed into FAILED, and never auto-retried through a fallback
 * provider. It becomes an explicit exception row that a reconciliation job or
 * an operator must resolve against the provider's own record.
 *
 * This service does NOT mutate historical financial records to "fix" a
 * divergence — it records the divergence. Any corrective money movement is a
 * separate, audited, dual-controlled action.
 */
import { Injectable, Logger } from "@nestjs/common";

import { type Prisma } from "@fliptrybe/database";

import { PrismaService } from "../prisma.service";

type ProviderDomain = "VIRTUAL_ACCOUNT" | "VIRTUAL_CARD" | "REMITTANCE";

type ReconciliationKind =
  | "MISSING_AT_PROVIDER"
  | "MISSING_INTERNALLY"
  | "AMOUNT_MISMATCH"
  | "CURRENCY_MISMATCH"
  | "STATUS_MISMATCH"
  | "FEE_MISMATCH"
  | "DUPLICATE_AT_PROVIDER"
  | "AMBIGUOUS_PROVIDER_RESULT"
  | "UNKNOWN";

export interface OpenExceptionInput {
  workspaceId?: string;
  resourceType: string;
  resourceId: string;
  domain: ProviderDomain;
  providerName: string;
  kind: ReconciliationKind;
  internalStatus?: string;
  providerStatus?: string;
  internalAmountMinor?: number;
  providerAmountMinor?: number;
  internalCurrency?: string;
  providerCurrency?: string;
  internalFeeMinor?: number;
  providerFeeMinor?: number;
  providerReference?: string;
  idempotencyKey?: string;
  detail?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class FinancialReconciliationService {
  private readonly logger = new Logger(FinancialReconciliationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Idempotent: re-running the reconciler for the same (resource, kind)
   * updates the existing open row rather than creating duplicates.
   */
  async openException(input: OpenExceptionInput) {
    const {
      resourceType,
      resourceId,
      kind,
      metadata,
      workspaceId,
      detail,
      ...rest
    } = input;

    const row = await this.prisma.client.financialReconciliationException.upsert({
      where: {
        resourceType_resourceId_kind: { resourceType, resourceId, kind }
      },
      create: {
        resourceType,
        resourceId,
        kind,
        status: "OPEN",
        workspaceId: workspaceId ?? null,
        detail: detail ?? null,
        ...(metadata ? { metadata: metadata as Prisma.InputJsonValue } : {}),
        domain: rest.domain,
        providerName: rest.providerName,
        internalStatus: rest.internalStatus ?? null,
        providerStatus: rest.providerStatus ?? null,
        internalAmountMinor: rest.internalAmountMinor ?? null,
        providerAmountMinor: rest.providerAmountMinor ?? null,
        internalCurrency: rest.internalCurrency ?? null,
        providerCurrency: rest.providerCurrency ?? null,
        internalFeeMinor: rest.internalFeeMinor ?? null,
        providerFeeMinor: rest.providerFeeMinor ?? null,
        providerReference: rest.providerReference ?? null,
        idempotencyKey: rest.idempotencyKey ?? null
      },
      update: {
        // Refresh the observed values, but never silently close an open row.
        providerStatus: rest.providerStatus ?? null,
        providerAmountMinor: rest.providerAmountMinor ?? null,
        providerCurrency: rest.providerCurrency ?? null,
        providerFeeMinor: rest.providerFeeMinor ?? null,
        providerReference: rest.providerReference ?? null,
        detail: detail ?? null,
        ...(metadata ? { metadata: metadata as Prisma.InputJsonValue } : {})
      }
    });

    this.logger.warn(
      `Reconciliation exception ${kind} opened for ${resourceType}:${resourceId} ` +
        `(provider=${rest.providerName}) — id=${row.id}`
    );

    return row;
  }

  async listOpen(filter: { workspaceId?: string; providerName?: string } = {}) {
    return this.prisma.client.financialReconciliationException.findMany({
      where: {
        status: { in: ["OPEN", "INVESTIGATING"] },
        ...(filter.workspaceId ? { workspaceId: filter.workspaceId } : {}),
        ...(filter.providerName ? { providerName: filter.providerName } : {})
      },
      orderBy: { createdAt: "desc" }
    });
  }

  /**
   * Marks an exception resolved. Deliberately does NOT perform any corrective
   * money movement — that is a separate, audited action (see ApprovalRequest
   * for the dual-control path).
   */
  async resolve(id: string, resolvedByUserId: string, resolutionNote: string) {
    const row = await this.prisma.client.financialReconciliationException.update({
      where: { id },
      data: {
        status: "RESOLVED",
        resolvedByUserId,
        resolutionNote,
        resolvedAt: new Date()
      }
    });

    await this.prisma.client.auditLog.create({
      data: {
        ...(row.workspaceId ? { workspaceId: row.workspaceId } : {}),
        actorUserId: resolvedByUserId,
        action: "financial_reconciliation.resolved",
        entityType: "FinancialReconciliationException",
        entityId: id,
        metadata: {
          resourceType: row.resourceType,
          resourceId: row.resourceId,
          kind: row.kind,
          providerName: row.providerName,
          resolutionNote
        }
      }
    });

    return row;
  }
}
