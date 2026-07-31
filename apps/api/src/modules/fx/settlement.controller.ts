import { Body, Controller, Get, Inject, Param, Post, Query, Req } from "@nestjs/common";

import { workspaceContextFromRequest, type WorkspaceContextRequest } from "../request-context";
import { RequirePermissions } from "../authorization.decorators";
import type {
  CreateSettlementInstructionDto,
  SettlementListFiltersDto
} from "./settlement.dtos";
import { SettlementService } from "./settlement.service";

@Controller("v1/settlements")
export class SettlementController {
  constructor(@Inject(SettlementService) private readonly settlement: SettlementService) {}

  @Post()
  async createSettlement(
    @Body() body: { quoteId: string; instruction: CreateSettlementInstructionDto },
    @Req() request: WorkspaceContextRequest
  ) {
    const ctx = workspaceContextFromRequest(request);
    return this.settlement.createSettlementInstruction(body.quoteId, {
      ...body.instruction,
      createdBy: ctx.userId
    });
  }

  @Get(":id")
  async getSettlement(@Param("id") id: string) {
    return this.settlement.getSettlementInstruction(id);
  }

  @Get()
  async listSettlements(@Query() filters: SettlementListFiltersDto) {
    return this.settlement.listSettlementInstructions(filters);
  }

  @Post(":id/submit")
  async submitSettlement(@Param("id") id: string) {
    return this.settlement.submitSettlement(id);
  }

  @Post(":id/poll")
  async pollSettlementStatus(@Param("id") id: string) {
    return this.settlement.pollSettlementStatus(id);
  }

  @Post(":id/reconcile")
  async reconcileSettlement(@Param("id") id: string) {
    return this.settlement.reconcileSettlement(id);
  }
}

@Controller("admin/settlements")
@RequirePermissions("admin:access")
export class AdminSettlementController {
  constructor(@Inject(SettlementService) private readonly settlement: SettlementService) {}

  @Get()
  async listAllSettlements(@Query() filters: SettlementListFiltersDto) {
    return this.settlement.listSettlementInstructions(filters);
  }

  @Get(":id")
  async getSettlementDetails(@Param("id") id: string) {
    return this.settlement.getSettlementInstruction(id);
  }

  @Post(":id/retry")
  async retrySettlement(@Param("id") id: string) {
    // Retry a failed settlement (safe because of idempotency key)
    return this.settlement.submitSettlement(id);
  }

  @Post("webhook/:provider")
  async handleWebhook(
    @Param("provider") provider: string,
    @Body() body: any
  ) {
    // Provider-agnostic webhook handler
    // Body should contain: eventId, eventType, payload
    await this.settlement.handleSettlementWebhook(
      provider,
      body.eventId ?? `${provider}_${Date.now()}`,
      body.eventType ?? "unknown",
      body
    );
    return { received: true };
  }
}
