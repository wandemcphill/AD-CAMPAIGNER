export * from "./core.js";

import type { GrowthServiceCatalogItem } from "@fliptrybe/types";
import { defaultGrowthServicesCatalog as baseGrowthServicesCatalog } from "./core.js";
import { nigeriaGrowthServicesCatalog } from "./nigeria-catalog.js";

function normalizeProductionRouting(service: GrowthServiceCatalogItem): GrowthServiceCatalogItem {
  return {
    ...service,
    supplierRouting: {
      ...service.supplierRouting,
      strategy: "PREFERRED_FIRST",
      preferredSupplier: "gsubz",
      fallbackSuppliers: ["sizzle"]
    }
  };
}

export const defaultGrowthServicesCatalog: GrowthServiceCatalogItem[] = [
  ...baseGrowthServicesCatalog.map(normalizeProductionRouting),
  ...nigeriaGrowthServicesCatalog
];
