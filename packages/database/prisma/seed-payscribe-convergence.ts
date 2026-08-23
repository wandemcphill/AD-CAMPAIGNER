import { createPrismaClient } from "../src/index";

// This is an additive convergence seed. It does not delete historical provider
// records; it makes Maplerad ineligible for financial-product routing while
// preserving the audit trail, and explicitly records Payscribe as the intended
// USD-card / NGN-account provider.
async function main() {
  const db = createPrismaClient();

  await db.providerConfig.updateMany({
    where: {
      name: {
        in: ["maplerad-virtual-card", "maplerad-virtual-account", "maplerad-remittance"]
      }
    },
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
    where: { providerName: "maplerad" },
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
