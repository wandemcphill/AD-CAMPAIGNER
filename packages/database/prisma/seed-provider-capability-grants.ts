import { createPrismaClient } from "../src/index";

// Seeds ProviderCapabilityGrant rows so ProviderRouterService.select()'s hard
// capability gate (see apps/api/src/modules/providers/provider-router.service.ts)
// has something to consult for every ProviderConfig row that already exists —
// without this, a provider present in ProviderConfig but absent here can never
// be selected, regardless of its ProviderConfig.status.
//
// Every row is seeded with enabled: false, mirroring the ProviderConfig rows
// they correspond to (all currently DISABLED — see seed-financial-products.ts).
// This is intentionally conservative: the grant ladder (documented ->
// implemented -> sandboxVerified -> kybApproved -> complianceApproved ->
// productionApproved -> enabled) must be earned by an operator explicitly
// flipping each flag, never defaulted true by a seed script.

interface CapabilityGrantSeed {
  providerName: string; // must match ProviderConfig.name exactly — that's the join key select() uses
  capability:
    | "NGN_VIRTUAL_ACCOUNT"
    | "USD_VIRTUAL_ACCOUNT"
    | "NGN_COLLECTION"
    | "INTERNATIONAL_COLLECTION"
    | "VIRTUAL_CARD"
    | "REMITTANCE";
  domain: "VIRTUAL_ACCOUNT" | "VIRTUAL_CARD" | "REMITTANCE";
  documented: boolean;
  implemented: boolean;
  sandboxVerified: boolean;
  notes: string;
}

const SEEDS: CapabilityGrantSeed[] = [
  {
    providerName: "swappr-virtual-account",
    capability: "NGN_VIRTUAL_ACCOUNT",
    domain: "VIRTUAL_ACCOUNT",
    documented: true,
    implemented: true,
    sandboxVerified: false, // Swappr sandbox calls blocked by IP allowlist in this environment
    notes: "docs.swappr.me mapped 2026-08-08; sandbox blocked by IP allowlist."
  },
  {
    providerName: "swappr-remittance",
    capability: "REMITTANCE",
    domain: "REMITTANCE",
    documented: true,
    implemented: true,
    sandboxVerified: false,
    notes: "docs.swappr.me mapped 2026-08-08; sandbox blocked by IP allowlist."
  },
  {
    providerName: "payscribe-virtual-card",
    capability: "VIRTUAL_CARD",
    domain: "VIRTUAL_CARD",
    documented: true,
    implemented: true,
    sandboxVerified: false, // no Payscribe sandbox credentials in this environment
    notes: "Payscribe API collection PDF mapped 2026-08-08b; not yet sandbox-tested."
  },
  {
    providerName: "korapay-collection",
    capability: "NGN_COLLECTION",
    domain: "VIRTUAL_ACCOUNT",
    documented: true,
    implemented: true,
    sandboxVerified: true,
    notes: "Korapay checkout collection supports NGN invoice checkout; routed through invoices/payment-links gateway."
  },
  {
    providerName: "korapay-collection",
    capability: "INTERNATIONAL_COLLECTION",
    domain: "VIRTUAL_ACCOUNT",
    documented: true,
    implemented: true,
    sandboxVerified: false,
    notes: "Enables explicit USD invoice collection capability tracking; production enablement remains operator-gated."
  },
  {
    providerName: "payscribe-virtual-account",
    capability: "USD_VIRTUAL_ACCOUNT",
    domain: "VIRTUAL_ACCOUNT",
    documented: true,
    implemented: true,
    sandboxVerified: false,
    notes: "Payscribe USD wallet/account capability for customer USD collections; requires provider-customer/KYC before production enablement."
  },
  {
    providerName: "yativo-remittance",
    capability: "REMITTANCE",
    domain: "REMITTANCE",
    documented: true,
    implemented: true,
    sandboxVerified: false, // Yativo returned 401 in both environments during the audit
    notes: "docs.yativo.com mapped 2026-08-07; live calls returned 401 in both environments."
  },
  {
    providerName: "fincra-remittance",
    capability: "REMITTANCE",
    domain: "REMITTANCE",
    documented: true,
    implemented: true,
    sandboxVerified: true, // live sandbox payout + status lookup confirmed 2026-08-10
    notes: "Live-verified 2026-08-10: real NGN payout, minor-unit balance math, status lookup all confirmed against sandboxapi.fincra.com."
  }
];

async function main() {
  const db = createPrismaClient();
  let created = 0;
  let skipped = 0;

  for (const seed of SEEDS) {
    const existing = await db.providerCapabilityGrant.findUnique({
      where: { providerName_capability: { providerName: seed.providerName, capability: seed.capability } }
    });
    if (existing) {
      skipped++;
      continue;
    }

    await db.providerCapabilityGrant.create({
      data: {
        providerName: seed.providerName,
        capability: seed.capability,
        domain: seed.domain,
        documented: seed.documented,
        implemented: seed.implemented,
        sandboxVerified: seed.sandboxVerified,
        kybApproved: false,
        complianceApproved: false,
        productionApproved: false,
        enabled: false,
        priority: 100,
        currencies: [],
        countries: [],
        notes: seed.notes,
        metadata: {}
      }
    });
    created++;
  }

  console.log(`ProviderCapabilityGrant: ${created} created, ${skipped} already existed`);
  await db.$disconnect();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
