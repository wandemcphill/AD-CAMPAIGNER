import { Injectable } from "@nestjs/common";

import { PrismaService } from "../prisma.service";
import { PricingRuleService } from "../providers/pricing-rule.service";
import { QueueProducerService } from "../queue-producer.service";
import { FxService } from "../fx/fx.service";
import { VirtualNumbersService } from "./virtual-numbers.service";

/**
 * Production facade for verification numbers.
 *
 * The legacy service has an internal backwards-compatible default-catalog
 * helper that seeds four historical countries. The production customer list
 * must come entirely from the live 5SIM sync, so this override deliberately
 * bypasses that legacy helper for the country listing endpoint.
 */
@Injectable()
export class ProductionVirtualNumbersService extends VirtualNumbersService {
  constructor(
    prismaService: PrismaService,
    queue: QueueProducerService,
    fx: FxService,
    pricingRules: PricingRuleService
  ) {
    super(prismaService, queue, fx, pricingRules);
    this.productionPrisma = prismaService;
  }

  private readonly productionPrisma: PrismaService;

  override async listCountries() {
    return this.productionPrisma.client.numberCountry.findMany({
      where: { enabled: true },
      orderBy: { sortOrder: "asc" }
    });
  }
}
