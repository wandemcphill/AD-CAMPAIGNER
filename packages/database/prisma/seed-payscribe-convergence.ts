import { createPrismaClient } from "../src/index";

// Additive convergence seed. Historical provider rows remain for audit, but
// retired Maplerad records are made impossible to route, and Payscribe's
// USD virtual card grant is approved to replace it.
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

  // Payscribe USD virtual card: approved by workspace operator (2026-08-23),
  // the same decision that prompted Maplerad's retirement above -- Payscribe
  // is the USD card issuer FlipTrybe currently has access to. The full grant
  // ladder is flipped on operator instruction, not on an independently
  // re-run sandbox/KYB/compliance check by this script: sandboxVerified,
  // kybApproved, and complianceApproved record the operator's attestation
  // that those steps are done, not a new verification performed here. See
  // packages/providers/src/financial-products.ts for the adapter's own
  // documented, still-open gaps (exact card `expiry` string format, full
  // card-create response shape, terminate refund semantics) that this
  // approval does not resolve -- they remain real integration risk to watch
  // for once live traffic starts, not something a status flag fixes.
  await db.providerCapabilityGrant.update({
    where: {
      providerName_capability: {
        providerName: "payscribe-virtual-card",
        capability: "VIRTUAL_CARD"
      }
    },
    data: {
      sandboxVerified: true,
      kybApproved: true,
      complianceApproved: true,
      productionApproved: true,
      enabled: true,
      notes:
        "Approved by workspace operator (2026-08-23) as the sole USD card issuer, " +
        "replacing Maplerad. Ladder flipped on operator attestation -- see the note " +
        "on this update in seed-payscribe-convergence.ts for what that does and does " +
        "not verify."
    }
  });

  await db.providerConfig.updateMany({
    where: { name: "payscribe-virtual-card" },
    data: {
      metadata: {
        providerKey: "payscribe",
        role: "primary",
        note: "USD cards only; requires a tier-2 ProviderCustomer before issuance. Approved by workspace operator (2026-08-23)."
      }
    }
  });

  console.log(
    "Financial provider routing converged: Payscribe primary and approved for live " +
      "USD card traffic, Maplerad retired."
  );
  await db.$disconnect();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
