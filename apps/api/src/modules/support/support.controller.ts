import { Body, Controller, Get, Inject, Param, Patch, Post, Query, Req } from "@nestjs/common";

import { workspaceContextFromRequest, type WorkspaceContextRequest } from "../request-context";
import { RequirePermissions } from "../authorization.decorators";
import { SupportService } from "./support.service";
import type {
  CreateSupportTicketDto,
  SupportTicketQueryDto,
  UpdateSupportTicketDto
} from "./support.dtos";

@Controller("support/tickets")
export class SupportController {
  constructor(@Inject(SupportService) private readonly support: SupportService) {}

  @Post()
  create(@Body() body: CreateSupportTicketDto, @Req() request: WorkspaceContextRequest) {
    return this.support.create(body, workspaceContextFromRequest(request));
  }

  @Get()
  list(@Req() request: WorkspaceContextRequest) {
    return this.support.list(workspaceContextFromRequest(request));
  }

  @Get(":id")
  get(@Param("id") id: string, @Req() request: WorkspaceContextRequest) {
    return this.support.get(id, workspaceContextFromRequest(request));
  }

  @Post(":id/replies")
  reply(
    @Param("id") id: string,
    @Body() body: { body: string },
    @Req() request: WorkspaceContextRequest
  ) {
    return this.support.reply(id, body.body, workspaceContextFromRequest(request));
  }
}

@Controller("admin/support/tickets")
@RequirePermissions("admin:access")
export class AdminSupportController {
  constructor(@Inject(SupportService) private readonly support: SupportService) {}

  @Get()
  list(@Query() query: SupportTicketQueryDto) {
    return this.support.adminList(query);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() body: UpdateSupportTicketDto) {
    return this.support.adminUpdate(id, body);
  }

  @Post(":id/replies")
  reply(
    @Param("id") id: string,
    @Body() body: { body: string },
    @Req() request: WorkspaceContextRequest
  ) {
    return this.support.adminReply(id, body.body, workspaceContextFromRequest(request).userId);
  }
}
