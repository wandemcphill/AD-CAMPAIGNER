import { Module } from "@nestjs/common";

import { PrismaModule } from "../prisma.module";
import { QueueProducerService } from "../queue-producer.service";
import { IncomingWebhooksController, OutgoingWebhooksController, ProviderWebhooksController } from "./webhooks.controller";
import { IncomingWebhooksService } from "./incoming-webhooks.service";
import { OutgoingWebhooksService } from "./outgoing-webhooks.service";
import { ProviderWebhooksService } from "./provider-webhooks.service";

@Module({
  imports: [PrismaModule],
  controllers: [OutgoingWebhooksController, IncomingWebhooksController, ProviderWebhooksController],
  providers: [QueueProducerService, OutgoingWebhooksService, IncomingWebhooksService, ProviderWebhooksService],
  exports: [OutgoingWebhooksService, IncomingWebhooksService, ProviderWebhooksService]
})
export class WebhooksModule {}
