/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req
} from "@nestjs/common";

import type {
  CreateSmmOrderDto,
  CreateGrowthOrderDto,
  CreateSupportTicketDto,
  QuoteCampaignDto,
  SmmSupplierReferenceDto,
  SmmSupplierReferencesDto,
  UpdateGrowthOrderDto,
  UpdateGrowthServiceDto
} from "./platform.dtos";
import { AuthSessionService } from "./auth-session.service";
import { Public, RequirePermissions } from "./authorization.decorators";
import { ManagedAdsService } from "./managed-ads.service";
import { PlatformService } from "./platform.service";
import {
  workspaceContextFromRequest,
  type HeaderBag,
  type WorkspaceContextRequest
} from "./request-context";

@Public()
@Controller("health")
export class HealthController {
  constructor(@Inject(PlatformService) private readonly platform: PlatformService) {}

  @Get()
  getHealth() {
    return this.platform.getHealth();
  }
}

@Controller("auth")
@RequirePermissions("analytics:read")
export class AuthController {
  constructor(@Inject(AuthSessionService) private readonly auth: AuthSessionService) {}

  @Get("session")
  getSession(@Headers() headers: HeaderBag) {
    return this.auth.getSession(headers);
  }

  @Post("register")
  @Public()
  register(@Body() body: unknown, @Headers() headers: HeaderBag) {
    return this.auth.register(body, headers);
  }

  @Post("login")
  @Public()
  login(@Body() body: unknown, @Headers() headers: HeaderBag) {
    return this.auth.login(body, headers);
  }

  @Post("logout")
  logout(@Headers() headers: HeaderBag) {
    return this.auth.logout(headers);
  }

  @Post("exchange")
  exchange(@Headers() headers: HeaderBag) {
    return this.auth.issueSession(headers);
  }
}

@Controller("organizations")
@RequirePermissions("admin:access")
export class OrganizationsController {
  constructor(@Inject(PlatformService) private readonly platform: PlatformService) {}

  @Get()
  list() {
    return this.platform.listOrganizations();
  }
}

@Controller("teams")
@RequirePermissions("team:manage")
export class TeamsController {
  constructor(@Inject(PlatformService) private readonly platform: PlatformService) {}

  @Get()
  list() {
    return this.platform.listTeamMembers();
  }
}

@Controller("client-profile")
@RequirePermissions("analytics:read")
export class ClientProfileController {
  constructor(@Inject(ManagedAdsService) private readonly managedAds: ManagedAdsService) {}

  @Get()
  async get(@Req() request: WorkspaceContextRequest) {
    const profiles = await this.managedAds.listCompanyProfiles(
      workspaceContextFromRequest(request)
    );

    return profiles[0] ?? null;
  }

  @Patch()
  @RequirePermissions("campaign:create")
  upsert(@Body() body: Record<string, unknown>, @Req() request: WorkspaceContextRequest) {
    return this.managedAds.upsertCompanyProfile(workspaceContextFromRequest(request), body);
  }
}

@Controller("company-profiles")
@RequirePermissions("analytics:read")
export class CompanyProfilesController {
  constructor(@Inject(ManagedAdsService) private readonly managedAds: ManagedAdsService) {}

  @Get()
  list(@Req() request: WorkspaceContextRequest) {
    return this.managedAds.listCompanyProfiles(workspaceContextFromRequest(request));
  }

  @Post()
  @RequirePermissions("campaign:create")
  create(@Body() body: Record<string, unknown>, @Req() request: WorkspaceContextRequest) {
    return this.managedAds.upsertCompanyProfile(workspaceContextFromRequest(request), body);
  }

  @Patch(":id")
  @RequirePermissions("campaign:create")
  update(
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
    @Req() request: WorkspaceContextRequest
  ) {
    return this.managedAds.upsertCompanyProfile(workspaceContextFromRequest(request), {
      ...body,
      id
    });
  }
}

@Controller("campaigns")
@RequirePermissions("analytics:read")
export class CampaignsController {
  constructor(
    @Inject(PlatformService) private readonly platform: PlatformService,
    @Inject(ManagedAdsService) private readonly managedAds: ManagedAdsService
  ) {}

  @Get()
  list(@Req() request: WorkspaceContextRequest) {
    return this.managedAds.listCampaigns(workspaceContextFromRequest(request));
  }

  @Get(":id/ledger")
  ledger(@Param("id") id: string, @Req() request: WorkspaceContextRequest) {
    return this.managedAds.listCampaignLedger(workspaceContextFromRequest(request), id);
  }

  @Get(":id/budget-summary")
  budgetSummary(@Param("id") id: string, @Req() request: WorkspaceContextRequest) {
    return this.managedAds.getCampaignBudgetSummary(workspaceContextFromRequest(request), id);
  }

  @Get(":id/spend-breakdown")
  spendBreakdown(@Param("id") id: string, @Req() request: WorkspaceContextRequest) {
    return this.managedAds.getCampaignSpendBreakdown(workspaceContextFromRequest(request), id);
  }

  @Get(":id")
  get(@Param("id") id: string, @Req() request: WorkspaceContextRequest) {
    return this.managedAds.getCampaign(workspaceContextFromRequest(request), id);
  }

  @Post()
  @RequirePermissions("campaign:create")
  create(@Body() body: Record<string, unknown>, @Req() request: WorkspaceContextRequest) {
    return this.managedAds.createCampaign(workspaceContextFromRequest(request), body);
  }

  @Patch(":id")
  @RequirePermissions("campaign:manage")
  update(
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
    @Req() request: WorkspaceContextRequest
  ) {
    return this.managedAds.updateCampaign(workspaceContextFromRequest(request), id, body);
  }

  @Post("quote")
  @RequirePermissions("campaign:create")
  quote(@Body() body: QuoteCampaignDto, @Req() request: WorkspaceContextRequest) {
    workspaceContextFromRequest(request);
    if (process.env.NODE_ENV === "production") {
      throw new BadRequestException(
        "Campaign estimates are prepared by the Fliptrybe team after brief review."
      );
    }

    return this.platform.quoteCampaign(body);
  }

  @Post(":id/start")
  @RequirePermissions("campaign:manage")
  start(@Param("id") id: string, @Req() request: WorkspaceContextRequest) {
    return this.managedAds.startCampaign(workspaceContextFromRequest(request), id);
  }

  @Post(":id/submit")
  @RequirePermissions("campaign:create")
  submit(
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
    @Req() request: WorkspaceContextRequest
  ) {
    return this.managedAds.submitCampaign(workspaceContextFromRequest(request), id, body);
  }

  @Post(":id/actions/pause")
  @RequirePermissions("campaign:manage")
  pause(
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
    @Req() request: WorkspaceContextRequest
  ) {
    return this.managedAds.pauseCampaign(workspaceContextFromRequest(request), id, body);
  }

  @Post(":id/actions/resume")
  @RequirePermissions("campaign:manage")
  resume(
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
    @Req() request: WorkspaceContextRequest
  ) {
    return this.managedAds.resumeCampaign(workspaceContextFromRequest(request), id, body);
  }

  @Post(":id/actions/request-changes")
  @RequirePermissions("campaign:manage")
  requestChanges(
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
    @Req() request: WorkspaceContextRequest
  ) {
    return this.managedAds.requestCampaignChanges(workspaceContextFromRequest(request), id, body);
  }

  @Post(":id/actions/increase-budget")
  @RequirePermissions("payment:manage")
  increaseBudget(
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
    @Req() request: WorkspaceContextRequest
  ) {
    return this.managedAds.increaseCampaignBudget(workspaceContextFromRequest(request), id, body);
  }

  @Post(":id/actions/decrease-budget")
  @RequirePermissions("payment:manage")
  decreaseBudget(
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
    @Req() request: WorkspaceContextRequest
  ) {
    return this.managedAds.decreaseCampaignBudget(workspaceContextFromRequest(request), id, body);
  }

  @Post(":id/actions/stop")
  @RequirePermissions("campaign:manage")
  stop(
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
    @Req() request: WorkspaceContextRequest
  ) {
    return this.managedAds.stopCampaign(workspaceContextFromRequest(request), id, body);
  }

  @Get(":id/timeline")
  timeline(@Param("id") id: string, @Req() request: WorkspaceContextRequest) {
    return this.managedAds
      .getCampaign(workspaceContextFromRequest(request), id)
      .then((campaign) => ({
        campaignId: id,
        items: campaign.statusHistory ?? []
      }));
  }

  @Get(":id/audit")
  @RequirePermissions("audit:read")
  audit(@Param("id") id: string, @Req() request: WorkspaceContextRequest) {
    return this.managedAds.listCampaignAuditTrail(workspaceContextFromRequest(request), id);
  }

  @Get(":id/budget")
  budget(@Param("id") id: string, @Req() request: WorkspaceContextRequest) {
    return this.managedAds.getCampaignBudgetSummary(workspaceContextFromRequest(request), id);
  }

  @Get(":id/notes")
  notes(@Param("id") id: string, @Req() request: WorkspaceContextRequest) {
    return this.managedAds
      .getCampaign(workspaceContextFromRequest(request), id)
      .then((campaign) =>
        (campaign.notes ?? []).filter(
          (note: { visibility?: string }) => note.visibility === "CLIENT_VISIBLE"
        )
      );
  }

  @Post(":id/notes")
  @RequirePermissions("campaign:manage")
  createNote(
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
    @Req() request: WorkspaceContextRequest
  ) {
    return this.managedAds.addCampaignNote(workspaceContextFromRequest(request), id, body);
  }

  @Get(":id/assets")
  assets(@Param("id") id: string, @Req() request: WorkspaceContextRequest) {
    return this.managedAds
      .getCampaign(workspaceContextFromRequest(request), id)
      .then((campaign) => campaign.creatives ?? []);
  }

  @Post(":id/assets")
  @RequirePermissions("campaign:manage")
  createAsset(
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
    @Req() request: WorkspaceContextRequest
  ) {
    return this.managedAds.addCampaignAsset(workspaceContextFromRequest(request), id, body);
  }

  @Get(":id/reports")
  reports(@Param("id") id: string, @Req() request: WorkspaceContextRequest) {
    return this.managedAds.listCampaignReports(workspaceContextFromRequest(request), id);
  }

  @Post(":id/invoices")
  @RequirePermissions("payment:manage")
  createInvoice(
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
    @Req() request: WorkspaceContextRequest
  ) {
    return this.managedAds.createCampaignInvoice(workspaceContextFromRequest(request), id, body);
  }

  @Post(":id/budget-holds")
  @RequirePermissions("payment:manage")
  createBudgetHold(
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
    @Req() request: WorkspaceContextRequest
  ) {
    return this.managedAds.createBudgetHold(workspaceContextFromRequest(request), id, body);
  }

  @Post(":id/budget-holds/:holdId/release")
  @RequirePermissions("payment:manage")
  releaseBudgetHold(
    @Param("id") id: string,
    @Param("holdId") holdId: string,
    @Body() body: Record<string, unknown>,
    @Req() request: WorkspaceContextRequest
  ) {
    return this.managedAds.releaseBudgetHold(
      workspaceContextFromRequest(request),
      id,
      holdId,
      body
    );
  }

  @Post(":id/budget-holds/:holdId/capture")
  @RequirePermissions("payment:manage")
  captureBudgetHold(
    @Param("id") id: string,
    @Param("holdId") holdId: string,
    @Body() body: Record<string, unknown>,
    @Req() request: WorkspaceContextRequest
  ) {
    return this.managedAds.captureBudgetHold(
      workspaceContextFromRequest(request),
      id,
      holdId,
      body
    );
  }
}

@Controller("destinations")
@Public()
export class DestinationsController {
  constructor(@Inject(PlatformService) private readonly platform: PlatformService) {}

  @Get("catalog")
  catalog() {
    return this.platform.listDestinations();
  }
}

@Controller("live")
@RequirePermissions("analytics:read")
export class LiveController {
  constructor(
    @Inject(PlatformService) private readonly platform: PlatformService,
    @Inject(ManagedAdsService) private readonly managedAds: ManagedAdsService
  ) {}

  @Get()
  list(@Req() request: WorkspaceContextRequest) {
    return this.platform.listLivePromotions(workspaceContextFromRequest(request));
  }

  @Post("boosts")
  @RequirePermissions("campaign:create")
  createBoost(@Req() request: WorkspaceContextRequest) {
    return this.managedAds.createCampaign(workspaceContextFromRequest(request), {
      name: "Realtime livestream boost",
      objective: "LIVE_VIEWERS",
      destinationKind: "TIKTOK_LIVE",
      destinationUrl: "https://tiktok.com/@fliptrybe/live"
    });
  }
}

@Controller("smm")
export class SmmController {
  constructor(@Inject(PlatformService) private readonly platform: PlatformService) {}

  @Get("services")
  @Public()
  services() {
    return this.platform.listSmmServices();
  }

  @Get("supplier-services")
  @RequirePermissions("admin:access")
  supplierServices() {
    return this.platform.listSmmSupplierServices();
  }

  @Get("balance")
  @RequirePermissions("admin:access")
  balance() {
    return this.platform.getSmmSupplierBalance();
  }

  @Get("health")
  @RequirePermissions("admin:access")
  health() {
    return this.platform.getSmmSupplierHealth();
  }

  @Post("quote")
  @RequirePermissions("campaign:create")
  quote(@Body() body: CreateSmmOrderDto, @Req() request: WorkspaceContextRequest) {
    return this.platform.quoteSmmOrder(workspaceContextFromRequest(request), body);
  }

  @Post("orders")
  @RequirePermissions("campaign:create")
  createOrder(@Body() body: CreateSmmOrderDto, @Req() request: WorkspaceContextRequest) {
    return this.platform.createSmmOrder(workspaceContextFromRequest(request), body);
  }

  @Post("orders/status")
  @RequirePermissions("campaign:manage")
  statuses(@Body() body: SmmSupplierReferencesDto, @Req() request: WorkspaceContextRequest) {
    return this.platform.getSmmOrderStatuses(workspaceContextFromRequest(request), body);
  }

  @Post("orders/refill")
  @RequirePermissions("campaign:manage")
  refill(@Body() body: SmmSupplierReferenceDto, @Req() request: WorkspaceContextRequest) {
    return this.platform.requestSmmRefill(workspaceContextFromRequest(request), body);
  }

  @Post("orders/cancel")
  @RequirePermissions("campaign:manage")
  cancel(@Body() body: SmmSupplierReferencesDto, @Req() request: WorkspaceContextRequest) {
    return this.platform.requestSmmCancel(workspaceContextFromRequest(request), body);
  }
}

@Controller("growth")
@RequirePermissions("analytics:read")
export class GrowthController {
  constructor(@Inject(PlatformService) private readonly platform: PlatformService) {}

  @Get("catalog")
  @Public()
  catalog() {
    return this.platform.listGrowthCatalog();
  }

  @Get("services")
  @Public()
  services() {
    return this.platform.listGrowthServices();
  }

  @Get("risk-report")
  @RequirePermissions("admin:access")
  riskReport() {
    return this.platform.getGrowthRiskReport();
  }

  @Get("orders")
  orders(@Req() request: WorkspaceContextRequest) {
    return this.platform.listGrowthOrders(workspaceContextFromRequest(request));
  }

  @Get("orders/:id")
  order(@Param("id") id: string, @Req() request: WorkspaceContextRequest) {
    return this.platform.getGrowthOrder(workspaceContextFromRequest(request), id);
  }

  @Post("orders")
  @RequirePermissions("campaign:create")
  createOrder(@Body() body: CreateGrowthOrderDto, @Req() request: WorkspaceContextRequest) {
    return this.platform.createGrowthOrder(workspaceContextFromRequest(request), body);
  }
}

@Controller("payments")
@RequirePermissions("payment:manage")
export class PaymentsController {
  constructor(@Inject(ManagedAdsService) private readonly managedAds: ManagedAdsService) {}

  @Post("intents")
  createIntent(@Body() body: Record<string, unknown>, @Req() request: WorkspaceContextRequest) {
    return this.managedAds.createPaymentIntent(workspaceContextFromRequest(request), body);
  }

  @Post("verify/:reference")
  verify(@Param("reference") reference: string, @Req() request: WorkspaceContextRequest) {
    return this.managedAds.verifyPayment(workspaceContextFromRequest(request), reference);
  }
}

@Controller("api/webhooks")
@Public()
export class WebhooksController {
  constructor(@Inject(ManagedAdsService) private readonly managedAds: ManagedAdsService) {}

  @Post("korapay")
  korapay(@Body() body: unknown, @Headers("x-korapay-signature") signature?: string) {
    return this.managedAds.handleKorapayWebhook(body, signature);
  }
}

@Controller("wallet")
@RequirePermissions("payment:manage")
export class WalletController {
  constructor(@Inject(ManagedAdsService) private readonly managedAds: ManagedAdsService) {}

  @Get()
  getWallet(@Req() request: WorkspaceContextRequest) {
    return this.managedAds.getWallet(workspaceContextFromRequest(request));
  }

  @Post("funding-intents")
  createFundingIntent(
    @Body() body: Record<string, unknown>,
    @Req() request: WorkspaceContextRequest
  ) {
    return this.managedAds.createFundingIntent(workspaceContextFromRequest(request), body);
  }
}

@Controller("invoices")
@RequirePermissions("payment:manage")
export class InvoicesController {
  constructor(@Inject(ManagedAdsService) private readonly managedAds: ManagedAdsService) {}

  @Get()
  list(@Req() request: WorkspaceContextRequest) {
    return this.managedAds.listInvoices(workspaceContextFromRequest(request));
  }

  @Get(":id")
  get(@Param("id") id: string, @Req() request: WorkspaceContextRequest) {
    return this.managedAds.getInvoice(workspaceContextFromRequest(request), id);
  }

  @Post(":id/pay")
  pay(
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
    @Req() request: WorkspaceContextRequest
  ) {
    return this.managedAds.payInvoice(workspaceContextFromRequest(request), id, body);
  }
}

@Controller("analytics")
@RequirePermissions("analytics:read")
export class AnalyticsController {
  constructor(@Inject(PlatformService) private readonly platform: PlatformService) {}

  @Get("overview")
  overview(@Req() request: WorkspaceContextRequest) {
    return this.platform.getAnalyticsOverview(workspaceContextFromRequest(request));
  }

  @Get("ai-insights")
  aiInsights(@Req() request: WorkspaceContextRequest) {
    return this.platform.getAiAdsInsights(workspaceContextFromRequest(request));
  }
}

@Controller("notifications")
@RequirePermissions("analytics:read")
export class NotificationsController {
  constructor(@Inject(ManagedAdsService) private readonly managedAds: ManagedAdsService) {}

  @Get()
  list(@Req() request: WorkspaceContextRequest) {
    return this.managedAds.listNotifications(workspaceContextFromRequest(request));
  }

  @Patch(":id/read")
  read(@Param("id") id: string, @Req() request: WorkspaceContextRequest) {
    return this.managedAds.markNotificationRead(workspaceContextFromRequest(request), id);
  }

  @Post("read-all")
  readAll(@Req() request: WorkspaceContextRequest) {
    return this.managedAds.markAllNotificationsRead(workspaceContextFromRequest(request));
  }
}

@Controller("referrals")
@RequirePermissions("admin:access")
export class ReferralsController {
  @Post("accounts")
  createAccount() {
    return {
      id: "ref_demo",
      code: "FLIPTRYBE",
      commissionRateBps: 500,
      status: "ACTIVE"
    };
  }
}

@Controller("support")
export class SupportController {
  constructor(@Inject(PlatformService) private readonly platform: PlatformService) {}

  @Get("tickets")
  @RequirePermissions("support:manage")
  listTickets(@Req() request: WorkspaceContextRequest) {
    return this.platform.listSupportTickets(workspaceContextFromRequest(request));
  }

  @Post("tickets")
  @RequirePermissions("analytics:read")
  createTicket(@Body() body: CreateSupportTicketDto, @Req() request: WorkspaceContextRequest) {
    return this.platform.createSupportTicket(workspaceContextFromRequest(request), body);
  }
}

@Controller("media")
@RequirePermissions("campaign:manage")
export class MediaController {
  constructor(@Inject(ManagedAdsService) private readonly managedAds: ManagedAdsService) {}

  @Post("uploads")
  createUpload(@Body() body: Record<string, unknown>, @Req() request: WorkspaceContextRequest) {
    return this.managedAds.createUploadIntent(workspaceContextFromRequest(request), body);
  }

  @Post("upload-intents")
  createUploadIntent(
    @Body() body: Record<string, unknown>,
    @Req() request: WorkspaceContextRequest
  ) {
    return this.managedAds.createUploadIntent(workspaceContextFromRequest(request), body);
  }

  @Post("uploads/:assetId/complete")
  completeUpload(
    @Param("assetId") assetId: string,
    @Body() body: Record<string, unknown>,
    @Req() request: WorkspaceContextRequest
  ) {
    return this.managedAds.completeUpload(workspaceContextFromRequest(request), assetId, body);
  }
}

@Controller("search")
@RequirePermissions("analytics:read")
export class SearchController {
  constructor(@Inject(PlatformService) private readonly platform: PlatformService) {}

  @Get()
  search(@Query("q") query?: string) {
    return this.platform.search(query);
  }
}

@Controller("admin")
@RequirePermissions("admin:access")
export class AdminController {
  constructor(@Inject(PlatformService) private readonly platform: PlatformService) {}

  @Get("overview")
  overview() {
    return this.platform.getAdminOverview();
  }

  @Get("smm/health")
  smmHealth() {
    return this.platform.getSmmSupplierHealth();
  }

  @Get("ai/suggestions")
  suggestionPreview() {
    return this.platform.createAiSuggestion();
  }

  @Post("ai/suggestions")
  suggestions() {
    return this.platform.createAiSuggestion();
  }
}

@Controller("admin/growth")
@RequirePermissions("admin:access")
export class AdminGrowthController {
  constructor(@Inject(PlatformService) private readonly platform: PlatformService) {}

  @Get("overview")
  overview(@Req() request: WorkspaceContextRequest) {
    return this.platform.getGrowthOverview(workspaceContextFromRequest(request));
  }

  @Get("services")
  services(@Req() request: WorkspaceContextRequest) {
    return this.platform.listAdminGrowthServices(workspaceContextFromRequest(request));
  }

  @Patch("services/:code")
  updateService(
    @Param("code") code: string,
    @Body() body: UpdateGrowthServiceDto,
    @Req() request: WorkspaceContextRequest
  ) {
    return this.platform.updateGrowthService(workspaceContextFromRequest(request), code, body);
  }

  @Get("orders")
  orders(@Req() request: WorkspaceContextRequest) {
    return this.platform.listGrowthOrders(workspaceContextFromRequest(request));
  }

  @Patch("orders/:id")
  @RequirePermissions("admin:access", "payment:manage")
  updateOrder(
    @Param("id") id: string,
    @Body() body: UpdateGrowthOrderDto,
    @Req() request: WorkspaceContextRequest
  ) {
    return this.platform.updateGrowthOrder(workspaceContextFromRequest(request), id, body);
  }

  @Post("orders/:id/override")
  @RequirePermissions("admin:access", "payment:manage")
  overrideOrder(
    @Param("id") id: string,
    @Body() body: UpdateGrowthOrderDto,
    @Req() request: WorkspaceContextRequest
  ) {
    return this.platform.updateGrowthOrder(workspaceContextFromRequest(request), id, body);
  }

  @Get("supplier-audit")
  supplierAudit(@Req() request: WorkspaceContextRequest) {
    return this.platform.getGrowthSupplierAudit(workspaceContextFromRequest(request));
  }

  @Get("risk-report")
  riskReport() {
    return this.platform.getGrowthRiskReport();
  }
}

@Controller("admin/campaign-ops")
@RequirePermissions("admin:access", "campaign:manage")
export class AdminCampaignOpsController {
  constructor(@Inject(ManagedAdsService) private readonly managedAds: ManagedAdsService) {}

  @Get("overview")
  overview(@Req() request: WorkspaceContextRequest) {
    return this.managedAds.getAdminOverview(workspaceContextFromRequest(request));
  }

  @Get("campaigns")
  list(@Query() query: Record<string, unknown>, @Req() request: WorkspaceContextRequest) {
    return this.managedAds.listAdminCampaigns(workspaceContextFromRequest(request), query);
  }

  @Get("queue")
  queue(@Query() query: Record<string, unknown>, @Req() request: WorkspaceContextRequest) {
    return this.managedAds.listAdminCampaigns(workspaceContextFromRequest(request), query);
  }

  @Get("campaigns/:id")
  get(@Param("id") id: string, @Req() request: WorkspaceContextRequest) {
    return this.managedAds.getAdminCampaign(workspaceContextFromRequest(request), id);
  }

  @Get("queue/:id")
  getQueueItem(@Param("id") id: string, @Req() request: WorkspaceContextRequest) {
    return this.managedAds.getAdminCampaign(workspaceContextFromRequest(request), id);
  }

  @Patch("campaigns/:id/status")
  @RequirePermissions("admin:access", "campaign:approve")
  updateStatus(
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
    @Req() request: WorkspaceContextRequest
  ) {
    return this.managedAds.updateAdminStatus(workspaceContextFromRequest(request), id, body);
  }

  @Patch("campaigns/:id/assignment")
  updateAssignment(
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
    @Req() request: WorkspaceContextRequest
  ) {
    return this.managedAds.updateAssignment(workspaceContextFromRequest(request), id, body);
  }

  @Post("campaigns/:id/notes")
  addNote(
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
    @Req() request: WorkspaceContextRequest
  ) {
    return this.managedAds.addCampaignNote(workspaceContextFromRequest(request), id, body, true);
  }

  @Post("campaigns/:id/ad-urls")
  addPlacement(
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
    @Req() request: WorkspaceContextRequest
  ) {
    return this.managedAds.createManualPlacement(workspaceContextFromRequest(request), id, body);
  }

  @Post("campaigns/:id/metrics")
  addMetrics(
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
    @Req() request: WorkspaceContextRequest
  ) {
    return this.managedAds.addManualMetric(workspaceContextFromRequest(request), id, body);
  }

  @Post("campaigns/:id/reports")
  createReport(
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
    @Req() request: WorkspaceContextRequest
  ) {
    return this.managedAds.createReport(workspaceContextFromRequest(request), id, body);
  }

  @Post("reports/:reportId/publish")
  @RequirePermissions("admin:access", "campaign:approve")
  publishReport(@Param("reportId") reportId: string, @Req() request: WorkspaceContextRequest) {
    return this.managedAds.publishReport(workspaceContextFromRequest(request), reportId);
  }

  @Get("reports")
  reports(@Req() request: WorkspaceContextRequest) {
    return this.managedAds.listAdminReports(workspaceContextFromRequest(request));
  }

  @Get("activity")
  globalActivity(@Req() request: WorkspaceContextRequest) {
    return this.managedAds.listAdminActivity(workspaceContextFromRequest(request));
  }

  @Get("campaigns/:id/activity")
  activity(@Param("id") id: string, @Req() request: WorkspaceContextRequest) {
    return this.managedAds
      .getAdminCampaign(workspaceContextFromRequest(request), id)
      .then((campaign) => ({
        campaignId: id,
        statusHistory: campaign.statusHistory ?? [],
        notes: campaign.notes ?? []
      }));
  }

  @Post("bulk")
  bulk(@Body() body: Record<string, unknown>, @Req() request: WorkspaceContextRequest) {
    return this.managedAds.bulkAdminAction(workspaceContextFromRequest(request), body);
  }
}

@Controller("audit")
@RequirePermissions("audit:read")
export class AuditController {
  constructor(@Inject(PlatformService) private readonly platform: PlatformService) {}

  @Get("logs")
  list(@Req() request: WorkspaceContextRequest) {
    return this.platform.listAuditLogs(workspaceContextFromRequest(request));
  }
}
