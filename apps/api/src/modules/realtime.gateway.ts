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

import { hasPermission } from "@fliptrybe/auth";
import type { Permission } from "@fliptrybe/types";
import { AuthSessionService } from "./auth-session.service";
import { PlatformService } from "./platform.service";
import { DigitalAccessHubService } from "./digital-access/digital-access.service";
import { ManagedAdsService } from "./managed-ads.service";
import type { AuthenticatedRequestContext } from "./request-context";

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
    @Inject(ManagedAdsService) private readonly managedAds: ManagedAdsService,
    @Inject(DigitalAccessHubService) private readonly digitalAccess: DigitalAccessHubService,
    @Inject(AuthSessionService) private readonly authSession: AuthSessionService
  ) {}

  async handleConnection(client: Socket) {
    const workspaceContext = await this.getSocketContext(client);

    client.emit(
      "livestreams",
      workspaceContext ? this.platform.listLivePromotions(workspaceContext) : []
    );

    if (this.canAccess(workspaceContext, "admin:access")) {
      client.emit("admin-monitoring", this.platform.getAdminOverview());
    } else {
      client.emit("admin-monitoring", null);
    }

    void this.emitManagedAdsSnapshot(client, workspaceContext);
    void this.emitDigitalAccessSnapshot(client, workspaceContext);
  }

  @SubscribeMessage("events:latest")
  async getLatestEvents(@ConnectedSocket() client: Socket) {
    const workspaceContext = await this.getSocketContext(client);
    if (!this.canAccess(workspaceContext, "analytics:read")) {
      client.emit("events", []);
      return;
    }

    client.emit("events", this.platform.getEvents());
  }

  @SubscribeMessage("broadcast:test")
  async broadcastTest(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { channel?: string; message?: string }
  ) {
    const workspaceContext = await this.getSocketContext(client);
    if (!this.canAccess(workspaceContext, "admin:access")) {
      client.emit("authorization:error", {
        message: "Missing required permission: admin:access."
      });
      return;
    }

    this.server.emit(body.channel ?? "notifications", {
      message: body.message ?? "Realtime test event",
      emittedAt: new Date().toISOString()
    });
  }

  private async emitDigitalAccessSnapshot(
    client: Socket,
    workspaceContext?: AuthenticatedRequestContext
  ) {
    const digitalAccessSnapshot = await this.digitalAccess.getRealtimeSnapshot(
      workspaceContext?.workspaceId
    );

    client.emit("digital-access-requests", digitalAccessSnapshot.requests);
    client.emit(
      "digital-access-admin-monitoring",
      this.canAccess(workspaceContext, "admin:access")
        ? {
            ...digitalAccessSnapshot.admin,
            emittedAt: new Date().toISOString()
          }
        : null
    );
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

  private async getSocketContext(client: Socket) {
    try {
      return await this.authSession.getWorkspaceContext(client.handshake.headers);
    } catch {
      return undefined;
    }
  }

  private canAccess(
    workspaceContext: AuthenticatedRequestContext | undefined,
    permission: Permission
  ) {
    if (!workspaceContext?.role) {
      return false;
    }

    return hasPermission(
      {
        role: workspaceContext.role,
        permissions: workspaceContext.permissions ?? [],
        isPlatformAdmin: Boolean(workspaceContext.isPlatformAdmin)
      },
      permission
    );
  }
}
