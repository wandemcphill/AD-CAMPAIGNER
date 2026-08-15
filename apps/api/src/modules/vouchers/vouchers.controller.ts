import { Body, Controller, Get, Inject, Param, Patch, Post, Req } from "@nestjs/common";

import { Public, RequirePermissions } from "../authorization.decorators";
import { workspaceContextFromRequest, type WorkspaceContextRequest } from "../request-context";
import { VouchersService } from "./vouchers.service";

@Controller("vouchers")
@RequirePermissions("analytics:read")
export class VouchersController {
  constructor(@Inject(VouchersService) private readonly vouchers: VouchersService) {}

  @Get("products")
  products() {
    return this.vouchers.listProducts();
  }

  @Get()
  list(@Req() request: WorkspaceContextRequest) {
    return this.vouchers.listWalletVouchers(workspaceContextFromRequest(request));
  }

  @Post()
  @RequirePermissions("campaign:create")
  create(
    @Body() body: { productId: string; giftNote?: string; redemptionDestination?: string; metadata?: Record<string, unknown> },
    @Req() request: WorkspaceContextRequest
  ) {
    return this.vouchers.createVoucher(body, workspaceContextFromRequest(request));
  }

  @Post(":id/share")
  @RequirePermissions("campaign:create")
  share(@Param("id") id: string, @Req() request: WorkspaceContextRequest) {
    return this.vouchers.shareVoucher(id, workspaceContextFromRequest(request));
  }

  @Post(":id/reveal")
  @RequirePermissions("campaign:create")
  reveal(@Param("id") id: string, @Req() request: WorkspaceContextRequest) {
    return this.vouchers.revealVoucher(id, workspaceContextFromRequest(request));
  }

  @Post(":id/redeem")
  @RequirePermissions("campaign:create")
  redeem(
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
    @Req() request: WorkspaceContextRequest
  ) {
    return this.vouchers.redeemVoucher(id, body, workspaceContextFromRequest(request));
  }
}

@Controller("claim")
@Public()
export class VoucherClaimController {
  constructor(@Inject(VouchersService) private readonly vouchers: VouchersService) {}

  @Get(":token")
  preview(@Param("token") token: string) {
    return this.vouchers.getClaimPreview(token);
  }

  @Post(":token")
  claim(
    @Param("token") token: string,
    @Req() request: WorkspaceContextRequest
  ) {
    return this.vouchers.claimVoucher(token, workspaceContextFromRequest(request));
  }
}

@Controller("admin/vouchers")
@RequirePermissions("admin:access")
export class AdminVouchersController {
  constructor(@Inject(VouchersService) private readonly vouchers: VouchersService) {}

  @Get("products")
  products() {
    return this.vouchers.adminListProducts();
  }

  @Patch("products/:id/denominations")
  setDenominations(
    @Param("id") id: string,
    @Body() body: { denominationsMinor: number[] },
    @Req() request: WorkspaceContextRequest
  ) {
    return this.vouchers.adminSetDenominations(
      id,
      body.denominationsMinor,
      workspaceContextFromRequest(request)
    );
  }
}
