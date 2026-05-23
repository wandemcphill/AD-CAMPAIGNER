import { MiddlewareConsumer, Module, type NestModule } from "@nestjs/common";

import { PrismaService } from "../prisma.service";
import { WorkspaceContextMiddleware } from "../workspace-context.middleware";
import { AdminDigitalAccessController, DigitalAccessController } from "./digital-access.controller";
import { DigitalAccessHubService } from "./digital-access.service";

@Module({
  controllers: [DigitalAccessController, AdminDigitalAccessController],
  providers: [PrismaService, WorkspaceContextMiddleware, DigitalAccessHubService],
  exports: [DigitalAccessHubService]
})
export class DigitalAccessModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(WorkspaceContextMiddleware).forRoutes(DigitalAccessController);
    consumer.apply(WorkspaceContextMiddleware).forRoutes(AdminDigitalAccessController);
  }
}
