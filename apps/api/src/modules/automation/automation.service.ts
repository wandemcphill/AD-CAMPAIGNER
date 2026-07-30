import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";

import type { Prisma } from "@fliptrybe/database";

import { PrismaService } from "../prisma.service";
import type { AuthenticatedRequestContext } from "../request-context";
import type { CreateAutomationWorkflowDto, UpdateAutomationWorkflowDto } from "./automation.dtos";

function requireScope(context?: AuthenticatedRequestContext) {
  if (!context?.workspaceId || !context.userId) {
    throw new UnauthorizedException("Authenticated workspace context is required.");
  }

  return context;
}

function jsonValue(input?: Record<string, unknown>) {
  return input as Prisma.InputJsonValue;
}

const validTriggerKinds = [
  "BUDGET_THRESHOLD",
  "PERFORMANCE_THRESHOLD",
  "SCHEDULE",
  "WALLET_BALANCE",
  "CREATIVE_AGE"
];

@Injectable()
export class AutomationService {
  constructor(private readonly prisma: PrismaService) {}

  private get db() {
    return this.prisma.client;
  }

  async list(context?: AuthenticatedRequestContext) {
    const scope = requireScope(context);

    return this.db.automationWorkflow.findMany({
      where: { workspaceId: scope.workspaceId, deletedAt: null },
      orderBy: { createdAt: "desc" }
    });
  }

  async create(input: CreateAutomationWorkflowDto, context?: AuthenticatedRequestContext) {
    const scope = requireScope(context);

    if (!input.name?.trim()) {
      throw new BadRequestException("A workflow name is required.");
    }
    if (!validTriggerKinds.includes(input.triggerKind)) {
      throw new BadRequestException("A valid trigger kind is required.");
    }
    if (!input.triggerSummary?.trim() || !input.actionSummary?.trim()) {
      throw new BadRequestException("Trigger and action summaries are required.");
    }

    return this.db.automationWorkflow.create({
      data: {
        workspaceId: scope.workspaceId,
        createdByUserId: scope.userId,
        name: input.name.trim(),
        triggerKind: input.triggerKind,
        triggerSummary: input.triggerSummary.trim(),
        actionSummary: input.actionSummary.trim(),
        status: "DRAFT",
        config: jsonValue(input.config ?? {})
      }
    });
  }

  async update(
    id: string,
    input: UpdateAutomationWorkflowDto,
    context?: AuthenticatedRequestContext
  ) {
    const scope = requireScope(context);
    const workflow = await this.findOwned(id, scope.workspaceId);

    return this.db.automationWorkflow.update({
      where: { id: workflow.id },
      data: {
        ...(input.name === undefined ? {} : { name: input.name.trim() }),
        ...(input.triggerKind === undefined ? {} : { triggerKind: input.triggerKind }),
        ...(input.triggerSummary === undefined ? {} : { triggerSummary: input.triggerSummary.trim() }),
        ...(input.actionSummary === undefined ? {} : { actionSummary: input.actionSummary.trim() }),
        ...(input.status === undefined ? {} : { status: input.status }),
        ...(input.config === undefined ? {} : { config: jsonValue(input.config) })
      }
    });
  }

  async remove(id: string, context?: AuthenticatedRequestContext) {
    const scope = requireScope(context);
    const workflow = await this.findOwned(id, scope.workspaceId);

    await this.db.automationWorkflow.update({
      where: { id: workflow.id },
      data: { deletedAt: new Date() }
    });

    return { ok: true };
  }

  private async findOwned(id: string, workspaceId: string) {
    const workflow = await this.db.automationWorkflow.findFirst({
      where: { id, workspaceId, deletedAt: null }
    });

    if (!workflow) {
      throw new NotFoundException("Workflow was not found in the active workspace.");
    }

    return workflow;
  }
}
