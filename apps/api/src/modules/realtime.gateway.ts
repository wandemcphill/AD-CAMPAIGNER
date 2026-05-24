/* eslint-disable @typescript-eslint/no-unsafe-assignment */
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
import { OtpMarketplaceService } from "./otp/otp.service";
import { DigitalAccessHubService } from "./digital-access/digital-access.service";
import { ManagedAdsService } from "./managed-ads.service";
import {
  optionalAuthenticatedContextFromHeaders,
  type AuthenticatedRequestContext
} from "./request-context";

@Injectable()
@WebSocketGateway({
  namespace: "realtime",
  cors: true
})
export class RealtimeGateway implements OnGatewayConnection {
  @WebSocketServer()
  private server!: Server;

  constructor(
    @Inject(PlatformService) private readonly platform: PlatformService,
    @Inject(OtpMarketplaceService) private readonly otp: OtpMarketplaceService,
    @Inject(ManagedAdsService) private readonly managedAds: ManagedAdsService,
    @Inject(DigitalAccessHubService) private readonly digitalAccess: DigitalAccessHubService
  ) {}

  handleConnection(client: Socket) {
    const workspaceContext = optionalAuthenticatedContextFromHeaders(client.handshake.headers);

    client.emit(
      "livestreams",
      workspaceContext ? this.platform.listLivePromotions(workspaceContext) : []
    );
    client.emit("admin-monitoring", this.platform.getAdminOverview());
    const otpSnapshot = this.otp.getRealtimeSnapshot();
    client.emit("otp-orders", otpSnapshot.orders);
    client.emit("otp-provider-health", []);
    client.emit("otp-admin-monitoring", {
      activeOrders: otpSnapshot.orders.length,
      emittedAt: new Date().toISOString()
    });
    void this.emitManagedAdsSnapshot(client, workspaceContext);
    void this.emitDigitalAccessSnapshot(client, workspaceContext?.workspaceId);
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

  private async emitDigitalAccessSnapshot(client: Socket, workspaceId?: string) {
    const digitalAccessSnapshot = await this.digitalAccess.getRealtimeSnapshot(workspaceId);

    client.emit("digital-access-requests", digitalAccessSnapshot.requests);
    client.emit("digital-access-admin-monitoring", {
      ...digitalAccessSnapshot.admin,
      emittedAt: new Date().toISOString()
    });
  }

  private async emitManagedAdsSnapshot(
    client: Socket,
    workspaceContext?: AuthenticatedRequestContext
  ) {
    if (!workspaceContext) {
      client.emit("notifications", []);
      client.emit("campaigns", []);
      return;
    }

    const [notifications, campaigns] = await Promise.all([
      this.managedAds.listNotifications(workspaceContext),
      this.managedAds.listCampaigns(workspaceContext)
    ]);
    client.emit("notifications", notifications);
    client.emit("campaigns", campaigns);
  }
}
