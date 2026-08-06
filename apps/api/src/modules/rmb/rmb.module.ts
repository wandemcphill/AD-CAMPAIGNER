import { MiddlewareConsumer, Module, type NestModule } from "@nestjs/common";

import { PrismaModule } from "../prisma.module";
import { AuthSessionService } from "../auth-session.service";
import { WorkspaceContextMiddleware } from "../workspace-context.middleware";
import { RmbController } from "./rmb.controller";
import { RmbService } from "./rmb.service";

@Module({
  imports: [PrismaModule],
  controllers: [RmbController],
  providers: [AuthSessionService, WorkspaceContextMiddleware, RmbService],
  exports: [RmbService]
})
export class RmbModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(WorkspaceContextMiddleware).forRoutes(RmbController);
  }
}
