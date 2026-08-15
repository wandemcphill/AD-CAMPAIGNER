import { Body, Controller, Get, Inject, Param, Patch, Post, Query, Req } from "@nestjs/common";

import type { ProviderDomain } from "@fliptrybe/providers";
import { authenticatedContextFromHeaders, type WorkspaceContextRequest } from "../request-context";
import { RequirePermissions } from "../authorization.decorators";
import { PricingRuleService } from "./pricing-rule.service";
import { ProvidersService } from "./providers.service";

@Controller("admin/providers")
@RequirePermissions("admin:access")
export class ProvidersController {
  constructor(
    @Inject(ProvidersService) private readonly providers: ProvidersService,
    @Inject(PricingRuleService) private readonly pricingRules: PricingRuleService
  ) {}

  @Get()
  overview() {
    return this.providers.overview();
  }

  @Get("registry")
  registry(@Query("domain") domain?: ProviderDomain) {
    return this.providers.listRegistry(domain);
  }

  @Patch("registry/:id")
  updateRegistry(
    @Param("id") id: string,
    @Body() body: { priority?: number; status?: "HEALTHY" | "DEGRADED" | "DOWN" | "DISABLED" },
    @Req() request: WorkspaceContextRequest
  ) {
    return this.providers.updateRegistryEntry(
      id,
      body,
      authenticatedContextFromHeaders(request.headers)
    );
  }

  // ── Capability grants ──────────────────────────────────────────────────────
  // The hard allowlist ProviderRouterService consults before routing any
  // financial domain. Reaching "enabled" requires climbing every rung below it;
  // the service enforces the ordering and audits every change.

  @Get("capability-grants")
  capabilityGrants(@Query("domain") domain?: ProviderDomain) {
    return this.providers.listCapabilityGrants(domain);
  }

  // Enabling a provider for real money movement needs payment:manage on top of
  // admin:access — the same pairing that guards growth order overrides.
  @Patch("capability-grants/:id")
  @RequirePermissions("admin:access", "payment:manage")
  updateCapabilityGrant(
    @Param("id") id: string,
    @Body()
    body: {
      documented?: boolean;
      implemented?: boolean;
      sandboxVerified?: boolean;
      kybApproved?: boolean;
      complianceApproved?: boolean;
      productionApproved?: boolean;
      enabled?: boolean;
      priority?: number;
      notes?: string;
      reason?: string;
    },
    @Req() request: WorkspaceContextRequest
  ) {
    return this.providers.updateCapabilityGrant(
      id,
      body,
      authenticatedContextFromHeaders(request.headers)
    );
  }

  @Post(":domain/:name/disable")
  disable(
    @Param("domain") domain: ProviderDomain,
    @Param("name") name: string,
    @Body() body: { reason?: string },
    @Req() request: WorkspaceContextRequest
  ) {
    return this.providers.setProviderStatus(
      domain,
      name,
      "DISABLED",
      authenticatedContextFromHeaders(request.headers),
      body.reason
    );
  }

  @Post(":domain/:name/enable")
  enable(
    @Param("domain") domain: ProviderDomain,
    @Param("name") name: string,
    @Body() body: { reason?: string },
    @Req() request: WorkspaceContextRequest
  ) {
    return this.providers.setProviderStatus(
      domain,
      name,
      "HEALTHY",
      authenticatedContextFromHeaders(request.headers),
      body.reason
    );
  }

  @Get("pricing-rules")
  listPricingRules(@Query("domain") domain?: ProviderDomain) {
    return this.pricingRules.list(domain);
  }

  @Post("pricing-rules")
  createPricingRule(
    @Body()
    body: {
      domain: ProviderDomain;
      countryCode?: string;
      network?: string;
      productType?: string;
      providerName?: string;
      markupBps: number;
      specificity?: number;
      confirmHighMarkup?: boolean;
    },
    @Req() request: WorkspaceContextRequest
  ) {
    return this.pricingRules.create(body, authenticatedContextFromHeaders(request.headers));
  }

  @Patch("pricing-rules/:id")
  setPricingRuleActive(
    @Param("id") id: string,
    @Body() body: { active: boolean },
    @Req() request: WorkspaceContextRequest
  ) {
    return this.pricingRules.setActive(
      id,
      body.active,
      authenticatedContextFromHeaders(request.headers)
    );
  }
}
