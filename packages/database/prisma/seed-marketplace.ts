import { createPrismaClient } from "../src/index";

// Demo/test fixture data for the Marketplace UI (/os/marketplace, /os/marketplace/agencies,
// /os/marketplace/creators). These are NOT real vetted agencies or creators -- every row's
// description is tagged "Demo listing for testing" so it reads unambiguously as fixture data
// wherever it surfaces. Safe to re-run (upserts by name); safe to clear entirely with:
//   DELETE FROM "MarketplaceAgency" WHERE description LIKE '%Demo listing%';
//   DELETE FROM "MarketplaceCreator" WHERE bio LIKE '%Demo listing%';

interface AgencySeed {
  name: string;
  specialty: string;
  location: string;
  verified: boolean;
  ratingBps: number;
  reviewCount: number;
  campaignCount: number;
  teamSize: number;
  packages: string[];
}

const AGENCIES: AgencySeed[] = [
  { name: "Demo Social Studio", specialty: "Social Media", location: "Lagos", verified: true, ratingBps: 9800, reviewCount: 128, campaignCount: 342, teamSize: 18, packages: ["Starter — ₦50K", "Growth — ₦150K", "Enterprise — ₦500K"] },
  { name: "Demo Performance Ads Co", specialty: "PPC / Google", location: "Abuja", verified: true, ratingBps: 9600, reviewCount: 96, campaignCount: 215, teamSize: 12, packages: ["Audit — ₦30K", "Management — ₦120K", "Full-stack — ₦300K"] },
  { name: "Demo Creative Motion Studio", specialty: "Video Production", location: "Lagos", verified: true, ratingBps: 9400, reviewCount: 67, campaignCount: 156, teamSize: 8, packages: ["Single video — ₦80K", "Campaign pack — ₦200K"] },
  { name: "Demo SEO Collective", specialty: "SEO", location: "Lagos", verified: false, ratingBps: 9000, reviewCount: 43, campaignCount: 89, teamSize: 6, packages: ["Local SEO — ₦40K", "National — ₦100K"] },
  { name: "Demo Influencer Hub", specialty: "Influencer Marketing", location: "Lagos", verified: true, ratingBps: 9200, reviewCount: 54, campaignCount: 178, teamSize: 10, packages: ["Nano — ₦25K", "Micro — ₦75K", "Macro — ₦250K"] },
  { name: "Demo Growth Partners", specialty: "Social Media", location: "Port Harcourt", verified: false, ratingBps: 8800, reviewCount: 31, campaignCount: 67, teamSize: 5, packages: ["Basic — ₦20K", "Pro — ₦60K"] }
];

interface CreatorSeed {
  name: string;
  niche: string;
  verified: boolean;
  followerCount: number;
  engagementBps: number;
  rateMinor: number;
  languages: string[];
  platforms: string[];
  pastCampaigns: number;
}

const CREATORS: CreatorSeed[] = [
  { name: "Demo Creator — Beauty", niche: "Beauty", verified: true, followerCount: 250000, engagementBps: 420, rateMinor: 5000000, languages: ["English", "Igbo"], platforms: ["Instagram", "TikTok"], pastCampaigns: 34 },
  { name: "Demo Creator — Tech", niche: "Tech", verified: true, followerCount: 180000, engagementBps: 510, rateMinor: 3500000, languages: ["English", "Yoruba"], platforms: ["YouTube", "X"], pastCampaigns: 22 },
  { name: "Demo Creator — Fashion", niche: "Fashion", verified: true, followerCount: 320000, engagementBps: 380, rateMinor: 6500000, languages: ["English", "Hausa"], platforms: ["Instagram", "TikTok"], pastCampaigns: 48 },
  { name: "Demo Creator — Food", niche: "Food", verified: false, followerCount: 95000, engagementBps: 620, rateMinor: 2000000, languages: ["English"], platforms: ["TikTok", "Instagram"], pastCampaigns: 15 },
  { name: "Demo Creator — Fitness", niche: "Fitness", verified: true, followerCount: 140000, engagementBps: 480, rateMinor: 3000000, languages: ["English", "Hausa"], platforms: ["YouTube", "Instagram"], pastCampaigns: 19 },
  { name: "Demo Creator — Lifestyle", niche: "Lifestyle", verified: false, followerCount: 210000, engagementBps: 350, rateMinor: 4000000, languages: ["English", "Yoruba"], platforms: ["Instagram", "YouTube"], pastCampaigns: 27 }
];

async function seedAgencies(db: ReturnType<typeof createPrismaClient>) {
  let created = 0;
  let updated = 0;

  for (const agency of AGENCIES) {
    const existing = await db.marketplaceAgency.findFirst({ where: { name: agency.name } });
    const description = `Demo listing for testing — full-service ${agency.specialty.toLowerCase()} agency.`;

    if (existing) {
      await db.marketplaceAgency.update({ where: { id: existing.id }, data: { ...agency, description } });
      updated++;
    } else {
      await db.marketplaceAgency.create({ data: { ...agency, description } });
      created++;
    }
  }

  console.log(`MarketplaceAgency: ${created} created, ${updated} updated`);
}

async function seedCreators(db: ReturnType<typeof createPrismaClient>) {
  let created = 0;
  let updated = 0;

  for (const creator of CREATORS) {
    const existing = await db.marketplaceCreator.findFirst({ where: { name: creator.name } });
    const bio = `Demo listing for testing — ${creator.niche.toLowerCase()} content creator.`;

    if (existing) {
      await db.marketplaceCreator.update({
        where: { id: existing.id },
        data: { ...creator, currency: "NGN", bio }
      });
      updated++;
    } else {
      await db.marketplaceCreator.create({ data: { ...creator, currency: "NGN", bio } });
      created++;
    }
  }

  console.log(`MarketplaceCreator: ${created} created, ${updated} updated`);
}

async function main() {
  const db = createPrismaClient();

  try {
    await seedAgencies(db);
    await seedCreators(db);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error("Marketplace seed failed:", error);
  process.exit(1);
});
