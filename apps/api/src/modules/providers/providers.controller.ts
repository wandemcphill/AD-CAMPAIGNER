import { Controller, Get, Inject } from "@nestjs/common";

import { RequirePermissions } from "../authorization.decorators";
import { ProvidersService } from "./providers.service";

@Controller("admin/providers")
@RequirePermissions("admin:access")
export class ProvidersController {
  constructor(@Inject(ProvidersService) private readonly providers: ProvidersService) {}

  @Get()
  overview() {
    return this.providers.overview();
  }
}
