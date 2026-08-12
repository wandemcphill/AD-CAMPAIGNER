import { MiddlewareConsumer, Module, type NestModule } from "@nestjs/common";

import { PrismaModule } from "../prisma.module";
import { QueueProducerService } from "../queue-producer.service";
import { AuthSessionService } from "../auth-session.service";
import { NotificationsModule } from "../notifications/notifications.module";
import { WorkspaceContextMiddleware } from "../workspace-context.middleware";
import { ProvidersModule } from "../providers/providers.module";
import { AdminVtuController, VtuController } from "./vtu.controller";
import { VtuWebhookController } from "./vtu-webhook.controller";
import { VtuService } from "./vtu.service";
import { VtuRouterService } from "./vtu-router.service";
import { VtuQuoteService } from "./vtu-quote.service";

@Module({
  imports: [PrismaModule, ProvidersModule, NotificationsModule],
  controllers: [VtuController, AdminVtuController, VtuWebhookController],
  providers: [
    QueueProducerService,
    AuthSessionService,
    WorkspaceContextMiddleware,
    VtuService,
    VtuRouterService,
    VtuQuoteService
  ],
  exports: [VtuService, VtuRouterService, VtuQuoteService]
})
export class VtuModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(WorkspaceContextMiddleware).forRoutes(VtuController);
    consumer.apply(WorkspaceContextMiddleware).forRoutes(AdminVtuController);
  }
}
