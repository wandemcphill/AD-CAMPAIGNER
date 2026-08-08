import { Module } from "@nestjs/common";

import { PrismaModule } from "../prisma.module";
import { NotificationsModule } from "../notifications/notifications.module";
import {
  AdminMarketplaceController,
  MarketplaceApplicationsController,
  MarketplaceController
} from "./marketplace.controller";
import { MarketplaceService } from "./marketplace.service";

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [MarketplaceController, MarketplaceApplicationsController, AdminMarketplaceController],
  providers: [MarketplaceService],
  exports: [MarketplaceService]
})
export class MarketplaceModule {}
