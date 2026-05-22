import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import {
  AdminController,
  AnalyticsController,
  AuditController,
  AuthController,
  CampaignsController,
  DestinationsController,
  HealthController,
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
import { PlatformService } from "./platform.service";
import { RealtimeGateway } from "./realtime.gateway";

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  controllers: [
    HealthController,
    AuthController,
    OrganizationsController,
    TeamsController,
    CampaignsController,
    DestinationsController,
    LiveController,
    SmmController,
    PaymentsController,
    WebhooksController,
    WalletController,
    AnalyticsController,
    NotificationsController,
    ReferralsController,
    SupportController,
    MediaController,
    SearchController,
    AdminController,
    AuditController
  ],
  providers: [PlatformService, RealtimeGateway]
})
export class AppModule {}
