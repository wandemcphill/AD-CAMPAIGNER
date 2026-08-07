import { MiddlewareConsumer, Module, type NestModule } from "@nestjs/common";

import { PrismaModule } from "../prisma.module";
import { AuthSessionService } from "../auth-session.service";
import { WorkspaceContextMiddleware } from "../workspace-context.middleware";
import { AdminCryptoController, CryptoController } from "./crypto.controller";
import { CryptoService } from "./crypto.service";

@Module({
  imports: [PrismaModule],
  controllers: [CryptoController, AdminCryptoController],
  providers: [AuthSessionService, WorkspaceContextMiddleware, CryptoService],
  exports: [CryptoService]
})
export class CryptoModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(WorkspaceContextMiddleware).forRoutes(CryptoController);
    consumer.apply(WorkspaceContextMiddleware).forRoutes(AdminCryptoController);
  }
}
