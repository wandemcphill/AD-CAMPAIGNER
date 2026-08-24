import { Module } from "@nestjs/common";

import { PrismaModule } from "../prisma.module";
import { PricingRuleService } from "./pricing-rule.service";
import { ProviderRouterService } from "./provider-router.service";
import { AdminProviderGovernanceController } from "./admin-provider-governance.controller";
import { AdminProviderGovernanceService } from "./admin-provider-governance.service";
import { ProvidersController } from "./providers.controller";
import { ProvidersService } from "./providers.service";

@Module({
  imports: [PrismaModule],
  controllers: [ProvidersController, AdminProviderGovernanceController],
  providers: [
    ProvidersService,
    ProviderRouterService,
    PricingRuleService,
    AdminProviderGovernanceService
  ],
  exports: [
    ProvidersService,
    ProviderRouterService,
    PricingRuleService,
    AdminProviderGovernanceService
  ]
})
export class ProvidersModule {}
