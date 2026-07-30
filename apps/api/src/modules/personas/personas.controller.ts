import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Req } from "@nestjs/common";

import { RequirePermissions } from "../authorization.decorators";
import { workspaceContextFromRequest, type WorkspaceContextRequest } from "../request-context";
import type { CreatePersonaDto, UpdatePersonaDto } from "./personas.dtos";
import { PersonasService } from "./personas.service";

@Controller("personas")
@RequirePermissions("analytics:read")
export class PersonasController {
  constructor(@Inject(PersonasService) private readonly personas: PersonasService) {}

  @Get()
  list(@Req() request: WorkspaceContextRequest) {
    return this.personas.list(workspaceContextFromRequest(request));
  }

  @Post()
  @RequirePermissions("campaign:create")
  create(@Body() body: CreatePersonaDto, @Req() request: WorkspaceContextRequest) {
    return this.personas.create(body, workspaceContextFromRequest(request));
  }

  @Patch(":id")
  @RequirePermissions("campaign:create")
  update(
    @Param("id") id: string,
    @Body() body: UpdatePersonaDto,
    @Req() request: WorkspaceContextRequest
  ) {
    return this.personas.update(id, body, workspaceContextFromRequest(request));
  }

  @Patch(":id/consent")
  @RequirePermissions("campaign:create")
  consent(@Param("id") id: string, @Req() request: WorkspaceContextRequest) {
    return this.personas.markConsented(id, workspaceContextFromRequest(request));
  }

  @Delete(":id")
  @RequirePermissions("campaign:create")
  remove(@Param("id") id: string, @Req() request: WorkspaceContextRequest) {
    return this.personas.remove(id, workspaceContextFromRequest(request));
  }
}
