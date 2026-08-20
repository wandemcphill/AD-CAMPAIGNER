import { createGsubzAdapter, createTopupWizardAdapter } from "@fliptrybe/providers";

import { createPrismaClient } from "../src/index";

const ALLOWED_PROVIDER_CONFIGS = [
  {
    providerName: "clubkonnect",
    displayName: "ClubKonnect (Nellobyte)",
    status: "ACTIVE",
    enabledServices: ["AIRTIME", "CABLE", "ELECTRICITY", "BETTING"],
    priority: 10
  },
  {
    providerName: "gsubz",
    displayName: "GSUBZ",
    status: "ACTIVE",
    enabledServices: ["DATA"],
    priority: 15
  },
  {
    providerName: "topupwizard",
    displayName: "TopupWizard",
    status: "CONFIGURED",
    enabledServices: ["EDUCATION"],
    priority: 20
  },
  {
    providerName: "sirpdata",
    displayName: "SIRP Data",
    status: "CONFIGURED",
    enabledServices: ["EDUCATION"],
    priority: 30
  }
] as const;

const EDUCATION_ROUTE_PRIORITY = {
  topupwizard: 10,
  sirpdata: 20
} as const;

const CLUBKONNECT_CABLE_PACKAGES = [
  { cableProvider: "dstv", packageCode: "dstv-padi", displayName: "DStv Padi", costMinor: 440000 },
  { cableProvider: "dstv", packageCode: "dstv-yanga", displayName: "DStv Yanga", costMinor: 600000 },
  { cableProvider: "dstv", packageCode: "dstv-confam", displayName: "DStv Confam", costMinor: 1100000 },
  { cableProvider: "dstv", packageCode: "dstv79", displayName: "DStv Compact", costMinor: 1900000 },
  { cableProvider: "dstv", packageCode: "dstv7", displayName: "DStv Compact Plus", costMinor: 3000000 },
  { cableProvider: "dstv", packageCode: "dstv3", displayName: "DStv Premium", costMinor: 4450000 },
  { cableProvider: "dstv", packageCode: "dstv10", displayName: "DStv Premium-Asia", costMinor: 5050000 },
  { cableProvider: "dstv", packageCode: "dstv9", displayName: "DStv Premium-French", costMinor: 6900000 }
] as const;

const BETTING_COMPANIES = [
  { code: "product-nairabet", name: "NairaBet" },
  { code: "product-bang-bet", name: "BangBet" },
  { code: "product-bet-way", name: "BetWay" },
  { code: "product-bet-land", name: "BetLand" },
  { code: "product-bet-king", name: "BetKing" },
  { code: "product-1x-bet", name: "1xBet" },
  { code: "product-naija-bet", name: "NaijaBet" },
  { code: "prd-sporty-bet", name: "Sporty Bet" },
  { code: "product-merry-bet", name: "MerryBet" }
] as const;

async function purgeLegacyVtuState(db: ReturnType<typeof createPrismaClient>) {
  await db.vtuProviderRoute.deleteMany({
    where: {
      OR: [
        { productType: "DATA" },
        { provider: { notIn: ["clubkonnect", "gsubz", "topupwizard", "sirpdata"] } },
        {
          AND: [{ productType: "EDUCATION" }, { provider: "clubkonnect" }]
        }
      ]
    }
  });

  await db.vtuDataPlan.deleteMany({});
  await db.vtuCanonicalSku.deleteMany({});
  await db.vtuProviderSkuMapping.deleteMany({});
  await db.vtuCablePackage.deleteMany({ where: { providerName: { not: "clubkonnect" } } });
  await db.vtuBettingCompany.deleteMany({ where: { providerName: { not: "clubkonnect" } } });
  await db.vtuEducationPlan.deleteMany({
    where: { providerName: { notIn: ["topupwizard", "sirpdata"] } }
  });
  await db.vtuProviderConfig.deleteMany({
    where: { providerName: { notIn: ["clubkonnect", "gsubz", "topupwizard", "sirpdata"] } }
  });
}

async function seedRoutes(db: ReturnType<typeof createPrismaClient>) {
  let created = 0;
  let updated = 0;

  for (const network of ["MTN", "GLO", "AIRTEL", "NINE_MOBILE"] as const) {
    const existing = await db.vtuProviderRoute.findFirst({
      where: { productType: "AIRTIME", network, provider: "clubkonnect" }
    });
    if (existing) {
      if (existing.priority !== 10) {
        await db.vtuProviderRoute.update({ where: { id: existing.id }, data: { priority: 10, active: true } });
        updated++;
      }
    } else {
      await db.vtuProviderRoute.create({
        data: {
          productType: "AIRTIME",
          network,
          provider: "clubkonnect",
          priority: 10,
          active: true,
          note: "Default airtime route"
        }
      });
      created++;
    }
  }

  for (const network of ["MTN", "GLO", "AIRTEL", "NINE_MOBILE"] as const) {
    const existing = await db.vtuProviderRoute.findFirst({
      where: { productType: "DATA", network, provider: "gsubz" }
    });
    if (existing) {
      if (existing.priority !== 10) {
        await db.vtuProviderRoute.update({ where: { id: existing.id }, data: { priority: 10, active: true } });
        updated++;
      }
    } else {
      await db.vtuProviderRoute.create({
        data: {
          productType: "DATA",
          network,
          provider: "gsubz",
          priority: 10,
          active: true,
          note: "Default data route"
        }
      });
      created++;
    }
  }

  for (const productType of ["CABLE", "ELECTRICITY", "BETTING"] as const) {
    const existing = await db.vtuProviderRoute.findFirst({
      where: { productType, network: null, provider: "clubkonnect" }
    });
    if (existing) {
      if (existing.priority !== 10) {
        await db.vtuProviderRoute.update({ where: { id: existing.id }, data: { priority: 10, active: true } });
        updated++;
      }
    } else {
      await db.vtuProviderRoute.create({
        data: {
          productType,
          network: null,
          provider: "clubkonnect",
          priority: 10,
          active: true,
          note: `Default ${productType.toLowerCase()} route`
        }
      });
      created++;
    }
  }

  for (const [provider, priority] of Object.entries(EDUCATION_ROUTE_PRIORITY)) {
    const existing = await db.vtuProviderRoute.findFirst({
      where: { productType: "EDUCATION", network: null, provider }
    });
    if (existing) {
      if (existing.priority !== priority) {
        await db.vtuProviderRoute.update({ where: { id: existing.id }, data: { priority, active: true } });
        updated++;
      }
    } else {
      await db.vtuProviderRoute.create({
        data: {
          productType: "EDUCATION",
          network: null,
          provider,
          priority,
          active: true,
          note: `Default education route (${provider})`
        }
      });
      created++;
    }
  }

  console.log(`VtuProviderRoute: ${created} created, ${updated} updated`);
}

async function seedCablePackages(db: ReturnType<typeof createPrismaClient>) {
  for (const pkg of CLUBKONNECT_CABLE_PACKAGES) {
    await db.vtuCablePackage.upsert({
      where: {
        providerName_packageCode: { providerName: "clubkonnect", packageCode: pkg.packageCode }
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
  console.log(`VtuCablePackage: ${CLUBKONNECT_CABLE_PACKAGES.length} rows upserted`);
}

async function seedBettingCompanies(db: ReturnType<typeof createPrismaClient>) {
  for (const company of BETTING_COMPANIES) {
    await db.vtuBettingCompany.upsert({
      where: {
        providerName_productCode: { providerName: "clubkonnect", productCode: company.code }
      },
      create: {
        id: `vbet_${Math.random().toString(36).slice(2, 12)}`,
        providerName: "clubkonnect",
        productCode: company.code,
        displayName: company.name,
        active: true
      },
      update: { displayName: company.name, active: true }
    });
  }
  console.log(`VtuBettingCompany: ${BETTING_COMPANIES.length} rows upserted`);
}

async function seedProviderConfigs(db: ReturnType<typeof createPrismaClient>) {
  for (const cfg of ALLOWED_PROVIDER_CONFIGS) {
    const existing = await db.vtuProviderConfig.findUnique({
      where: { providerName: cfg.providerName }
    });

    if (existing) {
      await db.vtuProviderConfig.update({
        where: { providerName: cfg.providerName },
        data: {
          displayName: cfg.displayName,
          enabledServices: [...cfg.enabledServices],
          priority: cfg.priority
        }
      });
    } else {
      await db.vtuProviderConfig.create({
        data: {
          id: `vpconf_${Math.random().toString(36).slice(2, 12)}`,
          providerName: cfg.providerName,
          displayName: cfg.displayName,
          status: cfg.status as never,
          enabledServices: [...cfg.enabledServices],
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
    }
  }

  console.log(`VtuProviderConfig: ${ALLOWED_PROVIDER_CONFIGS.length} rows ensured`);
}

async function seedGsubzDataPlans(db: ReturnType<typeof createPrismaClient>) {
  const apiKey = process.env.GSUBZ_API_KEY?.trim();
  if (!apiKey) {
    console.log("VtuDataPlan: skipped GSUBZ sync (missing GSUBZ_API_KEY)");
    return;
  }

  const adapter = createGsubzAdapter({
    apiKey,
    ...(process.env.GSUBZ_BASE_URL ? { baseUrl: process.env.GSUBZ_BASE_URL } : {})
  });

  const offers = await adapter.listDataPlans();
  for (const plan of offers) {
    await db.vtuDataPlan.upsert({
      where: {
        providerName_providerPlanId: {
          providerName: "gsubz",
          providerPlanId: plan.providerPlanId
        }
      },
      create: {
        id: `vdata_${Math.random().toString(36).slice(2, 12)}`,
        providerName: "gsubz",
        providerPlanId: plan.providerPlanId,
        network: plan.network,
        planType: plan.planType,
        displayName: plan.displayName,
        sizeMb: plan.sizeMb,
        validityDays: plan.validityDays,
        costMinor: plan.costMinor,
        currency: plan.currency,
        active: true
      },
      update: {
        network: plan.network,
        planType: plan.planType,
        displayName: plan.displayName,
        sizeMb: plan.sizeMb,
        validityDays: plan.validityDays,
        costMinor: plan.costMinor,
        currency: plan.currency,
        active: true,
        lastSyncedAt: new Date()
      }
    });
  }

  console.log(`VtuDataPlan: ${offers.length} gsubz rows upserted`);
}

async function seedTopupWizardEducation(db: ReturnType<typeof createPrismaClient>) {
  const apiKey = process.env.TOPUPWIZARD_API_KEY?.trim();
  if (!apiKey) {
    console.log("VtuEducationPlan: skipped topupwizard sync (missing TOPUPWIZARD_API_KEY)");
    return;
  }

  const adapter = createTopupWizardAdapter({
    apiKey,
    ...(process.env.TOPUPWIZARD_BASE_URL ? { baseUrl: process.env.TOPUPWIZARD_BASE_URL } : {})
  });

  if (!adapter.listEducationPlans) {
    console.log("VtuEducationPlan: skipped topupwizard sync (adapter has no education catalog)");
    return;
  }

  const offers = await adapter.listEducationPlans();
  for (const plan of offers) {
    await db.vtuEducationPlan.upsert({
      where: {
        providerName_productCode: {
          providerName: "topupwizard",
          productCode: plan.productCode
        }
      },
      create: {
        id: `vedu_${Math.random().toString(36).slice(2, 12)}`,
        providerName: "topupwizard",
        productCode: plan.productCode,
        displayName: plan.displayName,
        costMinor: plan.costMinor,
        currency: plan.currency,
        active: true,
        pricingSource: "SYNC"
      },
      update: {
        displayName: plan.displayName,
        costMinor: plan.costMinor,
        currency: plan.currency,
        active: true,
        pricingSource: "SYNC",
        lastSyncedAt: new Date()
      }
    });
  }

  console.log(`VtuEducationPlan: ${offers.length} topupwizard rows upserted`);
}

async function main() {
  const db = createPrismaClient();

  try {
    await purgeLegacyVtuState(db);
    await seedRoutes(db);
    await seedCablePackages(db);
    await seedBettingCompanies(db);
    await seedProviderConfigs(db);
    await seedGsubzDataPlans(db);
    await seedTopupWizardEducation(db);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error("VTU seed failed:", error);
  process.exit(1);
});
