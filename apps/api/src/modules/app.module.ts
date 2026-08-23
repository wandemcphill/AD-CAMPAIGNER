import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerModule } from "@nestjs/throttler";
import { ScheduleModule } from "@nestjs/schedule";

import {
  AdminController,
  AdminUsersController,
  AdminWalletsController,
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
  MeController,
  GrowthController,
  HealthController,
  LiveController,
  MediaController,
  NotificationsController,
  OrganizationsController,
  WorkspaceController,
  PaymentsController,
  PlatformConfigController,
  ReferralsController,
  RootController,
  SearchController,
  SmmController,
  TeamsController,
  WalletController,
  WebhooksController
} from "./platform.controllers";
import { AdminCommandCenterController } from "./admin-command-center.controller";
import { AdminCommandCenterService } from "./admin-command-center.service";
import { AdminFinanceModule } from "./admin-finance/admin-finance.module";
import { ManagedAdsService } from "./managed-ads.service";
import { PlatformService } from "./platform.service";
import { AuthSessionService } from "./auth-session.service";
import { AgeGuard } from "./age.guard";
import { AuthorizationGuard } from "./authorization.guard";
import { ClientIpThrottlerGuard } from "./client-ip.throttler-guard";
import { FeatureFlagGuard } from "./feature-flag.guard";
import { RealtimeGateway } from "./realtime.gateway";
import { PrismaModule } from "./prisma.module";
import { DigitalAccessModule } from "./digital-access/digital-access.module";
import { InvoicesModule } from "./invoices/invoices.module";
import { PaymentLinksModule } from "./payment-links/payment-links.module";
import { ApprovalsModule } from "./approvals/approvals.module";
import { VouchersModule } from "./vouchers/vouchers.module";
import { VtuModule } from "./vtu/vtu.module";
import { TelecomGatewayModule } from "./telecom-gateway/telecom-gateway.module";
import { VirtualNumbersModule } from "./virtual-numbers/virtual-numbers.module";
import { FxModule } from "./fx/fx.module";
import { DigitalValueModule } from "./digital-value/digital-value.module";
import { PersonasModule } from "./personas/personas.module";
import { AutomationModule } from "./automation/automation.module";
import { MarketplaceModule } from "./marketplace/marketplace.module";
import { RewardsModule } from "./rewards/rewards.module";
import { SecurityModule } from "./security/security.module";
import { ApiKeysModule } from "./api-keys/api-keys.module";
import { AiConfigModule } from "./ai-config/ai-config.module";
import { ProvidersModule } from "./providers/providers.module";
import { WebhooksModule } from "./webhooks/webhooks.module";
import { TrustEngineModule } from "./trust-engine/trust-engine.module";
import { CryptoModule } from "./crypto/crypto.module";
import { RmbModule } from "./rmb/rmb.module";
import { FinancialProductsModule } from "./financial-products/financial-products.module";
import { GuestCheckoutModule } from "./guest-checkout/guest-checkout.module";
import { SupportModule } from "./support/support.module";
import { NotificationsModule } from "./notifications/notifications.module";

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
    PrismaModule,
    AdminFinanceModule,
    ApprovalsModule,
    DigitalAccessModule,
    InvoicesModule,
    PaymentLinksModule,
    VouchersModule,
    VtuModule,
    TelecomGatewayModule,
    VirtualNumbersModule,
    FxModule,
    DigitalValueModule,
    PersonasModule,
    AutomationModule,
    MarketplaceModule,
    RewardsModule,
    SecurityModule,
    ApiKeysModule,
    AiConfigModule,
    ProvidersModule,
    WebhooksModule,
    TrustEngineModule,
    CryptoModule,
    RmbModule,
    FinancialProductsModule,
    GuestCheckoutModule,
    SupportModule,
    NotificationsModule
  ],
  controllers: [
    RootController,
    HealthController,
    PlatformConfigController,
    AuthController,
    OrganizationsController,
    WorkspaceController,
    TeamsController,
    ClientProfileController,
    CompanyProfilesController,
    AdAccountsController,
    CampaignsController,
    MeController,
    DestinationsController,
    LiveController,
    SmmController,
    GrowthController,
    PaymentsController,
    WebhooksController,
    WalletController,
    AnalyticsController,
    NotificationsController,
    ReferralsController,
    MediaController,
    SearchController,
    AdminController,
    AdminCommandCenterController,
    AdminUsersController,
    AdminWalletsController,
    AdminGrowthController,
    AdminCampaignOpsController,
    AuditController
  ],
  providers: [
    AuthSessionService,
    PlatformService,
    AdminCommandCenterService,
    ManagedAdsService,
    RealtimeGateway,
    {
      provide: APP_GUARD,
      useClass: ClientIpThrottlerGuard
    },
    {
      provide: APP_GUARD,
      useClass: AuthorizationGuard
    },
    {
      provide: APP_GUARD,
      useClass: AgeGuard
    },
    {
      provide: APP_GUARD,
      useClass: FeatureFlagGuard
    }
  ]
})
export class AppModule {}
