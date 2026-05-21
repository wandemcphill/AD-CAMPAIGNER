import { Inject, Injectable } from "@nestjs/common";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer
} from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";

import { PlatformService } from "./platform.service";

@Injectable()
@WebSocketGateway({
  namespace: "realtime",
  cors: true
})
export class RealtimeGateway implements OnGatewayConnection {
  @WebSocketServer()
  private server!: Server;

  constructor(@Inject(PlatformService) private readonly platform: PlatformService) {}

  handleConnection(client: Socket) {
    client.emit("notifications", this.platform.listNotifications());
    client.emit("campaigns", this.platform.listCampaigns());
    client.emit("livestreams", this.platform.listLivePromotions());
    client.emit("admin-monitoring", this.platform.getAdminOverview());
  }

  @SubscribeMessage("events:latest")
  getLatestEvents(@ConnectedSocket() client: Socket) {
    client.emit("events", this.platform.getEvents());
  }

  @SubscribeMessage("broadcast:test")
  broadcastTest(@MessageBody() body: { channel?: string; message?: string }) {
    this.server.emit(body.channel ?? "notifications", {
      message: body.message ?? "Realtime test event",
      emittedAt: new Date().toISOString()
    });
  }
}
