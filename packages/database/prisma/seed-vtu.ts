import { createPrismaClient } from "../src/index";

// Seeds VtuProviderRoute (routing priority table) and VtuDataPlan (data plan catalog).
//
// Supplier split:
//   AIRTIME + BETTING         -> ClubKonnect (funded, live-verified)
//   DATA                      -> Swiftlink (cheapest), ClubKonnect as fallback
//   CABLE + ELECTRICITY       -> Swiftlink (cheapest), ClubKonnect as fallback
//   EDUCATION                 -> SirpData, then TopupWizard
//   DATA (international)      -> Reloadly, via the telecom gateway
//
// VTpass has been removed from the platform. ClubKonnect plan IDs/prices below are
// verified against the live account as of 2026-08-05 (see vtu.service.ts
// DEFAULT_DATA_PLANS for the same verified set used as the runtime bootstrap catalog).

const NETWORKS = ["MTN", "GLO", "AIRTEL", "NINE_MOBILE"] as const;
const PRODUCT_TYPES = ["AIRTIME", "DATA"] as const;
const BILLS_PRODUCT_TYPES = ["ELECTRICITY", "CABLE"] as const;
const CLUBKONNECT_ONLY_BILLS_PRODUCT_TYPES = ["BETTING"] as const;

// AIRTIME stays with ClubKonnect — the funded, live-verified account.
// VTpass has been removed from the platform entirely.
const ROUTE_PRIORITY = {
  clubkonnect: 10
};

// DATA is a three-deep ladder, cheapest first, on published catalogue prices for
// MTN 1GB SME: Swiftlink ₦268, TopupWizard ₦505, ClubKonnect ₦563. Swiftlink is
// cheaper still on other networks (9mobile 1GB ₦180).
//
// Two fallbacks rather than one because data is the highest-volume vertical and
// ClubKonnect is nearly twice Swiftlink's price — putting TopupWizard in the
// middle means a Swiftlink outage costs ~88% more rather than ~110%.
const DATA_ROUTE_PRIORITY = {
  swiftlink: 10,
  topupwizard: 15,
  clubkonnect: 20
};

// CABLE and ELECTRICITY go to Swiftlink first: it is the cheapest source for
// both. ClubKonnect stays on as fallback so a Swiftlink outage does not take
// the vertical down — unlike EDUCATION, where falling back would silently sell
// a worse price, cable/electricity prices are close enough that continuity wins.
//
// Lower number = higher priority (VtuProviderRoute is ordered priority: asc).
const BILLS_ROUTE_PRIORITY = {
  swiftlink: 10,
  clubkonnect: 20
};

// EDUCATION routes separately from the other bills.
//
// SirpData and TopupWizard ONLY. ClubKonnect is deliberately not a fallback
// here: it is the most expensive source for exam PINs and its account tier
// returns no JAMB pricing at all, so falling back to it would quietly sell a
// worse price rather than fail. WAEC/NECO/JAMB/NABTEB all come from these two.
//
// Lower number = higher priority (VtuProviderRoute is ordered priority: asc).
const EDUCATION_ROUTE_PRIORITY = {
  sirpdata: 10,
  topupwizard: 15
};

interface DataPlanSeed {
  providerPlanId: string;
  network: (typeof NETWORKS)[number];
  planType: "SME" | "CG" | "GIFTING" | "CORPORATE";
  displayName: string;
  sizeMb: number;
  validityDays: number;
  costMinor: number;
}

// Real ClubKonnect PRODUCT_ID / PRODUCT_NAME / PRODUCT_AMOUNT values pulled from the
// live account (UserID CK101286023) via /APIDatabundlePlansV2.asp on 2026-08-05.
const CLUBKONNECT_PLANS: DataPlanSeed[] = [
  { providerPlanId: "500", network: "MTN", planType: "SME", displayName: "MTN 500MB - Weekly (SME)", sizeMb: 500, validityDays: 7, costMinor: 30700 },
  { providerPlanId: "1000", network: "MTN", planType: "SME", displayName: "MTN 1GB - Weekly (SME)", sizeMb: 1024, validityDays: 7, costMinor: 41000 },
  { providerPlanId: "1000.00", network: "MTN", planType: "SME", displayName: "MTN 1GB - Monthly (SME)", sizeMb: 1024, validityDays: 30, costMinor: 56300 },
  { providerPlanId: "2000.00", network: "MTN", planType: "SME", displayName: "MTN 2GB - Monthly (SME)", sizeMb: 2048, validityDays: 30, costMinor: 111700 },
  { providerPlanId: "3000.00", network: "MTN", planType: "SME", displayName: "MTN 3GB - Monthly (SME)", sizeMb: 3072, validityDays: 30, costMinor: 162900 },
  { providerPlanId: "5000.00", network: "MTN", planType: "SME", displayName: "MTN 5GB - Monthly (SME)", sizeMb: 5120, validityDays: 30, costMinor: 251100 },
  { providerPlanId: "1000", network: "GLO", planType: "SME", displayName: "Glo 1GB - 30 days (SME)", sizeMb: 1024, validityDays: 30, costMinor: 46100 },
  { providerPlanId: "2000", network: "GLO", planType: "SME", displayName: "Glo 2GB - 30 days (SME)", sizeMb: 2048, validityDays: 30, costMinor: 92200 },
  { providerPlanId: "3000", network: "GLO", planType: "SME", displayName: "Glo 3GB - 30 days (SME)", sizeMb: 3072, validityDays: 30, costMinor: 138300 },
  { providerPlanId: "5000", network: "GLO", planType: "SME", displayName: "Glo 5GB - 30 days (SME)", sizeMb: 5120, validityDays: 30, costMinor: 230600 },
  { providerPlanId: "10000", network: "GLO", planType: "SME", displayName: "Glo 10GB - 30 days (SME)", sizeMb: 10240, validityDays: 30, costMinor: 461200 },
  { providerPlanId: "1499.93", network: "AIRTEL", planType: "SME", displayName: "Airtel 2GB - 30 days (Direct Data)", sizeMb: 2048, validityDays: 30, costMinor: 145493 },
  { providerPlanId: "1999.91", network: "AIRTEL", planType: "SME", displayName: "Airtel 3GB - 30 days (Direct Data)", sizeMb: 3072, validityDays: 30, costMinor: 193991 },
  { providerPlanId: "2999.92", network: "AIRTEL", planType: "SME", displayName: "Airtel 8GB - 30 days (Direct Data)", sizeMb: 8192, validityDays: 30, costMinor: 290992 },
  { providerPlanId: "3999.91", network: "AIRTEL", planType: "SME", displayName: "Airtel 10GB - 30 days (Direct Data)", sizeMb: 10240, validityDays: 30, costMinor: 387991 },
  { providerPlanId: "1000", network: "NINE_MOBILE", planType: "SME", displayName: "9mobile 1GB - 30 days (SME)", sizeMb: 1024, validityDays: 30, costMinor: 49200 },
  { providerPlanId: "2000", network: "NINE_MOBILE", planType: "SME", displayName: "9mobile 2GB - 30 days (SME)", sizeMb: 2048, validityDays: 30, costMinor: 98400 },
  { providerPlanId: "5000", network: "NINE_MOBILE", planType: "SME", displayName: "9mobile 5GB - 30 days (SME)", sizeMb: 5120, validityDays: 30, costMinor: 246000 },
  { providerPlanId: "10000", network: "NINE_MOBILE", planType: "SME", displayName: "9mobile 10GB - 30 days (SME)", sizeMb: 10240, validityDays: 30, costMinor: 492000 }
];

// Verified DStv package codes from ClubKonnect docs (2026-08-05). GOtv/StarTimes/Showmax
// are populated live by the cable_catalog_sync worker job.
const CLUBKONNECT_CABLE_PACKAGES: Array<{
  cableProvider: string;
  packageCode: string;
  displayName: string;
  costMinor: number;
}> = [
  { cableProvider: "dstv", packageCode: "dstv-padi", displayName: "DStv Padi", costMinor: 440000 },
  { cableProvider: "dstv", packageCode: "dstv-yanga", displayName: "DStv Yanga", costMinor: 600000 },
  { cableProvider: "dstv", packageCode: "dstv-confam", displayName: "DStv Confam", costMinor: 1100000 },
  { cableProvider: "dstv", packageCode: "dstv79", displayName: "DStv Compact", costMinor: 1900000 },
  { cableProvider: "dstv", packageCode: "dstv7", displayName: "DStv Compact Plus", costMinor: 3000000 },
  { cableProvider: "dstv", packageCode: "dstv3", displayName: "DStv Premium", costMinor: 4450000 },
  { cableProvider: "dstv", packageCode: "dstv10", displayName: "DStv Premium-Asia", costMinor: 5050000 },
  { cableProvider: "dstv", packageCode: "dstv9", displayName: "DStv Premium-French", costMinor: 6900000 }
];

async function seedRoutes(db: ReturnType<typeof createPrismaClient>) {
  let created = 0;
  let skipped = 0;

  for (const productType of PRODUCT_TYPES) {
    // DATA is Swiftlink-led; AIRTIME stays ClubKonnect-only.
    const priorities = productType === "DATA" ? DATA_ROUTE_PRIORITY : ROUTE_PRIORITY;

    for (const network of NETWORKS) {
      for (const [provider, priority] of Object.entries(priorities)) {
        const existing = await db.vtuProviderRoute.findFirst({
          where: { productType, network, provider }
        });

        if (existing) {
          if (existing.priority !== priority) {
            await db.vtuProviderRoute.update({ where: { id: existing.id }, data: { priority } });
          }
          skipped++;
          continue;
        }

        await db.vtuProviderRoute.create({
          data: {
            productType,
            network,
            provider,
            priority,
            active: true,
            note: `Seeded ${productType} route (${provider})`
          }
        });
        created++;
      }
    }
  }

  console.log(`VtuProviderRoute: ${created} created, ${skipped} already existed`);
}

async function seedBillsRoutes(db: ReturnType<typeof createPrismaClient>) {
  let created = 0;
  let skipped = 0;

  for (const productType of BILLS_PRODUCT_TYPES) {
    for (const [provider, priority] of Object.entries(BILLS_ROUTE_PRIORITY)) {
      const existing = await db.vtuProviderRoute.findFirst({
        where: { productType, network: null, provider }
      });

      if (existing) {
        if (existing.priority !== priority) {
          await db.vtuProviderRoute.update({ where: { id: existing.id }, data: { priority } });
        }
        skipped++;
        continue;
      }

      await db.vtuProviderRoute.create({
        data: {
          productType,
          network: null,
          provider,
          priority,
          active: true,
          note: `Seeded ${productType} route (${provider}, priority ${priority})`
        }
      });
      created++;
    }
  }

  for (const productType of CLUBKONNECT_ONLY_BILLS_PRODUCT_TYPES) {
    const provider = "clubkonnect";
    const priority = ROUTE_PRIORITY.clubkonnect;
    const existing = await db.vtuProviderRoute.findFirst({
      where: { productType, network: null, provider }
    });

    if (existing) {
      skipped++;
      continue;
    }

    await db.vtuProviderRoute.create({
      data: {
        productType,
        network: null,
        provider,
        priority,
        active: true,
        note: "Seeded primary bills route (only provider verified for this product)"
      }
    });
    created++;
  }

  for (const [provider, priority] of Object.entries(EDUCATION_ROUTE_PRIORITY)) {
    const existing = await db.vtuProviderRoute.findFirst({
      where: { productType: "EDUCATION", network: null, provider }
    });

    if (existing) {
      // Re-assert priority so an environment seeded before education moved off
      // ClubKonnect-only picks up the new ordering instead of keeping the old.
      if (existing.priority !== priority) {
        await db.vtuProviderRoute.update({ where: { id: existing.id }, data: { priority } });
      }
      skipped++;
      continue;
    }

    await db.vtuProviderRoute.create({
      data: {
        productType: "EDUCATION",
        network: null,
        provider,
        priority,
        active: true,
        note:
          provider === "clubkonnect"
            ? "Seeded education fallback (funded account; no JAMB pricing at this tier)"
            : "Seeded education route (cheapest source for WAEC/NECO/NABTEB)"
      }
    });
    created++;
  }

  console.log(`VtuProviderRoute (bills): ${created} created, ${skipped} already existed`);
}

async function seedDataPlans(db: ReturnType<typeof createPrismaClient>) {
  const rows: Array<{ providerName: string; plan: DataPlanSeed }> = [
    ...CLUBKONNECT_PLANS.map((plan) => ({ providerName: "clubkonnect", plan }))
  ];

  for (const { providerName, plan } of rows) {
    await db.vtuDataPlan.upsert({
      where: {
        providerName_providerPlanId: {
          providerName,
          providerPlanId: plan.providerPlanId
        }
      },
      create: {
        providerName,
        providerPlanId: plan.providerPlanId,
        network: plan.network,
        planType: plan.planType,
        displayName: plan.displayName,
        sizeMb: plan.sizeMb,
        validityDays: plan.validityDays,
        costMinor: plan.costMinor,
        currency: "NGN",
        active: true
      },
      update: {
        network: plan.network,
        planType: plan.planType,
        displayName: plan.displayName,
        sizeMb: plan.sizeMb,
        validityDays: plan.validityDays,
        costMinor: plan.costMinor,
        active: true,
        lastSyncedAt: new Date()
      }
    });
  }

  console.log(`VtuDataPlan: ${rows.length} rows upserted (clubkonnect: ${CLUBKONNECT_PLANS.length})`);
}

async function seedCablePackages(db: ReturnType<typeof createPrismaClient>) {
  for (const pkg of CLUBKONNECT_CABLE_PACKAGES) {
    await db.vtuCablePackage.upsert({
      where: {
        providerName_packageCode: {
          providerName: "clubkonnect",
          packageCode: pkg.packageCode
        }
      },
      create: {
        providerName: "clubkonnect",
        cableProvider: pkg.cableProvider,
        packageCode: pkg.packageCode,
        displayName: pkg.displayName,
        costMinor: pkg.costMinor,
        currency: "NGN",
        active: true
      },
      update: {
        cableProvider: pkg.cableProvider,
        displayName: pkg.displayName,
        costMinor: pkg.costMinor,
        active: true,
        lastSyncedAt: new Date()
      }
    });
  }

  console.log(`VtuCablePackage: ${CLUBKONNECT_CABLE_PACKAGES.length} rows upserted (clubkonnect/dstv)`);
}

// ─── VtuCanonicalSku + VtuProviderSkuMapping seed ───────────────────────────
// Canonical SKUs are network/size/validity tuples that abstract over provider-specific
// plan IDs. The router uses them to compare costs across providers for the same product.
// pricingSource: LIVE_PROVIDER = pulled from the API; RESEARCHED_PUBLIC_PRICE = public docs/verifiable.
// ClubKonnect costs are LIVE_PROVIDER (verified against the funded account 2026-08-05).
// adminApproved: true on ClubKonnect (verified live).

interface CanonicalSkuSeed {
  id: string;
  displayName: string;
  network: string;
  sizeMb: number;
  validityDays: number;
  minMarginBps: number;
  mappings: Array<{
    providerName: string;
    providerSku: string;
    costMinor: number;
    adminApproved: boolean;
    pricingSourceType: "LIVE_PROVIDER" | "RESEARCHED_PUBLIC_PRICE";
  }>;
}

const CANONICAL_SKUS: CanonicalSkuSeed[] = [
  {
    id: "sku_mtn_500mb_7d",
    displayName: "MTN 500MB Weekly",
    network: "MTN",
    sizeMb: 500,
    validityDays: 7,
    minMarginBps: 200,
    mappings: [
      { providerName: "clubkonnect", providerSku: "500", costMinor: 30700, adminApproved: true, pricingSourceType: "LIVE_PROVIDER" }
    ]
  },
  {
    id: "sku_mtn_1gb_7d",
    displayName: "MTN 1GB Weekly",
    network: "MTN",
    sizeMb: 1024,
    validityDays: 7,
    minMarginBps: 200,
    mappings: [
      { providerName: "clubkonnect", providerSku: "1000", costMinor: 41000, adminApproved: true, pricingSourceType: "LIVE_PROVIDER" }
    ]
  },
  {
    id: "sku_mtn_1gb_30d",
    displayName: "MTN 1GB Monthly",
    network: "MTN",
    sizeMb: 1024,
    validityDays: 30,
    minMarginBps: 200,
    mappings: [
      { providerName: "clubkonnect", providerSku: "1000.00", costMinor: 56300, adminApproved: true, pricingSourceType: "LIVE_PROVIDER" },
    ]
  },
  {
    id: "sku_mtn_2gb_30d",
    displayName: "MTN 2GB Monthly",
    network: "MTN",
    sizeMb: 2048,
    validityDays: 30,
    minMarginBps: 200,
    mappings: [
      { providerName: "clubkonnect", providerSku: "2000.00", costMinor: 111700, adminApproved: true, pricingSourceType: "LIVE_PROVIDER" },
    ]
  },
  {
    id: "sku_mtn_3gb_30d",
    displayName: "MTN 3GB Monthly",
    network: "MTN",
    sizeMb: 3072,
    validityDays: 30,
    minMarginBps: 200,
    mappings: [
      { providerName: "clubkonnect", providerSku: "3000.00", costMinor: 162900, adminApproved: true, pricingSourceType: "LIVE_PROVIDER" }
    ]
  },
  {
    id: "sku_mtn_5gb_30d",
    displayName: "MTN 5GB Monthly",
    network: "MTN",
    sizeMb: 5120,
    validityDays: 30,
    minMarginBps: 200,
    mappings: [
      { providerName: "clubkonnect", providerSku: "5000.00", costMinor: 251100, adminApproved: true, pricingSourceType: "LIVE_PROVIDER" },
    ]
  },
  {
    id: "sku_glo_1gb_30d",
    displayName: "Glo 1GB Monthly",
    network: "GLO",
    sizeMb: 1024,
    validityDays: 30,
    minMarginBps: 200,
    mappings: [
      { providerName: "clubkonnect", providerSku: "1000", costMinor: 46100, adminApproved: true, pricingSourceType: "LIVE_PROVIDER" },
    ]
  },
  {
    id: "sku_glo_2gb_30d",
    displayName: "Glo 2GB Monthly",
    network: "GLO",
    sizeMb: 2048,
    validityDays: 30,
    minMarginBps: 200,
    mappings: [
      { providerName: "clubkonnect", providerSku: "2000", costMinor: 92200, adminApproved: true, pricingSourceType: "LIVE_PROVIDER" },
    ]
  },
  {
    id: "sku_glo_5gb_30d",
    displayName: "Glo 5GB Monthly",
    network: "GLO",
    sizeMb: 5120,
    validityDays: 30,
    minMarginBps: 200,
    mappings: [
      { providerName: "clubkonnect", providerSku: "5000", costMinor: 230600, adminApproved: true, pricingSourceType: "LIVE_PROVIDER" },
    ]
  },
  {
    id: "sku_airtel_2gb_30d",
    displayName: "Airtel 2GB Monthly",
    network: "AIRTEL",
    sizeMb: 2048,
    validityDays: 30,
    minMarginBps: 200,
    mappings: [
      { providerName: "clubkonnect", providerSku: "1499.93", costMinor: 145493, adminApproved: true, pricingSourceType: "LIVE_PROVIDER" },
    ]
  },
  {
    id: "sku_airtel_3gb_30d",
    displayName: "Airtel 3GB Monthly",
    network: "AIRTEL",
    sizeMb: 3072,
    validityDays: 30,
    minMarginBps: 200,
    mappings: [
      { providerName: "clubkonnect", providerSku: "1999.91", costMinor: 193991, adminApproved: true, pricingSourceType: "LIVE_PROVIDER" }
    ]
  },
  {
    id: "sku_9mobile_1gb_30d",
    displayName: "9mobile 1GB Monthly",
    network: "NINE_MOBILE",
    sizeMb: 1024,
    validityDays: 30,
    minMarginBps: 200,
    mappings: [
      { providerName: "clubkonnect", providerSku: "1000", costMinor: 49200, adminApproved: true, pricingSourceType: "LIVE_PROVIDER" },
    ]
  },
  {
    id: "sku_9mobile_2gb_30d",
    displayName: "9mobile 2GB Monthly",
    network: "NINE_MOBILE",
    sizeMb: 2048,
    validityDays: 30,
    minMarginBps: 200,
    mappings: [
      { providerName: "clubkonnect", providerSku: "2000", costMinor: 98400, adminApproved: true, pricingSourceType: "LIVE_PROVIDER" },
    ]
  }
];

async function seedCanonicalSkus(db: ReturnType<typeof createPrismaClient>) {
  const mappingUid = () => `vpsm_${Math.random().toString(36).slice(2, 12)}`;
  let skuCreated = 0;
  let skuSkipped = 0;
  let mappingCreated = 0;
  let mappingSkipped = 0;

  for (const sku of CANONICAL_SKUS) {
    const existing = await db.vtuCanonicalSku.findUnique({ where: { id: sku.id } });
    if (!existing) {
      await db.vtuCanonicalSku.create({
        data: {
          id: sku.id,
          displayName: sku.displayName,
          category: "DATA",
          network: sku.network,
          sizeMb: sku.sizeMb,
          validityDays: sku.validityDays,
          minMarginBps: sku.minMarginBps,
          active: true,
          adminApproved: true,
          metadata: {}
        }
      });
      skuCreated++;
    } else {
      await db.vtuCanonicalSku.update({
        where: { id: sku.id },
        data: { displayName: sku.displayName, active: true }
      });
      skuSkipped++;
    }

    for (const m of sku.mappings) {
      // The DB's real uniqueness constraint is (providerName, providerSku) -- a prior
      // findFirst({ canonicalSkuId, providerName }) check missed rows created under a
      // different canonicalSkuId with the same (providerName, providerSku) pair, so a
      // reseed could try to create() a row that collides on the actual unique index.
      // upsert() on that same compound key is what Prisma auto-names
      // providerName_providerSku for an unnamed @@unique([providerName, providerSku]).
      const result = await db.vtuProviderSkuMapping.upsert({
        where: { providerName_providerSku: { providerName: m.providerName, providerSku: m.providerSku } },
        create: {
          id: mappingUid(),
          canonicalSkuId: sku.id,
          providerName: m.providerName,
          providerSku: m.providerSku,
          costMinor: m.costMinor,
          adminApproved: m.adminApproved,
          active: true,
          pricingSourceType: m.pricingSourceType,
          lastSyncedAt: new Date(),
          metadata: {}
        },
        update: {
          canonicalSkuId: sku.id,
          costMinor: m.costMinor,
          active: true,
          lastSyncedAt: new Date()
        }
      });
      if (result.createdAt.getTime() === result.updatedAt.getTime()) {
        mappingCreated++;
      } else {
        mappingSkipped++;
      }
    }
  }

  console.log(
    `VtuCanonicalSku: ${skuCreated} created, ${skuSkipped} updated | VtuProviderSkuMapping: ${mappingCreated} created, ${mappingSkipped} updated`
  );
}

async function main() {
  const db = createPrismaClient();

  try {
    await seedRoutes(db);
    await seedBillsRoutes(db);
    await seedDataPlans(db);
    await seedCablePackages(db);
    await seedProviderConfigs(db);
    await seedCanonicalSkus(db);
  } finally {
    await db.$disconnect();
  }
}

// ─── VtuProviderConfig seed ──────────────────────────────────────────────────
// Bootstraps routing configuration for all known providers.
// Status reflects whether real API credentials are available and verified.
// Weights: costWeight 70 / successRateWeight 20 / latencyWeight 5 / balanceWeight 5.
// These can be tuned per-provider via admin UI after launch.

const PROVIDER_CONFIGS: Array<{
  providerName: string;
  displayName: string;
  status: string;
  enabledServices: string[];
  priority: number;
}> = [
  {
    providerName: "clubkonnect",
    displayName: "ClubKonnect (Nellobyte)",
    status: "ACTIVE",
    enabledServices: ["AIRTIME", "DATA", "CABLE", "ELECTRICITY", "BETTING", "EDUCATION"],
    priority: 10
  },
  {
    providerName: "topupwizard",
    displayName: "TopupWizard",
    // API docs verified (topupwizard.com/apidocs); endpoints implemented against the
    // real docs. Status: CONFIGURED — a real credential has been supplied, but no
    // live sandbox call has been made yet.
    status: "CONFIGURED",
    enabledServices: ["AIRTIME", "DATA", "CABLE", "ELECTRICITY", "EDUCATION"],
    priority: 30
  },
  {
    providerName: "inlomax",
    displayName: "Inlomax",
    // API docs verified (inlomax.com/docs); endpoints implemented.
    // Status: CONFIGURED — awaiting credential provisioning.
    status: "CONFIGURED",
    enabledServices: ["AIRTIME", "DATA", "CABLE", "ELECTRICITY", "EDUCATION"],
    priority: 40
  },
  {
    providerName: "vtugate",
    displayName: "VTUGate",
    // API docs verified (vtugate.com/docs); endpoints implemented.
    // Test API Key available from dashboard; sandbox testing pending.
    status: "CONFIGURED",
    enabledServices: ["AIRTIME", "DATA", "CABLE", "ELECTRICITY", "EDUCATION"],
    priority: 50
  },
  {
    providerName: "swiftlink",
    displayName: "Swiftlink Nigeria",
    // Full official API docs (swiftlinkng.com/api) verified and endpoints implemented
    // against them. Cheapest source for CABLE and ELECTRICITY, which is what it now
    // leads on (see BILLS_ROUTE_PRIORITY) with ClubKonnect behind it.
    //
    // Status stays DISCOVERED: VtuRouterService only selects ACTIVE/PRODUCTION_READY/
    // SANDBOX, so cable/electricity resolve through the VtuProviderRoute table instead.
    // SWIFTLINK_API_KEY is the only value that has to be supplied (or SWIFTLINK_EMAIL +
    // SWIFTLINK_PASSWORD, which log in for a token instead) — the subcategory_id every
    // purchase needs is resolved from /get/plans rather than configured.
    status: "DISCOVERED",
    enabledServices: ["AIRTIME", "DATA", "CABLE", "ELECTRICITY"],
    priority: 60
  },
  {
    providerName: "ebills",
    displayName: "eBills (ebill.com.ng)",
    // Full official API docs (ebill.com.ng) now verified and endpoints implemented against
    // them — airtime, data, electricity, cable, and WAEC/NECO/NABTEB education pins.
    // Status: CONFIGURED — a real credential has been supplied, but no live sandbox call
    // has been made yet.
    status: "CONFIGURED",
    enabledServices: ["AIRTIME", "DATA", "ELECTRICITY", "CABLE", "EDUCATION"],
    priority: 70
  },
  {
    providerName: "sirpdata",
    displayName: "SIRP Data",
    // Full official API docs (sirpdata.com.ng) verified and endpoints implemented against
    // them — airtime, data, cable, electricity, and educational PINs. Status: CONFIGURED —
    // a real credential has been supplied, but no live sandbox call has been made yet.
    status: "CONFIGURED",
    enabledServices: ["AIRTIME", "DATA", "CABLE", "ELECTRICITY", "EDUCATION"],
    priority: 75
  },
  {
    providerName: "isquaredata",
    displayName: "iSquareData",
    // Developer page has plan IDs; auth and base URL not publicly documented.
    status: "DISCOVERED",
    enabledServices: ["DATA", "EDUCATION"],
    priority: 80
  },
  {
    providerName: "iacafe",
    displayName: "IA-Café",
    // Full official API docs (iacafe.com.ng/docs) verified and endpoints implemented
    // against them — airtime, data (incl. Budget Data as extra SKUs), cable, electricity
    // (token/units/band captured), and betting (mandatory verify-then-fund). Education
    // and epins are also implemented against verified docs. Status: CONFIGURED — a real
    // credential has been supplied, but no live sandbox call has been made yet.
    //
    // ⚠️ WARNING: the supplied IACAFE_API_KEY credential is a LIVE production key, not a
    // sandbox/test key. Any real call against it moves real money. Keep this provider's
    // status at CONFIGURED (never ACTIVE/PRODUCTION_READY) until it has been deliberately
    // reviewed and test-purchased with a small real amount by someone authorized to do so.
    status: "CONFIGURED",
    enabledServices: ["AIRTIME", "DATA", "CABLE", "ELECTRICITY", "BETTING"],
    priority: 90
  }
];

async function seedProviderConfigs(db: ReturnType<typeof createPrismaClient>) {
  const uid = () => `vpconf_${Math.random().toString(36).slice(2, 12)}`;
  let created = 0;
  let updated = 0;

  for (const cfg of PROVIDER_CONFIGS) {
    const existing = await db.vtuProviderConfig.findUnique({
      where: { providerName: cfg.providerName }
    });

    if (existing) {
      await db.vtuProviderConfig.update({
        where: { providerName: cfg.providerName },
        data: {
          displayName: cfg.displayName,
          enabledServices: cfg.enabledServices,
          priority: cfg.priority
          // status is NOT overwritten — admin controls it after initial seed
        }
      });
      updated++;
    } else {
      await db.vtuProviderConfig.create({
        data: {
          id: uid(),
          providerName: cfg.providerName,
          displayName: cfg.displayName,
          status: cfg.status as never,
          enabledServices: cfg.enabledServices,
          priority: cfg.priority,
          costWeight: 70,
          successRateWeight: 20,
          latencyWeight: 5,
          balanceWeight: 5,
          minBalanceMinor: 0,
          maxTransactionMinor: 50000000,
          trafficAllocationPct: 100,
          maintenanceMode: false
        }
      });
      created++;
    }
  }

  console.log(`VtuProviderConfig: ${created} created, ${updated} updated`);
}

main().catch((error: unknown) => {
  console.error("VTU seed failed:", error);
  process.exit(1);
});
