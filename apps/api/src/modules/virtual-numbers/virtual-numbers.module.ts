import { MiddlewareConsumer, Module, type NestModule } from "@nestjs/common";

import { PrismaService } from "../prisma.service";
import { QueueProducerService } from "../queue-producer.service";
import { AuthSessionService } from "../auth-session.service";
import { WorkspaceContextMiddleware } from "../workspace-context.middleware";
import { FxModule } from "../fx/fx.module";
import {
  AdminVirtualNumbersController,
  VirtualNumbersController,
  VirtualNumbersWebhookController
} from "./virtual-numbers.controller";
import { VirtualNumbersService } from "./virtual-numbers.service";

@Module({
  imports: [FxModule],
  controllers: [
    VirtualNumbersController,
    VirtualNumbersWebhookController,
    AdminVirtualNumbersController
  ],
  providers: [
    PrismaService,
    QueueProducerService,
    AuthSessionService,
    WorkspaceContextMiddleware,
    VirtualNumbersService
  ],
  exports: [VirtualNumbersService]
})
export class VirtualNumbersModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(WorkspaceContextMiddleware).forRoutes(VirtualNumbersController);
    consumer.apply(WorkspaceContextMiddleware).forRoutes(AdminVirtualNumbersController);
  }
}
