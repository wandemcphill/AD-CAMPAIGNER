import { MiddlewareConsumer, Module, type NestModule } from "@nestjs/common";

import { PrismaService } from "../prisma.service";
import { QueueProducerService } from "../queue-producer.service";
import { AuthSessionService } from "../auth-session.service";
import { WorkspaceContextMiddleware } from "../workspace-context.middleware";
import { AdminVtuController, VtuController } from "./vtu.controller";
import { VtuService } from "./vtu.service";

@Module({
  controllers: [VtuController, AdminVtuController],
  providers: [PrismaService, QueueProducerService, AuthSessionService, WorkspaceContextMiddleware, VtuService],
  exports: [VtuService]
})
export class VtuModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(WorkspaceContextMiddleware).forRoutes(VtuController);
    consumer.apply(WorkspaceContextMiddleware).forRoutes(AdminVtuController);
  }
}
