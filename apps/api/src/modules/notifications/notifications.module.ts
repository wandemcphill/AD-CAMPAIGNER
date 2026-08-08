import { Module } from "@nestjs/common";

import { PrismaModule } from "../prisma.module";
import { QueueProducerService } from "../queue-producer.service";
import { NotificationsService } from "./notifications.service";

@Module({
  imports: [PrismaModule],
  providers: [QueueProducerService, NotificationsService],
  exports: [NotificationsService]
})
export class NotificationsModule {}
