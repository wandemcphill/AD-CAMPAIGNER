import { MiddlewareConsumer, Module, type NestModule } from "@nestjs/common";

import { PrismaModule } from "../prisma.module";
import { QueueProducerService } from "../queue-producer.service";
import { AuthSessionService } from "../auth-session.service";
import { WorkspaceContextMiddleware } from "../workspace-context.middleware";
import { AdminDigitalAccessController, DigitalAccessController } from "./digital-access.controller";
import { DigitalAccessHubService } from "./digital-access.service";

@Module({
  imports: [PrismaModule],
  controllers: [DigitalAccessController, AdminDigitalAccessController],
  providers: [
    QueueProducerService,
    AuthSessionService,
    WorkspaceContextMiddleware,
    DigitalAccessHubService
  ],
  exports: [DigitalAccessHubService]
})
export class DigitalAccessModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(WorkspaceContextMiddleware).forRoutes(DigitalAccessController);
    consumer.apply(WorkspaceContextMiddleware).forRoutes(AdminDigitalAccessController);
  }
}
