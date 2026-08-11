import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";

import { Prisma } from "@fliptrybe/database";
import { PrismaService } from "../prisma.service";

export interface RequestApprovalInput {
  workspaceId?: string | undefined;
  action: string;
  entityType: string;
  entityId: string;
  reason: string;
  payload?: Record<string, unknown>;
  requestedByUserId: string;
}

/**
 * Generic dual-approval gate for actions that move real money outside the normal
 * customer-initiated flow — refunds, reversals, re-routes (handbook `08` §9, `11` §5).
 *
 * This service only owns the approval workflow's bookkeeping (request → decide →
 * mark executed/failed). It does not know how to perform the underlying action —
 * each domain (Digital Access, VTU, Virtual Numbers, ...) calls `request()` to gate
 * an action, then `execute()` with its own callback once a request is approved.
 *
 * The load-bearing invariant is enforced in `decide()`: the user who approves or
 * rejects a request must not be the user who requested it. Prisma can't express a
 * cross-column inequality constraint, so this is checked here rather than in the DB.
 */
@Injectable()
export class ApprovalsService {
  constructor(private readonly prismaService: PrismaService) {}

  private get db() {
    return this.prismaService.client;
  }

  async request(input: RequestApprovalInput) {
    const approval = await this.db.approvalRequest.create({
      data: {
        ...(input.workspaceId ? { workspaceId: input.workspaceId } : {}),
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        reason: input.reason,
        payload: (input.payload ?? {}) as Prisma.InputJsonValue,
        requestedByUserId: input.requestedByUserId
      }
    });

    await this.db.auditLog.create({
      data: {
        ...(input.workspaceId ? { workspaceId: input.workspaceId } : {}),
        actorUserId: input.requestedByUserId,
        action: "approval.requested",
        entityType: "ApprovalRequest",
        entityId: approval.id,
        metadata: { action: input.action, targetEntityType: input.entityType, targetEntityId: input.entityId }
      }
    });

    return approval;
  }

  async listPending(workspaceId?: string) {
    return this.db.approvalRequest.findMany({
      where: { status: "PENDING", ...(workspaceId ? { workspaceId } : {}) },
      orderBy: { createdAt: "asc" }
    });
  }

  /**
   * Powers the unified Approvals Queue UI. `status` maps to the DB status column
   * directly except "flagged", which isn't a real ApprovalStatus value — it's a
   * PENDING request that's been sitting long enough (or is otherwise notable) to
   * call out; we treat any PENDING request older than `flaggedAfterMs` as flagged.
   * `type` filters on `entityType`, which is a free-form string set by whichever
   * domain called `request()` — there's no DB-level enum for it.
   */
  async list(params: {
    workspaceId?: string;
    status?: "pending" | "flagged" | "all";
    type?: string;
    flaggedAfterMs?: number;
  }) {
    const status = params.status ?? "all";
    const flaggedAfterMs = params.flaggedAfterMs ?? 24 * 60 * 60 * 1000;

    const where: Prisma.ApprovalRequestWhereInput = {
      ...(params.workspaceId ? { workspaceId: params.workspaceId } : {}),
      ...(params.type && params.type !== "all" ? { entityType: params.type } : {})
    };

    if (status === "pending" || status === "flagged") {
      where.status = "PENDING";
    }

    const requests = await this.db.approvalRequest.findMany({
      where,
      orderBy: { createdAt: "asc" }
    });

    if (status !== "flagged") {
      return requests;
    }

    const cutoff = Date.now() - flaggedAfterMs;
    return requests.filter((request) => request.createdAt.getTime() <= cutoff);
  }

  async get(id: string) {
    const approval = await this.db.approvalRequest.findUnique({ where: { id } });
    if (!approval) throw new NotFoundException("Approval request not found.");
    return approval;
  }

  async decide(id: string, input: { decidedByUserId: string; approve: boolean; note?: string }) {
    const approval = await this.get(id);

    if (approval.status !== "PENDING") {
      throw new BadRequestException(`Approval request is already ${approval.status.toLowerCase()}.`);
    }
    if (approval.requestedByUserId === input.decidedByUserId) {
      throw new ForbiddenException("The requester cannot also approve or reject this request.");
    }

    const updated = await this.db.approvalRequest.update({
      where: { id },
      data: {
        status: input.approve ? "APPROVED" : "REJECTED",
        decidedByUserId: input.decidedByUserId,
        decidedAt: new Date(),
        ...(input.note?.trim() ? { decisionNote: input.note.trim() } : {})
      }
    });

    await this.db.auditLog.create({
      data: {
        ...(approval.workspaceId ? { workspaceId: approval.workspaceId } : {}),
        actorUserId: input.decidedByUserId,
        action: input.approve ? "approval.approved" : "approval.rejected",
        entityType: "ApprovalRequest",
        entityId: approval.id,
        metadata: { note: input.note ?? null }
      }
    });

    return updated;
  }

  /**
   * Runs `fn` for an APPROVED request and records the outcome. Throws if the request
   * isn't approved or has already been executed — callers should not retry a failed
   * execution silently; a fresh approval decision (or explicit ops action) is required.
   */
  async execute<T>(id: string, fn: () => Promise<T>): Promise<T> {
    const approval = await this.get(id);

    if (approval.status !== "APPROVED") {
      throw new BadRequestException(
        `Approval request must be APPROVED before executing (currently ${approval.status}).`
      );
    }

    try {
      const result = await fn();
      await this.db.approvalRequest.update({
        where: { id },
        data: { status: "EXECUTED", executedAt: new Date() }
      });
      return result;
    } catch (error) {
      await this.db.approvalRequest.update({
        where: { id },
        data: {
          status: "EXECUTION_FAILED",
          executionError: error instanceof Error ? error.message : String(error)
        }
      });
      throw error;
    }
  }
}
