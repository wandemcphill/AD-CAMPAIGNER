import { MiddlewareConsumer, Module, type NestModule } from "@nestjs/common";

import { ProvidersModule } from "../providers/providers.module";
import { PrismaModule } from "../prisma.module";
import { QueueProducerService } from "../queue-producer.service";
import { AuthSessionService } from "../auth-session.service";
import { NotificationsModule } from "../notifications/notifications.module";
import { WorkspaceContextMiddleware } from "../workspace-context.middleware";
import { FxModule } from "../fx/fx.module";
import {
  AdminVirtualNumbersController,
  VirtualNumbersController,
  VirtualNumbersWebhookController
} from "./virtual-numbers.controller";
import { VirtualNumbersService } from "./virtual-numbers.service";
import { ProductionVirtualNumbersService } from "./production-virtual-numbers.service";

@Module({
  imports: [FxModule, PrismaModule, NotificationsModule, ProvidersModule],
  controllers: [
    VirtualNumbersController,
    VirtualNumbersWebhookController,
    AdminVirtualNumbersController
  ],
  providers: [
    QueueProducerService,
    AuthSessionService,
    WorkspaceContextMiddleware,
    {
      provide: VirtualNumbersService,
      useClass: ProductionVirtualNumbersService
    }
  ],
  exports: [VirtualNumbersService]
})
export class VirtualNumbersModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(WorkspaceContextMiddleware).forRoutes(VirtualNumbersController);
    consumer.apply(WorkspaceContextMiddleware).forRoutes(AdminVirtualNumbersController);
  }
}
