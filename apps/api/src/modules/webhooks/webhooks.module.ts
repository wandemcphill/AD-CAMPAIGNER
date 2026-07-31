import { Module } from "@nestjs/common";

import { PrismaService } from "../prisma.service";
import { IncomingWebhooksController, OutgoingWebhooksController } from "./webhooks.controller";
import { IncomingWebhooksService } from "./incoming-webhooks.service";
import { OutgoingWebhooksService } from "./outgoing-webhooks.service";

@Module({
  controllers: [OutgoingWebhooksController, IncomingWebhooksController],
  providers: [PrismaService, OutgoingWebhooksService, IncomingWebhooksService],
  exports: [OutgoingWebhooksService, IncomingWebhooksService]
})
export class WebhooksModule {}
