import { Module } from "@nestjs/common";

import { PrismaModule } from "../prisma.module";
import { QueueProducerService } from "../queue-producer.service";
import { IncomingWebhooksController, OutgoingWebhooksController, ProviderWebhooksController } from "./webhooks.controller";
import { AdminWebhookOperationsController } from "./admin-webhook-operations.controller";
import { IncomingWebhooksService } from "./incoming-webhooks.service";
import { OutgoingWebhooksService } from "./outgoing-webhooks.service";
import { ProviderWebhooksService } from "./provider-webhooks.service";
import { AdminWebhookOperationsService } from "./admin-webhook-operations.service";

@Module({
  imports: [PrismaModule],
  controllers: [OutgoingWebhooksController, IncomingWebhooksController, ProviderWebhooksController, AdminWebhookOperationsController],
  providers: [QueueProducerService, OutgoingWebhooksService, IncomingWebhooksService, ProviderWebhooksService, AdminWebhookOperationsService],
  exports: [OutgoingWebhooksService, IncomingWebhooksService, ProviderWebhooksService]
})
export class WebhooksModule {}
