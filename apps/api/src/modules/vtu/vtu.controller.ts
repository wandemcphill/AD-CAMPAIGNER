import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req
} from "@nestjs/common";

import {
  workspaceContextFromRequest,
  type WorkspaceContextRequest
} from "../request-context";
import { RequirePermissions } from "../authorization.decorators";
import type {
  AdminEducationPlanUpsertDto,
  AdminVtuRouteUpdateDto,
  BillsOrderQueryDto,
  BuyAirtimeEpinDto,
  BuyDataEpinDto,
  BuyBetFundingDto,
  BuyCableDto,
  BuyEducationDto,
  BuyElectricityDto,
  BuyAirtimeDto,
  BuyDataDto,
  CablePackagesQueryDto,
  GetVtuQuoteDto,
  ValidateMeterDto,
  VerifyBettingDto,
  VerifyCableDto,
  VerifyJambDto,
  VtuOrderQueryDto
} from "./vtu.dtos";
import { VtuService } from "./vtu.service";

@Controller("vtu")
@RequirePermissions("analytics:read")
export class VtuController {
  constructor(@Inject(VtuService) private readonly vtu: VtuService) {}

  @Get("quote")
  @RequirePermissions("analytics:read")
  getQuote(@Query() query: GetVtuQuoteDto) {
    return this.vtu.createQuoteForProduct(query);
  }

  @Get("data-plans")
  listDataPlans(@Query("network") network?: BuyDataDto["network"]) {
    return this.vtu.listDataPlans(network);
  }

  @Get("orders")
  @RequirePermissions("analytics:read")
  listOrders(@Query() query: VtuOrderQueryDto, @Req() request: WorkspaceContextRequest) {
    return this.vtu.listOrders(workspaceContextFromRequest(request), query);
  }

  @Post("airtime")
  @RequirePermissions("campaign:create")
  buyAirtime(@Body() body: BuyAirtimeDto, @Req() request: WorkspaceContextRequest) {
    return this.vtu.buyAirtime(workspaceContextFromRequest(request), body);
  }

  @Post("data")
  @RequirePermissions("campaign:create")
  buyData(@Body() body: BuyDataDto, @Req() request: WorkspaceContextRequest) {
    return this.vtu.buyData(workspaceContextFromRequest(request), body);
  }

  @Post("airtime/epin")
  @RequirePermissions("campaign:create")
  buyAirtimeEpin(@Body() body: BuyAirtimeEpinDto, @Req() request: WorkspaceContextRequest) {
    return this.vtu.buyAirtimeEpin(workspaceContextFromRequest(request), body);
  }

  @Post("data/epin")
  @RequirePermissions("campaign:create")
  buyDataEpin(@Body() body: BuyDataEpinDto, @Req() request: WorkspaceContextRequest) {
    return this.vtu.buyDataEpin(workspaceContextFromRequest(request), body);
  }

  // Phase 5 — Bills & Cable

  @Post("electricity/validate")
  @RequirePermissions("campaign:create")
  validateMeter(@Body() body: ValidateMeterDto) {
    return this.vtu.validateMeter(body);
  }

  @Post("electricity")
  @RequirePermissions("campaign:create")
  buyElectricity(@Body() body: BuyElectricityDto, @Req() request: WorkspaceContextRequest) {
    return this.vtu.buyElectricity(workspaceContextFromRequest(request), body);
  }

  @Get("cable/packages")
  listCablePackages(@Query() query: CablePackagesQueryDto) {
    return this.vtu.listCablePackages(query.provider);
  }

  @Post("cable/verify")
  @RequirePermissions("campaign:create")
  verifyCable(@Body() body: VerifyCableDto) {
    return this.vtu.verifyCable(body);
  }

  @Post("cable")
  @RequirePermissions("campaign:create")
  buyCable(@Body() body: BuyCableDto, @Req() request: WorkspaceContextRequest) {
    return this.vtu.buyCable(workspaceContextFromRequest(request), body);
  }

  @Get("bills/orders")
  @RequirePermissions("analytics:read")
  listBillsOrders(
    @Query() query: BillsOrderQueryDto,
    @Req() request: WorkspaceContextRequest
  ) {
    return this.vtu.listBillsOrders(workspaceContextFromRequest(request), query);
  }

  // ─── Bet funding ────────────────────────────────────────────────────────────

  @Get("betting/companies")
  listBettingCompanies() {
    return this.vtu.listBettingCompanies();
  }

  @Post("betting/verify")
  @RequirePermissions("campaign:create")
  verifyBetting(@Body() body: VerifyBettingDto) {
    return this.vtu.verifyBetting(body);
  }

  @Post("betting")
  @RequirePermissions("campaign:create")
  buyBetFunding(@Body() body: BuyBetFundingDto, @Req() request: WorkspaceContextRequest) {
    return this.vtu.buyBetFunding(workspaceContextFromRequest(request), body);
  }

  // ─── Education (WAEC / JAMB) ────────────────────────────────────────────────

  @Get("education/plans")
  listEducationPlans() {
    return this.vtu.listEducationPlans();
  }

  @Post("education/verify-jamb")
  @RequirePermissions("campaign:create")
  verifyJamb(@Body() body: VerifyJambDto) {
    return this.vtu.verifyJamb(body);
  }

  @Post("education")
  @RequirePermissions("campaign:create")
  buyEducation(@Body() body: BuyEducationDto, @Req() request: WorkspaceContextRequest) {
    return this.vtu.buyEducation(workspaceContextFromRequest(request), body);
  }
}

@Controller("admin/vtu")
@RequirePermissions("admin:access")
export class AdminVtuController {
  constructor(@Inject(VtuService) private readonly vtu: VtuService) {}

  @Get("routes")
  listRoutes() {
    return this.vtu.adminListRoutes();
  }

  @Patch("routes/:id")
  updateRoute(
    @Param("id") id: string,
    @Body() body: AdminVtuRouteUpdateDto,
    @Req() request: WorkspaceContextRequest
  ) {
    return this.vtu.adminUpdateRoute(id, body, workspaceContextFromRequest(request));
  }

  @Post("orders/:id/resolve")
  resolveOrder(
    @Param("id") id: string,
    @Body() body: { resolution: "DELIVERED" | "REVERSED" },
    @Req() request: WorkspaceContextRequest
  ) {
    return this.vtu.adminResolveOrder(id, body.resolution, workspaceContextFromRequest(request));
  }

  @Get("bills/orders")
  adminBillsOrders(
    @Query() query: { status?: string; productType?: string; days?: number; limit?: number }
  ) {
    return this.vtu.adminBillsOrders(query);
  }

  // ─── Canonical SKU management ─────────────────────────────────────────────────

  @Get("skus")
  listCanonicalSkus(@Query() query: { network?: string; category?: string }) {
    return this.vtu.adminListCanonicalSkus(query);
  }

  @Patch("skus/mappings/:mappingId")
  updateSkuMapping(
    @Param("mappingId") mappingId: string,
    @Body() body: { costMinor?: number; active?: boolean; adminApproved?: boolean },
    @Req() request: WorkspaceContextRequest
  ) {
    return this.vtu.adminUpdateSkuMapping(mappingId, body, workspaceContextFromRequest(request));
  }

  // ─── Education plan pricing ──────────────────────────────────────────────────
  // For providers with no pricing endpoint of their own (SirpData) this is the
  // only way a plan row exists, and buyEducation refuses to charge without one.

  @Get("education/plans")
  listEducationPlans(@Query() query: { providerName?: string }) {
    return this.vtu.adminListEducationPlans(query);
  }

  @Put("education/plans")
  upsertEducationPlan(
    @Body() body: AdminEducationPlanUpsertDto,
    @Req() request: WorkspaceContextRequest
  ) {
    return this.vtu.adminUpsertEducationPlan(body, workspaceContextFromRequest(request));
  }

  @Delete("education/plans/:id")
  deleteEducationPlan(@Param("id") id: string, @Req() request: WorkspaceContextRequest) {
    return this.vtu.adminDeleteEducationPlan(id, workspaceContextFromRequest(request));
  }

  // ─── Provider Control Center ─────────────────────────────────────────────────

  @Get("providers")
  listProviderConfigs() {
    return this.vtu.adminListProviderConfigs();
  }

  @Patch("providers/:providerName")
  updateProviderConfig(
    @Param("providerName") providerName: string,
    @Body()
    body: {
      status?: string;
      maintenanceMode?: boolean;
      minBalanceMinor?: number;
      maxTransactionMinor?: number;
      costWeight?: number;
      successRateWeight?: number;
      latencyWeight?: number;
      balanceWeight?: number;
      trafficAllocationPct?: number;
      enabledServices?: string[];
    },
    @Req() request: WorkspaceContextRequest
  ) {
    return this.vtu.adminUpdateProviderConfig(
      providerName,
      body,
      workspaceContextFromRequest(request)
    );
  }

  @Get("providers/:providerName/balance")
  getProviderBalance(@Param("providerName") providerName: string) {
    return this.vtu.adminGetProviderBalance(providerName);
  }

  @Get("providers/routing-matrix")
  getRoutingMatrix() {
    return this.vtu.adminGetRoutingMatrix();
  }
}
