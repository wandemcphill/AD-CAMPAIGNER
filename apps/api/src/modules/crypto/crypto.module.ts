import { MiddlewareConsumer, Module, type NestModule } from "@nestjs/common";

import { PrismaModule } from "../prisma.module";
import { AuthSessionService } from "../auth-session.service";
import { WorkspaceContextMiddleware } from "../workspace-context.middleware";
import { CryptoController } from "./crypto.controller";
import { CryptoService } from "./crypto.service";

@Module({
  imports: [PrismaModule],
  controllers: [CryptoController],
  providers: [AuthSessionService, WorkspaceContextMiddleware, CryptoService],
  exports: [CryptoService]
})
export class CryptoModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(WorkspaceContextMiddleware).forRoutes(CryptoController);
  }
}
