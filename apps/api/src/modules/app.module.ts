import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import {
  AdminController,
  AnalyticsController,
  AuditController,
  AuthController,
  AdminCampaignOpsController,
  CampaignsController,
  ClientProfileController,
  CompanyProfilesController,
  DestinationsController,
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
    CampaignsController,
    DestinationsController,
    LiveController,
    SmmController,
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
    AdminCampaignOpsController,
    AuditController
  ],
  providers: [PrismaService, AuthSessionService, PlatformService, ManagedAdsService, RealtimeGateway]
})
export class AppModule {}
