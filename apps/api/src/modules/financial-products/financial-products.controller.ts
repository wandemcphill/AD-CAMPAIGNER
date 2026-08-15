import { Body, Controller, Get, Inject, Param, Post, Req } from "@nestjs/common";

import { workspaceContextFromRequest, type WorkspaceContextRequest } from "../request-context";
import { RequireAdult } from "../age.decorators";
import { RequirePermissions } from "../authorization.decorators";
import { RequireFeature } from "../feature-flag.decorators";
import type {
  CreateVirtualAccountDto,
  FundVirtualCardDto,
  IssueVirtualCardDto,
  RemittanceQuoteDto,
  RequestWalletWithdrawalDto,
  SendRemittanceDto
} from "./financial-products.dtos";
import { FinancialProductsService } from "./financial-products.service";

// Virtual accounts, cards and remittance are age-restricted (18+) per the route
// map. @RequireAdult on the controller applies to every route here, including the
// read endpoints — an under-18 user cannot even enumerate these products.
@Controller("financial-products")
@RequireAdult()
export class FinancialProductsController {
  constructor(
    @Inject(FinancialProductsService) private readonly financial: FinancialProductsService
  ) {}

  // ─── Virtual Accounts ───────────────────────────────────────────────────────

  @Post("accounts")
  @RequireFeature("virtualAccounts")
  @RequirePermissions("campaign:create")
  createAccount(@Body() body: CreateVirtualAccountDto, @Req() request: WorkspaceContextRequest) {
    return this.financial.createAccount(workspaceContextFromRequest(request), body);
  }

  @Get("accounts")
  @RequireFeature("virtualAccounts")
  @RequirePermissions("analytics:read")
  listAccounts(@Req() request: WorkspaceContextRequest) {
    return this.financial.listAccounts(workspaceContextFromRequest(request));
  }

  @Get("accounts/:id")
  @RequireFeature("virtualAccounts")
  @RequirePermissions("analytics:read")
  getAccount(@Param("id") id: string, @Req() request: WorkspaceContextRequest) {
    return this.financial.getAccount(workspaceContextFromRequest(request), id);
  }

  @Post("accounts/:id/close")
  @RequireFeature("virtualAccounts")
  @RequirePermissions("campaign:create")
  closeAccount(@Param("id") id: string, @Req() request: WorkspaceContextRequest) {
    return this.financial.closeAccount(workspaceContextFromRequest(request), id);
  }

  // ─── Virtual Cards ──────────────────────────────────────────────────────────

  @Post("cards")
  @RequireFeature("virtualCards")
  @RequirePermissions("campaign:create")
  issueCard(@Body() body: IssueVirtualCardDto, @Req() request: WorkspaceContextRequest) {
    return this.financial.issueCard(workspaceContextFromRequest(request), body);
  }

  @Get("cards")
  @RequireFeature("virtualCards")
  @RequirePermissions("analytics:read")
  listCards(@Req() request: WorkspaceContextRequest) {
    return this.financial.listCards(workspaceContextFromRequest(request));
  }

  @Post("cards/:id/fund")
  @RequireFeature("virtualCards")
  @RequirePermissions("campaign:create")
  fundCard(
    @Param("id") id: string,
    @Body() body: FundVirtualCardDto,
    @Req() request: WorkspaceContextRequest
  ) {
    return this.financial.fundCard(workspaceContextFromRequest(request), id, body);
  }

  @Post("cards/:id/freeze")
  @RequireFeature("virtualCards")
  @RequirePermissions("campaign:create")
  freezeCard(@Param("id") id: string, @Req() request: WorkspaceContextRequest) {
    return this.financial.freezeCard(workspaceContextFromRequest(request), id);
  }

  @Post("cards/:id/unfreeze")
  @RequireFeature("virtualCards")
  @RequirePermissions("campaign:create")
  unfreezeCard(@Param("id") id: string, @Req() request: WorkspaceContextRequest) {
    return this.financial.unfreezeCard(workspaceContextFromRequest(request), id);
  }

  @Post("cards/:id/terminate")
  @RequireFeature("virtualCards")
  @RequirePermissions("campaign:create")
  terminateCard(@Param("id") id: string, @Req() request: WorkspaceContextRequest) {
    return this.financial.terminateCard(workspaceContextFromRequest(request), id);
  }

  // ─── Remittance ─────────────────────────────────────────────────────────────

  @Post("remittance/quote")
  @RequireFeature("remittance")
  @RequirePermissions("campaign:create")
  // Needs the workspace context now that a quote is persisted against it — the
  // send leg checks ownership before consuming it.
  getRemittanceQuote(@Body() body: RemittanceQuoteDto, @Req() request: WorkspaceContextRequest) {
    return this.financial.getRemittanceQuote(workspaceContextFromRequest(request), body);
  }

  @Post("remittance/send")
  @RequireFeature("remittance")
  @RequirePermissions("campaign:create")
  sendRemittance(@Body() body: SendRemittanceDto, @Req() request: WorkspaceContextRequest) {
    return this.financial.sendRemittance(workspaceContextFromRequest(request), body);
  }

  @Get("remittance")
  @RequireFeature("remittance")
  @RequirePermissions("analytics:read")
  listRemittanceTransfers(@Req() request: WorkspaceContextRequest) {
    return this.financial.listRemittanceTransfers(workspaceContextFromRequest(request));
  }

  // ─── Wallet Withdrawal ──────────────────────────────────────────────────────

  @Post("wallet-withdrawals")
  @RequireFeature("walletWithdrawals")
  @RequirePermissions("wallet:withdraw")
  requestWithdrawal(@Body() body: RequestWalletWithdrawalDto, @Req() request: WorkspaceContextRequest) {
    return this.financial.requestWithdrawal(workspaceContextFromRequest(request), body);
  }

  @Get("wallet-withdrawals")
  @RequireFeature("walletWithdrawals")
  @RequirePermissions("wallet:withdraw")
  listWithdrawals(@Req() request: WorkspaceContextRequest) {
    return this.financial.listWithdrawals(workspaceContextFromRequest(request));
  }
}
