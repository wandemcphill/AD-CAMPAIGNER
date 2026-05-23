import { Body, Controller, Get, Headers, Inject, Param, Post, Query, Req } from "@nestjs/common";

import type {
  CreateCampaignDto,
  CreatePaymentIntentDto,
  CreateSmmOrderDto,
  CreateSupportTicketDto,
  QuoteCampaignDto,
  SmmSupplierReferenceDto,
  SmmSupplierReferencesDto
} from "./platform.dtos";
import { AuthSessionService } from "./auth-session.service";
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

@Controller("campaigns")
export class CampaignsController {
  constructor(@Inject(PlatformService) private readonly platform: PlatformService) {}

  @Get()
  list(@Req() request: WorkspaceContextRequest) {
    return this.platform.listCampaigns(workspaceContextFromRequest(request));
  }

  @Post()
  create(@Body() body: CreateCampaignDto, @Req() request: WorkspaceContextRequest) {
    return this.platform.createCampaign(workspaceContextFromRequest(request), body);
  }

  @Post("quote")
  quote(@Body() body: QuoteCampaignDto, @Req() request: WorkspaceContextRequest) {
    workspaceContextFromRequest(request);

    return this.platform.quoteCampaign(body);
  }

  @Post(":id/start")
  start(@Param("id") id: string, @Req() request: WorkspaceContextRequest) {
    return this.platform.startCampaign(workspaceContextFromRequest(request), id);
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
  constructor(@Inject(PlatformService) private readonly platform: PlatformService) {}

  @Get()
  list(@Req() request: WorkspaceContextRequest) {
    return this.platform.listLivePromotions(workspaceContextFromRequest(request));
  }

  @Post("boosts")
  createBoost(@Req() request: WorkspaceContextRequest) {
    return this.platform.createCampaign(workspaceContextFromRequest(request), {
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
  constructor(@Inject(PlatformService) private readonly platform: PlatformService) {}

  @Post("intents")
  createIntent(@Body() body: CreatePaymentIntentDto, @Req() request: WorkspaceContextRequest) {
    return this.platform.createPaymentIntent(workspaceContextFromRequest(request), body);
  }

  @Post("verify/:reference")
  verify(@Param("reference") reference: string, @Req() request: WorkspaceContextRequest) {
    return this.platform.verifyPayment(workspaceContextFromRequest(request), reference);
  }
}

@Controller("api/webhooks")
export class WebhooksController {
  constructor(@Inject(PlatformService) private readonly platform: PlatformService) {}

  @Post("korapay")
  korapay(@Body() body: unknown, @Headers("x-korapay-signature") signature?: string) {
    return this.platform.handleKorapayWebhook(body, signature);
  }
}

@Controller("wallet")
export class WalletController {
  constructor(@Inject(PlatformService) private readonly platform: PlatformService) {}

  @Get()
  getWallet(@Req() request: WorkspaceContextRequest) {
    return this.platform.getWallet(workspaceContextFromRequest(request));
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
  constructor(@Inject(PlatformService) private readonly platform: PlatformService) {}

  @Get()
  list(@Req() request: WorkspaceContextRequest) {
    return this.platform.listNotifications(workspaceContextFromRequest(request));
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
  constructor(@Inject(PlatformService) private readonly platform: PlatformService) {}

  @Post("uploads")
  createUpload(@Req() request: WorkspaceContextRequest) {
    return this.platform.createUploadUrl(workspaceContextFromRequest(request));
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

@Controller("audit")
export class AuditController {
  constructor(@Inject(PlatformService) private readonly platform: PlatformService) {}

  @Get("logs")
  list(@Req() request: WorkspaceContextRequest) {
    return this.platform.listAuditLogs(workspaceContextFromRequest(request));
  }
}
