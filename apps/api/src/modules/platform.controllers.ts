/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Inject,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req
} from "@nestjs/common";

import { publicFeatureFlags } from "@fliptrybe/feature-flags";

import type {
  CreateGrowthOrderDto,
  QuoteCampaignDto,
  UpdateGrowthOrderDto,
  UpdateGrowthServiceDto
} from "./platform.dtos";
import { AuthSessionService } from "./auth-session.service";
import { RequireAdult } from "./age.decorators";
import { Public, RequirePermissions } from "./authorization.decorators";
import { ManagedAdsService } from "./managed-ads.service";
import { PlatformService } from "./platform.service";
import {
  workspaceContextFromRequest,
  type HeaderBag,
  type WorkspaceContextRequest
} from "./request-context";

@Public()
@Controller()
export class RootController {
  @Get()
  getRoot() {
    return {
      name: "FlipTrybe Ads Campaigner API",
      status: "ok",
      version: "0.1.0",
      endpoints: {
        health: "/v1/health",
        docs: "/docs"
      }
    };
  }
}

@Public()
@Controller("health")
export class HealthController {
  constructor(@Inject(PlatformService) private readonly platform: PlatformService) {}

  @Get()
  getHealth() {
    return this.platform.getHealth();
  }
}

/**
 * Lets the browser bundle render navigation and screens against the same flag
 * set the API enforces. Client components cannot read `process.env`, so without
 * this the web app would keep linking to verticals that answer 503.
 *
 * Public and unauthenticated on purpose: which verticals a deployment runs is
 * not a secret, and the nav has to be correct before a user signs in (guest
 * checkout, marketing CTAs). No credentials or provider details are exposed.
 */
@Public()
@Controller("platform")
export class PlatformConfigController {
  @Get("feature-flags")
  getFeatureFlags() {
    return { flags: publicFeatureFlags() };
  }
}

@Controller("auth")
@RequirePermissions("analytics:read")
export class AuthController {
  constructor(@Inject(AuthSessionService) private readonly auth: AuthSessionService) {}

  @Get("session")
  @Public()
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

  // Both password-reset routes are @Public by necessity — the caller is locked
  // out. The global ThrottlerGuard is the first line of defence; per-user
  // issuance limits and enumeration-safe responses live in the service.
  @Post("password/forgot")
  @Public()
  forgotPassword(@Body() body: { identifier?: string }, @Headers() headers: HeaderBag) {
    const forwardedFor = headers["x-forwarded-for"];
    const requestIp = (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor)
      ?.split(",")[0]
      ?.trim();

    return this.auth.requestPasswordReset(body?.identifier ?? "", requestIp);
  }

  @Post("password/reset")
  @Public()
  resetPassword(@Body() body: { token?: string; password?: string }) {
    return this.auth.resetPassword(body?.token ?? "", body?.password ?? "");
  }

  @Get("sessions")
  sessions(@Headers() headers: HeaderBag) {
    return this.auth.listSessions(headers);
  }

  @Delete("sessions/:id")
  revokeSession(@Param("id") id: string, @Headers() headers: HeaderBag) {
    return this.auth.revokeSession(headers, id);
  }

  @Post("exchange")
  exchange(@Headers() headers: HeaderBag) {
    return this.auth.issueSession(headers);
  }
}

@Controller("workspace")
@RequirePermissions("analytics:read")
export class WorkspaceController {
  constructor(@Inject(PlatformService) private readonly platform: PlatformService) {}

  @Get()
  get(@Req() request: WorkspaceContextRequest) {
    return this.platform.getWorkspace(workspaceContextFromRequest(request));
  }

  // team:manage is OWNER/ADMIN only — MANAGER can run campaigns but must not be
  // able to rename the workspace they operate in.
  @Patch()
  @RequirePermissions("team:manage")
  update(@Body() body: { name?: string }, @Req() request: WorkspaceContextRequest) {
    return this.platform.updateWorkspace(body, workspaceContextFromRequest(request));
  }
}

@Controller("organizations")
@RequirePermissions("admin:access")
export class OrganizationsController {
  constructor(@Inject(PlatformService) private readonly platform: PlatformService) {}

  @Get()
  list(@Req() request: WorkspaceContextRequest) {
    return this.platform.listOrganizations(workspaceContextFromRequest(request));
  }
}

@Controller("teams")
@RequirePermissions("team:manage")
export class TeamsController {
  constructor(@Inject(PlatformService) private readonly platform: PlatformService) {}

  @Get()
  list(@Req() request: WorkspaceContextRequest) {
    return this.platform.listTeamMembers(workspaceContextFromRequest(request));
  }

  @Get("projects")
  projects(@Req() request: WorkspaceContextRequest) {
    return this.platform.listTeamProjects(workspaceContextFromRequest(request));
  }

  @Get("approvals")
  approvals(@Req() request: WorkspaceContextRequest) {
    return this.platform.listTeamApprovals(workspaceContextFromRequest(request));
  }

  @Post("invite")
  invite(@Body() body: { username: string; role: string }, @Req() request: WorkspaceContextRequest) {
    return this.platform.inviteTeamMember(body, workspaceContextFromRequest(request));
  }

  @Patch(":id/role")
  updateRole(
    @Param("id") id: string,
    @Body() body: { role: string },
    @Req() request: WorkspaceContextRequest
  ) {
    return this.platform.updateTeamMemberRole(id, body.role, workspaceContextFromRequest(request));
  }

  @Delete(":id")
  remove(@Param("id") id: string, @Req() request: WorkspaceContextRequest) {
    return this.platform.removeTeamMember(id, workspaceContextFromRequest(request));
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

@Controller("ad-accounts")
@RequirePermissions("analytics:read")
export class AdAccountsController {
  constructor(@Inject(ManagedAdsService) private readonly managedAds: ManagedAdsService) {}

  @Get()
  list(@Req() request: WorkspaceContextRequest) {
    return this.managedAds.listAdAccounts(workspaceContextFromRequest(request));
  }

  @Get(":id")
  get(@Param("id") id: string, @Req() request: WorkspaceContextRequest) {
    return this.managedAds.getAdAccount(workspaceContextFromRequest(request), id);
  }

  @Post()
  @RequirePermissions("campaign:create")
  create(@Body() body: Record<string, unknown>, @Req() request: WorkspaceContextRequest) {
    return this.managedAds.createAdAccount(workspaceContextFromRequest(request), body);
  }

  @Patch(":id")
  @RequirePermissions("campaign:manage")
  update(
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
    @Req() request: WorkspaceContextRequest
  ) {
    return this.managedAds.updateAdAccount(workspaceContextFromRequest(request), id, body);
  }

  @Patch(":id/kyc")
  @RequirePermissions("admin:access", "campaign:approve")
  reviewKyc(
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
    @Req() request: WorkspaceContextRequest
  ) {
    return this.managedAds.reviewAdAccountKyc(workspaceContextFromRequest(request), id, body);
  }
}

// The signed-in user's own account settings. analytics:read is the broadest
// permission (held by every workspace role), so any authenticated member can set
// their own date of birth — the value that unlocks the 18+ age gate.
@Controller("me")
@RequirePermissions("analytics:read")
export class MeController {
  constructor(@Inject(PlatformService) private readonly platform: PlatformService) {}

  @Patch("date-of-birth")
  setDateOfBirth(
    @Body() body: { dateOfBirth: string },
    @Req() request: WorkspaceContextRequest
  ) {
    return this.platform.updateMyDateOfBirth(
      workspaceContextFromRequest(request),
      body?.dateOfBirth
    );
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

  @Get("budget-optimization")
  @RequirePermissions("payment:manage")
  budgetOptimization(@Req() request: WorkspaceContextRequest) {
    return this.managedAds.getBudgetOptimizationRecommendations(workspaceContextFromRequest(request));
  }

  @Get(":id")
  get(@Param("id") id: string, @Req() request: WorkspaceContextRequest) {
    return this.managedAds.getCampaign(workspaceContextFromRequest(request), id);
  }

  // Managed ad campaigns are age-restricted (18+) per the route map. The gate is on
  // creation only — listing/viewing existing campaigns is not age-gated.
  @Post()
  @RequirePermissions("campaign:create")
  @RequireAdult()
  create(@Body() body: Record<string, unknown>, @Req() request: WorkspaceContextRequest) {
    return this.managedAds.createCampaign(workspaceContextFromRequest(request), body);
  }

  @Post("wizard")
  @RequirePermissions("campaign:create")
  @RequireAdult()
  createFromWizard(@Body() body: Record<string, unknown>, @Req() request: WorkspaceContextRequest) {
    return this.managedAds.createCampaignFromWizard(workspaceContextFromRequest(request), body);
  }

  @Post("recommendations")
  @RequirePermissions("campaign:create")
  recommendations(@Body() body: Record<string, unknown>, @Req() request: WorkspaceContextRequest) {
    return this.managedAds.getCampaignRecommendations(workspaceContextFromRequest(request), body);
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

  @Get(":id/outcome")
  getOutcome(@Param("id") id: string, @Req() request: WorkspaceContextRequest) {
    return this.managedAds.getCampaignOutcome(workspaceContextFromRequest(request), id);
  }

  @Post(":id/outcome")
  @RequirePermissions("campaign:manage")
  recordOutcome(
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
    @Req() request: WorkspaceContextRequest
  ) {
    return this.managedAds.recordCampaignOutcome(workspaceContextFromRequest(request), id, body);
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

  @Post(":id/actions/transfer-budget")
  @RequirePermissions("payment:manage")
  transferBudget(
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
    @Req() request: WorkspaceContextRequest
  ) {
    return this.managedAds.transferCampaignBudget(workspaceContextFromRequest(request), id, body);
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

  // quote / orders / orders/status / orders/refill / orders/cancel were removed
  // (see platform.service.ts) — they placed real supplier-side orders through
  // an in-memory smmOrders array with no ledger entry and no persisted row.
  // Real SMM order placement has always gone through GrowthOrder; see
  // GrowthController below and migration 20260807070000_drop_dead_smm_order_table.
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

  @Get("ledger")
  listLedger(
    @Req() request: WorkspaceContextRequest,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("limit") limit?: string,
    @Query("cursor") cursor?: string
  ) {
    return this.managedAds.listWalletLedger(workspaceContextFromRequest(request), {
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
      ...(limit ? { limit: Number(limit) } : {}),
      ...(cursor ? { cursor } : {})
    });
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

  @Get("preferences")
  preferences(@Req() request: WorkspaceContextRequest) {
    return this.managedAds.listNotificationPreferences(workspaceContextFromRequest(request));
  }

  @Put("preferences/:eventName")
  updatePreference(
    @Param("eventName") eventName: string,
    @Body() body: { inApp?: boolean; email?: boolean; sms?: boolean; whatsapp?: boolean },
    @Req() request: WorkspaceContextRequest
  ) {
    return this.managedAds.upsertNotificationPreference(
      workspaceContextFromRequest(request),
      eventName,
      body
    );
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

// A duplicate SupportController (same class name, different file) already
// lives in ./support/support.module.ts at the exact same route prefix
// ("support/tickets") — GET/POST /support/tickets registered from BOTH here
// and there. It's a genuine route-shadowing conflict, not a deliberate
// alias: the frontend calls POST /support/tickets/:id/replies, which only
// exists on the SupportModule version, confirming that's the one actually
// winning at runtime — this one was dead code, reachable by nothing.
// Removed rather than left in place, since which controller wins is an
// accident of module-registration order, not something to depend on.

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

  @Get("assets")
  listAssets(@Query("kind") kind: string | undefined, @Req() request: WorkspaceContextRequest) {
    return this.managedAds.listMediaAssets(
      workspaceContextFromRequest(request),
      kind === undefined ? {} : { kind }
    );
  }
}

@Controller("search")
@RequirePermissions("analytics:read")
export class SearchController {
  constructor(@Inject(PlatformService) private readonly platform: PlatformService) {}

  @Get()
  search(@Query("q") query: string | undefined, @Req() request: WorkspaceContextRequest) {
    return this.platform.search(query, workspaceContextFromRequest(request));
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

@Controller("admin/users")
@RequirePermissions("admin:access")
export class AdminUsersController {
  constructor(@Inject(PlatformService) private readonly platform: PlatformService) {}

  @Get()
  search(
    @Query("q") q?: string,
    @Query("status") status?: "ACTIVE" | "SUSPENDED",
    @Query("limit") limit?: string
  ) {
    return this.platform.adminSearchUsers({
      ...(q ? { q } : {}),
      ...(status ? { status } : {}),
      ...(limit ? { limit: Number(limit) } : {})
    });
  }

  @Get(":id")
  detail(@Param("id") id: string) {
    return this.platform.adminGetUser(id);
  }

  @Patch(":id/status")
  setStatus(
    @Param("id") id: string,
    @Body() body: { status: "ACTIVE" | "SUSPENDED"; reason: string },
    @Req() request: WorkspaceContextRequest
  ) {
    return this.platform.adminSetUserStatus(
      id,
      body.status,
      body.reason,
      workspaceContextFromRequest(request)
    );
  }
}

@Controller("admin/wallets")
@RequirePermissions("admin:access")
export class AdminWalletsController {
  constructor(@Inject(ManagedAdsService) private readonly managedAds: ManagedAdsService) {}

  @Get(":workspaceId")
  getWallet(@Param("workspaceId") workspaceId: string) {
    return this.managedAds.adminGetWallet(workspaceId);
  }

  @Post(":workspaceId/adjustments")
  adjust(
    @Param("workspaceId") workspaceId: string,
    @Body()
    body: {
      direction: "CREDIT" | "DEBIT";
      amountMinor: number;
      reason: string;
      currency?: string;
      idempotencyKey?: string;
    },
    @Req() request: WorkspaceContextRequest
  ) {
    return this.managedAds.adminAdjustWallet(workspaceContextFromRequest(request), {
      ...body,
      workspaceId
    });
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

  @Get("campaigns/:id/launch-spec")
  launchSpec(@Param("id") id: string, @Req() request: WorkspaceContextRequest) {
    return this.managedAds.getCampaignLaunchSpec(workspaceContextFromRequest(request), id);
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
  list(@Req() request: WorkspaceContextRequest, @Query("limit") limit?: string) {
    return this.platform.listAuditLogsFromStore(
      workspaceContextFromRequest(request),
      limit ? Number(limit) : undefined
    );
  }
}
