import { createPrismaClient } from "../src/index";

// Seeds NumberCountry and VirtualNumberProduct for the Phase 2 launch ladder (plan §4.4).
// Prices are provisional — every figure must be re-derived from live provider APIs
// before launch (plan §12 item 5). referenceCostMinorUsd in metadata is a display
// estimate only; the actual charge always comes from a live searchNumbers() call.

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
  // Disabled until SMSPVA inventory is confirmed at integration (plan §4.4, §12 item 4).
  { isoCode: "DE", name: "Germany", dialPrefix: "+49", flagEmoji: "🇩🇪", enabled: false, sortOrder: 40 },
  // No confirmed long-term rental inventory across the three providers (plan §12 item 3).
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
  // UK — hero SKU, SMSPool
  { countryCode: "GB", rentalKind: "LONG_TERM", durationDays: 360, displayName: "UK Number — 360 days", active: true, preferredProviders: ["smspool"], referenceCostMinorUsd: 5500 },
  // US — full ladder, SMSPool
  { countryCode: "US", rentalKind: "STANDARD", durationDays: 30, displayName: "US Number — 30 days", active: true, preferredProviders: ["smspool"], referenceCostMinorUsd: 1800 },
  { countryCode: "US", rentalKind: "EXTENDED", durationDays: 90, displayName: "US Number — 90 days", active: true, preferredProviders: ["smspool"], referenceCostMinorUsd: 4900 },
  { countryCode: "US", rentalKind: "EXTENDED", durationDays: 180, displayName: "US Number — 180 days", active: true, preferredProviders: ["smspool"], referenceCostMinorUsd: 9200 },
  { countryCode: "US", rentalKind: "LONG_TERM", durationDays: 360, displayName: "US Number — 360 days", active: true, preferredProviders: ["smspool"], referenceCostMinorUsd: 17500 },
  // Canada — SMSPool
  { countryCode: "CA", rentalKind: "STANDARD", durationDays: 30, displayName: "Canada Number — 30 days", active: true, preferredProviders: ["smspool"], referenceCostMinorUsd: 2000 },
  // Germany — SMSPVA, inactive until inventory confirmed
  { countryCode: "DE", rentalKind: "EXTENDED", durationDays: 30, displayName: "Germany Number — 30 days", active: false, preferredProviders: ["smspva"], referenceCostMinorUsd: 3500 },
  // 5SIM short rentals — broad country coverage, temporary/1-hour to 1-month tier.
  // Seeded against US as a representative short-rental SKU; expand per-country once
  // catalog sync (Phase 3) replaces this manual seed.
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
      preferredProviders: product.preferredProviders,
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

  console.log(`VirtualNumberProduct: ${created} created, ${updated} updated`);
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
