import { Body, Controller, Get, Param, Patch, Query, Req } from "@nestjs/common";

import { RequirePermissions } from "../authorization.decorators";
import {
  workspaceContextFromRequest,
  type WorkspaceContextRequest
} from "../request-context";
import { AdminVtuCommercialService } from "./admin-vtu-commercial.service";

@Controller("admin/vtu/commercial")
@RequirePermissions("admin:access")
export class AdminVtuCommercialController {
  constructor(private readonly commercial: AdminVtuCommercialService) {}

  @Get("products")
  listProducts(@Query() query: { network?: string; category?: string }) {
    return this.commercial.listCanonicalProducts(query);
  }

  @Patch("products/:id")
  updateProduct(
    @Param("id") id: string,
    @Body()
    body: {
      sellingPriceMinor?: number | null;
      minMarginBps?: number;
      active?: boolean;
      adminApproved?: boolean;
    },
    @Req() request: WorkspaceContextRequest
  ) {
    return this.commercial.updateCanonicalProduct(
      id,
      body,
      workspaceContextFromRequest(request)
    );
  }
}
