import { Module } from "@nestjs/common";

import { PrismaModule } from "../prisma.module";
import { VtuModule } from "../vtu/vtu.module";
import {
  AdminGuestCheckoutController,
  GuestCheckoutController,
  GuestCheckoutWebhookController
} from "./guest-checkout.controller";
import { GuestCheckoutService } from "./guest-checkout.service";

@Module({
  imports: [PrismaModule, VtuModule],
  controllers: [GuestCheckoutController, GuestCheckoutWebhookController, AdminGuestCheckoutController],
  providers: [GuestCheckoutService],
  exports: [GuestCheckoutService]
})
export class GuestCheckoutModule {}
