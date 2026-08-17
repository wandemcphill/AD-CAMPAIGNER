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
  // Scopes the row to what the provider can actually issue. The router only
  // applies its productType filter when this is non-empty (see selectProviders
  // — an empty array means "no restriction"), so leaving it blank made every
  // card provider a candidate for every currency: a USD request could resolve
  // to NGN-only Sudo, and Payscribe/Maplerad were unreachable for USD because
  // the caller's scope was hardcoded to NGN_CARD.
  enabledProductTypes: string[];
  metadata: Record<string, unknown>;
}

const SEEDS: ProviderConfigSeed[] = [
  {
    // The ONLY money/virtual-account provider that has fully verified FlipTrybe,
    // alongside Korapay for collections. Swappr and Inflow below are implemented
    // and mapped but not verified, so they sit behind it as future options
    // rather than live candidates.
    //
    // Payscribe NGN virtual accounts are collection-only: funds settle to the
    // business NGN collection balance, so getAccount reports a 0 balance by
    // design. Supported banks are 9psb, palmpay and cashconnect; palmpay
    // additionally needs bvn/identity for a tier-0 customer.
    name: "payscribe-virtual-account",
    domain: "VIRTUAL_ACCOUNT",
    priority: 10,
    enabledCountries: ["NG"],
    enabledProductTypes: ["NGN_ACCOUNT"],
    metadata: {
      providerKey: "payscribe",
      role: "primary",
      note: "Verified provider. Requires a tier-1 Payscribe customer (ProviderCustomer)."
    }
  },
  {
    name: "swappr-virtual-account",
    // Demoted behind Payscribe: implemented but not a verified money provider.
    domain: "VIRTUAL_ACCOUNT",
    priority: 20,
    enabledCountries: ["NG"],
    enabledProductTypes: ["NGN_ACCOUNT"],
    metadata: { providerKey: "swappr", note: "Not verified; no live credentials — SWAPPR_API_KEY unset." }
  },
  {
    name: "swappr-remittance",
    domain: "REMITTANCE",
    priority: 10,
    enabledCountries: ["NG", "US", "GB"],
    enabledProductTypes: ["BANK_TRANSFER"],
    metadata: {
      providerKey: "swappr",
      role: "primary",
      note: "No live credentials yet — SWAPPR_API_KEY unset."
    }
  },
  {
    name: "sudo-virtual-card",
    domain: "VIRTUAL_CARD",
    // Priorities are only meaningful WITHIN a product type. Sudo is the sole
    // NGN issuer, so its 10 never competes with the USD rows below.
    priority: 10,
    enabledCountries: ["NG"],
    // NGN only — Sudo issues NGN Verve cards and nothing else.
    enabledProductTypes: ["NGN_CARD"],
    metadata: {
      providerKey: "sudo",
      role: "primary",
      note:
        "Sandbox-verified NGN card issuance; no production credentials yet — SUDO_API_KEY unset. " +
        "fundCard also needs SUDO_FUNDING_ACCOUNT_ID. terminateCard is not live-verified and throws."
    }
  },
  {
    name: "payscribe-virtual-card",
    domain: "VIRTUAL_CARD",
    // Leads USD. The earlier ordering put Payscribe last on the grounds that it
    // was never sandbox-verified while Maplerad was — but that comparison was
    // being made across currencies it could never actually serve. Within
    // USD_CARD the deciding fact is that Payscribe is the issuer FlipTrybe has
    // been granted access to; Maplerad's verification came from a sprint with
    // no ongoing account. Access beats a stale sandbox result. Both stay
    // DISABLED and ungranted regardless, so this only decides ordering once an
    // operator turns one on.
    priority: 10,
    enabledCountries: ["NG"],
    // USD only — Payscribe does not issue NGN cards.
    enabledProductTypes: ["USD_CARD"],
    metadata: {
      providerKey: "payscribe",
      role: "primary",
      note:
        "USD cards only; requires a tier-2 ProviderCustomer before issuance. " +
        "No live credentials yet — PAYSCRIBE_API_KEY unset."
    }
  },
  {
    name: "maplerad-virtual-card",
    domain: "VIRTUAL_CARD",
    priority: 15,
    enabledCountries: ["NG"],
    enabledProductTypes: ["USD_CARD"],
    metadata: {
      providerKey: "maplerad",
      role: "fallback",
      note: "Sandbox-verified issuance; no production credentials yet — MAPLERAD_API_KEY unset."
    }
  },
  {
    name: "inflow-virtual-account",
    domain: "VIRTUAL_ACCOUNT",
    // Behind Payscribe (10) and Swappr (20): implemented, not verified.
    priority: 30,
    enabledCountries: ["NG"],
    enabledProductTypes: ["NGN_ACCOUNT"],
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
    enabledProductTypes: ["BANK_TRANSFER"],
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
    enabledProductTypes: ["BANK_TRANSFER"],
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
  let repriced = 0;

  for (const seed of SEEDS) {
    const existing = await db.providerConfig.findUnique({ where: { name: seed.name } });
    if (existing) {
      // Re-assert routing fields on an existing row, the way seed-vtu.ts does.
      //
      // Skipping outright meant a change here only ever reached a fresh
      // database: demoting payscribe-virtual-card was a no-op on every
      // environment that already had the row, so it stayed tied with
      // sudo-virtual-card at 10 and could still win selection.
      //
      // enabledProductTypes matters even more than priority. Every existing row
      // was created with [], which the router reads as "no restriction" — so
      // until it is backfilled, currency scoping silently does nothing and an
      // NGN-only issuer remains a candidate for a USD card.
      //
      // status and enabledCountries are deliberately left alone — an operator
      // may have enabled a provider or narrowed its countries after seeding, and
      // a re-run must not silently revert that.
      const productTypesDiffer =
        existing.enabledProductTypes.length !== seed.enabledProductTypes.length ||
        seed.enabledProductTypes.some((t) => !existing.enabledProductTypes.includes(t));

      if (existing.priority !== seed.priority || productTypesDiffer) {
        await db.providerConfig.update({
          where: { name: seed.name },
          data: { priority: seed.priority, enabledProductTypes: seed.enabledProductTypes }
        });
        repriced++;
      }
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
        enabledProductTypes: seed.enabledProductTypes,
        metadata: seed.metadata as Prisma.InputJsonValue
      }
    });
    created++;
  }

  console.log(
    `ProviderConfig (financial-products): ${created} created, ${skipped} already existed` +
      `, ${repriced} rescoped`
  );
  await db.$disconnect();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
