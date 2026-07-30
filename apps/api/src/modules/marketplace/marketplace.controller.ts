import { Controller, Get, Inject, Query } from "@nestjs/common";

import { Public } from "../authorization.decorators";
import { MarketplaceService } from "./marketplace.service";

@Controller("marketplace")
@Public()
export class MarketplaceController {
  constructor(@Inject(MarketplaceService) private readonly marketplace: MarketplaceService) {}

  @Get("agencies")
  agencies(@Query("specialty") specialty?: string) {
    return this.marketplace.listAgencies(specialty === undefined ? {} : { specialty });
  }

  @Get("creators")
  creators(@Query("niche") niche?: string) {
    return this.marketplace.listCreators(niche === undefined ? {} : { niche });
  }
}
