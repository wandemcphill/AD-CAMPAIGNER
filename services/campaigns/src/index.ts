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

// Meta's own stated minimum is ~$5-15/day per ad set (2026 guidance); below that, delivery is
// unreliable regardless of targeting quality. ~₦8,000 approximates the $5 floor at a ~1600 NGN/USD
// rate (same approximation the OTP pricing already uses) -- this should track a live FX rate
// rather than stay hardcoded once a real rate feed exists, but a rough, honest floor beats none.
const DEFAULT_MIN_BUDGET_MINOR = 800_000; // ~₦8,000 (~$5)

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
  | "ECOMMERCE_STORE"
  | "FLIPTRYBE_STORE";

/**
 * Categories where the ad's destination MUST be a FlipTrybe-hosted listing rather than an
 * arbitrary external link. These are high-stakes, remote, stranger-to-stranger transactions
 * (accommodation/property/vehicles, wholesale merchant trade, resale of used goods) where
 * FlipTrybe's own KYC/escrow/review machinery (verified real and built, see the
 * fliptrybe-marketplace-routing-verified memory) is the only thing standing between a customer
 * and a "pay to secure your booking" scam. The ad-campaign engine drives discovery/traffic; the
 * transaction itself happens on FlipTrybe.
 *
 * These three values are FlipTrybe's real, verified lanes (`Fliptrybe/website/app/sell/page.tsx`,
 * option values "declutter" | "tradehub" | "primeslots") -- short-lets, hotels, real estate, and
 * automobiles all live under PrimeSlots (there is no separate hotel or logistics listing lane;
 * logistics is a delivery/dispatch service, not something a customer lists for sale).
 */
export type MarketplaceLane = "PRIMESLOTS" | "TRADEHUB" | "DECLUTTER";

interface MarketplaceLaneRule {
  lane: MarketplaceLane;
  /** The exact `?lane=` value FlipTrybe's /sell page expects. */
  laneParam: string;
  label: string;
  keywords: string[];
}

const MARKETPLACE_LANE_RULES: MarketplaceLaneRule[] = [
  {
    lane: "PRIMESLOTS",
    laneParam: "primeslots",
    label: "Real estate, short-let, hotel, or vehicle",
    keywords: [
      "shortlet", "short let", "sublet", "airbnb", "vacation rental", "apartment for rent", "flat for rent",
      "hotel", "guest house", "guesthouse", "serviced apartment", "lodge",
      "house for sale", "land for sale", "property", "real estate",
      "car for sale", "vehicle for sale", "automobile"
    ]
  },
  {
    lane: "TRADEHUB",
    laneParam: "tradehub",
    label: "Registered-merchant / wholesale trade",
    keywords: [
      "cac registered", "registered merchant", "wholesale", "distributor", "manufacturer",
      "bulk order", "bulk supply", "b2b", "trailer load", "trailer-load", "farm produce wholesale"
    ]
  },
  {
    lane: "DECLUTTER",
    laneParam: "declutter",
    label: "Used item resale",
    keywords: ["declutter", "used ", "fairly used", "second hand", "second-hand", "thrift item", "pre-owned"]
  }
];

/**
 * Detects whether a campaign's product falls into a category that must route through a
 * FlipTrybe listing instead of running as a normal ad. Same keyword-matching approach as
 * `detectCategoryProfile` -- rule-based today, same seam a real classifier plugs into later.
 */
export function detectMarketplaceLane(productDescription?: string): MarketplaceLane | undefined {
  if (!productDescription) {
    return undefined;
  }

  const text = productDescription.toLowerCase();
  const match = MARKETPLACE_LANE_RULES.find((rule) => rule.keywords.some((keyword) => text.includes(keyword)));

  return match?.lane;
}

export function isFliptrybeListingUrl(link: string): boolean {
  try {
    return new URL(link).hostname.toLowerCase().includes("fliptrybe");
  } catch {
    return false;
  }
}

export type CampaignGender = "MALE" | "FEMALE" | "ALL";

/**
 * Geographic targeting hierarchy: country -> state/region/province -> city -> local government
 * area/district/county. Named for Nigeria's administrative structure (state, LGA) since that's
 * the primary market, but every level is free-text and works for any country's equivalent
 * subdivision -- a state field holds "Lagos" as easily as "California" or "Ontario".
 */
/**
 * Radius targeting around an exact point -- "5km from this address" -- distinct from the named-place
 * hierarchy above. Real Meta/Google targeting supports this and the named hierarchy alone can't
 * express it (a whole LGA is far coarser than a delivery-constrained seller needs). Primarily for
 * hyperlocal/declutter/local-service use cases, see the vertical-aware-targeting-and-routing memory.
 */
export interface CampaignRadiusTargeting {
  latitude: number;
  longitude: number;
  radiusKm: number;
}

export interface CampaignSpecTargeting {
  countries: string[];
  states: string[];
  cities: string[];
  localGovernmentAreas: string[];
  /** Set only when the caller supplied a valid latitude/longitude/radius -- narrows delivery to an
   *  exact radius around a point, layered on top of (not replacing) the named-place hierarchy. */
  radius?: CampaignRadiusTargeting;
  ageMin: number;
  ageMax: number;
  gender: CampaignGender;
  /** Topic/interest categories (e.g. "thrift fashion", "football"). */
  interests: string[];
  /** Consumer/purchase-behavior classifications (e.g. "engaged shoppers", "frequent travelers") --
   *  Meta's "Behaviors" detailed-targeting category; platform-adapter maps these per network. */
  behaviors: string[];
  /** Search-intent keywords -- what someone actually searched for. Primarily consumed by
   *  search-ad platforms (Google); ignored by social platforms like Meta that don't target on
   *  search queries. Kept here so the same CampaignSpec works once a Google adapter exists. */
  searchKeywords: string[];
  /** When true (the default), let the target platform's own algorithm find the best audience
   *  (e.g. Meta's Advantage+ Audience) using interests/behaviors as optional signals rather than
   *  a hard filter -- matches "we decide how" for Studio's simple flow. Pro/Company callers can
   *  set this false to manually restrict delivery to exactly the specified audience. */
  optimizeAutomatically: boolean;
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
  /** Free text describing the product/business -- used to detect categories (real estate/short-let/
   *  hotel/vehicle, wholesale merchant trade, used-item resale) that must route through a FlipTrybe
   *  listing, see `detectMarketplaceLane`. Same field name/shape as RecommendTargetingInput's. */
  productDescription?: string;
  country?: string;
  countries?: string[];
  state?: string;
  states?: string[];
  city?: string;
  cities?: string[];
  localGovernmentArea?: string;
  localGovernmentAreas?: string[];
  /** Optional exact-point radius targeting, see CampaignRadiusTargeting. All three must be present
   *  and valid (latitude -90..90, longitude -180..180, radiusKm 1..50) or none is applied. */
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  ageMin?: number;
  ageMax?: number;
  gender?: string;
  interests?: string[];
  behaviors?: string[];
  searchKeywords?: string[];
  optimizeAutomatically?: boolean;
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

  if (host.includes("fliptrybe")) {
    return "FLIPTRYBE_STORE";
  }
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

/** All three of latitude/longitude/radiusKm must be present and pass basic sanity bounds, or no
 *  radius targeting is applied -- a partial/malformed radius is treated as absent, not an error,
 *  since it's an optional refinement layered on the named-place hierarchy. */
function normalizeRadius(
  latitude: unknown,
  longitude: unknown,
  radiusKm: unknown
): CampaignRadiusTargeting | undefined {
  if (latitude === undefined && longitude === undefined && radiusKm === undefined) {
    return undefined;
  }

  const lat = Number(latitude);
  const lng = Number(longitude);
  const radius = Number(radiusKm);

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    !Number.isFinite(radius) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180 ||
    radius <= 0
  ) {
    return undefined;
  }

  return { latitude: lat, longitude: lng, radiusKm: clamp(radius, 1, 50) };
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

  const marketplaceLane = detectMarketplaceLane(input.productDescription);

  if (marketplaceLane && !isFliptrybeListingUrl(link)) {
    const rule = MARKETPLACE_LANE_RULES.find((candidate) => candidate.lane === marketplaceLane);
    throw new Error(
      `${rule?.label ?? "This category"} must link to a FlipTrybe listing, not an external link -- ` +
        "it keeps your customer's payment protected by FlipTrybe's escrow instead of unprotected off-platform. " +
        "Paste your FlipTrybe listing URL, or create one first on FlipTrybe if you don't have one yet."
    );
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

  const radius = normalizeRadius(input.latitude, input.longitude, input.radiusKm);

  const targeting: CampaignSpecTargeting = {
    countries: dedupeStrings(input.countries ?? (input.country ? [input.country] : ["NG"])),
    states: dedupeStrings(input.states ?? (input.state ? [input.state] : [])),
    cities: dedupeStrings(input.cities ?? (input.city ? [input.city] : [])),
    localGovernmentAreas: dedupeStrings(
      input.localGovernmentAreas ?? (input.localGovernmentArea ? [input.localGovernmentArea] : [])
    ),
    ...(radius ? { radius } : {}),
    ageMin: Math.min(ageMin, ageMax),
    ageMax: Math.max(ageMin, ageMax),
    gender: normalizeGender(input.gender),
    interests: dedupeStrings(input.interests ?? []),
    behaviors: dedupeStrings(input.behaviors ?? []),
    searchKeywords: dedupeStrings(input.searchKeywords ?? []),
    optimizeAutomatically: input.optimizeAutomatically ?? true
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
    states: string[];
    cities: string[];
    localGovernmentAreas: string[];
    radius?: CampaignRadiusTargeting;
    ageMin: number;
    ageMax: number;
    genders: string[];
    interests: string[];
    behaviors: string[];
    optimizeAutomatically: boolean;
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

  const locationParts = [
    ...spec.targeting.localGovernmentAreas,
    ...spec.targeting.cities,
    ...spec.targeting.states,
    ...spec.targeting.countries
  ];
  const copyInstructions = [
    `Create a new campaign in Ads Manager with objective "${objective}".`,
    `Name the campaign "${label}".`,
    `Create one ad set with a daily budget of ${(spec.budget.amountMinor / 100).toLocaleString()} ${spec.budget.currency}, optimizing for "${optimizationGoal}" (billed on ${billingEvent}).`,
    `Set location targeting to ${locationParts.join(", ") || "Nigeria"}, ages ${spec.targeting.ageMin}-${spec.targeting.ageMax}, gender: ${genders.join("/")}.`,
    ...(spec.targeting.radius
      ? [
          `Narrow delivery to a ${spec.targeting.radius.radiusKm}km radius around ${spec.targeting.radius.latitude.toFixed(5)}, ${spec.targeting.radius.longitude.toFixed(5)} using Ads Manager's pin-drop radius targeting -- this is tighter than the named-place targeting above, use it for local-delivery-constrained sellers.`
        ]
      : []),
    spec.targeting.interests.length
      ? `Add interest targeting: ${spec.targeting.interests.join(", ")}.`
      : "No specific interest targeting requested — leave broad.",
    spec.targeting.behaviors.length
      ? `Add behavior targeting: ${spec.targeting.behaviors.join(", ")}.`
      : "No specific behavior targeting requested.",
    spec.targeting.optimizeAutomatically
      ? "Enable Advantage+ Audience (or equivalent broad/algorithmic targeting) so Meta's delivery system finds the best-performing people beyond the specified interests/behaviors, rather than restricting strictly to them."
      : "Restrict delivery strictly to the specified interests/behaviors — do not enable Advantage+ Audience expansion.",
    "Use Advantage+ Placements (automatic placements across Feed, Stories, Reels, etc.) rather than manually selecting placements — Meta's 2026 data shows meaningfully better cost efficiency and fewer failed campaigns with automatic placements for conversion-focused objectives; only override manually once real performance data justifies excluding a specific placement.",
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
        states: spec.targeting.states,
        cities: spec.targeting.cities,
        localGovernmentAreas: spec.targeting.localGovernmentAreas,
        ...(spec.targeting.radius ? { radius: spec.targeting.radius } : {}),
        ageMin: spec.targeting.ageMin,
        ageMax: spec.targeting.ageMax,
        genders,
        interests: spec.targeting.interests,
        behaviors: spec.targeting.behaviors,
        optimizeAutomatically: spec.targeting.optimizeAutomatically
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

// ---------------------------------------------------------------------------
// Targeting Recommendations.
//
// Suggests SEVERAL audience/budget options (not one) based on the goal, budget, and a free-text
// product/business description -- e.g. "I sell wigs in Lagos" -> fashion-skewed audience presets.
//
// HONEST SCOPE NOTE: category detection here is keyword matching against a small dictionary, not
// language understanding -- there is no LLM wired into this codebase yet (AI_PROVIDER=mock
// throughout). This is deliberately built as a swappable function: today it's a solid rule-based
// baseline that works correctly for the common categories; once a real AI provider exists, this is
// the exact seam a smarter, freeform-text-understanding version plugs into without changing any
// caller. Budget-to-outcome estimates use published Nigerian CPC/CPM ranges (2026) and are
// explicitly ranges, not guarantees -- actual results vary by creative, season, and competition.
// ---------------------------------------------------------------------------

export interface CampaignTargetingRecommendation {
  label: string;
  rationale: string;
  targeting: {
    ageMin: number;
    ageMax: number;
    gender: CampaignGender;
    interests: string[];
    behaviors: string[];
    localGovernmentAreas: string[];
    radius?: CampaignRadiusTargeting;
  };
  optimizeAutomatically: boolean;
  estimatedOutcome: {
    metric: string;
    lowEstimate: number;
    highEstimate: number;
    basis: string;
  };
}

export interface RecommendTargetingInput {
  goal: string;
  budgetMinor: number;
  /** Free text describing the product/business, e.g. "I sell wigs in Lagos" -- keyword-matched
   *  against a category dictionary, see the honest scope note above. */
  productDescription?: string;
  city?: string;
  localGovernmentArea?: string;
  /** Optional exact-point radius, e.g. for a local-service/declutter seller who only wants buyers
   *  within a few km. When all three are present and valid, the hyper-local option narrows to this
   *  radius instead of just the named LGA/city. */
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
}

interface CategoryProfile {
  category: string;
  keywords: string[];
  ageMin: number;
  ageMax: number;
  gender: CampaignGender;
  interests: string[];
  behaviors: string[];
}

const CATEGORY_PROFILES: CategoryProfile[] = [
  {
    category: "Fashion & Beauty",
    keywords: ["wig", "hair", "dress", "cloth", "shoe", "bag", "jewelry", "makeup", "beauty", "cosmetic", "fashion"],
    ageMin: 18,
    ageMax: 40,
    gender: "FEMALE",
    interests: ["fashion", "beauty", "online shopping"],
    behaviors: ["engaged shoppers"]
  },
  {
    category: "Food & Restaurant",
    keywords: ["food", "restaurant", "catering", "snack", "drink", "meal", "kitchen", "chef", "bakery"],
    ageMin: 18,
    ageMax: 55,
    gender: "ALL",
    interests: ["food delivery", "restaurants"],
    behaviors: ["frequent restaurant visitors"]
  },
  {
    category: "Electronics & Gadgets",
    keywords: ["phone", "gadget", "laptop", "electronics", "accessory", "charger", "earpiece", "tech"],
    ageMin: 18,
    ageMax: 45,
    gender: "ALL",
    interests: ["technology", "online shopping"],
    behaviors: ["engaged shoppers", "early technology adopters"]
  },
  {
    category: "Real Estate & Property",
    keywords: ["property", "real estate", "house", "apartment", "land", "shortlet", "rent"],
    ageMin: 25,
    ageMax: 55,
    gender: "ALL",
    interests: ["real estate", "home improvement"],
    behaviors: []
  },
  {
    category: "Events & Services",
    keywords: ["event", "wedding", "party", "photography", "makeup artist", "planner", "decor"],
    ageMin: 20,
    ageMax: 45,
    gender: "ALL",
    interests: ["event planning"],
    behaviors: []
  }
];

const GENERAL_PROFILE: CategoryProfile = {
  category: "General",
  keywords: [],
  ageMin: 18,
  ageMax: 65,
  gender: "ALL",
  interests: [],
  behaviors: []
};

function detectCategoryProfile(productDescription?: string): CategoryProfile {
  if (!productDescription) {
    return GENERAL_PROFILE;
  }

  const text = productDescription.toLowerCase();
  const match = CATEGORY_PROFILES.find((profile) =>
    profile.keywords.some((keyword) => text.includes(keyword))
  );

  return match ?? GENERAL_PROFILE;
}

// Published 2026 Nigerian benchmark ranges (Meta/Instagram) -- wide because actual cost varies a
// lot by audience, creative, and season. Used only to produce an illustrative range, never a
// point estimate, and always labeled with its basis so it can't be mistaken for a guarantee.
const NAIRA_CPC_LOW_MINOR = 5_000; // ₦50
const NAIRA_CPC_HIGH_MINOR = 30_000; // ₦300
const NAIRA_CPM_LOW_MINOR = 100_000; // ₦1,000 per 1,000 impressions
const NAIRA_CPM_HIGH_MINOR = 500_000; // ₦5,000 per 1,000 impressions

/** Exported so the API layer can attach the same illustrative outcome estimate to AI-generated
 *  targeting options (AnthropicRecommendationClient) as it does to the rule-based ones below --
 *  one estimation basis, whichever provider actually produced the audience parameters. */
export function estimateOutcomeForGoal(goal: CampaignGoal, budgetMinor: number): CampaignTargetingRecommendation["estimatedOutcome"] {
  const clicksLow = Math.floor(budgetMinor / NAIRA_CPC_HIGH_MINOR);
  const clicksHigh = Math.floor(budgetMinor / NAIRA_CPC_LOW_MINOR);
  const basisClicks = "Nigeria 2026 Meta/Instagram CPC benchmark range ₦50-₦300; actual cost varies by audience, creative, and season.";

  switch (goal) {
    case "WHATSAPP_MESSAGES":
    case "PHONE_CALLS":
      // Rough click-to-contact rate for click-to-WhatsApp/call ads, illustrative only.
      return {
        metric: goal === "WHATSAPP_MESSAGES" ? "estimated WhatsApp messages" : "estimated phone calls",
        lowEstimate: Math.round(clicksLow * 0.15),
        highEstimate: Math.round(clicksHigh * 0.3),
        basis: `${basisClicks} Assumes roughly 15-30% of clicks convert to a message/call -- a rough industry range, not measured for this specific campaign.`
      };
    case "WEBSITE_VISITS":
      return {
        metric: "estimated website clicks",
        lowEstimate: clicksLow,
        highEstimate: clicksHigh,
        basis: basisClicks
      };
    case "SALES":
      return {
        metric: "estimated orders",
        lowEstimate: Math.round(clicksLow * 0.01),
        highEstimate: Math.round(clicksHigh * 0.03),
        basis: `${basisClicks} Assumes a rough 1-3% click-to-purchase rate -- typical e-commerce range, highly dependent on product/offer/checkout experience.`
      };
    case "MORE_FOLLOWERS":
      return {
        metric: "estimated new followers",
        lowEstimate: Math.round(clicksLow * 0.4),
        highEstimate: Math.round(clicksHigh * 0.7),
        basis: `${basisClicks} Assumes a rough 40-70% follow rate among engaged clickers.`
      };
    default: {
      const impressionsLow = Math.floor((budgetMinor / NAIRA_CPM_HIGH_MINOR) * 1000);
      const impressionsHigh = Math.floor((budgetMinor / NAIRA_CPM_LOW_MINOR) * 1000);

      return {
        metric: "estimated views/impressions",
        lowEstimate: impressionsLow,
        highEstimate: impressionsHigh,
        basis: "Nigeria 2026 Meta/Instagram CPM benchmark range ₦1,000-₦5,000 per 1,000 impressions."
      };
    }
  }
}

/**
 * Returns MULTIPLE targeting recommendations (not one), from broadest (Advantage+-style, matches
 * 2026 Meta best practice of letting the algorithm find buyers) to narrowest (hyper-local, best
 * for delivery-constrained sellers). The customer/operator picks one, or a Pro/Company caller can
 * present all three.
 */
export function recommendCampaignTargeting(
  input: RecommendTargetingInput
): CampaignTargetingRecommendation[] {
  const goal = normalizeGoalSafe(input.goal);
  const profile = detectCategoryProfile(input.productDescription);
  const estimatedOutcome = estimateOutcomeForGoal(goal, input.budgetMinor);
  const localGovernmentAreas = input.localGovernmentArea ? [input.localGovernmentArea] : [];
  const hyperLocalRadius = normalizeRadius(input.latitude, input.longitude, input.radiusKm);

  const recommendations: CampaignTargetingRecommendation[] = [
    {
      label: "Broad reach (recommended)",
      rationale:
        "Meta's own 2026 guidance: broad targeting with Advantage+ Audience typically outperforms manual narrowing, because the delivery algorithm finds buyers you wouldn't have manually targeted. Best default for most first campaigns.",
      targeting: { ageMin: 18, ageMax: 65, gender: "ALL", interests: [], behaviors: [], localGovernmentAreas: [] },
      optimizeAutomatically: true,
      estimatedOutcome
    },
    {
      label: profile === GENERAL_PROFILE ? "Focused audience" : `Focused on ${profile.category.toLowerCase()} buyers`,
      rationale:
        profile === GENERAL_PROFILE
          ? "A moderately narrowed starting audience, still algorithm-expanded -- a middle ground between broad and hyper-local."
          : `Detected "${profile.category}" from your description. Starts the algorithm with relevant interests/behaviors as hints -- Meta still expands beyond these when it finds better-performing people.`,
      targeting: {
        ageMin: profile.ageMin,
        ageMax: profile.ageMax,
        gender: profile.gender,
        interests: profile.interests,
        behaviors: profile.behaviors,
        localGovernmentAreas: []
      },
      optimizeAutomatically: true,
      estimatedOutcome
    },
    {
      label: hyperLocalRadius ? `Hyper-local (${hyperLocalRadius.radiusKm}km radius)` : "Hyper-local",
      rationale: hyperLocalRadius
        ? `Narrows delivery to an exact ${hyperLocalRadius.radiusKm}km radius around your pinned location -- the tightest option, best for delivery-constrained sellers (declutter/local services) where a whole LGA is still too broad. Double-check it isn't too narrow to deliver reliably (Meta recommends 1,000+ people in the targeted audience).`
        : input.city
          ? `Narrows delivery to ${input.city}${input.localGovernmentArea ? `, ${input.localGovernmentArea}` : ""} specifically -- best if you only deliver/serve locally. Smaller audience than the other two options, so double-check it isn't too narrow to deliver reliably (Meta recommends 1,000+ people in the targeted audience).`
          : "Narrows to your specified location -- best if you only deliver/serve locally. Add a city (or an exact radius) for this option to actually narrow anything.",
      targeting: {
        ageMin: profile.ageMin,
        ageMax: profile.ageMax,
        gender: profile.gender,
        interests: profile.interests,
        behaviors: profile.behaviors,
        localGovernmentAreas,
        ...(hyperLocalRadius ? { radius: hyperLocalRadius } : {})
      },
      optimizeAutomatically: true,
      estimatedOutcome
    }
  ];

  return recommendations;
}

/** Exported for the same reason as estimateOutcomeForGoal -- the API layer's AI-provider path
 *  needs to normalize a raw wizard goal string the same way this heuristic path already does. */
export function normalizeGoalSafe(raw: string): CampaignGoal {
  try {
    return normalizeGoal(raw);
  } catch {
    return "WEBSITE_VISITS";
  }
}

// ---------------------------------------------------------------------------
// Budget Optimization Engine.
//
// Honest scope note: this is NOT cross-PLATFORM auto-optimization ("move ₦10,000 from Google to
// Meta automatically"). That requires simultaneous spend AND reporting API access on 2+ platforms,
// which doesn't exist yet -- see the ad-platform-mechanics-reference memory's explanation of why
// that's a compounding partner-approval problem, not just an engineering layer. What's genuinely
// buildable today: FlipTrybe already captures real per-campaign spend (CampaignLedgerEntry) and
// real outcome data (CampaignOutcome, self-reported or platform-derived) across a workspace's own
// campaigns, whatever platform each runs on. This engine compares cost-per-outcome across a
// customer's own live campaigns and RECOMMENDS moving unspent budget from an underperforming one
// to an overperforming one -- reusing the existing transferCampaignBudget execution path rather
// than duplicating it. It never executes a transfer itself; recommendation and execution stay
// separate, matching the "don't silently move real money" principle used everywhere else in this
// codebase (budget increases/decreases already require an explicit client action, not automation).
// ---------------------------------------------------------------------------

export interface CampaignPerformanceInput {
  campaignId: string;
  name: string;
  currency: string;
  budgetMinor: number;
  spentMinor: number;
  goal: CampaignGoal;
  outcome?: {
    messagesCount?: number;
    ordersCount?: number;
    estRevenueMinor?: number;
  };
}

export interface BudgetOptimizationRecommendation {
  fromCampaignId: string;
  fromName: string;
  toCampaignId: string;
  toName: string;
  amountMinor: number;
  currency: string;
  reason: string;
}

export interface BudgetOptimizationScore {
  campaignId: string;
  name: string;
  /** Cost per primary outcome (order, or message if no order data), in minor units. Null when
   *  there isn't enough spend+outcome data yet to score this campaign -- excluded from
   *  recommendations, never treated as "performing badly". */
  costPerOutcomeMinor: number | null;
  outcomeCount: number;
  unspentMinor: number;
}

export interface BudgetOptimizationResult {
  scored: BudgetOptimizationScore[];
  recommendations: BudgetOptimizationRecommendation[];
  note: string;
}

const OPTIMIZATION_NOTE =
  "Recommendations compare cost-per-outcome across your own live campaigns using real spend and " +
  "reported outcomes -- not cross-platform auto-optimization (that needs simultaneous ad-spend and " +
  "reporting API access on 2+ networks, which isn't available yet). Nothing moves automatically; " +
  "confirm a recommendation to execute it as a budget transfer.";

function primaryOutcomeCount(outcome: CampaignPerformanceInput["outcome"]): number {
  if (!outcome) {
    return 0;
  }
  if (outcome.ordersCount && outcome.ordersCount > 0) {
    return outcome.ordersCount;
  }
  return outcome.messagesCount ?? 0;
}

/**
 * Compares cost-per-outcome across a workspace's own live campaigns (grouped by currency, since
 * transferCampaignBudget already requires matching currencies) and recommends moving unspent
 * budget from the worst-performing scorable campaign to the best-performing one, when the gap is
 * large enough (>=1.5x cost-per-outcome) to be worth acting on. Conservative by design: moves at
 * most half of the underperformer's unspent budget in one recommendation, never all of it, so a
 * still-running campaign isn't starved by a single automated suggestion.
 */
export function recommendBudgetOptimization(
  campaigns: CampaignPerformanceInput[]
): BudgetOptimizationResult {
  const scored: BudgetOptimizationScore[] = campaigns.map((campaign) => {
    const outcomeCount = primaryOutcomeCount(campaign.outcome);
    const unspentMinor = Math.max(0, campaign.budgetMinor - campaign.spentMinor);
    const costPerOutcomeMinor =
      outcomeCount > 0 && campaign.spentMinor > 0 ? campaign.spentMinor / outcomeCount : null;

    return { campaignId: campaign.campaignId, name: campaign.name, costPerOutcomeMinor, outcomeCount, unspentMinor };
  });

  const byCurrency = new Map<string, CampaignPerformanceInput[]>();
  for (const campaign of campaigns) {
    const group = byCurrency.get(campaign.currency) ?? [];
    group.push(campaign);
    byCurrency.set(campaign.currency, group);
  }

  const recommendations: BudgetOptimizationRecommendation[] = [];

  for (const [currency, group] of byCurrency) {
    const scorable = group
      .map((campaign) => ({
        campaign,
        score: scored.find((entry) => entry.campaignId === campaign.campaignId)!
      }))
      .filter((entry) => entry.score.costPerOutcomeMinor !== null)
      .sort((a, b) => a.score.costPerOutcomeMinor! - b.score.costPerOutcomeMinor!);

    if (scorable.length < 2) {
      continue;
    }

    const best = scorable[0]!;
    const worst = scorable[scorable.length - 1]!;
    const costRatio = worst.score.costPerOutcomeMinor! / best.score.costPerOutcomeMinor!;

    if (costRatio >= 1.5 && worst.score.unspentMinor > 0 && best.campaign.campaignId !== worst.campaign.campaignId) {
      const amountMinor = Math.floor(worst.score.unspentMinor / 2);

      if (amountMinor > 0) {
        recommendations.push({
          fromCampaignId: worst.campaign.campaignId,
          fromName: worst.campaign.name,
          toCampaignId: best.campaign.campaignId,
          toName: best.campaign.name,
          amountMinor,
          currency,
          reason:
            `"${worst.campaign.name}" costs ${Math.round(worst.score.costPerOutcomeMinor! / 100).toLocaleString()} ${currency} per outcome vs ` +
            `${Math.round(best.score.costPerOutcomeMinor! / 100).toLocaleString()} ${currency} for "${best.campaign.name}" (${costRatio.toFixed(1)}x). ` +
            `Moving half of its unspent budget to the better performer.`
        });
      }
    }
  }

  return { scored, recommendations, note: OPTIMIZATION_NOTE };
}
