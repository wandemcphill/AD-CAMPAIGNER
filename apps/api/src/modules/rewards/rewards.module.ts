import { MiddlewareConsumer, Module, type NestModule } from "@nestjs/common";

import { PrismaModule } from "../prisma.module";
import { QueueProducerService } from "../queue-producer.service";
import { AuthSessionService } from "../auth-session.service";
import { WorkspaceContextMiddleware } from "../workspace-context.middleware";
import { RewardsController, AdminRewardsController } from "./rewards.controller";
import { RewardsService } from "./rewards.service";
import { RewardVerificationService } from "./reward-verification.service";
import { RewardFulfillmentService } from "./reward-fulfillment.service";

@Module({
  imports: [PrismaModule],
  controllers: [RewardsController, AdminRewardsController],
  providers: [
    QueueProducerService,
    AuthSessionService,
    WorkspaceContextMiddleware,
    RewardsService,
    RewardVerificationService,
    RewardFulfillmentService
  ],
  exports: [RewardsService]
})
export class RewardsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(WorkspaceContextMiddleware).forRoutes(RewardsController);
    consumer.apply(WorkspaceContextMiddleware).forRoutes(AdminRewardsController);
  }
}
