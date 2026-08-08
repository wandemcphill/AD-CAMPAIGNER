import { Module } from "@nestjs/common";

import { PrismaModule } from "../prisma.module";
import { VtuModule } from "../vtu/vtu.module";
import { NotificationsModule } from "../notifications/notifications.module";
import {
  AdminGuestCheckoutController,
  GuestCheckoutController,
  GuestCheckoutWebhookController
} from "./guest-checkout.controller";
import { GuestCheckoutService } from "./guest-checkout.service";

@Module({
  imports: [PrismaModule, VtuModule, NotificationsModule],
  controllers: [GuestCheckoutController, GuestCheckoutWebhookController, AdminGuestCheckoutController],
  providers: [GuestCheckoutService],
  exports: [GuestCheckoutService]
})
export class GuestCheckoutModule {}
