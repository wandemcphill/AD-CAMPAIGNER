import { Body, Controller, Get, Inject, Param, Post, Query, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import {
  workspaceContextFromRequest,
  type WorkspaceContextRequest
} from '../request-context';
import { RequirePermissions } from '../authorization.decorators';
import { DigitalValueService } from './digital-value.service';
import type {
  GiftCardSellRateDto,
  GiftCardSubmitDto,
  GiftCardProductsQueryDto,
  GiftCardBuyQuoteDto,
  GiftCardPurchaseDto,
  AirtimeCashoutRequestOtpDto,
  AirtimeCashoutVerifyOtpDto,
  AirtimeCashoutQuoteDto,
  AirtimeCashoutInitiateDto,
  DecideGiftCardSellReviewDto
} from './digital-value.dtos';

@Controller('digital-value')
@RequirePermissions('analytics:read')
export class DigitalValueController {
  constructor(@Inject(DigitalValueService) private readonly service: DigitalValueService) {}

  // ─── Gift Card Sell ────────────────────────────────────────────────────────────

  @Post('gift-cards/sell/rate')
  @RequirePermissions('campaign:create')
  @Throttle({ short: { limit: 20, ttl: 60_000 } })
  getGiftCardSellRate(
    @Body() body: GiftCardSellRateDto,
    @Req() request: WorkspaceContextRequest
  ) {
    return this.service.getGiftCardSellRate(workspaceContextFromRequest(request), body);
  }

  @Post('gift-cards/sell')
  @RequirePermissions('campaign:create')
  @Throttle({ short: { limit: 5, ttl: 60_000 } })
  submitGiftCardSell(
    @Body() body: GiftCardSubmitDto,
    @Req() request: WorkspaceContextRequest
  ) {
    return this.service.submitGiftCardSell(workspaceContextFromRequest(request), body);
  }

  // ─── Gift Card Buy ────────────────────────────────────────────────────────────

  @Get('gift-cards/products')
  getGiftCardProducts(
    @Query() query: GiftCardProductsQueryDto,
    @Req() request: WorkspaceContextRequest
  ) {
    return this.service.getGiftCardProducts(workspaceContextFromRequest(request), query);
  }

  @Post('gift-cards/buy/quote')
  @RequirePermissions('campaign:create')
  getGiftCardBuyQuote(
    @Body() body: GiftCardBuyQuoteDto,
    @Req() request: WorkspaceContextRequest
  ) {
    return this.service.getGiftCardBuyQuote(workspaceContextFromRequest(request), body);
  }

  @Post('gift-cards/buy')
  @RequirePermissions('campaign:create')
  purchaseGiftCard(
    @Body() body: GiftCardPurchaseDto,
    @Req() request: WorkspaceContextRequest
  ) {
    return this.service.purchaseGiftCard(workspaceContextFromRequest(request), body);
  }

  // ─── Airtime Cashout ──────────────────────────────────────────────────────────

  @Get('airtime/networks')
  getAirtimeNetworks() {
    return this.service.getAirtimeNetworks();
  }

  @Post('airtime/cashout/otp')
  @RequirePermissions('campaign:create')
  requestAirtimeOtp(
    @Body() body: AirtimeCashoutRequestOtpDto,
    @Req() request: WorkspaceContextRequest
  ) {
    return this.service.requestAirtimeOtp(workspaceContextFromRequest(request), body);
  }

  @Post('airtime/cashout/verify')
  @RequirePermissions('campaign:create')
  verifyAirtimeOtp(
    @Body() body: AirtimeCashoutVerifyOtpDto,
    @Req() request: WorkspaceContextRequest
  ) {
    return this.service.verifyAirtimeOtp(workspaceContextFromRequest(request), body);
  }

  @Post('airtime/cashout/quote')
  @RequirePermissions('campaign:create')
  getAirtimeCashoutQuote(
    @Body() body: AirtimeCashoutQuoteDto,
    @Req() request: WorkspaceContextRequest
  ) {
    return this.service.getAirtimeCashoutQuote(workspaceContextFromRequest(request), body);
  }

  @Post('airtime/cashout')
  @RequirePermissions('campaign:create')
  initiateAirtimeCashout(
    @Body() body: AirtimeCashoutInitiateDto,
    @Req() request: WorkspaceContextRequest
  ) {
    return this.service.initiateAirtimeCashout(workspaceContextFromRequest(request), body);
  }
}

@Controller('admin/digital-value')
@RequirePermissions('admin:access')
export class AdminDigitalValueController {
  constructor(@Inject(DigitalValueService) private readonly service: DigitalValueService) {}

  @Get('gift-cards/sell/flagged')
  listFlaggedGiftCardSells(@Query('workspaceId') workspaceId?: string) {
    return this.service.listFlaggedGiftCardSells(workspaceId);
  }

  @Post('gift-cards/sell/:approvalId/decide')
  decideFlaggedGiftCardSell(
    @Param('approvalId') approvalId: string,
    @Body() body: DecideGiftCardSellReviewDto,
    @Req() request: WorkspaceContextRequest
  ) {
    const ctx = workspaceContextFromRequest(request);

    return body.approve
      ? this.service.executeApprovedGiftCardSell(approvalId, ctx.userId, body.note)
      : this.service.rejectFlaggedGiftCardSell(approvalId, ctx.userId, body.note);
  }
}
