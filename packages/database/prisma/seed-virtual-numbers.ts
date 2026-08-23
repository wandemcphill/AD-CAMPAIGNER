import { createPrismaClient } from "../src/index";

// Production verification-number routing is intentionally 5SIM-only. The
// catalogue must mirror 5SIM's live country inventory rather than a hand-picked
// country list, otherwise the customer storefront hides most of the supplier's
// inventory.

const BASE_URL = (process.env.FIVESIM_BASE_URL ?? process.env.FIVESIM_API_URL ?? "https://5sim.net/v1").replace(/\/+$/, "");
const TOKEN = process.env.FIVESIM_API_TOKEN?.trim() ?? process.env.FIVESIM_API_KEY?.trim() ?? "";

function flagEmoji(iso: string): string {
  const normalized = iso.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) return "🌍";
  return [...normalized]
    .map((char) => String.fromCodePoint(127397 + char.charCodeAt(0)))
    .join("");
}

type FiveSimCountry = {
  iso?: Record<string, number>;
  prefix?: Record<string, number>;
  text_en?: string;
  [key: string]: unknown;
};

type FiveSimPrices = Record<string, Record<string, Record<string, { cost?: number; count?: number; rate?: number }>>>;

async function fiveSimGet<T>(path: string): Promise<T> {
  if (!TOKEN) throw new Error("FIVESIM_API_TOKEN is not configured.");
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: "application/json"
    }
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`5SIM ${path} returned HTTP ${response.status}: ${body.slice(0, 300)}`);
  }
  return (await response.json()) as T;
}

function deriveCountry(payload: FiveSimCountry, slug: string) {
  const iso = Object.keys(payload.iso ?? {})[0]?.toUpperCase() ?? "";
  const prefix = Object.keys(payload.prefix ?? {})[0] ?? "";
  const countryCode = slug.trim().toLowerCase();

  return {
    countryCode,
    iso,
    name: payload.text_en?.trim() || slug,
    dialPrefix: prefix || "+0",
    flagEmoji: flagEmoji(iso)
  };
}

function minimumLiveCostMinorUsd(prices: FiveSimPrices, countryCode: string): number {
  const country = prices[countryCode];
  if (!country) return 0;

  let minimum = Number.POSITIVE_INFINITY;
  for (const product of Object.values(country)) {
    for (const operator of Object.values(product)) {
      const count = Number(operator.count ?? 0);
      const cost = Number(operator.cost ?? 0);
      if (count > 0 && Number.isFinite(cost) && cost > 0) {
        minimum = Math.min(minimum, cost);
      }
    }
  }

  return Number.isFinite(minimum) ? Math.round(minimum * 100) : 0;
}

async function seedLive5SimCatalog(db: ReturnType<typeof createPrismaClient>) {
  const [countries, prices] = await Promise.all([
    fiveSimGet<Record<string, FiveSimCountry>>("/guest/countries"),
    fiveSimGet<FiveSimPrices>("/guest/prices")
  ]);

  const rows = Object.entries(countries)
    .filter(([slug]) => slug !== "any")
    .map(([slug, payload]) => ({
      ...deriveCountry(payload, slug),
      referenceCostMinorUsd: minimumLiveCostMinorUsd(prices, slug)
    }))
    .filter((country) => country.name && country.dialPrefix);

  if (rows.length === 0) {
    throw new Error("5SIM returned no usable countries.");
  }

  // Disable stale rows before reactivating the live supplier universe. This
  // removes the old four-country/hand-seeded ceiling without deleting history.
  await db.numberCountry.updateMany({ data: { enabled: false } });
  await db.virtualNumberProduct.updateMany({ data: { active: false, preferredProviders: ["5sim"] } });

  let countriesCreated = 0;
  let countriesUpdated = 0;
  let productsCreated = 0;
  let productsUpdated = 0;

  for (const [index, country] of rows.entries()) {
    const existing = await db.numberCountry.findUnique({ where: { isoCode: country.countryCode } });

    if (existing) {
      await db.numberCountry.update({
        where: { isoCode: existing.isoCode },
        data: {
          name: country.name,
          dialPrefix: country.dialPrefix,
          flagEmoji: country.flagEmoji,
          enabled: true,
          sortOrder: (index + 1) * 10
        }
      });
      countriesUpdated += 1;
    } else {
      await db.numberCountry.create({
        data: {
          isoCode: country.countryCode,
          name: country.name,
          dialPrefix: country.dialPrefix,
          flagEmoji: country.flagEmoji,
          enabled: true,
          sortOrder: (index + 1) * 10
        }
      });
      countriesCreated += 1;
    }

    // 5SIM's guest products endpoint is service-oriented. This product is the
    // storefront's generic 24-hour verification number SKU; the purchase path
    // then resolves live 5SIM services and prices for the selected country.
    const product = {
      countryCode: country.countryCode,
      capability: "SMS" as const,
      rentalKind: "TEMPORARY" as const,
      durationDays: 1,
      displayName: `${country.name} verification number — 24 hours`,
      active: true,
      preferredProviders: ["5sim"],
      metadata: {
        referenceCostMinorUsd: country.referenceCostMinorUsd,
        provider: "5sim",
        providerCountryRef: country.countryCode,
        catalogSource: "5SIM_LIVE"
      }
    };

    const existingProduct = await db.virtualNumberProduct.findUnique({
      where: {
        countryCode_capability_durationDays: {
          countryCode: product.countryCode,
          capability: "SMS",
          durationDays: product.durationDays
        }
      }
    });

    if (existingProduct) {
      await db.virtualNumberProduct.update({ where: { id: existingProduct.id }, data: product });
      productsUpdated += 1;
    } else {
      await db.virtualNumberProduct.create({ data: product });
      productsCreated += 1;
    }
  }

  console.log(
    `5SIM live catalogue: ${rows.length} countries synced (${countriesCreated} created, ${countriesUpdated} updated); ` +
      `${productsCreated + productsUpdated} active verification products.`
  );
}

async function main() {
  const db = createPrismaClient();

  try {
    try {
      await seedLive5SimCatalog(db);
    } catch (error) {
      // A transient supplier outage must not wipe the last known-good catalogue.
      // The sync is therefore best-effort during deploy; existing rows remain
      // untouched when the upstream call fails.
      console.error(
        `5SIM live catalogue sync skipped: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error("Virtual Numbers seed failed:", error);
  process.exit(1);
});