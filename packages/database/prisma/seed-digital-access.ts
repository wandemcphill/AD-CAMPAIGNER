import { createPrismaClient } from "../src/index";

interface DigitalAccessPlanSeed {
  planName: string;
  duration: string;
  priceMinor: number;
  description: string;
}

interface DigitalAccessServiceSeed {
  categorySlug: string;
  name: string;
  slug: string;
  description: string;
  deliveryEta: string;
  startingPriceMinor: number;
  isFeatured?: boolean;
  plans: DigitalAccessPlanSeed[];
}

const CATEGORIES = [
  {
    name: "AI Tools",
    slug: "ai-tools",
    description: "Managed access to approved AI productivity tools.",
    sortOrder: 10
  },
  {
    name: "Streaming",
    slug: "streaming",
    description: "Workspace-safe streaming and creative reference access.",
    sortOrder: 20
  },
  {
    name: "Gaming",
    slug: "gaming",
    description: "Creator and community gaming platform access.",
    sortOrder: 30
  },
  {
    name: "VPN & Security",
    slug: "vpn-security",
    description: "Privacy, access, and account security services.",
    sortOrder: 40
  }
];

const SERVICES: DigitalAccessServiceSeed[] = [
  {
    categorySlug: "ai-tools",
    name: "ChatGPT Plus Access",
    slug: "chatgpt-plus-access",
    description: "Managed monthly access for campaign planning, copy, and creative iteration.",
    deliveryEta: "Same day",
    startingPriceMinor: 3500000,
    isFeatured: true,
    plans: [
      {
        planName: "Monthly access",
        duration: "30 days",
        priceMinor: 3500000,
        description: "One managed seat for 30 days."
      }
    ]
  },
  {
    categorySlug: "ai-tools",
    name: "Canva Pro Access",
    slug: "canva-pro-access",
    description: "Design workspace access for social posts, flyers, decks, and campaign assets.",
    deliveryEta: "Same day",
    startingPriceMinor: 1200000,
    isFeatured: true,
    plans: [
      {
        planName: "Monthly access",
        duration: "30 days",
        priceMinor: 1200000,
        description: "One managed seat for 30 days."
      }
    ]
  },
  {
    categorySlug: "streaming",
    name: "Netflix Gift Access",
    slug: "netflix-gift-access",
    description: "Managed streaming access for creators and workspace-approved usage.",
    deliveryEta: "24 hours",
    startingPriceMinor: 700000,
    plans: [
      {
        planName: "Monthly access",
        duration: "30 days",
        priceMinor: 700000,
        description: "One managed profile/access slot for 30 days."
      }
    ]
  },
  {
    categorySlug: "vpn-security",
    name: "VPN Setup",
    slug: "vpn-setup",
    description: "Managed VPN access setup for secured creator operations.",
    deliveryEta: "Same day",
    startingPriceMinor: 500000,
    plans: [
      {
        planName: "Monthly access",
        duration: "30 days",
        priceMinor: 500000,
        description: "One managed VPN access slot for 30 days."
      }
    ]
  }
];

async function seedCategories(db: ReturnType<typeof createPrismaClient>) {
  for (const category of CATEGORIES) {
    await db.digitalAccessCategory.upsert({
      where: { slug: category.slug },
      update: {
        description: category.description,
        isActive: true,
        name: category.name,
        sortOrder: category.sortOrder
      },
      create: {
        description: category.description,
        isActive: true,
        name: category.name,
        slug: category.slug,
        sortOrder: category.sortOrder
      }
    });
  }
}

async function seedServices(db: ReturnType<typeof createPrismaClient>) {
  for (const service of SERVICES) {
    const serviceRow = await db.digitalAccessService.upsert({
      where: { slug: service.slug },
      update: {
        category: service.categorySlug,
        currency: "NGN",
        deliveryEta: service.deliveryEta,
        description: service.description,
        isActive: true,
        isFeatured: Boolean(service.isFeatured),
        name: service.name,
        startingPriceMinor: service.startingPriceMinor
      },
      create: {
        category: service.categorySlug,
        currency: "NGN",
        deliveryEta: service.deliveryEta,
        description: service.description,
        isActive: true,
        isFeatured: Boolean(service.isFeatured),
        name: service.name,
        slug: service.slug,
        startingPriceMinor: service.startingPriceMinor
      }
    });

    for (const plan of service.plans) {
      const existing = await db.digitalAccessPlan.findFirst({
        where: { planName: plan.planName, serviceId: serviceRow.id }
      });

      if (existing) {
        await db.digitalAccessPlan.update({
          where: { id: existing.id },
          data: {
            currency: "NGN",
            description: plan.description,
            duration: plan.duration,
            isActive: true,
            priceMinor: plan.priceMinor
          }
        });
      } else {
        await db.digitalAccessPlan.create({
          data: {
            currency: "NGN",
            description: plan.description,
            duration: plan.duration,
            isActive: true,
            planName: plan.planName,
            priceMinor: plan.priceMinor,
            serviceId: serviceRow.id
          }
        });
      }
    }
  }
}

async function main() {
  const db = createPrismaClient();

  try {
    await seedCategories(db);
    await seedServices(db);
    console.log(
      `Digital Access seed complete: ${CATEGORIES.length} categories, ${SERVICES.length} services.`
    );
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error("Digital Access seed failed:", error);
  process.exit(1);
});
