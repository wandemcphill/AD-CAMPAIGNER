import { createPrismaClient } from "../src/index";

// Seeds VtuProviderRoute (routing priority table) and VtuDataPlan (data plan catalog)
// for the two live-wired adapters: vtpass (primary, sandbox-capable) and clubkonnect
// (secondary, no sandbox). Real plan codes/prices must be refreshed by the
// plan_catalog_sync worker job once it exists — these are representative NGN market
// rates so the /os/airtime and /os/data pages have something real to render against.

const NETWORKS = ["MTN", "GLO", "AIRTEL", "NINE_MOBILE"] as const;
const PRODUCT_TYPES = ["AIRTIME", "DATA"] as const;

const ROUTE_PRIORITY = {
  vtpass: 10,
  clubkonnect: 20
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

// ClubKonnect plan IDs are opaque numeric codes assigned by their panel; placeholders
// here follow their documented numbering convention and must be reconciled against a
// live /api/v1/data/plans pull before this provider handles real traffic.
const CLUBKONNECT_PLANS: DataPlanSeed[] = [
  { providerPlanId: "501", network: "MTN", planType: "SME", displayName: "MTN 1GB SME (30 days)", sizeMb: 1024, validityDays: 30, costMinor: 23500 },
  { providerPlanId: "502", network: "MTN", planType: "SME", displayName: "MTN 2GB SME (30 days)", sizeMb: 2048, validityDays: 30, costMinor: 46500 },
  { providerPlanId: "503", network: "MTN", planType: "GIFTING", displayName: "MTN 500MB Gifting (30 days)", sizeMb: 500, validityDays: 30, costMinor: 13500 },
  { providerPlanId: "601", network: "GLO", planType: "SME", displayName: "Glo 1GB (30 days)", sizeMb: 1024, validityDays: 30, costMinor: 27500 },
  { providerPlanId: "602", network: "GLO", planType: "SME", displayName: "Glo 3GB (30 days)", sizeMb: 3072, validityDays: 30, costMinor: 70000 },
  { providerPlanId: "701", network: "AIRTEL", planType: "CG", displayName: "Airtel 1GB CG (30 days)", sizeMb: 1024, validityDays: 30, costMinor: 30500 },
  { providerPlanId: "702", network: "AIRTEL", planType: "CG", displayName: "Airtel 2GB CG (30 days)", sizeMb: 2048, validityDays: 30, costMinor: 56000 },
  { providerPlanId: "801", network: "NINE_MOBILE", planType: "SME", displayName: "9mobile 1GB SME (30 days)", sizeMb: 1024, validityDays: 30, costMinor: 25500 },
  { providerPlanId: "802", network: "NINE_MOBILE", planType: "SME", displayName: "9mobile 1.5GB SME (30 days)", sizeMb: 1536, validityDays: 30, costMinor: 36500 }
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
            note: `Seeded ${priority === ROUTE_PRIORITY.vtpass ? "primary" : "secondary"} route`
          }
        });
        created++;
      }
    }
  }

  console.log(`VtuProviderRoute: ${created} created, ${skipped} already existed`);
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

async function main() {
  const db = createPrismaClient();

  try {
    await seedRoutes(db);
    await seedDataPlans(db);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error("VTU seed failed:", error);
  process.exit(1);
});
