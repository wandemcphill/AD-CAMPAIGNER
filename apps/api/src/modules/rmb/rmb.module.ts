import { MiddlewareConsumer, Module, type NestModule } from "@nestjs/common";

import { PrismaModule } from "../prisma.module";
import { AuthSessionService } from "../auth-session.service";
import { NotificationsModule } from "../notifications/notifications.module";
import { WorkspaceContextMiddleware } from "../workspace-context.middleware";
import { AdminRmbController, RmbController } from "./rmb.controller";
import { RmbService } from "./rmb.service";

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [RmbController, AdminRmbController],
  providers: [AuthSessionService, WorkspaceContextMiddleware, RmbService],
  exports: [RmbService]
})
export class RmbModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(WorkspaceContextMiddleware).forRoutes(RmbController);
    consumer.apply(WorkspaceContextMiddleware).forRoutes(AdminRmbController);
  }
}
