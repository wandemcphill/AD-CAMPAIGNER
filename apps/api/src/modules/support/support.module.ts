import { MiddlewareConsumer, Module, type NestModule } from "@nestjs/common";

import { PrismaModule } from "../prisma.module";
import { AuthSessionService } from "../auth-session.service";
import { WorkspaceContextMiddleware } from "../workspace-context.middleware";
import { AdminSupportController, SupportController } from "./support.controller";
import { SupportService } from "./support.service";

@Module({
  imports: [PrismaModule],
  controllers: [SupportController, AdminSupportController],
  providers: [AuthSessionService, WorkspaceContextMiddleware, SupportService],
  exports: [SupportService]
})
export class SupportModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(WorkspaceContextMiddleware).forRoutes(SupportController);
    consumer.apply(WorkspaceContextMiddleware).forRoutes(AdminSupportController);
  }
}
