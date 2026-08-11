import { Body, Controller, Get, Inject, Post, Req } from "@nestjs/common";

import { workspaceContextFromRequest, type WorkspaceContextRequest } from "../request-context";
import { RequirePermissions } from "../authorization.decorators";
import type { SetFxRateDto, RefreshRatesDto, FxQuoteRequestDto } from "./fx.dtos";
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

  @Get("health")
  health() {
    return this.fx.getHealth();
  }

  @Post()
  setRate(@Body() body: SetFxRateDto, @Req() request: WorkspaceContextRequest) {
    return this.fx.setRate(workspaceContextFromRequest(request), body);
  }

  @Post("refresh")
  refreshRates(@Body() body: RefreshRatesDto) {
    return this.fx.refreshRateCache(body);
  }
}

// Same gap as SettlementController (settlement.controller.ts) — no
// @RequirePermissions/@Public meant this always 403'd via the guard's
// fail-closed default. Gated admin:access to match the settlement flow it
// feeds into, which is ops-only for the same reason (see that file's note).
@Controller("v1/fx")
@RequirePermissions("admin:access")
export class FxQuoteController {
  constructor(@Inject(FxService) private readonly fx: FxService) {}

  @Post("quotes")
  createQuote(@Body() body: FxQuoteRequestDto, @Req() request: WorkspaceContextRequest) {
    return this.fx.createQuote(workspaceContextFromRequest(request), body);
  }
}
