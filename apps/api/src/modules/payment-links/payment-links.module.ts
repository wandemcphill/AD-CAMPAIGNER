import { MiddlewareConsumer, Module, type NestModule } from "@nestjs/common";

import { PrismaModule } from "../prisma.module";
import { AuthSessionService } from "../auth-session.service";
import { WorkspaceContextMiddleware } from "../workspace-context.middleware";
import { PaymentLinksController, PublicPaymentLinksController } from "./payment-links.controller";
import { PaymentLinksService } from "./payment-links.service";

@Module({
  imports: [PrismaModule],
  controllers: [PaymentLinksController, PublicPaymentLinksController],
  providers: [AuthSessionService, WorkspaceContextMiddleware, PaymentLinksService],
  exports: [PaymentLinksService]
})
export class PaymentLinksModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Only the authenticated controller needs workspace context; the public
    // resolver is unauthenticated.
    consumer.apply(WorkspaceContextMiddleware).forRoutes(PaymentLinksController);
  }
}
