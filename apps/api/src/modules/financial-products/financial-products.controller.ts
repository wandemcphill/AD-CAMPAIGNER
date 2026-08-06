import { Body, Controller, Get, Inject, Param, Post, Req } from "@nestjs/common";

import { workspaceContextFromRequest, type WorkspaceContextRequest } from "../request-context";
import { RequirePermissions } from "../authorization.decorators";
import type {
  CreateVirtualAccountDto,
  FundVirtualCardDto,
  IssueVirtualCardDto,
  RemittanceQuoteDto,
  SendRemittanceDto
} from "./financial-products.dtos";
import { FinancialProductsService } from "./financial-products.service";

@Controller("financial-products")
export class FinancialProductsController {
  constructor(
    @Inject(FinancialProductsService) private readonly financial: FinancialProductsService
  ) {}

  // ─── Virtual Accounts ───────────────────────────────────────────────────────

  @Post("accounts")
  @RequirePermissions("campaign:create")
  createAccount(@Body() body: CreateVirtualAccountDto, @Req() request: WorkspaceContextRequest) {
    return this.financial.createAccount(workspaceContextFromRequest(request), body);
  }

  @Get("accounts")
  @RequirePermissions("analytics:read")
  listAccounts(@Req() request: WorkspaceContextRequest) {
    return this.financial.listAccounts(workspaceContextFromRequest(request));
  }

  @Get("accounts/:id")
  @RequirePermissions("analytics:read")
  getAccount(@Param("id") id: string, @Req() request: WorkspaceContextRequest) {
    return this.financial.getAccount(workspaceContextFromRequest(request), id);
  }

  @Post("accounts/:id/close")
  @RequirePermissions("campaign:create")
  closeAccount(@Param("id") id: string, @Req() request: WorkspaceContextRequest) {
    return this.financial.closeAccount(workspaceContextFromRequest(request), id);
  }

  // ─── Virtual Cards ──────────────────────────────────────────────────────────

  @Post("cards")
  @RequirePermissions("campaign:create")
  issueCard(@Body() body: IssueVirtualCardDto, @Req() request: WorkspaceContextRequest) {
    return this.financial.issueCard(workspaceContextFromRequest(request), body);
  }

  @Get("cards")
  @RequirePermissions("analytics:read")
  listCards(@Req() request: WorkspaceContextRequest) {
    return this.financial.listCards(workspaceContextFromRequest(request));
  }

  @Post("cards/:id/fund")
  @RequirePermissions("campaign:create")
  fundCard(
    @Param("id") id: string,
    @Body() body: FundVirtualCardDto,
    @Req() request: WorkspaceContextRequest
  ) {
    return this.financial.fundCard(workspaceContextFromRequest(request), id, body);
  }

  @Post("cards/:id/freeze")
  @RequirePermissions("campaign:create")
  freezeCard(@Param("id") id: string, @Req() request: WorkspaceContextRequest) {
    return this.financial.freezeCard(workspaceContextFromRequest(request), id);
  }

  @Post("cards/:id/unfreeze")
  @RequirePermissions("campaign:create")
  unfreezeCard(@Param("id") id: string, @Req() request: WorkspaceContextRequest) {
    return this.financial.unfreezeCard(workspaceContextFromRequest(request), id);
  }

  @Post("cards/:id/terminate")
  @RequirePermissions("campaign:create")
  terminateCard(@Param("id") id: string, @Req() request: WorkspaceContextRequest) {
    return this.financial.terminateCard(workspaceContextFromRequest(request), id);
  }

  // ─── Remittance ─────────────────────────────────────────────────────────────

  @Post("remittance/quote")
  @RequirePermissions("campaign:create")
  getRemittanceQuote(@Body() body: RemittanceQuoteDto) {
    return this.financial.getRemittanceQuote(body);
  }

  @Post("remittance/send")
  @RequirePermissions("campaign:create")
  sendRemittance(@Body() body: SendRemittanceDto, @Req() request: WorkspaceContextRequest) {
    return this.financial.sendRemittance(workspaceContextFromRequest(request), body);
  }

  @Get("remittance")
  @RequirePermissions("analytics:read")
  listRemittanceTransfers(@Req() request: WorkspaceContextRequest) {
    return this.financial.listRemittanceTransfers(workspaceContextFromRequest(request));
  }
}
