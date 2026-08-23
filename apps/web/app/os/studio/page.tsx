"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import {
  MessageCircle,
  Globe,
  PlayCircle,
  Phone,
  Users,
  ShoppingBag,
  ArrowRight,
  CheckCircle2,
  Rocket,
  ShieldCheck,
  ExternalLink,
  Link2
} from "lucide-react";

import { Badge, Button, Panel, SummaryStatStrip, cn } from "@fliptrybe/ui";

import {
  amountToMinor,
  createCampaignFromWizard,
  formatCampaignMoney,
  type CreateCampaignFromWizardResult,
  type StudioGoal
} from "../../campaigns/api";
import { ErrorNotice } from "../../campaigns/components";
import { useApiSession } from "../../lib/use-session";
import { ApiClientError } from "../../lib/api-client";
import Link from "next/link";

type GoalOption = {
  goal: StudioGoal;
  label: string;
  hint: string;
  icon: typeof MessageCircle;
};

const goalOptions: GoalOption[] = [
  { goal: "WHATSAPP_MESSAGES", label: "WhatsApp messages", hint: "Get customers messaging you", icon: MessageCircle },
  { goal: "WEBSITE_VISITS", label: "Website visits", hint: "Send people to your site", icon: Globe },
  { goal: "VIDEO_VIEWS", label: "Video views", hint: "Get your video seen", icon: PlayCircle },
  { goal: "PHONE_CALLS", label: "Phone calls", hint: "Get customers calling you", icon: Phone },
  { goal: "MORE_FOLLOWERS", label: "More followers", hint: "Grow your audience", icon: Users },
  { goal: "SALES", label: "Sales", hint: "Sell more products", icon: ShoppingBag }
];

const budgetPresetsMinor = [500000, 1000000, 2500000, 5000000];

// Presentation-only hint, mirroring the authoritative MARKETPLACE_LANE_RULES keyword lists in
// services/campaigns/src/index.ts (detectMarketplaceLane). The server always re-checks and
// enforces this on submit -- this is just an early, friendlier nudge before that happens.
//
// laneParam/route verified directly against FlipTrybe's real code
// (Fliptrybe/website/app/sell/page.tsx + components/web-flows.tsx): the /sell page's <select>
// only has three option values -- "declutter" | "tradehub" | "primeslots" -- short-lets, hotels,
// real estate, and vehicles all live under PrimeSlots. There is no separate hotel or logistics
// listing lane. Only `?lane=` is read from the URL on that page; title/city are plain form state,
// not query-param-driven, so we don't fabricate params the destination doesn't consume.
const MARKETPLACE_LANE_HINTS: Array<{ laneParam: string; label: string; noun: string; keywords: string[] }> = [
  {
    laneParam: "primeslots",
    label: "Real estate, short-let, hotel, or vehicle",
    noun: "a PrimeSlots listing (real estate, short-let, hotel, or vehicle)",
    keywords: [
      "shortlet", "short let", "sublet", "airbnb", "vacation rental", "apartment for rent", "flat for rent",
      "hotel", "guest house", "guesthouse", "serviced apartment", "lodge",
      "house for sale", "land for sale", "property", "real estate",
      "car for sale", "vehicle for sale", "automobile"
    ]
  },
  {
    laneParam: "tradehub",
    label: "Registered-merchant / wholesale trade",
    noun: "a TradeHub listing (registered-merchant / wholesale trade)",
    keywords: [
      "cac registered", "registered merchant", "wholesale", "distributor", "manufacturer",
      "bulk order", "bulk supply", "b2b", "trailer load", "trailer-load", "farm produce wholesale"
    ]
  },
  {
    laneParam: "declutter",
    label: "Used item resale",
    noun: "a Declutter listing (used item resale)",
    keywords: ["declutter", "used ", "fairly used", "second hand", "second-hand", "thrift item", "pre-owned"]
  }
];

type MarketplaceLaneHint = (typeof MARKETPLACE_LANE_HINTS)[number];

function detectMarketplaceLaneHint(productDescription: string): MarketplaceLaneHint | undefined {
  const text = productDescription.trim().toLowerCase();
  if (!text) {
    return undefined;
  }

  return MARKETPLACE_LANE_HINTS.find((rule) => rule.keywords.some((keyword) => text.includes(keyword)));
}

function buildFliptrybeListingCreateUrl(lane: MarketplaceLaneHint) {
  return `https://fliptrybe.store/sell?lane=${encodeURIComponent(lane.laneParam)}`;
}

function formatPresetLabel(amountMinor: number) {
  return `NGN ${(amountMinor / 100).toLocaleString()}`;
}

export default function StudioPage() {
  const { loading: sessionLoading, session } = useApiSession();
  const [goal, setGoal] = useState<StudioGoal>();
  const [link, setLink] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [city, setCity] = useState("");
  const [budgetPresetMinor, setBudgetPresetMinor] = useState<number>();
  const [customBudget, setCustomBudget] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string>();
  const [result, setResult] = useState<CreateCampaignFromWizardResult>();

  const [listingChoice, setListingChoice] = useState<"have" | "need">();

  const budgetMinor = customBudget ? amountToMinor(customBudget) : (budgetPresetMinor ?? 0);
  const canSubmit = Boolean(goal) && link.trim().length > 0 && budgetMinor > 0;
  const detectedMarketplaceLane = useMemo(
    () => detectMarketplaceLaneHint(productDescription),
    [productDescription]
  );

  if (!sessionLoading && !session) {
    return (
      <>
        <Panel className="mx-auto mt-16 max-w-2xl p-8">
          <Badge tone="warning">Sign in required</Badge>
          <h1 className="mt-4 text-3xl font-semibold tracking-normal text-[var(--ft-text-primary)]">
            Studio creates your workspace automatically
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--ft-text-secondary)]">
            Sign in or create an account to attach a workspace session, hydrate the studio, and launch a campaign
            without a manual setup step.
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <Link
              className="inline-flex h-11 items-center justify-center gap-2 rounded-[var(--radius-sm)] border border-[var(--ft-accent)] bg-[var(--ft-accent)] px-5 text-sm font-semibold text-[var(--ft-bg-base)] transition hover:bg-[var(--ft-accent-dim)]"
              href="/login"
            >
              Sign in
            </Link>
            <Link
              className="inline-flex h-11 items-center justify-center gap-2 rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-5 text-sm font-semibold text-[var(--ft-text-primary)] transition hover:border-[var(--ft-accent)]"
              href="/register"
            >
              Create account
            </Link>
          </div>
        </Panel>
      </>
    );
  }

  useEffect(() => {
    if (!detectedMarketplaceLane) {
      setListingChoice(undefined);
    }
  }, [detectedMarketplaceLane]);

  function handleBudgetPreset(amount: number) {
    setBudgetPresetMinor(amount);
    setCustomBudget("");
  }

  function handleCustomBudgetChange(value: string) {
    setCustomBudget(value);
    setBudgetPresetMinor(undefined);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!goal) {
      setFormError("Choose what you want more of.");
      return;
    }
    if (!link.trim()) {
      setFormError("Paste the link you want to promote.");
      return;
    }
    if (budgetMinor <= 0) {
      setFormError("Choose or enter a budget.");
      return;
    }

    setFormError(undefined);
    setSubmitting(true);
    try {
      const response = await createCampaignFromWizard({
        goal,
        link: link.trim(),
        budgetMinor,
        ...(city.trim() ? { city: city.trim() } : {}),
        ...(productDescription.trim() ? { productDescription: productDescription.trim() } : {})
      });
      setResult(response);
    } catch (caught) {
      setFormError(
        caught instanceof ApiClientError
          ? caught.message
          : "We could not launch this campaign right now. Try again in a moment."
      );
    } finally {
      setSubmitting(false);
    }
  }

  function handleStartAnother() {
    setResult(undefined);
    setGoal(undefined);
    setLink("");
    setProductDescription("");
    setCity("");
    setBudgetPresetMinor(undefined);
    setCustomBudget("");
    setFormError(undefined);
    setListingChoice(undefined);
  }

  if (result) {
    return (
      <>
        <Panel className="mx-auto mt-10 max-w-xl p-8 text-center">
          <div className="mx-auto grid size-14 place-items-center rounded-[var(--radius-sm)] border border-[var(--ft-green)]/40 bg-[var(--ft-green-subtle)]">
            <CheckCircle2 className="size-7 stroke-[1.5] text-[var(--ft-green)]" />
          </div>
          <h1 className="mt-4 text-2xl font-medium text-[var(--ft-text-primary)]">
            Your campaign is on its way
          </h1>
          <p className="mt-2 text-sm leading-6 text-[var(--ft-text-secondary)]">
            We&apos;ve queued <span className="font-medium text-[var(--ft-text-primary)]">{result.campaign.name}</span>{" "}
            for {formatCampaignMoney(result.campaign.budget)}. Our team reviews and launches every campaign, then
            we&apos;ll let you know the moment it&apos;s live.
          </p>
          {result.warnings.length > 0 ? (
            <div className="mt-4 rounded-[var(--radius-sm)] border border-[var(--ft-yellow)]/40 bg-[var(--ft-yellow-subtle)] p-3 text-left text-sm text-[var(--ft-yellow)]">
              {result.warnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
          ) : null}
          <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
            <Link
              className="inline-flex h-10 items-center justify-center gap-2 rounded-[var(--radius-sm)] border border-transparent bg-[var(--ft-accent)] px-5 text-sm font-semibold text-[var(--ft-bg-base)] transition hover:bg-[var(--ft-accent-dim)]"
              href={`/os/campaigns/${result.campaign.id}`}
            >
              View campaign
              <ArrowRight className="size-4 stroke-[1.5]" />
            </Link>
            <Button onClick={handleStartAnother} variant="secondary">
              Boost something else
            </Button>
          </div>
        </Panel>
      </>
    );
  }

  return (
    <>
      <header className="flex flex-col gap-3 border-b border-[var(--ft-border)] pb-5">
        <Badge tone="info">FlipTrybe Studio</Badge>
        <h1 className="text-3xl font-semibold tracking-normal text-[var(--ft-text-primary)] sm:text-4xl">
          Boost your business in 60 seconds
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-[var(--ft-text-secondary)]">
          No ad accounts, no campaign managers, no jargon. Tell us what you want more of, paste your link, pick a
          budget, and we&apos;ll handle the rest.
        </p>
      </header>

      <ErrorNotice message={formError} />

      <section className="mt-6">
        <SummaryStatStrip
          items={[
            { label: "generation cost", value: "15 credits" },
            { label: "workspace", value: session?.workspace?.name ?? "Attached" },
            { label: "launch mode", value: "Managed desk review" }
          ]}
        />
      </section>

      <form className="mt-6 grid gap-6" onSubmit={(event) => void handleSubmit(event)}>
        <Panel className="p-5">
          <div className="text-sm font-medium text-[var(--ft-text-primary)]">What do you want more of?</div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {goalOptions.map((option) => (
              <button
                className={cn(
                  "grid gap-1 rounded-[var(--radius-md)] border p-4 text-left transition",
                  goal === option.goal
                    ? "border-[var(--ft-accent)] bg-[var(--ft-accent-subtle)] shadow-[0_0_0_3px_var(--ft-accent-glow)]"
                    : "border-[var(--ft-border)] bg-[var(--ft-bg-surface)] hover:border-[var(--ft-accent)]"
                )}
                key={option.goal}
                onClick={() => setGoal(option.goal)}
                type="button"
              >
                <option.icon className="size-5 stroke-[1.5] text-[var(--ft-accent)]" />
                <div className="mt-1 text-sm font-semibold text-[var(--ft-text-primary)]">{option.label}</div>
                <div className="text-xs text-[var(--ft-text-secondary)]">{option.hint}</div>
              </button>
            ))}
          </div>
        </Panel>

        <Panel className="p-5">
          <label className="text-sm font-medium text-[var(--ft-text-primary)]" htmlFor="studio-product">
            What are you promoting? <span className="text-[var(--ft-text-muted)]">(optional)</span>
          </label>
          <p className="mt-1 text-xs text-[var(--ft-text-secondary)]">
            A short description helps us pick the right audience — and for short-lets, hotels, logistics, and used
            items, tells us to route the ad to your FlipTrybe listing so the customer's payment stays protected.
          </p>
          <input
            className="mt-3 h-11 w-full rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-3 text-sm text-[var(--ft-text-primary)] outline-none focus:border-[var(--ft-accent)]"
            id="studio-product"
            onChange={(event) => setProductDescription(event.target.value)}
            placeholder="e.g. shortlet apartment in Lekki, fairly used TV, hotel rooms in Abuja..."
            type="text"
            value={productDescription}
          />
          {detectedMarketplaceLane ? (
            <div className="mt-3 rounded-[var(--radius-md)] border border-[var(--ft-yellow)]/40 bg-[var(--ft-yellow-subtle)] p-4">
              <div className="flex gap-2 text-xs leading-5 text-[var(--ft-yellow)]">
                <ShieldCheck className="mt-0.5 size-4 shrink-0" />
                <span>
                  This sounds like <strong>{detectedMarketplaceLane.label.toLowerCase()}</strong> — to keep your
                  customer&apos;s payment protected, this ad has to link to a FlipTrybe listing instead of an
                  external link.
                </span>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <button
                  className={cn(
                    "flex items-center gap-2 rounded-[var(--radius-sm)] border p-3 text-left text-xs transition",
                    listingChoice === "have"
                      ? "border-[var(--ft-accent)] bg-[var(--ft-accent-subtle)]"
                      : "border-[var(--ft-border)] bg-[var(--ft-bg-surface)] hover:border-[var(--ft-accent)]"
                  )}
                  onClick={() => setListingChoice("have")}
                  type="button"
                >
                  <Link2 className="size-4 shrink-0 text-[var(--ft-accent)]" />
                  <span>
                    <span className="block font-semibold text-[var(--ft-text-primary)]">I already have a listing</span>
                    <span className="text-[var(--ft-text-secondary)]">Paste its FlipTrybe link below</span>
                  </span>
                </button>
                <a
                  className={cn(
                    "flex items-center gap-2 rounded-[var(--radius-sm)] border p-3 text-left text-xs transition",
                    listingChoice === "need"
                      ? "border-[var(--ft-accent)] bg-[var(--ft-accent-subtle)]"
                      : "border-[var(--ft-border)] bg-[var(--ft-bg-surface)] hover:border-[var(--ft-accent)]"
                  )}
                  href={buildFliptrybeListingCreateUrl(detectedMarketplaceLane)}
                  onClick={() => setListingChoice("need")}
                  rel="noreferrer"
                  target="_blank"
                >
                  <ExternalLink className="size-4 shrink-0 text-[var(--ft-accent)]" />
                  <span>
                    <span className="block font-semibold text-[var(--ft-text-primary)]">I don&apos;t have one yet</span>
                    <span className="text-[var(--ft-text-secondary)]">Create one on FlipTrybe (short signup)</span>
                  </span>
                </a>
              </div>
              {listingChoice === "need" ? (
                <p className="mt-3 text-xs text-[var(--ft-text-secondary)]">
                  Once your listing is live, come back and paste its link below to finish this campaign.
                </p>
              ) : null}
            </div>
          ) : null}
        </Panel>

        <Panel className="p-5">
          <label className="text-sm font-medium text-[var(--ft-text-primary)]" htmlFor="studio-link">
            {detectedMarketplaceLane ? "Paste your FlipTrybe listing link" : "Paste your link"}
          </label>
          <p className="mt-1 text-xs text-[var(--ft-text-secondary)]">
            {detectedMarketplaceLane
              ? "e.g. https://fliptrybe.store/listings/... — this is where the ad sends customers to book and pay, protected by FlipTrybe."
              : "Your TikTok video, Instagram Reel, WhatsApp number, or website — wherever you want customers to go."}
          </p>
          <input
            className="mt-3 h-11 w-full rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-3 text-sm text-[var(--ft-text-primary)] outline-none focus:border-[var(--ft-accent)]"
            id="studio-link"
            onChange={(event) => setLink(event.target.value)}
            placeholder={
              detectedMarketplaceLane ? "https://fliptrybe.store/listings/..." : "https://wa.me/234... or https://instagram.com/..."
            }
            type="url"
            value={link}
          />
        </Panel>

        <Panel className="p-5">
          <label className="text-sm font-medium text-[var(--ft-text-primary)]" htmlFor="studio-city">
            Where do you sell? <span className="text-[var(--ft-text-muted)]">(optional)</span>
          </label>
          <input
            className="mt-3 h-11 w-full rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-3 text-sm text-[var(--ft-text-primary)] outline-none focus:border-[var(--ft-accent)]"
            id="studio-city"
            onChange={(event) => setCity(event.target.value)}
            placeholder="Lagos, Abuja, Nigeria..."
            type="text"
            value={city}
          />
        </Panel>

        <Panel className="p-5">
          <div className="text-sm font-medium text-[var(--ft-text-primary)]">Budget</div>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {budgetPresetsMinor.map((amount) => (
              <button
                className={cn(
                  "h-11 rounded-[var(--radius-sm)] border text-sm font-semibold transition",
                  budgetPresetMinor === amount && !customBudget
                    ? "border-[var(--ft-accent)] bg-[var(--ft-accent-subtle)] text-[var(--ft-accent)]"
                    : "border-[var(--ft-border)] bg-[var(--ft-bg-surface)] text-[var(--ft-text-primary)] hover:border-[var(--ft-accent)]"
                )}
                key={amount}
                onClick={() => handleBudgetPreset(amount)}
                type="button"
              >
                {formatPresetLabel(amount)}
              </button>
            ))}
          </div>
          <div className="mt-3">
            <input
              className="h-11 w-full rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-3 text-sm text-[var(--ft-text-primary)] outline-none focus:border-[var(--ft-accent)] sm:w-56"
              onChange={(event) => handleCustomBudgetChange(event.target.value)}
              placeholder="Or enter a custom amount"
              type="text"
              value={customBudget}
            />
          </div>
        </Panel>

        <div className="flex justify-end">
          <Button disabled={!canSubmit || submitting || sessionLoading} type="submit">
            <Rocket className="size-4 stroke-[1.5]" />
            {submitting ? "Launching..." : "Launch"}
          </Button>
        </div>
      </form>
    </>
  );
}
