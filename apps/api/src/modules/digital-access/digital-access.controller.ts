import { Body, Controller, Get, Headers, Inject, Param, Patch, Post, Query } from "@nestjs/common";

import type {
  CreateDigitalAccessRequestDto,
  DigitalAccessAssignDto,
  DigitalAccessCategoryDto,
  DigitalAccessListQueryDto,
  DigitalAccessPlanDto,
  DigitalAccessRequestQueryDto,
  DigitalAccessServiceDto,
  DigitalAccessStatusDto
} from "./digital-access.dtos";
import { DigitalAccessHubService } from "./digital-access.service";

@Controller("digital-access")
export class DigitalAccessController {
  constructor(@Inject(DigitalAccessHubService) private readonly hub: DigitalAccessHubService) {}

  @Get("categories")
  categories() {
    return this.hub.listCategories();
  }

  @Get("services")
  services(@Query() query: DigitalAccessListQueryDto) {
    return this.hub.listServices(query);
  }

  @Get("services/:slug")
  service(@Param("slug") slug: string) {
    return this.hub.getService(slug);
  }

  @Get("requests")
  requests(@Headers("x-user-id") userId?: string) {
    return this.hub.listRequests({ userId: userId ?? "user_demo" });
  }

  @Get("requests/:id")
  request(@Param("id") id: string, @Headers("x-user-id") userId?: string) {
    return this.hub.getRequest(id, { userId: userId ?? "user_demo" });
  }

  @Post("requests")
  createRequest(
    @Body() body: CreateDigitalAccessRequestDto,
    @Headers("x-user-id") userId?: string,
    @Headers("idempotency-key") idempotencyKey?: string,
    @Headers("x-forwarded-for") ipAddress?: string,
    @Headers("user-agent") userAgent?: string,
    @Headers("x-device-id") deviceId?: string
  ) {
    return this.hub.createRequest(body, {
      userId: userId ?? "user_demo",
      ...(idempotencyKey === undefined ? {} : { idempotencyKey }),
      ...(ipAddress === undefined ? {} : { ipAddress }),
      ...(userAgent === undefined ? {} : { userAgent }),
      ...(deviceId === undefined ? {} : { deviceId })
    });
  }
}

@Controller("admin/digital-access")
export class AdminDigitalAccessController {
  constructor(@Inject(DigitalAccessHubService) private readonly hub: DigitalAccessHubService) {}

  @Get("overview")
  overview() {
    return this.hub.getAdminOverview();
  }

  @Get("categories")
  categories() {
    return this.hub.listAdminCategories();
  }

  @Post("categories")
  createCategory(@Body() body: DigitalAccessCategoryDto) {
    return this.hub.createCategory(body);
  }

  @Patch("categories/:id")
  updateCategory(@Param("id") id: string, @Body() body: DigitalAccessCategoryDto) {
    return this.hub.updateCategory(id, body);
  }

  @Get("services")
  services(@Query() query: DigitalAccessListQueryDto) {
    return this.hub.listAdminServices(query);
  }

  @Post("services")
  createService(@Body() body: DigitalAccessServiceDto) {
    return this.hub.createService(body);
  }

  @Patch("services/:id")
  updateService(@Param("id") id: string, @Body() body: DigitalAccessServiceDto) {
    return this.hub.updateService(id, body);
  }

  @Get("plans")
  plans(@Query("serviceId") serviceId?: string) {
    return this.hub.listAdminPlans(serviceId);
  }

  @Post("plans")
  createPlan(@Body() body: DigitalAccessPlanDto) {
    return this.hub.createPlan(body);
  }

  @Patch("plans/:id")
  updatePlan(@Param("id") id: string, @Body() body: DigitalAccessPlanDto) {
    return this.hub.updatePlan(id, body);
  }

  @Get("requests")
  requests(@Query() query: DigitalAccessRequestQueryDto) {
    return this.hub.listAdminRequests(query);
  }

  @Patch("requests/:id/status")
  status(@Param("id") id: string, @Body() body: DigitalAccessStatusDto) {
    return this.hub.updateRequestStatus(id, body.status);
  }

  @Patch("requests/:id/assign")
  assign(@Param("id") id: string, @Body() body: DigitalAccessAssignDto) {
    return this.hub.assignRequest(id, body.assignedTo ?? null);
  }
}
