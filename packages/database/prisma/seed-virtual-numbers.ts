import { createPrismaClient } from "../src/index";

// Seeds NumberCountry and VirtualNumberProduct for the Phase 2 launch ladder.
// Production verification-number routing is intentionally 5SIM-only. The live
// provider adapter reads FIVESIM_API_TOKEN (or the legacy FIVESIM_API_KEY) from
// the service environment. Other OTP suppliers remain documented only and are
// not selected for customer number orders.

interface CountrySeed {
  isoCode: string;
  name: string;
  dialPrefix: string;
  flagEmoji: string;
  enabled: boolean;
  sortOrder: number;
}

const COUNTRIES: CountrySeed[] = [
  { isoCode: "GB", name: "United Kingdom", dialPrefix: "+44", flagEmoji: "🇬🇧", enabled: true, sortOrder: 10 },
  { isoCode: "US", name: "United States", dialPrefix: "+1", flagEmoji: "🇺🇸", enabled: true, sortOrder: 20 },
  { isoCode: "CA", name: "Canada", dialPrefix: "+1", flagEmoji: "🇨🇦", enabled: true, sortOrder: 30 },
  { isoCode: "DE", name: "Germany", dialPrefix: "+49", flagEmoji: "🇩🇪", enabled: false, sortOrder: 40 },
  { isoCode: "AU", name: "Australia", dialPrefix: "+61", flagEmoji: "🇦🇺", enabled: false, sortOrder: 50 }
];

interface ProductSeed {
  countryCode: string;
  rentalKind: "TEMPORARY" | "STANDARD" | "EXTENDED" | "LONG_TERM";
  durationDays: number;
  displayName: string;
  active: boolean;
  preferredProviders: string[];
  referenceCostMinorUsd: number;
}

const PRODUCTS: ProductSeed[] = [
  { countryCode: "GB", rentalKind: "LONG_TERM", durationDays: 360, displayName: "UK Number — 360 days", active: true, preferredProviders: ["5sim"], referenceCostMinorUsd: 5500 },
  { countryCode: "US", rentalKind: "STANDARD", durationDays: 30, displayName: "US Number — 30 days", active: true, preferredProviders: ["5sim"], referenceCostMinorUsd: 1800 },
  { countryCode: "US", rentalKind: "EXTENDED", durationDays: 90, displayName: "US Number — 90 days", active: true, preferredProviders: ["5sim"], referenceCostMinorUsd: 4900 },
  { countryCode: "US", rentalKind: "EXTENDED", durationDays: 180, displayName: "US Number — 180 days", active: true, preferredProviders: ["5sim"], referenceCostMinorUsd: 9200 },
  { countryCode: "US", rentalKind: "LONG_TERM", durationDays: 360, displayName: "US Number — 360 days", active: true, preferredProviders: ["5sim"], referenceCostMinorUsd: 17500 },
  { countryCode: "CA", rentalKind: "STANDARD", durationDays: 30, displayName: "Canada Number — 30 days", active: true, preferredProviders: ["5sim"], referenceCostMinorUsd: 2000 },
  { countryCode: "DE", rentalKind: "EXTENDED", durationDays: 30, displayName: "Germany Number — 30 days", active: false, preferredProviders: ["5sim"], referenceCostMinorUsd: 3500 },
  { countryCode: "US", rentalKind: "TEMPORARY", durationDays: 1, displayName: "US Number — 24 hours (5SIM)", active: true, preferredProviders: ["5sim"], referenceCostMinorUsd: 150 }
];

async function seedCountries(db: ReturnType<typeof createPrismaClient>) {
  let created = 0;
  let updated = 0;

  for (const country of COUNTRIES) {
    const existing = await db.numberCountry.findUnique({ where: { isoCode: country.isoCode } });
    if (existing) {
      await db.numberCountry.update({
        where: { isoCode: country.isoCode },
        data: {
          name: country.name,
          dialPrefix: country.dialPrefix,
          flagEmoji: country.flagEmoji,
          enabled: country.enabled,
          sortOrder: country.sortOrder
        }
      });
      updated++;
    } else {
      await db.numberCountry.create({ data: country });
      created++;
    }
  }

  console.log(`NumberCountry: ${created} created, ${updated} updated`);
}

async function seedProducts(db: ReturnType<typeof createPrismaClient>) {
  // Remove stale supplier affinity from any older product rows. This prevents a
  // previous SMSPool/SMSPVA seed from remaining selectable after the launch policy
  // changes to 5SIM-only.
  await db.virtualNumberProduct.updateMany({
    data: { preferredProviders: ["5sim"] }
  });

  let created = 0;
  let updated = 0;

  for (const product of PRODUCTS) {
    const existing = await db.virtualNumberProduct.findUnique({
      where: {
        countryCode_capability_durationDays: {
          countryCode: product.countryCode,
          capability: "SMS",
          durationDays: product.durationDays
        }
      }
    });

    const data = {
      countryCode: product.countryCode,
      capability: "SMS" as const,
      rentalKind: product.rentalKind,
      durationDays: product.durationDays,
      displayName: product.displayName,
      active: product.active,
      preferredProviders: ["5sim"],
      metadata: { referenceCostMinorUsd: product.referenceCostMinorUsd }
    };

    if (existing) {
      await db.virtualNumberProduct.update({ where: { id: existing.id }, data });
      updated++;
    } else {
      await db.virtualNumberProduct.create({ data });
      created++;
    }
  }

  console.log(`VirtualNumberProduct: ${created} created, ${updated} updated (5SIM-only)`);
}

async function main() {
  const db = createPrismaClient();

  try {
    await seedCountries(db);
    await seedProducts(db);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error("Virtual Numbers seed failed:", error);
  process.exit(1);
});