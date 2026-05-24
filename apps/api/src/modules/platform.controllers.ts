/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
import {
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
  CreateSupportTicketDto,
  QuoteCampaignDto,
  SmmSupplierReferenceDto,
  SmmSupplierReferencesDto
} from "./platform.dtos";
import { AuthSessionService } from "./auth-session.service";
import { ManagedAdsService } from "./managed-ads.service";
import { PlatformService } from "./platform.service";
import {
  workspaceContextFromRequest,
  type HeaderBag,
  type WorkspaceContextRequest
} from "./request-context";

@Controller("health")
export class HealthController {
  constructor(@Inject(PlatformService) private readonly platform: PlatformService) {}

  @Get()
  getHealth() {
    return this.platform.getHealth();
  }
}

@Controller("auth")
export class AuthController {
  constructor(@Inject(AuthSessionService) private readonly auth: AuthSessionService) {}

  @Get("session")
  getSession(@Headers() headers: HeaderBag) {
    return this.auth.getSession(headers);
  }

  @Post("register")
  register(@Body() body: unknown, @Headers() headers: HeaderBag) {
    return this.auth.register(body, headers);
  }

  @Post("login")
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
export class OrganizationsController {
  constructor(@Inject(PlatformService) private readonly platform: PlatformService) {}

  @Get()
  list() {
    return this.platform.listOrganizations();
  }
}

@Controller("teams")
export class TeamsController {
  constructor(@Inject(PlatformService) private readonly platform: PlatformService) {}

  @Get()
  list() {
    return this.platform.listTeamMembers();
  }
}

@Controller("client-profile")
export class ClientProfileController {
  constructor(@Inject(ManagedAdsService) private readonly managedAds: ManagedAdsService) {}

  @Get()
  async get(@Req() request: WorkspaceContextRequest) {
    const profiles = await this.managedAds.listCompanyProfiles(workspaceContextFromRequest(request));

    return profiles[0] ?? null;
  }

  @Patch()
  upsert(@Body() body: Record<string, unknown>, @Req() request: WorkspaceContextRequest) {
    return this.managedAds.upsertCompanyProfile(workspaceContextFromRequest(request), body);
  }
}

@Controller("company-profiles")
export class CompanyProfilesController {
  constructor(@Inject(ManagedAdsService) private readonly managedAds: ManagedAdsService) {}

  @Get()
  list(@Req() request: WorkspaceContextRequest) {
    return this.managedAds.listCompanyProfiles(workspaceContextFromRequest(request));
  }

  @Post()
  create(@Body() body: Record<string, unknown>, @Req() request: WorkspaceContextRequest) {
    return this.managedAds.upsertCompanyProfile(workspaceContextFromRequest(request), body);
  }

  @Patch(":id")
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
export class CampaignsController {
  constructor(
    @Inject(PlatformService) private readonly platform: PlatformService,
    @Inject(ManagedAdsService) private readonly managedAds: ManagedAdsService
  ) {}

  @Get()
  list(@Req() request: WorkspaceContextRequest) {
    return this.managedAds.listCampaigns(workspaceContextFromRequest(request));
  }

  @Get(":id")
  get(@Param("id") id: string, @Req() request: WorkspaceContextRequest) {
    return this.managedAds.getCampaign(workspaceContextFromRequest(request), id);
  }

  @Post()
  create(@Body() body: Record<string, unknown>, @Req() request: WorkspaceContextRequest) {
    return this.managedAds.createCampaign(workspaceContextFromRequest(request), body);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
    @Req() request: WorkspaceContextRequest
  ) {
    return this.managedAds.updateCampaign(workspaceContextFromRequest(request), id, body);
  }

  @Post("quote")
  quote(@Body() body: QuoteCampaignDto, @Req() request: WorkspaceContextRequest) {
    workspaceContextFromRequest(request);

    return this.platform.quoteCampaign(body);
  }

  @Post(":id/start")
  start(@Param("id") id: string, @Req() request: WorkspaceContextRequest) {
    return this.managedAds.startCampaign(workspaceContextFromRequest(request), id);
  }

  @Post(":id/submit")
  submit(
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
    @Req() request: WorkspaceContextRequest
  ) {
    return this.managedAds.submitCampaign(workspaceContextFromRequest(request), id, body);
  }

  @Get(":id/timeline")
  timeline(@Param("id") id: string, @Req() request: WorkspaceContextRequest) {
    return this.managedAds.getCampaign(workspaceContextFromRequest(request), id).then((campaign) => ({
      campaignId: id,
      items: campaign.statusHistory ?? []
    }));
  }

  @Get(":id/notes")
  notes(@Param("id") id: string, @Req() request: WorkspaceContextRequest) {
    return this.managedAds.getCampaign(workspaceContextFromRequest(request), id).then((campaign) =>
      (campaign.notes ?? []).filter((note: { visibility?: string }) => note.visibility === "CLIENT_VISIBLE")
    );
  }

  @Post(":id/notes")
  createNote(
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
    @Req() request: WorkspaceContextRequest
  ) {
    return this.managedAds.addCampaignNote(workspaceContextFromRequest(request), id, body);
  }

  @Get(":id/assets")
  assets(@Param("id") id: string, @Req() request: WorkspaceContextRequest) {
    return this.managedAds.getCampaign(workspaceContextFromRequest(request), id).then((campaign) => campaign.creatives ?? []);
  }

  @Post(":id/assets")
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
  createInvoice(
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
    @Req() request: WorkspaceContextRequest
  ) {
    return this.managedAds.createCampaignInvoice(workspaceContextFromRequest(request), id, body);
  }

  @Post(":id/budget-holds")
  createBudgetHold(
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
    @Req() request: WorkspaceContextRequest
  ) {
    return this.managedAds.createBudgetHold(workspaceContextFromRequest(request), id, body);
  }

  @Post(":id/budget-holds/:holdId/release")
  releaseBudgetHold(
    @Param("id") id: string,
    @Param("holdId") holdId: string,
    @Body() body: Record<string, unknown>,
    @Req() request: WorkspaceContextRequest
  ) {
    return this.managedAds.releaseBudgetHold(workspaceContextFromRequest(request), id, holdId, body);
  }

  @Post(":id/budget-holds/:holdId/capture")
  captureBudgetHold(
    @Param("id") id: string,
    @Param("holdId") holdId: string,
    @Body() body: Record<string, unknown>,
    @Req() request: WorkspaceContextRequest
  ) {
    return this.managedAds.captureBudgetHold(workspaceContextFromRequest(request), id, holdId, body);
  }
}

@Controller("destinations")
export class DestinationsController {
  constructor(@Inject(PlatformService) private readonly platform: PlatformService) {}

  @Get("catalog")
  catalog() {
    return this.platform.listDestinations();
  }
}

@Controller("live")
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
  services() {
    return this.platform.listSmmServices();
  }

  @Get("supplier-services")
  supplierServices() {
    return this.platform.listSmmSupplierServices();
  }

  @Get("balance")
  balance() {
    return this.platform.getSmmSupplierBalance();
  }

  @Get("health")
  health() {
    return this.platform.getSmmSupplierHealth();
  }

  @Post("quote")
  quote(@Body() body: CreateSmmOrderDto, @Req() request: WorkspaceContextRequest) {
    return this.platform.quoteSmmOrder(workspaceContextFromRequest(request), body);
  }

  @Post("orders")
  createOrder(@Body() body: CreateSmmOrderDto, @Req() request: WorkspaceContextRequest) {
    return this.platform.createSmmOrder(workspaceContextFromRequest(request), body);
  }

  @Post("orders/status")
  statuses(@Body() body: SmmSupplierReferencesDto, @Req() request: WorkspaceContextRequest) {
    return this.platform.getSmmOrderStatuses(workspaceContextFromRequest(request), body);
  }

  @Post("orders/refill")
  refill(@Body() body: SmmSupplierReferenceDto, @Req() request: WorkspaceContextRequest) {
    return this.platform.requestSmmRefill(workspaceContextFromRequest(request), body);
  }

  @Post("orders/cancel")
  cancel(@Body() body: SmmSupplierReferencesDto, @Req() request: WorkspaceContextRequest) {
    return this.platform.requestSmmCancel(workspaceContextFromRequest(request), body);
  }
}

@Controller("payments")
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
export class WebhooksController {
  constructor(@Inject(ManagedAdsService) private readonly managedAds: ManagedAdsService) {}

  @Post("korapay")
  korapay(@Body() body: unknown, @Headers("x-korapay-signature") signature?: string) {
    return this.managedAds.handleKorapayWebhook(body, signature);
  }
}

@Controller("wallet")
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
  listTickets(@Req() request: WorkspaceContextRequest) {
    return this.platform.listSupportTickets(workspaceContextFromRequest(request));
  }

  @Post("tickets")
  createTicket(@Body() body: CreateSupportTicketDto, @Req() request: WorkspaceContextRequest) {
    return this.platform.createSupportTicket(workspaceContextFromRequest(request), body);
  }
}

@Controller("media")
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
export class SearchController {
  constructor(@Inject(PlatformService) private readonly platform: PlatformService) {}

  @Get()
  search(@Query("q") query?: string) {
    return this.platform.search(query);
  }
}

@Controller("admin")
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

  @Post("ai/suggestions")
  suggestions() {
    return this.platform.createAiSuggestion();
  }
}

@Controller("admin/campaign-ops")
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
    return this.managedAds.getCampaign(workspaceContextFromRequest(request), id);
  }

  @Get("queue/:id")
  getQueueItem(@Param("id") id: string, @Req() request: WorkspaceContextRequest) {
    return this.managedAds.getCampaign(workspaceContextFromRequest(request), id);
  }

  @Patch("campaigns/:id/status")
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
    return this.managedAds.getCampaign(workspaceContextFromRequest(request), id).then((campaign) => ({
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
export class AuditController {
  constructor(@Inject(PlatformService) private readonly platform: PlatformService) {}

  @Get("logs")
  list(@Req() request: WorkspaceContextRequest) {
    return this.platform.listAuditLogs(workspaceContextFromRequest(request));
  }
}
