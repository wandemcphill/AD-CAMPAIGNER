import { createPrismaClient, type Prisma } from "../src/index";

// Seeds ProviderConfig rows for the financial-products vertical (virtual
// accounts, virtual cards, remittance). No live credentials exist for any of
// these providers in this environment — every row is seeded with
// status: "DISABLED" so the admin UI shows them as "configured but disabled"
// rather than absent, and ProviderRouterService.select() correctly returns no
// candidate until an operator flips status to ENABLED after real credentials
// are wired up (see packages/providers/src/financial-products.ts for the
// adapter implementations and their unverified-endpoint-shape caveats).
//
// name must be globally unique (ProviderConfig.name @@unique), and a
// ProviderConfig row is scoped to a single domain, so Swappr — which serves
// both VIRTUAL_ACCOUNT and REMITTANCE — gets two distinct rows.

interface ProviderConfigSeed {
  name: string;
  domain: "VIRTUAL_ACCOUNT" | "VIRTUAL_CARD" | "REMITTANCE";
  priority: number;
  enabledCountries: string[];
  metadata: Record<string, unknown>;
}

const SEEDS: ProviderConfigSeed[] = [
  {
    name: "swappr-virtual-account",
    domain: "VIRTUAL_ACCOUNT",
    priority: 10,
    enabledCountries: ["NG"],
    metadata: { providerKey: "swappr", note: "No live credentials yet — SWAPPR_API_KEY unset." }
  },
  {
    name: "swappr-remittance",
    domain: "REMITTANCE",
    priority: 10,
    enabledCountries: ["NG", "US", "GB"],
    metadata: {
      providerKey: "swappr",
      role: "primary",
      note: "No live credentials yet — SWAPPR_API_KEY unset."
    }
  },
  {
    name: "sudo-virtual-card",
    domain: "VIRTUAL_CARD",
    // Ahead of Payscribe: Sudo is live sandbox-verified for NGN Verve issuance,
    // freeze/unfreeze and top-up (see the adapter header in
    // packages/providers/src/financial-products.ts). Payscribe is documented but
    // never sandbox-verified, so it should not be the first card issuer tried.
    priority: 10,
    enabledCountries: ["NG"],
    metadata: {
      providerKey: "sudo",
      role: "primary",
      note:
        "Sandbox-verified NGN card issuance; no production credentials yet — SUDO_API_KEY unset. " +
        "fundCard also needs SUDO_FUNDING_ACCOUNT_ID. terminateCard is not live-verified and throws."
    }
  },
  {
    name: "maplerad-virtual-card",
    domain: "VIRTUAL_CARD",
    priority: 15,
    enabledCountries: ["NG"],
    metadata: {
      providerKey: "maplerad",
      role: "fallback",
      note: "Sandbox-verified issuance; no production credentials yet — MAPLERAD_API_KEY unset."
    }
  },
  {
    name: "payscribe-virtual-card",
    domain: "VIRTUAL_CARD",
    // Demoted behind the two sandbox-verified issuers above.
    priority: 20,
    enabledCountries: ["NG"],
    metadata: { providerKey: "payscribe", note: "No live credentials yet — PAYSCRIBE_API_KEY unset." }
  },
  {
    name: "inflow-virtual-account",
    domain: "VIRTUAL_ACCOUNT",
    priority: 20,
    enabledCountries: ["NG"],
    metadata: {
      providerKey: "inflow",
      role: "fallback",
      note: "No live credentials yet — INFLOW_API_KEY unset. baseUrl defaults to production."
    }
  },
  {
    name: "yativo-remittance",
    domain: "REMITTANCE",
    // Higher number = lower priority (see selectProviders' score formula:
    // score = (1000 - priority) × healthWeight). Yativo is the fallback,
    // behind swappr-remittance's priority 10.
    priority: 20,
    enabledCountries: ["NG", "US"],
    metadata: {
      providerKey: "yativo",
      role: "fallback",
      note: "No live credentials yet — YATIVO_API_KEY unset."
    }
  },
  {
    name: "fincra-remittance",
    domain: "REMITTANCE",
    // Live sandbox-verified NGN payouts (2026-08-10) — see docs/providers/fincra.md.
    // Still DISABLED like every other row here until FINCRA_API_KEY/
    // FINCRA_BUSINESS_ID are production credentials and the enabled
    // ProviderCapabilityGrant is flipped on (see seed-provider-capability-grants.ts).
    priority: 15,
    enabledCountries: ["NG"],
    metadata: {
      providerKey: "fincra",
      role: "candidate",
      note: "Sandbox-verified NGN payouts; no production credentials yet — FINCRA_API_KEY unset."
    }
  }
];

async function main() {
  const db = createPrismaClient();
  let created = 0;
  let skipped = 0;

  for (const seed of SEEDS) {
    const existing = await db.providerConfig.findUnique({ where: { name: seed.name } });
    if (existing) {
      skipped++;
      continue;
    }

    await db.providerConfig.create({
      data: {
        name: seed.name,
        domain: seed.domain,
        tier: "BUDGET",
        status: "DISABLED",
        priority: seed.priority,
        enabledCountries: seed.enabledCountries,
        enabledNetworks: [],
        enabledProductTypes: [],
        metadata: seed.metadata as Prisma.InputJsonValue
      }
    });
    created++;
  }

  console.log(`ProviderConfig (financial-products): ${created} created, ${skipped} already existed`);
  await db.$disconnect();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
