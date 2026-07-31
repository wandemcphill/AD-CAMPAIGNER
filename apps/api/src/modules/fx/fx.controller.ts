import { Body, Controller, Get, Inject, Post, Req } from "@nestjs/common";

import { workspaceContextFromRequest, type WorkspaceContextRequest } from "../request-context";
import { RequirePermissions } from "../authorization.decorators";
import type { SetFxRateDto } from "./fx.dtos";
import { FxService } from "./fx.service";

@Controller("admin/digital-products/fx")
@RequirePermissions("admin:access")
export class FxController {
  constructor(@Inject(FxService) private readonly fx: FxService) {}

  @Get()
  current() {
    return this.fx.getCurrent();
  }

  @Get("history")
  history() {
    return this.fx.getHistory();
  }

  @Post()
  setRate(@Body() body: SetFxRateDto, @Req() request: WorkspaceContextRequest) {
    return this.fx.setRate(workspaceContextFromRequest(request), body);
  }
}
