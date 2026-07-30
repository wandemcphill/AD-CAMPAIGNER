import { Module } from "@nestjs/common";

import { PrismaService } from "../prisma.service";
import { MarketplaceController } from "./marketplace.controller";
import { MarketplaceService } from "./marketplace.service";

@Module({
  controllers: [MarketplaceController],
  providers: [PrismaService, MarketplaceService],
  exports: [MarketplaceService]
})
export class MarketplaceModule {}
