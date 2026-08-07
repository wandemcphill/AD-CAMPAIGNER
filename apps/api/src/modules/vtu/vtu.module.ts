import { MiddlewareConsumer, Module, type NestModule } from "@nestjs/common";

import { PrismaModule } from "../prisma.module";
import { QueueProducerService } from "../queue-producer.service";
import { AuthSessionService } from "../auth-session.service";
import { WorkspaceContextMiddleware } from "../workspace-context.middleware";
import { ProvidersModule } from "../providers/providers.module";
import { AdminVtuController, VtuController } from "./vtu.controller";
import { VtuService } from "./vtu.service";

@Module({
  imports: [PrismaModule, ProvidersModule],
  controllers: [VtuController, AdminVtuController],
  providers: [QueueProducerService, AuthSessionService, WorkspaceContextMiddleware, VtuService],
  exports: [VtuService]
})
export class VtuModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(WorkspaceContextMiddleware).forRoutes(VtuController);
    consumer.apply(WorkspaceContextMiddleware).forRoutes(AdminVtuController);
  }
}
