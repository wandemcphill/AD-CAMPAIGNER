export const campaignsService = {
  name: "campaigns",
  responsibilities: ["drafts", "review", "scheduling", "optimization", "lifecycle events"]
} as const;

/**
 * Campaign Risk Engine.
 *
 * Mirrors the SMM/OTP fraud-assessment pattern (`assessSmmOrderFraud`): a pure, deterministic
 * scorer that turns a campaign + advertiser context into an ALLOW / REVIEW / BLOCK decision.
 * The decision drives risk-gated automation, not customer type:
 *   ALLOW  -> eligible for automatic launch (green)
 *   REVIEW -> routed to the ops queue for a human (yellow)
 *   BLOCK  -> rejected before any spend (red)
 *
 * Account type only shifts the review threshold (dedicated/high-value accounts are scrutinised
 * sooner); the content-policy rules that protect ad-account health apply to every type equally.
 */

export type CampaignRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "BLOCKED";
export type CampaignRiskAction = "ALLOW" | "REVIEW" | "BLOCK";
export type CampaignAccountType = "CONNECTED" | "MANAGED" | "DEDICATED";
export type CampaignKycStatus = "UNVERIFIED" | "PENDING" | "VERIFIED" | "REJECTED";

export interface CampaignRiskSignal {
  code: string;
  message: string;
  score: number;
  severity: Exclude<CampaignRiskLevel, "LOW">;
  category?: string;
}

export interface CampaignRiskAssessment {
  score: number;
  riskLevel: CampaignRiskLevel;
  action: CampaignRiskAction;
  autoLaunchEligible: boolean;
  categories: string[];
  signals: CampaignRiskSignal[];
}

export interface CampaignRiskAdvertiser {
  kycStatus?: CampaignKycStatus;
  priorCampaigns?: number;
  priorViolations?: number;
}

export interface CampaignRiskInput {
  accountType: CampaignAccountType;
  budgetMinor: number;
  currency?: string;
  destinationUrl?: string;
  destinationKind?: string;
  /** Concatenated brief + creative captions to scan for policy-sensitive content. */
  contentText?: string;
  productCategory?: string;
  advertiser?: CampaignRiskAdvertiser;
  /** Destination URLs of the advertiser's recent/active campaigns, for velocity checks. */
  recentCampaignUrls?: string[];
  /** Minimum budget (minor units) below which delivery is ineffective. Default ₦1,000. */
  minBudgetMinor?: number;
}

interface ContentRule {
  category: string;
  score: number;
  severity: Exclude<CampaignRiskLevel, "LOW">;
  terms: string[];
}

// RED — prohibited outright. A single hit blocks the campaign.
const PROHIBITED_CONTENT: ContentRule[] = [
  {
    category: "gambling",
    score: 95,
    severity: "BLOCKED",
    terms: ["casino", "betting", "sportsbet", "gamble", "gambling", "lottery", "pool bet"]
  },
  {
    category: "weapons",
    score: 95,
    severity: "BLOCKED",
    terms: ["firearm", "ammunition", "ammo for sale", "rifle", "pistol", "handgun"]
  },
  {
    category: "adult",
    score: 95,
    severity: "BLOCKED",
    terms: ["porn", "xxx", "escort service", "sex cam", "nude photos"]
  },
  {
    category: "counterfeit",
    score: 95,
    severity: "BLOCKED",
    terms: ["counterfeit", "first copy", "fake designer", "replica watch", "knockoff"]
  },
  {
    category: "illegal-drugs",
    score: 95,
    severity: "BLOCKED",
    terms: ["cocaine", "tramadol for sale", "codeine syrup", "illegal drug"]
  },
  {
    category: "misleading-claims",
    score: 92,
    severity: "BLOCKED",
    terms: [
      "guaranteed returns",
      "double your money",
      "cure cancer",
      "miracle cure",
      "get rich quick",
      "100% profit",
      "risk-free investment"
    ]
  }
];

// YELLOW — allowed but requires human review.
const RESTRICTED_CONTENT: ContentRule[] = [
  {
    category: "financial-services",
    score: 55,
    severity: "HIGH",
    terms: ["loan", "forex", "crypto", "investment", "trading signal", "bitcoin", "usdt", "ponzi"]
  },
  {
    category: "health-supplements",
    score: 45,
    severity: "MEDIUM",
    terms: ["supplement", "weight loss", "slimming tea", "detox", "herbal cure", "enlargement"]
  },
  {
    category: "recruitment",
    score: 40,
    severity: "MEDIUM",
    terms: ["work from home", "earn daily", "hiring agents", "job vacancy", "recruitment"]
  },
  {
    category: "alcohol-tobacco",
    score: 40,
    severity: "MEDIUM",
    terms: ["alcohol", "vodka", "whisky", "cigarette", "vape", "tobacco"]
  },
  {
    category: "political",
    score: 50,
    severity: "HIGH",
    terms: ["vote for", "political party", "campaign for", "election candidate"]
  }
];

const DEFAULT_MIN_BUDGET_MINOR = 100_000; // ₦1,000

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function createSignal(
  code: string,
  message: string,
  score: number,
  severity: Exclude<CampaignRiskLevel, "LOW">,
  category?: string
): CampaignRiskSignal {
  return category === undefined
    ? { code, message, score, severity }
    : { code, message, score, severity, category };
}

function isPublicUrl(value: string) {
  try {
    const url = new URL(value.trim());
    const hostname = url.hostname.toLowerCase();

    return (
      (url.protocol === "https:" || url.protocol === "http:") &&
      hostname.includes(".") &&
      hostname !== "localhost"
    );
  } catch {
    return false;
  }
}

function codeFromCategory(prefix: string, category: string) {
  return `${prefix}_${category.replace(/-/g, "_").toUpperCase()}`;
}

/**
 * Account-type-aware risk banding. Dedicated (high-value) accounts drop into REVIEW sooner;
 * connected accounts (advertiser's own account and money) are scrutinised least.
 */
function getCampaignRisk(
  score: number,
  accountType: CampaignAccountType
): Pick<CampaignRiskAssessment, "action" | "riskLevel"> {
  const reviewFloor = accountType === "DEDICATED" ? 20 : accountType === "MANAGED" ? 30 : 40;

  if (score >= 90) {
    return { action: "BLOCK", riskLevel: "BLOCKED" };
  }
  if (score >= 60) {
    return { action: "REVIEW", riskLevel: "HIGH" };
  }
  if (score >= reviewFloor) {
    return { action: "REVIEW", riskLevel: "MEDIUM" };
  }

  return { action: "ALLOW", riskLevel: "LOW" };
}

export function assessCampaignRisk(input: CampaignRiskInput): CampaignRiskAssessment {
  const signals: CampaignRiskSignal[] = [];
  const categories = new Set<string>();
  const haystack = [input.contentText, input.productCategory, input.destinationKind]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLowerCase();

  for (const rule of PROHIBITED_CONTENT) {
    const hit = rule.terms.find((term) => haystack.includes(term));

    if (hit) {
      signals.push(
        createSignal(
          codeFromCategory("PROHIBITED", rule.category),
          `Prohibited content detected (${rule.category}): "${hit}".`,
          rule.score,
          rule.severity,
          rule.category
        )
      );
      categories.add(rule.category);
    }
  }

  for (const rule of RESTRICTED_CONTENT) {
    const hit = rule.terms.find((term) => haystack.includes(term));

    if (hit) {
      signals.push(
        createSignal(
          codeFromCategory("RESTRICTED", rule.category),
          `Restricted content requires review (${rule.category}): "${hit}".`,
          rule.score,
          rule.severity,
          rule.category
        )
      );
      categories.add(rule.category);
    }
  }

  const destinationUrl = input.destinationUrl?.trim();

  if (!destinationUrl) {
    signals.push(
      createSignal("MISSING_DESTINATION", "A destination link is required to launch.", 55, "HIGH")
    );
  } else if (!isPublicUrl(destinationUrl)) {
    signals.push(
      createSignal(
        "INVALID_DESTINATION_URL",
        "Destination must be a public http(s) link.",
        50,
        "HIGH"
      )
    );
  }

  const funded = input.accountType === "MANAGED" || input.accountType === "DEDICATED";
  const kycStatus = input.advertiser?.kycStatus;

  if (kycStatus === "REJECTED") {
    signals.push(
      createSignal("KYC_REJECTED", "Advertiser failed KYC verification.", 95, "BLOCKED")
    );
  } else if (funded && (kycStatus === undefined || kycStatus === "UNVERIFIED")) {
    signals.push(
      createSignal(
        "UNVERIFIED_FUNDED_ADVERTISER",
        "Advertiser is unverified and FlipTrybe funds the spend.",
        30,
        "MEDIUM"
      )
    );
  }

  const priorViolations = input.advertiser?.priorViolations ?? 0;

  if (priorViolations > 0) {
    signals.push(
      createSignal(
        "PRIOR_VIOLATIONS",
        `Advertiser has ${priorViolations} prior policy violation(s).`,
        clamp(30 + priorViolations * 20, 0, 95),
        priorViolations >= 3 ? "BLOCKED" : "HIGH"
      )
    );
  }

  if ((input.advertiser?.priorCampaigns ?? 0) === 0 && funded) {
    signals.push(
      createSignal(
        "FIRST_FUNDED_CAMPAIGN",
        "First funded campaign from this advertiser.",
        20,
        "MEDIUM"
      )
    );
  }

  const minBudget = input.minBudgetMinor ?? DEFAULT_MIN_BUDGET_MINOR;

  if (input.budgetMinor < minBudget) {
    signals.push(
      createSignal(
        "BELOW_MIN_BUDGET",
        "Budget is below the minimum for effective delivery.",
        25,
        "MEDIUM"
      )
    );
  }

  const duplicateCount = (input.recentCampaignUrls ?? []).filter(
    (url) => Boolean(url) && Boolean(destinationUrl) && url === destinationUrl
  ).length;

  if (duplicateCount >= 3) {
    signals.push(
      createSignal(
        "DUPLICATE_DESTINATION_VELOCITY",
        "Multiple recent campaigns target the same link.",
        35,
        "MEDIUM"
      )
    );
  }

  const score = clamp(
    signals.reduce((total, signal) => total + signal.score, 0),
    0,
    100
  );
  const risk = getCampaignRisk(score, input.accountType);

  return {
    score,
    ...risk,
    autoLaunchEligible: risk.action === "ALLOW",
    categories: [...categories],
    signals
  };
}
