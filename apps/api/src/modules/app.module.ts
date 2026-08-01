import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { ScheduleModule } from "@nestjs/schedule";

import {
  AdminController,
  AnalyticsController,
  AuditController,
  AuthController,
  AdminCampaignOpsController,
  AdminGrowthController,
  AdAccountsController,
  CampaignsController,
  ClientProfileController,
  CompanyProfilesController,
  DestinationsController,
  GrowthController,
  HealthController,
  InvoicesController,
  LiveController,
  MediaController,
  NotificationsController,
  OrganizationsController,
  PaymentsController,
  ReferralsController,
  SearchController,
  SmmController,
  SupportController,
  TeamsController,
  WalletController,
  WebhooksController
} from "./platform.controllers";
import { ManagedAdsService } from "./managed-ads.service";
import { PlatformService } from "./platform.service";
import { PrismaService } from "./prisma.service";
import { AuthSessionService } from "./auth-session.service";
import { AuthorizationGuard } from "./authorization.guard";
import { RealtimeGateway } from "./realtime.gateway";
import { DigitalAccessModule } from "./digital-access/digital-access.module";
import { VouchersModule } from "./vouchers/vouchers.module";
import { VtuModule } from "./vtu/vtu.module";
import { VirtualNumbersModule } from "./virtual-numbers/virtual-numbers.module";
import { FxModule } from "./fx/fx.module";
import { DigitalValueModule } from "./digital-value/digital-value.module";
import { PersonasModule } from "./personas/personas.module";
import { AutomationModule } from "./automation/automation.module";
import { MarketplaceModule } from "./marketplace/marketplace.module";
import { RewardsModule } from "./rewards/rewards.module";
import { SecurityModule } from "./security/security.module";
import { ApiKeysModule } from "./api-keys/api-keys.module";
import { ProvidersModule } from "./providers/providers.module";
import { WebhooksModule } from "./webhooks/webhooks.module";
import { TrustEngineModule } from "./trust-engine/trust-engine.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        name: "short",
        ttl: 60000,
        limit: 100
      },
      {
        name: "long",
        ttl: 900000,
        limit: 1000
      }
    ]),
    DigitalAccessModule,
    VouchersModule,
    VtuModule,
    VirtualNumbersModule,
    FxModule,
    DigitalValueModule,
    PersonasModule,
    AutomationModule,
    MarketplaceModule,
    RewardsModule,
    SecurityModule,
    ApiKeysModule,
    ProvidersModule,
    WebhooksModule,
    TrustEngineModule
  ],
  controllers: [
    HealthController,
    AuthController,
    OrganizationsController,
    TeamsController,
    ClientProfileController,
    CompanyProfilesController,
    AdAccountsController,
    CampaignsController,
    DestinationsController,
    LiveController,
    SmmController,
    GrowthController,
    PaymentsController,
    WebhooksController,
    WalletController,
    InvoicesController,
    AnalyticsController,
    NotificationsController,
    ReferralsController,
    SupportController,
    MediaController,
    SearchController,
    AdminController,
    AdminGrowthController,
    AdminCampaignOpsController,
    AuditController
  ],
  providers: [
    PrismaService,
    AuthSessionService,
    PlatformService,
    ManagedAdsService,
    RealtimeGateway,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard
    },
    {
      provide: APP_GUARD,
      useClass: AuthorizationGuard
    }
  ]
})
export class AppModule {}
