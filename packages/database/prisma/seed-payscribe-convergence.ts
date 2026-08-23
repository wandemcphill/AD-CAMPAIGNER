import { createPrismaClient } from "../src/index";

// Additive convergence seed. Historical provider rows remain for audit, but
// retired Maplerad records are made impossible to route.
async function main() {
  const db = createPrismaClient();

  const retiredNames = [
    "maplerad-virtual-card",
    "maplerad-virtual-account",
    "maplerad-remittance"
  ];

  await db.providerConfig.updateMany({
    where: { name: { in: retiredNames } },
    data: {
      status: "DISABLED",
      priority: 9999,
      enabledProductTypes: [],
      metadata: {
        routed: false,
        role: "retired",
        replacement: "payscribe",
        reason: "Financial-product routing converged on Payscribe; retained for historical audit only."
      }
    }
  });

  await db.providerCapabilityGrant.updateMany({
    where: { providerName: { in: retiredNames } },
    data: {
      enabled: false,
      productionApproved: false,
      notes: "Retired from FlipTrybe financial-product routing; retained for historical audit only."
    }
  });

  console.log("Financial provider routing converged: Payscribe primary, Maplerad retired.");
  await db.$disconnect();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
