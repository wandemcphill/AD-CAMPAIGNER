import { Module } from "@nestjs/common";

import { PrismaModule } from "../prisma.module";
import {
  AdminMarketplaceController,
  MarketplaceApplicationsController,
  MarketplaceController
} from "./marketplace.controller";
import { MarketplaceService } from "./marketplace.service";

@Module({
  imports: [PrismaModule],
  controllers: [MarketplaceController, MarketplaceApplicationsController, AdminMarketplaceController],
  providers: [MarketplaceService],
  exports: [MarketplaceService]
})
export class MarketplaceModule {}
