import { MiddlewareConsumer, Module, type NestModule } from "@nestjs/common";

import { PrismaModule } from "../prisma.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { AuthSessionService } from "../auth-session.service";
import { WorkspaceContextMiddleware } from "../workspace-context.middleware";
import { ApprovalsController } from "./approvals.controller";
import { ApprovalsService } from "./approvals.service";

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [ApprovalsController],
  providers: [ApprovalsService, AuthSessionService, WorkspaceContextMiddleware],
  exports: [ApprovalsService]
})
export class ApprovalsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(WorkspaceContextMiddleware).forRoutes(ApprovalsController);
  }
}
