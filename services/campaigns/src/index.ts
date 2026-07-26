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

// ---------------------------------------------------------------------------
// Campaign Engine.
//
// Turns the one-screen wizard's plain-language answers (what do you want more
// of / paste link / where / budget) into a normalized, platform-agnostic
// CampaignSpec. The Execution Engine later maps a CampaignSpec to each ad
// network's own campaign objects, so the wizard and this normalizer stay the
// same as new platforms are added.
// ---------------------------------------------------------------------------

export type CampaignGoal =
  | "WHATSAPP_MESSAGES"
  | "WEBSITE_VISITS"
  | "VIDEO_VIEWS"
  | "PHONE_CALLS"
  | "MORE_FOLLOWERS"
  | "SALES"
  | "STORE_VISITS"
  | "LIVE_VIEWERS";

// Mirrors the CampaignObjective enum in the Prisma schema / @fliptrybe/types.
export type CampaignObjective =
  | "AWARENESS"
  | "ENGAGEMENT"
  | "TRAFFIC"
  | "LEADS"
  | "SALES"
  | "APP_INSTALLS"
  | "FOLLOWERS"
  | "LIVE_VIEWERS";

// Subset of DestinationKind the wizard infers from the pasted link in v1.
export type CampaignDestinationKind =
  | "TIKTOK_PROFILE"
  | "TIKTOK_LIVE"
  | "INSTAGRAM_PROFILE"
  | "INSTAGRAM_REEL"
  | "INSTAGRAM_LIVE"
  | "FACEBOOK_PAGE"
  | "FACEBOOK_LIVE"
  | "WHATSAPP_CHANNEL"
  | "YOUTUBE_CHANNEL"
  | "WEBSITE"
  | "ECOMMERCE_STORE";

export type CampaignGender = "MALE" | "FEMALE" | "ALL";

export interface CampaignSpecTargeting {
  countries: string[];
  cities: string[];
  ageMin: number;
  ageMax: number;
  gender: CampaignGender;
  interests: string[];
}

export interface CampaignSpec {
  goal: CampaignGoal;
  objective: CampaignObjective;
  destination: { url: string; kind: CampaignDestinationKind };
  budget: { amountMinor: number; currency: string };
  targeting: CampaignSpecTargeting;
  schedule: { startsAt?: string; endsAt?: string };
  warnings: string[];
}

export interface CampaignSpecInput {
  goal: string;
  link: string;
  budgetMinor: number;
  currency?: string;
  country?: string;
  countries?: string[];
  city?: string;
  cities?: string[];
  ageMin?: number;
  ageMax?: number;
  gender?: string;
  interests?: string[];
  startsAt?: string;
  endsAt?: string;
}

const GOAL_CONFIG: Record<
  CampaignGoal,
  { objective: CampaignObjective; supported: boolean; note?: string }
> = {
  WHATSAPP_MESSAGES: { objective: "LEADS", supported: true },
  WEBSITE_VISITS: { objective: "TRAFFIC", supported: true },
  VIDEO_VIEWS: { objective: "ENGAGEMENT", supported: true },
  PHONE_CALLS: { objective: "LEADS", supported: true },
  MORE_FOLLOWERS: { objective: "FOLLOWERS", supported: true },
  SALES: { objective: "SALES", supported: true },
  STORE_VISITS: {
    objective: "AWARENESS",
    supported: false,
    note: "Store-visit campaigns are not available yet; running as an awareness campaign."
  },
  LIVE_VIEWERS: {
    objective: "LIVE_VIEWERS",
    supported: false,
    note: "Live-viewer ad campaigns depend on platform LIVE-promotion access and require review."
  }
};

function normalizeGoal(raw: string): CampaignGoal {
  const value = (raw ?? "").trim().toUpperCase().replace(/[\s-]+/g, "_");

  if (value in GOAL_CONFIG) {
    return value as CampaignGoal;
  }
  if (value === "FOLLOWERS") {
    return "MORE_FOLLOWERS";
  }
  if (value.includes("WHATSAPP") || value.includes("MESSAGE")) {
    return "WHATSAPP_MESSAGES";
  }
  if (value.includes("STORE")) {
    return "STORE_VISITS";
  }
  if (value.includes("LIVE")) {
    return "LIVE_VIEWERS";
  }
  if (value.includes("CALL")) {
    return "PHONE_CALLS";
  }
  if (value.includes("FOLLOW")) {
    return "MORE_FOLLOWERS";
  }
  if (value.includes("SALE") || value.includes("PURCHASE") || value.includes("ORDER")) {
    return "SALES";
  }
  if (value.includes("VIDEO") || value.includes("VIEW")) {
    return "VIDEO_VIEWS";
  }
  if (value.includes("WEBSITE") || value.includes("VISIT") || value.includes("TRAFFIC")) {
    return "WEBSITE_VISITS";
  }

  throw new Error(`Unrecognised campaign goal: "${raw}".`);
}

function deriveDestinationKind(link: string, goal: CampaignGoal): CampaignDestinationKind {
  let host = "";
  let path = "";

  try {
    const url = new URL(link);
    host = url.hostname.toLowerCase();
    path = url.pathname.toLowerCase();
  } catch {
    // link is validated by the caller before this point.
  }

  const isLive = path.includes("/live");

  if (host.includes("wa.me") || host.includes("whatsapp")) {
    return "WHATSAPP_CHANNEL";
  }
  if (host.includes("tiktok")) {
    return isLive ? "TIKTOK_LIVE" : "TIKTOK_PROFILE";
  }
  if (host.includes("instagram")) {
    if (path.includes("/reel")) {
      return "INSTAGRAM_REEL";
    }

    return isLive ? "INSTAGRAM_LIVE" : "INSTAGRAM_PROFILE";
  }
  if (host.includes("facebook") || host.includes("fb.com") || host.includes("fb.watch")) {
    return isLive ? "FACEBOOK_LIVE" : "FACEBOOK_PAGE";
  }
  if (host.includes("youtube") || host.includes("youtu.be")) {
    return "YOUTUBE_CHANNEL";
  }
  if (goal === "SALES") {
    return "ECOMMERCE_STORE";
  }

  return "WEBSITE";
}

function normalizeGender(raw?: string): CampaignGender {
  const value = (raw ?? "").trim().toUpperCase();

  if (value === "MALE" || value === "M" || value === "MEN") {
    return "MALE";
  }
  if (value === "FEMALE" || value === "F" || value === "WOMEN") {
    return "FEMALE";
  }

  return "ALL";
}

function clampAge(value: number) {
  return clamp(Math.trunc(value), 13, 65);
}

function dedupeStrings(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export function normalizeCampaignSpec(input: CampaignSpecInput): CampaignSpec {
  const warnings: string[] = [];
  const goal = normalizeGoal(input.goal);
  const config = GOAL_CONFIG[goal];

  if (!config.supported && config.note) {
    warnings.push(config.note);
  }

  const link = input.link?.trim();

  if (!link || !isPublicUrl(link)) {
    throw new Error("A valid public destination link (http/https) is required.");
  }

  const budgetMinor = Math.trunc(Number(input.budgetMinor));

  if (!Number.isFinite(budgetMinor) || budgetMinor <= 0) {
    throw new Error("Budget must be a positive amount.");
  }
  if (budgetMinor < DEFAULT_MIN_BUDGET_MINOR) {
    warnings.push("Budget is below the recommended minimum for effective delivery.");
  }

  const ageMin = clampAge(input.ageMin ?? 18);
  const ageMax = clampAge(input.ageMax ?? 65);

  const targeting: CampaignSpecTargeting = {
    countries: dedupeStrings(input.countries ?? (input.country ? [input.country] : ["NG"])),
    cities: dedupeStrings(input.cities ?? (input.city ? [input.city] : [])),
    ageMin: Math.min(ageMin, ageMax),
    ageMax: Math.max(ageMin, ageMax),
    gender: normalizeGender(input.gender),
    interests: dedupeStrings(input.interests ?? [])
  };

  return {
    goal,
    objective: config.objective,
    destination: { url: link, kind: deriveDestinationKind(link, goal) },
    budget: { amountMinor: budgetMinor, currency: (input.currency ?? "NGN").toUpperCase() },
    targeting,
    schedule: {
      ...(input.startsAt ? { startsAt: input.startsAt } : {}),
      ...(input.endsAt ? { endsAt: input.endsAt } : {})
    },
    warnings
  };
}

// ---------------------------------------------------------------------------
// Execution Engine (manual-first).
//
// A CampaignSpec is platform-agnostic; a launch spec translates it into the
// exact settings an operator copies into a given ad network's Ads Manager.
// This is the concierge "spec sheet": it turns queue review from open-ended
// judgment into a two-minute copy job, and it is the same mapping the future
// automated connector (createMetaAdsProvider) will use once Marketing API
// access is approved — only the destination (human vs. API call) changes.
//
// The field names below are FlipTrybe's advisory mapping, not a literal
// Meta Marketing API payload — an operator should still confirm against
// Meta's current Ads Manager UI before launching.
// ---------------------------------------------------------------------------

export type LaunchSpecPlatform = "META";

export interface CampaignLaunchAdSet {
  name: string;
  dailyBudgetMinor: number;
  currency: string;
  billingEvent: string;
  optimizationGoal: string;
  targeting: {
    countries: string[];
    cities: string[];
    ageMin: number;
    ageMax: number;
    genders: string[];
    interests: string[];
  };
}

export interface CampaignLaunchSpec {
  platform: LaunchSpecPlatform;
  campaign: { name: string; objective: string; buyingType: string };
  adSet: CampaignLaunchAdSet;
  ad: { name: string; destinationUrl: string; callToAction: string };
  copyInstructions: string[];
  warnings: string[];
}

// FlipTrybe CampaignObjective -> Meta Ads Manager objective (advisory; Meta's naming evolves).
const META_OBJECTIVE_MAP: Record<CampaignObjective, string> = {
  AWARENESS: "OUTCOME_AWARENESS",
  ENGAGEMENT: "OUTCOME_ENGAGEMENT",
  TRAFFIC: "OUTCOME_TRAFFIC",
  LEADS: "OUTCOME_LEADS",
  SALES: "OUTCOME_SALES",
  APP_INSTALLS: "OUTCOME_APP_PROMOTION",
  FOLLOWERS: "OUTCOME_ENGAGEMENT",
  LIVE_VIEWERS: "OUTCOME_ENGAGEMENT"
};

const META_OPTIMIZATION_MAP: Record<CampaignObjective, { billingEvent: string; optimizationGoal: string }> = {
  AWARENESS: { billingEvent: "IMPRESSIONS", optimizationGoal: "REACH" },
  ENGAGEMENT: { billingEvent: "IMPRESSIONS", optimizationGoal: "POST_ENGAGEMENT" },
  TRAFFIC: { billingEvent: "IMPRESSIONS", optimizationGoal: "LINK_CLICKS" },
  LEADS: { billingEvent: "IMPRESSIONS", optimizationGoal: "CONVERSATIONS" },
  SALES: { billingEvent: "IMPRESSIONS", optimizationGoal: "OFFSITE_CONVERSIONS" },
  APP_INSTALLS: { billingEvent: "IMPRESSIONS", optimizationGoal: "APP_INSTALLS" },
  FOLLOWERS: { billingEvent: "IMPRESSIONS", optimizationGoal: "POST_ENGAGEMENT" },
  LIVE_VIEWERS: { billingEvent: "IMPRESSIONS", optimizationGoal: "POST_ENGAGEMENT" }
};

const CALL_TO_ACTION_MAP: Record<CampaignGoal, string> = {
  WHATSAPP_MESSAGES: "SEND_WHATSAPP_MESSAGE",
  WEBSITE_VISITS: "LEARN_MORE",
  VIDEO_VIEWS: "WATCH_MORE",
  PHONE_CALLS: "CALL_NOW",
  MORE_FOLLOWERS: "LEARN_MORE",
  SALES: "SHOP_NOW",
  STORE_VISITS: "GET_DIRECTIONS",
  LIVE_VIEWERS: "WATCH_MORE"
};

function titleCaseGoal(goal: CampaignGoal) {
  return goal
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Builds the Meta launch spec sheet for a given CampaignSpec. `advertiserName` labels the
 * campaign/ad-set names so an operator managing many concurrent placements can tell them apart
 * in Ads Manager at a glance.
 */
export function buildMetaLaunchSpec(spec: CampaignSpec, advertiserName: string): CampaignLaunchSpec {
  const objective = META_OBJECTIVE_MAP[spec.objective];
  const { billingEvent, optimizationGoal } = META_OPTIMIZATION_MAP[spec.objective];
  const label = `${advertiserName} - ${titleCaseGoal(spec.goal)}`;
  const genders =
    spec.targeting.gender === "ALL" ? ["MALE", "FEMALE"] : [spec.targeting.gender];

  const copyInstructions = [
    `Create a new campaign in Ads Manager with objective "${objective}".`,
    `Name the campaign "${label}".`,
    `Create one ad set with a daily budget of ${(spec.budget.amountMinor / 100).toLocaleString()} ${spec.budget.currency}, optimizing for "${optimizationGoal}" (billed on ${billingEvent}).`,
    `Set location targeting to ${[...spec.targeting.cities, ...spec.targeting.countries].join(", ") || "Nigeria"}, ages ${spec.targeting.ageMin}-${spec.targeting.ageMax}, gender: ${genders.join("/")}.`,
    spec.targeting.interests.length
      ? `Add interest targeting: ${spec.targeting.interests.join(", ")}.`
      : "No specific interest targeting requested — leave broad.",
    `Create one ad pointing to ${spec.destination.url} with call-to-action "${CALL_TO_ACTION_MAP[spec.goal]}".`,
    "Submit for Meta's ad review, then mark this placement launched in FlipTrybe once approved."
  ];

  return {
    platform: "META",
    campaign: { name: label, objective, buyingType: "AUCTION" },
    adSet: {
      name: `${label} - Ad Set`,
      dailyBudgetMinor: spec.budget.amountMinor,
      currency: spec.budget.currency,
      billingEvent,
      optimizationGoal,
      targeting: {
        countries: spec.targeting.countries,
        cities: spec.targeting.cities,
        ageMin: spec.targeting.ageMin,
        ageMax: spec.targeting.ageMax,
        genders,
        interests: spec.targeting.interests
      }
    },
    ad: {
      name: `${label} - Ad`,
      destinationUrl: spec.destination.url,
      callToAction: CALL_TO_ACTION_MAP[spec.goal]
    },
    copyInstructions,
    warnings: spec.warnings
  };
}
