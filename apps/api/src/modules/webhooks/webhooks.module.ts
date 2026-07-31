import { Module } from "@nestjs/common";

import { PrismaService } from "../prisma.service";
import { QueueProducerService } from "../queue-producer.service";
import { IncomingWebhooksController, OutgoingWebhooksController, ProviderWebhooksController } from "./webhooks.controller";
import { IncomingWebhooksService } from "./incoming-webhooks.service";
import { OutgoingWebhooksService } from "./outgoing-webhooks.service";
import { ProviderWebhooksService } from "./provider-webhooks.service";

@Module({
  controllers: [OutgoingWebhooksController, IncomingWebhooksController, ProviderWebhooksController],
  providers: [PrismaService, QueueProducerService, OutgoingWebhooksService, IncomingWebhooksService, ProviderWebhooksService],
  exports: [OutgoingWebhooksService, IncomingWebhooksService, ProviderWebhooksService]
})
export class WebhooksModule {}
