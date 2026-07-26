"use client";

import { type FormEvent, useState } from "react";
import {
  MessageCircle,
  Globe,
  PlayCircle,
  Phone,
  Users,
  ShoppingBag,
  ArrowRight,
  CheckCircle2,
  Rocket
} from "lucide-react";

import { Badge, Button, Panel, cn } from "@fliptrybe/ui";

import {
  amountToMinor,
  createCampaignFromWizard,
  formatCampaignMoney,
  type CreateCampaignFromWizardResult,
  type StudioGoal
} from "../campaigns/api";
import { CampaignShell, ErrorNotice } from "../campaigns/components";
import { useApiSession } from "../lib/use-session";
import { ApiClientError } from "../lib/api-client";

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

function formatPresetLabel(amountMinor: number) {
  return `NGN ${(amountMinor / 100).toLocaleString()}`;
}

export default function StudioPage() {
  const { loading: sessionLoading } = useApiSession();
  const [goal, setGoal] = useState<StudioGoal>();
  const [link, setLink] = useState("");
  const [city, setCity] = useState("");
  const [budgetPresetMinor, setBudgetPresetMinor] = useState<number>();
  const [customBudget, setCustomBudget] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string>();
  const [result, setResult] = useState<CreateCampaignFromWizardResult>();

  const budgetMinor = customBudget ? amountToMinor(customBudget) : (budgetPresetMinor ?? 0);
  const canSubmit = Boolean(goal) && link.trim().length > 0 && budgetMinor > 0;

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
        ...(city.trim() ? { city: city.trim() } : {})
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
    setCity("");
    setBudgetPresetMinor(undefined);
    setCustomBudget("");
    setFormError(undefined);
  }

  if (result) {
    return (
      <CampaignShell active="/studio">
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
            <a
              className="inline-flex h-10 items-center justify-center gap-2 rounded-[var(--radius-sm)] border border-transparent bg-[var(--ft-accent)] px-5 text-sm font-semibold text-[var(--ft-bg-base)] transition hover:bg-[var(--ft-accent-dim)]"
              href={`/campaigns/${result.campaign.id}`}
            >
              View campaign
              <ArrowRight className="size-4 stroke-[1.5]" />
            </a>
            <Button onClick={handleStartAnother} variant="secondary">
              Boost something else
            </Button>
          </div>
        </Panel>
      </CampaignShell>
    );
  }

  return (
    <CampaignShell active="/studio">
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
          <label className="text-sm font-medium text-[var(--ft-text-primary)]" htmlFor="studio-link">
            Paste your link
          </label>
          <p className="mt-1 text-xs text-[var(--ft-text-secondary)]">
            Your TikTok video, Instagram Reel, WhatsApp number, or website — wherever you want customers to go.
          </p>
          <input
            className="mt-3 h-11 w-full rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-3 text-sm text-[var(--ft-text-primary)] outline-none focus:border-[var(--ft-accent)]"
            id="studio-link"
            onChange={(event) => setLink(event.target.value)}
            placeholder="https://wa.me/234... or https://instagram.com/..."
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
    </CampaignShell>
  );
}
