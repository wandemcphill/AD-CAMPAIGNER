import { Body, Controller, Get, Inject, Param, Post, Query } from "@nestjs/common";

import type {
  CreateCampaignDto,
  CreatePaymentIntentDto,
  CreateSmmOrderDto,
  CreateSupportTicketDto,
  QuoteCampaignDto
} from "./platform.dtos";
import { PlatformService } from "./platform.service";

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
  constructor(@Inject(PlatformService) private readonly platform: PlatformService) {}

  @Get("session")
  getSession() {
    return this.platform.getSession();
  }

  @Post("login")
  login() {
    return this.platform.getSession();
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
  list() {
    return this.platform.listCampaigns();
  }

  @Post()
  create(@Body() body: CreateCampaignDto) {
    return this.platform.createCampaign(body);
  }

  @Post("quote")
  quote(@Body() body: QuoteCampaignDto) {
    return this.platform.quoteCampaign(body);
  }

  @Post(":id/start")
  start(@Param("id") id: string) {
    return this.platform.startCampaign(id);
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
  list() {
    return this.platform.listLivePromotions();
  }

  @Post("boosts")
  createBoost() {
    return this.platform.createCampaign({
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

  @Get("health")
  health() {
    return this.platform.getSmmSupplierHealth();
  }

  @Post("quote")
  quote(@Body() body: CreateSmmOrderDto) {
    return this.platform.quoteSmmOrder(body);
  }

  @Post("orders")
  createOrder(@Body() body: CreateSmmOrderDto) {
    return this.platform.createSmmOrder(body);
  }
}

@Controller("payments")
export class PaymentsController {
  constructor(@Inject(PlatformService) private readonly platform: PlatformService) {}

  @Post("intents")
  createIntent(@Body() body: CreatePaymentIntentDto) {
    return this.platform.createPaymentIntent(body);
  }
}

@Controller("wallet")
export class WalletController {
  constructor(@Inject(PlatformService) private readonly platform: PlatformService) {}

  @Get()
  getWallet() {
    return this.platform.getWallet();
  }
}

@Controller("analytics")
export class AnalyticsController {
  constructor(@Inject(PlatformService) private readonly platform: PlatformService) {}

  @Get("overview")
  overview() {
    return this.platform.getAnalyticsOverview();
  }
}

@Controller("notifications")
export class NotificationsController {
  constructor(@Inject(PlatformService) private readonly platform: PlatformService) {}

  @Get()
  list() {
    return this.platform.listNotifications();
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
  listTickets() {
    return this.platform.listSupportTickets();
  }

  @Post("tickets")
  createTicket(@Body() body: CreateSupportTicketDto) {
    return this.platform.createSupportTicket(body);
  }
}

@Controller("media")
export class MediaController {
  constructor(@Inject(PlatformService) private readonly platform: PlatformService) {}

  @Post("uploads")
  createUpload() {
    return this.platform.createUploadUrl();
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
  list() {
    return this.platform.listAuditLogs();
  }
}
