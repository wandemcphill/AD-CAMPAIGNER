import { MiddlewareConsumer, Module, type NestModule } from "@nestjs/common";

import { PrismaModule } from "../prisma.module";
import { AuthSessionService } from "../auth-session.service";
import { WorkspaceContextMiddleware } from "../workspace-context.middleware";
import { ProvidersModule } from "../providers/providers.module";
import { TelecomGatewayController } from "./telecom-gateway.controller";
import { TelecomGatewayService } from "./telecom-gateway.service";
import { PhoneNumberService } from "./phone-number.service";
import { TelecomRoutingService } from "./telecom-routing.service";
import { TelecomCatalogService } from "./telecom-catalog.service";
import { TelecomHealthService } from "./telecom-health.service";

@Module({
  imports: [PrismaModule, ProvidersModule],
  controllers: [TelecomGatewayController],
  providers: [
    AuthSessionService,
    WorkspaceContextMiddleware,
    PhoneNumberService,
    TelecomHealthService,
    TelecomRoutingService,
    TelecomCatalogService,
    TelecomGatewayService
  ],
  exports: [TelecomGatewayService, PhoneNumberService, TelecomRoutingService]
})
export class TelecomGatewayModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(WorkspaceContextMiddleware).forRoutes(TelecomGatewayController);
  }
}
