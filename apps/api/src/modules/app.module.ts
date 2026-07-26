import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";

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
import { OtpModule } from "./otp/otp.module";
import { DigitalAccessModule } from "./digital-access/digital-access.module";

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), OtpModule, DigitalAccessModule],
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
      useClass: AuthorizationGuard
    }
  ]
})
export class AppModule {}
