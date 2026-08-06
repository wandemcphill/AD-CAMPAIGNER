import { createPrismaClient } from "../src/index";

// Seeds VtuProviderRoute (routing priority table) and VtuDataPlan (data plan catalog)
// for the two live-wired adapters. ClubKonnect (Nellobyte) is primary — it's the funded,
// production account; VTpass is configured as fallback. ClubKonnect plan IDs/prices below
// are verified against the live account as of 2026-08-05 (see vtu.service.ts
// DEFAULT_DATA_PLANS for the same verified set used as the runtime bootstrap catalog);
// VTpass entries remain representative until that account is funded and pulled live.

const NETWORKS = ["MTN", "GLO", "AIRTEL", "NINE_MOBILE"] as const;
const PRODUCT_TYPES = ["AIRTIME", "DATA"] as const;
const BILLS_PRODUCT_TYPES = ["ELECTRICITY", "CABLE"] as const;
// Betting/education support on VTpass is not verified — ClubKonnect only for now.
const CLUBKONNECT_ONLY_BILLS_PRODUCT_TYPES = ["BETTING", "EDUCATION"] as const;

const ROUTE_PRIORITY = {
  clubkonnect: 10,
  vtpass: 20
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

// VTpass variation codes follow the documented `<network>-<size>-<validity>` pattern.
// Representative rates — VTpass is the fallback provider, reconcile against a live pull
// once that account is funded.
const VTPASS_PLANS: DataPlanSeed[] = [
  { providerPlanId: "mtn-10mb-100", network: "MTN", planType: "SME", displayName: "MTN 100MB (1 day)", sizeMb: 100, validityDays: 1, costMinor: 10000 },
  { providerPlanId: "mtn-1gb-500", network: "MTN", planType: "SME", displayName: "MTN 1GB SME (30 days)", sizeMb: 1024, validityDays: 30, costMinor: 22800 },
  { providerPlanId: "mtn-2gb-1000", network: "MTN", planType: "SME", displayName: "MTN 2GB SME (30 days)", sizeMb: 2048, validityDays: 30, costMinor: 45600 },
  { providerPlanId: "mtn-5gb-2500", network: "MTN", planType: "SME", displayName: "MTN 5GB SME (30 days)", sizeMb: 5120, validityDays: 30, costMinor: 114000 },
  { providerPlanId: "glo-1gb-350", network: "GLO", planType: "SME", displayName: "Glo 1GB (30 days)", sizeMb: 1024, validityDays: 30, costMinor: 27000 },
  { providerPlanId: "glo-2gb-700", network: "GLO", planType: "SME", displayName: "Glo 2GB (30 days)", sizeMb: 2048, validityDays: 30, costMinor: 47500 },
  { providerPlanId: "glo-5gb-1500", network: "GLO", planType: "SME", displayName: "Glo 5GB (30 days)", sizeMb: 5120, validityDays: 30, costMinor: 115000 },
  { providerPlanId: "airtel-1gb-300", network: "AIRTEL", planType: "CG", displayName: "Airtel 1GB CG (30 days)", sizeMb: 1024, validityDays: 30, costMinor: 30000 },
  { providerPlanId: "airtel-2gb-600", network: "AIRTEL", planType: "CG", displayName: "Airtel 2GB CG (30 days)", sizeMb: 2048, validityDays: 30, costMinor: 55000 },
  { providerPlanId: "etisalat-1gb-300", network: "NINE_MOBILE", planType: "SME", displayName: "9mobile 1GB SME (30 days)", sizeMb: 1024, validityDays: 30, costMinor: 25000 },
  { providerPlanId: "etisalat-2gb-600", network: "NINE_MOBILE", planType: "SME", displayName: "9mobile 2GB SME (30 days)", sizeMb: 2048, validityDays: 30, costMinor: 48000 }
];

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
    for (const network of NETWORKS) {
      for (const [provider, priority] of Object.entries(ROUTE_PRIORITY)) {
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
            note: `Seeded ${priority === ROUTE_PRIORITY.clubkonnect ? "primary" : "secondary"} route`
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
    for (const [provider, priority] of Object.entries(ROUTE_PRIORITY)) {
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
          note: `Seeded ${priority === ROUTE_PRIORITY.clubkonnect ? "primary" : "secondary"} bills route`
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

  console.log(`VtuProviderRoute (bills): ${created} created, ${skipped} already existed`);
}

async function seedDataPlans(db: ReturnType<typeof createPrismaClient>) {
  const rows: Array<{ providerName: string; plan: DataPlanSeed }> = [
    ...VTPASS_PLANS.map((plan) => ({ providerName: "vtpass", plan })),
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

  console.log(`VtuDataPlan: ${rows.length} rows upserted (vtpass: ${VTPASS_PLANS.length}, clubkonnect: ${CLUBKONNECT_PLANS.length})`);
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

async function main() {
  const db = createPrismaClient();

  try {
    await seedRoutes(db);
    await seedBillsRoutes(db);
    await seedDataPlans(db);
    await seedCablePackages(db);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error("VTU seed failed:", error);
  process.exit(1);
});
