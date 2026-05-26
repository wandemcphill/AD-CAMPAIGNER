"use client";

import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Calculator,
  CalendarDays,
  Check,
  CheckCircle2,
  CircleDot,
  ClipboardList,
  FileText,
  LinkIcon,
  Megaphone,
  RefreshCw,
  Rocket,
  ShieldCheck,
  Sparkles,
  Target,
  UploadCloud,
  Users,
  WalletCards
} from "lucide-react";

import {
  Badge,
  Button,
  Panel,
  PlatformChip,
  PlatformSelectCard,
  UploadZone as SharedUploadZone,
  WizardStepBar,
  cn
} from "@fliptrybe/ui";
import type { Campaign, CampaignObjective, CurrencyCode, DestinationKind } from "@fliptrybe/types";

import { amountToMinor, createCampaign, formatCampaignMoney } from "../api";
import {
  CampaignShell,
  EmptyState,
  ErrorNotice,
  LoadingBlock,
  PageHeader,
  SourceBadge,
  StatusBadge,
  linkButtonClass,
  secondaryLinkButtonClass
} from "../components";
import { destinationLabels, objectiveLabels, objectiveOptions } from "../data";
import { useCampaignBuilderData } from "../use-campaign-dashboard-data";
import { useApiSession } from "../../lib/use-session";

type CampaignFormState = {
  ageRange: string;
  budget: string;
  cta: string;
  currency: CurrencyCode;
  destinationKind: DestinationKind;
  destinationUrl: string;
  endDate: string;
  gender: string;
  headline: string;
  interests: string;
  keyMessage: string;
  language: string;
  name: string;
  objective: CampaignObjective;
  placement: string;
  primaryCopy: string;
  promotion: string;
  startDate: string;
  targetRegion: string;
};

const builderSteps = [
  {
    description: "Tell the team what you sell, where traffic should go, and what success looks like.",
    label: "Campaign Basics",
    title: "Brief us on the outcome"
  },
  {
    description: "Share directional audience signals so specialists can refine targeting inside each ad platform.",
    label: "Audience & Targeting",
    title: "Define who we should reach"
  },
  {
    description: "Choose the first destination and note any placement preference for the launch plan.",
    label: "Platforms & Placement",
    title: "Pick where the campaign should run"
  },
  {
    description: "Set the funding range, flight dates, and daily pacing expectation for invoice review.",
    label: "Budget & Flight",
    title: "Plan the spend"
  },
  {
    description: "Upload source assets and approve the handoff details before the team review starts.",
    label: "Creative Handoff",
    title: "Send the brief to the team"
  }
] as const;

const stepGuidance = [
  {
    body: "Clear briefs reduce back-and-forth. Lead with the offer, the landing destination, and the business outcome you want the campaign team to optimize for.",
    icon: FileText,
    points: ["One primary offer", "A working destination link", "Success metric in plain language"],
    title: "Managed brief standard"
  },
  {
    body: "Audience notes should be directional, not overbuilt. The specialist will translate this into platform-ready targeting and exclusions.",
    icon: Users,
    points: ["Core geography and age range", "Interest or buyer signals", "Language and audience sensitivity notes"],
    title: "Audience signals"
  },
  {
    body: "Pick the channel that best matches the asset and buying intent. The team can still adjust placement after reviewing the creative.",
    icon: Target,
    points: ["Destination that should receive traffic", "Preferred content format", "Any placement you want avoided"],
    title: "Channel fit"
  },
  {
    body: "Wallet funding stays separate from campaign approval. Your invoice will confirm the budget hold, service context, and any launch requirements.",
    icon: WalletCards,
    points: ["Total media budget", "Flight dates", "Estimated daily pacing"],
    title: "Funding context"
  },
  {
    body: "Upload the strongest raw material available. Operators can adapt creative, but clean source assets make launch faster.",
    icon: UploadCloud,
    points: ["Product or service visuals", "Short caption and CTA", "Backup creative for testing"],
    title: "Creative handoff"
  }
] as const;

const budgetPresets = [
  { label: "NGN 50k", value: "50000" },
  { label: "NGN 100k", value: "100000" },
  { label: "NGN 250k", value: "250000" },
  { label: "NGN 500k", value: "500000" }
];

const profileGateSteps = [
  {
    body: "Company, industry, and brand links tell the team what they are promoting.",
    icon: FileText,
    label: "Business context"
  },
  {
    body: "Billing details let us issue a campaign-linked invoice with the right service period.",
    icon: WalletCards,
    label: "Invoice readiness"
  },
  {
    body: "Once complete, your brief can move straight into review and operator handoff.",
    icon: Rocket,
    label: "Campaign unlock"
  }
] as const;

const ctaOptions = ["Shop Now", "Learn More", "Sign Up", "Download", "Book Now", "Contact Us"];

const inputClass =
  "h-11 rounded-[var(--radius-sm)] border border-[var(--ft-border-strong)] bg-[var(--ft-bg-muted)] px-4 text-[var(--ft-text-primary)] outline-none transition placeholder:text-[var(--ft-text-muted)] focus:border-[var(--ft-accent)] focus:ring-0";

const textareaClass =
  "min-h-28 rounded-[var(--radius-sm)] border border-[var(--ft-border-strong)] bg-[var(--ft-bg-muted)] px-4 py-3 text-[var(--ft-text-primary)] outline-none transition placeholder:text-[var(--ft-text-muted)] focus:border-[var(--ft-accent)] focus:ring-0";

const labelClass = "grid gap-1.5 text-xs font-medium text-[var(--ft-text-secondary)]";
const helperClass = "text-xs leading-5 text-[var(--ft-text-muted)]";
const lastStepIndex = builderSteps.length - 1;
const wizardStepStorageKey = "fliptrybe:campaign-intake-step";
const acceptedUploadTypes = [".pdf", ".png", ".jpg", ".jpeg", ".mp4", ".mov", ".zip"];
const acceptedUploadMimeTypes = new Set([
  "application/pdf",
  "application/zip",
  "image/jpeg",
  "image/png",
  "video/mp4",
  "video/quicktime"
]);
const maxUploadBytes = 50 * 1024 * 1024;

function dateInputFromToday(offsetDays: number) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function createInitialForm(): CampaignFormState {
  return {
    ageRange: "18-44",
    budget: "250000",
    cta: "Learn More",
    currency: "NGN",
    destinationKind: "INSTAGRAM_REEL",
    destinationUrl: "https://instagram.com/fliptrybe",
    endDate: dateInputFromToday(17),
    gender: "All",
    headline: "Discover Fliptrybe",
    interests: "Small business, creators, online shopping",
    keyMessage: "Launch faster with a team that handles the ad operations.",
    language: "English",
    name: "Creator growth sprint",
    objective: "ENGAGEMENT",
    placement: "Any recommended placement",
    primaryCopy: "Tell us what you want to promote. We handle strategy, setup, and reporting.",
    promotion: "A focused campaign to grow reach and engagement for Fliptrybe's creator services.",
    startDate: dateInputFromToday(3),
    targetRegion: "Nigeria"
  };
}

function storedWizardStep() {
  if (typeof window === "undefined") {
    return 0;
  }

  const value = window.localStorage.getItem(wizardStepStorageKey);
  const parsed = value ? Number.parseInt(value, 10) : 0;

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.min(Math.max(parsed, 0), lastStepIndex);
}

function destinationPlatform(destinationKind: string) {
  if (destinationKind.startsWith("TIKTOK")) {
    return "TikTok";
  }
  if (destinationKind.startsWith("INSTAGRAM")) {
    return "Instagram";
  }
  if (destinationKind.startsWith("FACEBOOK")) {
    return "Facebook";
  }
  if (destinationKind.startsWith("WHATSAPP")) {
    return "WhatsApp";
  }
  if (destinationKind.startsWith("YOUTUBE")) {
    return "YouTube";
  }
  if (destinationKind.startsWith("TELEGRAM")) {
    return "Telegram";
  }

  return "Web";
}

function objectiveHint(objective: CampaignObjective) {
  const hints: Record<CampaignObjective, string> = {
    APP_INSTALLS: "Drive installs and first opens for an app.",
    AWARENESS: "Introduce the offer to a fresh audience.",
    ENGAGEMENT: "Build comments, saves, shares, and social proof.",
    FOLLOWERS: "Grow a profile or channel audience.",
    LEADS: "Capture prospects for follow-up.",
    LIVE_VIEWERS: "Bring viewers into a live moment.",
    SALES: "Push purchase intent around a product or offer.",
    TRAFFIC: "Move qualified people to the destination link."
  };

  return hints[objective];
}

function creativeZonesFor(destinationKind: DestinationKind) {
  if (destinationKind.startsWith("TIKTOK")) {
    return [
      {
        label: "TikTok Feed 9:16",
        spec: "MP4 or MOV, max 500MB, 1080x1920 recommended"
      },
      {
        label: "TikTok Cover Frame",
        spec: "JPG or PNG, max 10MB, clear product or creator frame"
      }
    ];
  }

  if (destinationKind.startsWith("INSTAGRAM") || destinationKind.startsWith("FACEBOOK")) {
    return [
      {
        label: "Meta Story/Reels 9:16",
        spec: "MP4, MOV, JPG, or PNG, 1080x1920 recommended"
      },
      {
        label: "Meta Feed 1:1",
        spec: "JPG, PNG, MP4, or MOV, 1080x1080 recommended"
      }
    ];
  }

  return [
    {
      label: "Primary Video or Image",
      spec: "MP4, MOV, JPG, or PNG, sized for the selected destination"
    },
    {
      label: "Backup Creative",
      spec: "Alternate image or short video for the team to adapt"
    }
  ];
}

function budgetAllocation(destinationKind: DestinationKind) {
  if (destinationKind.startsWith("TIKTOK")) {
    return [{ className: "bg-[var(--ft-accent)]", label: "TikTok", percentage: 100 }];
  }

  if (destinationKind.startsWith("INSTAGRAM") || destinationKind.startsWith("FACEBOOK")) {
    return [{ className: "bg-[var(--ft-accent)]", label: "Meta", percentage: 100 }];
  }

  if (
    destinationKind === "APP" ||
    destinationKind === "ECOMMERCE_STORE" ||
    destinationKind === "FLIPTRYBE_STORE" ||
    destinationKind === "WEBSITE"
  ) {
    return [
      { className: "bg-[var(--ft-accent)]", label: "Meta", percentage: 60 },
      { className: "bg-[var(--ft-green)]", label: "TikTok", percentage: 40 }
    ];
  }

  return [
    { className: "bg-[var(--ft-accent)]", label: "Meta", percentage: 50 },
    { className: "bg-[var(--ft-green)]", label: "TikTok", percentage: 50 }
  ];
}

function dateToTime(value: string) {
  const time = Date.parse(`${value}T00:00:00`);

  return Number.isNaN(time) ? undefined : time;
}

function campaignDurationDays(startDate: string, endDate: string) {
  const start = dateToTime(startDate);
  const end = dateToTime(endDate);

  if (start === undefined || end === undefined || end < start) {
    return undefined;
  }

  return Math.floor((end - start) / 86_400_000) + 1;
}

function toCreatePayload(form: CampaignFormState) {
  const destinationUrl = form.destinationUrl.trim();
  const name = form.name.trim();
  const brief = [
    form.promotion.trim(),
    form.keyMessage.trim() ? `Key message: ${form.keyMessage.trim()}` : "",
    form.headline.trim() ? `Headline: ${form.headline.trim()}` : "",
    form.primaryCopy.trim() ? `Primary copy: ${form.primaryCopy.trim()}` : "",
    form.cta.trim() ? `CTA: ${form.cta.trim()}` : ""
  ]
    .filter(Boolean)
    .join("\n\n");
  const targetingNotes = [
    form.ageRange.trim() ? `Age: ${form.ageRange.trim()}` : "",
    form.gender.trim() ? `Gender: ${form.gender.trim()}` : "",
    form.interests.trim() ? `Interests: ${form.interests.trim()}` : "",
    form.language.trim() ? `Language: ${form.language.trim()}` : ""
  ]
    .filter(Boolean)
    .join("; ");

  return {
    ...(name ? { name } : {}),
    objective: form.objective,
    budgetMinor: amountToMinor(form.budget),
    currency: form.currency,
    destinationKind: form.destinationKind,
    ...(destinationUrl ? { destinationUrl } : {}),
    ...(form.startDate ? { startsAt: `${form.startDate}T09:00:00.000+01:00` } : {}),
    ...(form.endDate ? { endsAt: `${form.endDate}T18:00:00.000+01:00` } : {}),
    ...(brief ? { brief } : {}),
    ...(form.targetRegion.trim() ? { targetCountry: form.targetRegion.trim() } : {}),
    ...(targetingNotes ? { targetingNotes } : {}),
    placementPlan: {
      creativeZones: creativeZonesFor(form.destinationKind).map((zone) => zone.label),
      preference: form.placement,
      proposedAllocation: budgetAllocation(form.destinationKind).map(({ label, percentage }) => ({
        label,
        percentage
      }))
    }
  };
}

function StepHeading({ activeStep }: { activeStep: number }) {
  const step = builderSteps[activeStep] ?? builderSteps[0];

  return (
    <div>
      <div className="font-mono text-xs font-medium uppercase tracking-[0.15em] text-[var(--ft-accent)]">
        Step {activeStep + 1} of {builderSteps.length}
      </div>
      <h2 className="mt-2 text-xl font-semibold text-[var(--ft-text-primary)]">{step.title}</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--ft-text-secondary)]">
        {step.description}
      </p>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 border-b border-[var(--ft-border)] py-3 last:border-b-0 sm:grid-cols-[160px_1fr] sm:gap-4">
      <dt className="text-sm text-[var(--ft-text-muted)]">{label}</dt>
      <dd className="text-sm font-medium text-[var(--ft-text-primary)]">{value || "Not provided"}</dd>
    </div>
  );
}

function UploadZone({ label, spec }: { label: string; spec: string }) {
  const [fileName, setFileName] = useState<string>();
  const [fileSize, setFileSize] = useState<string>();
  const [uploadError, setUploadError] = useState<string>();

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setUploadError(undefined);
    setFileName(undefined);
    setFileSize(undefined);

    if (!file) {
      return;
    }

    const extension = `.${file.name.split(".").pop()?.toLowerCase() ?? ""}`;
    if (!acceptedUploadMimeTypes.has(file.type) && !acceptedUploadTypes.includes(extension)) {
      setUploadError("That file type isn't supported. Upload PNG, JPG, PDF, MP4, MOV, or ZIP under 50MB.");
      event.target.value = "";
      return;
    }

    if (file.size > maxUploadBytes) {
      setUploadError("That file is too large. Maximum file size is 50MB.");
      event.target.value = "";
      return;
    }

    setFileName(file.name);
    setFileSize(`${(file.size / (1024 * 1024)).toFixed(1)} MB`);
  }

  return (
    <SharedUploadZone
      error={uploadError}
      hint={`${spec} Accepted: PDF, PNG, JPG, MP4, MOV, ZIP. Max 50MB per file.`}
      label={label}
    >
      <UploadCloud className="mx-auto mb-3 size-5 stroke-[1.5] text-[var(--ft-accent)]" />
      {fileName ? (
        <div className="flex items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-3 py-2 text-left">
          <span className="min-w-0 truncate text-sm text-[var(--ft-text-primary)]">{fileName}</span>
          <span className="shrink-0 font-mono text-[11px] uppercase tracking-[0.04em] text-[var(--ft-text-muted)]">
            {fileSize}
          </span>
        </div>
      ) : null}
      <label className="mx-auto mt-3 inline-flex h-10 w-fit cursor-pointer items-center justify-center rounded-[var(--radius-sm)] border border-[var(--ft-border-strong)] bg-transparent px-4 text-sm font-medium text-[var(--ft-text-primary)] transition hover:border-[var(--ft-accent)] hover:bg-[var(--ft-bg-surface)]">
        Upload Assets
        <input
          accept={acceptedUploadTypes.join(",")}
          className="sr-only"
          onChange={handleFileChange}
          type="file"
        />
      </label>
    </SharedUploadZone>
  );
}

export default function NewCampaignPage() {
  const { destinations, error, loading, refresh, source } = useCampaignBuilderData();
  const { loading: sessionLoading, session } = useApiSession();
  const [form, setForm] = useState<CampaignFormState>(() => createInitialForm());
  const [activeStep, setActiveStep] = useState(() => storedWizardStep());
  const [createdCampaign, setCreatedCampaign] = useState<Campaign>();
  const [formError, setFormError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const estimatedBudget = useMemo(
    () => ({ amountMinor: amountToMinor(form.budget), currency: form.currency }),
    [form.budget, form.currency]
  );
  const durationDays = useMemo(
    () => campaignDurationDays(form.startDate, form.endDate),
    [form.endDate, form.startDate]
  );
  const selectedPlatform = destinationPlatform(form.destinationKind);
  const selectedBudgetPreset = budgetPresets.some((preset) => preset.value === form.budget);
  const allocation = budgetAllocation(form.destinationKind);
  const activeStepMeta = builderSteps[activeStep] ?? builderSteps[0];
  const stepHelp = stepGuidance[activeStep] ?? stepGuidance[0];
  const StepHelpIcon = stepHelp.icon;
  const dailySpendMinor = durationDays ? Math.round(estimatedBudget.amountMinor / durationDays) : 0;
  const referenceId = createdCampaign?.providerReference ?? createdCampaign?.id;
  const businessProfileChecking = loading || sessionLoading;
  const businessProfileComplete = source === "api" && Boolean(session);
  const quotePathLabel = "Team-reviewed estimate path";

  useEffect(() => {
    window.localStorage.setItem(wizardStepStorageKey, String(activeStep));
  }, [activeStep]);

  function validateStep(stepIndex: number) {
    if (stepIndex === 0) {
      if (!form.name.trim()) {
        return "We need a campaign name to keep the team handoff clear.";
      }
      if (!form.promotion.trim()) {
        return "We need a short promotion summary before we can continue.";
      }
      if (!form.destinationUrl.trim()) {
        return "We need the landing URL to proceed.";
      }
    }

    if (stepIndex === 3) {
      if (!amountToMinor(form.budget)) {
        return "We need a budget greater than zero before we can continue.";
      }
      if (!durationDays) {
        return "Choose a valid start and end date so we can estimate daily spend.";
      }
    }

    return undefined;
  }

  function goToNextStep() {
    const validation = validateStep(activeStep);
    if (validation) {
      setFormError(validation);
      return;
    }

    setFormError(undefined);
    setActiveStep((current) => Math.min(current + 1, lastStepIndex));
  }

  function goToPreviousStep() {
    setFormError(undefined);
    setActiveStep((current) => Math.max(current - 1, 0));
  }

  async function submitCampaign() {
    setFormError(undefined);

    const firstInvalidStep = [0, 3].find((stepIndex) => validateStep(stepIndex));
    if (firstInvalidStep !== undefined) {
      setActiveStep(firstInvalidStep);
      setFormError(validateStep(firstInvalidStep));
      return;
    }

    setSubmitting(true);
    try {
      const payload = toCreatePayload(form);
      if (!payload.budgetMinor) {
        throw new Error("Budget must be greater than zero.");
      }
      const created = await createCampaign(payload);
      window.localStorage.removeItem(wizardStepStorageKey);
      setCreatedCampaign(created);
    } catch {
      setFormError("We could not send this brief right now. Your draft is still here, so try again in a moment.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (activeStep < lastStepIndex) {
      goToNextStep();
      return;
    }

    void submitCampaign();
  }

  function handleBriefAnotherCampaign() {
    setActiveStep(0);
    setCreatedCampaign(undefined);
    setForm(createInitialForm());
    setFormError(undefined);
    window.localStorage.setItem(wizardStepStorageKey, "0");
  }

  return (
    <CampaignShell active="/campaigns/new">
      <PageHeader
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button disabled={loading} onClick={() => void refresh()} variant="secondary">
              <RefreshCw className="size-4 stroke-[1.5]" />
              Refresh
            </Button>
            <a className={secondaryLinkButtonClass} href="/campaigns">
              Campaigns
              <ArrowRight className="size-4 stroke-[1.5]" />
            </a>
          </div>
        }
        eyebrow={
          <>
            <Badge tone="info">Campaign intake</Badge>
            <SourceBadge source={source} />
          </>
        }
        title="Brief us on your next campaign"
      />

      <ErrorNotice message={formError ?? error} />

      {!businessProfileComplete ? (
        <Panel className="mt-6 overflow-hidden border-[var(--ft-accent)]/35">
          <div className="grid gap-5 p-5 lg:grid-cols-[64px_minmax(0,1fr)_auto] lg:items-center">
            <div className="grid size-14 place-items-center rounded-[var(--radius-sm)] border border-[var(--ft-accent)]/35 bg-[var(--ft-accent-subtle)]">
              <ShieldCheck className="size-6 stroke-[1.5] text-[var(--ft-accent)]" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={businessProfileChecking ? "info" : "warning"}>
                  {businessProfileChecking ? "Checking profile" : "Profile required"}
                </Badge>
                <Badge tone="neutral">Takes about 3 minutes</Badge>
                <Badge tone="info">Secure handoff</Badge>
              </div>
              <h2 className="mt-3 text-xl font-medium text-[var(--ft-text-primary)]">
                Before you launch your first campaign, we need a few details about your business.
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--ft-text-secondary)]">
                Complete company, contact, destination, and billing context first. This helps our operators prepare
                your campaign plan, invoice the right business, and keep reviews moving without chasing basics.
              </p>
              <p className="mt-2 text-xs font-medium uppercase tracking-[0.08em] text-[var(--ft-accent)]">
                Add business info, contact, billing context, and brand links to unlock campaign submission.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
              <a className={linkButtonClass} href="/onboarding">
                Complete Business Profile
                <ArrowRight className="size-4 stroke-[1.5]" />
              </a>
              <a className={secondaryLinkButtonClass} href="/campaigns">
                Not now
              </a>
            </div>
          </div>
          <div className="grid border-t border-[var(--ft-border)] bg-[var(--ft-bg-muted)] md:grid-cols-3">
            {profileGateSteps.map((item, index) => (
              <div
                className={cn("p-4", index > 0 ? "border-t border-[var(--ft-border)] md:border-l md:border-t-0" : "")}
                key={item.label}
              >
                <div className="flex items-center gap-3">
                  <div className="grid size-9 place-items-center rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] text-[var(--ft-accent)]">
                    <item.icon className="size-4 stroke-[1.5]" />
                  </div>
                  <div className="font-medium text-[var(--ft-text-primary)]">{item.label}</div>
                </div>
                <p className="mt-3 text-sm leading-6 text-[var(--ft-text-secondary)]">{item.body}</p>
              </div>
            ))}
          </div>
        </Panel>
      ) : null}

      {businessProfileComplete ? (
      <section className="mt-6 grid gap-4 xl:grid-cols-[240px_minmax(0,1fr)_340px]">
        <div className="xl:col-span-3">
          <WizardStepBar current={createdCampaign ? builderSteps.length : activeStep} steps={builderSteps.map((step) => step.label)} />
        </div>
        <aside className="hidden xl:block">
          <div className="sticky top-20 min-h-[520px] border-l border-[var(--ft-border)] bg-[var(--ft-bg-surface)] py-4">
            <div className="px-4 pb-4">
              <div className="font-mono text-[11px] font-medium uppercase tracking-[0.15em] text-[var(--ft-text-muted)]">
                Client brief
              </div>
              <p className="mt-2 text-sm leading-6 text-[var(--ft-text-secondary)]">
                Tell us what to promote. Our team reviews, plans, and launches the campaign.
              </p>
            </div>
            <div className="grid">
              {builderSteps.map((step, index) => {
                const completed = Boolean(createdCampaign) || index < activeStep;
                const current = !createdCampaign && index === activeStep;

                return (
                  <button
                    className={cn(
                      "grid grid-cols-[28px_1fr] gap-3 border-l-2 px-4 py-3 text-left transition",
                      completed
                        ? "border-l-transparent text-[var(--ft-text-primary)]"
                        : "border-l-transparent text-[var(--ft-text-muted)]",
                      current &&
                        "border-l-[var(--ft-accent)] bg-[var(--ft-accent-subtle)] text-[var(--ft-text-primary)]"
                    )}
                    key={step.label}
                    onClick={() => {
                      setFormError(undefined);
                      setActiveStep(index);
                    }}
                    type="button"
                  >
                    <span
                      className={cn(
                        "mt-0.5 grid size-7 place-items-center rounded-[var(--radius-sm)] border font-mono text-[11px]",
                        completed
                          ? "border-[var(--ft-accent)] bg-[var(--ft-accent)] text-[var(--ft-bg-base)]"
                          : current
                            ? "border-[var(--ft-accent)] text-[var(--ft-accent)]"
                            : "border-[var(--ft-border)] bg-[var(--ft-bg-muted)] text-[var(--ft-text-muted)]"
                      )}
                    >
                      {completed ? <Check className="size-4 stroke-[2]" /> : index + 1}
                    </span>
                    <span>
                      <span className={cn("block text-sm", current ? "font-semibold" : "font-medium")}>
                        {step.label}
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-[var(--ft-text-muted)]">
                        {step.description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        <div className="xl:hidden">
          <div className="rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-mono text-[11px] uppercase tracking-[0.15em] text-[var(--ft-accent)]">
                  Step {activeStep + 1} of {builderSteps.length}
                </div>
                <div className="mt-1 text-sm font-semibold text-[var(--ft-text-primary)]">
                  {activeStepMeta.label}
                </div>
              </div>
              <div className="flex gap-1.5">
                {builderSteps.map((step, index) => (
                  <span
                    className={cn(
                      "block size-2 rounded-full",
                      index <= activeStep || createdCampaign
                        ? "bg-[var(--ft-accent)]"
                        : "bg-[var(--ft-border-strong)]"
                    )}
                    key={step.label}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        <Panel className="overflow-hidden bg-[var(--ft-bg-surface)]">
          {createdCampaign ? (
            <div className="grid gap-6 p-5">
              <div className="flex items-start justify-between gap-4 border-b border-[var(--ft-border)] pb-5">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--ft-green)]/40 bg-[var(--ft-green-subtle)] px-2 py-1 font-mono text-[11px] uppercase tracking-[0.04em] text-[var(--ft-green)]">
                    <CheckCircle2 className="size-4 stroke-[1.5]" />
                    Brief received
                  </div>
                  <h2 className="mt-4 text-2xl font-semibold text-[var(--ft-text-primary)]">
                    Our team has your campaign brief.
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--ft-text-secondary)]">
                    Brief sent. Your campaign is now in review with the Fliptrybe team. We'll confirm your campaign plan within 1 business day and send you an invoice to fund your campaign.
                  </p>
                </div>
                <Rocket className="hidden size-6 stroke-[1.5] text-[var(--ft-accent)] sm:block" />
              </div>

              <div className="grid gap-4 lg:grid-cols-[1fr_0.75fr]">
                <div className="rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] p-4">
                  <div className="font-mono text-[11px] uppercase tracking-[0.15em] text-[var(--ft-text-muted)]">
                    Reference ID
                  </div>
                  <div className="mt-2 break-all font-mono text-xl text-[var(--ft-text-primary)]">
                    {referenceId}
                  </div>
                  <div className="mt-5 grid gap-3 text-sm">
                    <div className="flex justify-between gap-3">
                      <span className="text-[var(--ft-text-secondary)]">Campaign</span>
                      <span className="text-right font-medium text-[var(--ft-text-primary)]">
                        {createdCampaign.name}
                      </span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-[var(--ft-text-secondary)]">Budget</span>
                      <span className="font-mono text-[var(--ft-text-primary)]">
                        {formatCampaignMoney(createdCampaign.budget)}
                      </span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-[var(--ft-text-secondary)]">Current status</span>
                      <StatusBadge status={createdCampaign.status} />
                    </div>
                  </div>
                </div>

                <div className="rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] p-4">
                  <div className="font-mono text-[11px] uppercase tracking-[0.15em] text-[var(--ft-text-muted)]">
                    Expected timeline
                  </div>
                  <div className="mt-4 grid gap-4">
                    {[
                      {
                        detail: "Your reference ID is ready for tracking.",
                        label: "Submission received",
                        state: "done"
                      },
                      {
                        detail: "The team checks objective, budget, targeting, and assets.",
                        label: "Team review",
                        state: "current"
                      },
                      {
                        detail: "Setup and launch usually follow in 1-3 business days once clear.",
                        label: "Setup and launch",
                        state: "upcoming"
                      }
                    ].map((item) => (
                      <div className="grid grid-cols-[20px_1fr] gap-3" key={item.label}>
                        <span
                          className={cn(
                            "mt-1 grid size-5 place-items-center rounded-full border",
                            item.state === "done"
                              ? "border-[var(--ft-green)] bg-[var(--ft-green)] text-[var(--ft-bg-base)]"
                              : item.state === "current"
                                ? "border-[var(--ft-accent)] bg-[var(--ft-accent)] text-[var(--ft-bg-base)]"
                                : "border-[var(--ft-border-strong)] bg-[var(--ft-bg-surface)]"
                          )}
                        >
                          {item.state === "done" ? <Check className="size-3.5 stroke-[2]" /> : null}
                        </span>
                        <span>
                          <span className="block text-sm font-medium text-[var(--ft-text-primary)]">
                            {item.label}
                          </span>
                          <span className="mt-1 block text-xs leading-5 text-[var(--ft-text-secondary)]">
                            {item.detail}
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 border-t border-[var(--ft-border)] pt-5 sm:flex-row sm:items-center sm:justify-between">
                <button
                  className="text-left text-sm font-medium text-[var(--ft-text-secondary)] hover:text-[var(--ft-text-primary)]"
                  onClick={handleBriefAnotherCampaign}
                  type="button"
                >
                  Brief another campaign
                </button>
                <a className={linkButtonClass} href={`/campaigns/${createdCampaign.id}`}>
                  View Campaign Status
                  <ArrowRight className="size-4 stroke-[1.5]" />
                </a>
              </div>
            </div>
          ) : (
            <form className="grid" onSubmit={handleSubmit}>
              <div className="border-b border-[var(--ft-border)] p-5">
                  <StepHeading activeStep={activeStep} />
                  <div className="mt-4 grid gap-2 sm:grid-cols-3">
                    {["Strategy review", "Invoice check", "Operator launch"].map((item) => (
                      <div
                        className="flex items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 py-2 text-xs font-medium text-[var(--ft-text-secondary)]"
                        key={item}
                      >
                        <CheckCircle2 className="size-4 shrink-0 stroke-[1.5] text-[var(--ft-green)]" />
                        {item}
                      </div>
                    ))}
                  </div>
                </div>

              <div className="min-h-[520px] p-5">
                {activeStep === 0 ? (
                  <section className="grid gap-5">
                    <div className="grid gap-4 lg:grid-cols-2">
                      <label className={labelClass}>
                        Campaign name
                        <input
                          className={inputClass}
                          onChange={(event) =>
                            setForm((current) => ({ ...current, name: event.target.value }))
                          }
                          value={form.name}
                        />
                      </label>
                      <label className={labelClass}>
                        Landing URL
                        <span className="flex h-11 items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--ft-border-strong)] bg-[var(--ft-bg-muted)] px-4 focus-within:border-[var(--ft-accent)]">
                          <LinkIcon className="size-4 shrink-0 stroke-[1.5] text-[var(--ft-text-muted)]" />
                          <input
                            className="min-w-0 flex-1 bg-transparent text-[var(--ft-text-primary)] outline-none"
                            onChange={(event) =>
                              setForm((current) => ({ ...current, destinationUrl: event.target.value }))
                            }
                            value={form.destinationUrl}
                          />
                        </span>
                      </label>
                    </div>

                    <div>
                      <div className="mb-2 text-xs font-medium text-[var(--ft-text-secondary)]">
                        Campaign objective
                      </div>
                      <div className="grid gap-2 lg:grid-cols-2">
                        {objectiveOptions.map((objective) => (
                          <button
                            className={cn(
                              "grid min-h-20 grid-cols-[auto_1fr_auto] items-center gap-3 rounded-[var(--radius-sm)] border px-3 py-3 text-left transition",
                              form.objective === objective
                                ? "border-[var(--ft-accent)] bg-[var(--ft-accent-subtle)]"
                                : "border-[var(--ft-border)] bg-[var(--ft-bg-muted)] hover:border-[var(--ft-border-strong)]"
                            )}
                            key={objective}
                            onClick={() =>
                              setForm((current) => ({
                                ...current,
                                objective
                              }))
                            }
                            type="button"
                          >
                            <CircleDot className="size-5 stroke-[1.5] text-[var(--ft-accent)]" />
                            <span>
                              <span className="block text-sm font-medium text-[var(--ft-text-primary)]">
                                {objectiveLabels[objective]}
                              </span>
                              <span className="mt-1 block text-xs leading-5 text-[var(--ft-text-secondary)]">
                                {objectiveHint(objective)}
                              </span>
                            </span>
                            <span
                              className={cn(
                                "size-3 rounded-full border",
                                form.objective === objective
                                  ? "border-[var(--ft-accent)] bg-[var(--ft-accent)]"
                                  : "border-[var(--ft-border-strong)]"
                              )}
                            />
                          </button>
                        ))}
                      </div>
                    </div>

                    <label className={labelClass}>
                      What are you promoting?
                      <textarea
                        className={textareaClass}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, promotion: event.target.value }))
                        }
                        value={form.promotion}
                      />
                    </label>
                    <label className={labelClass}>
                      Key message or tagline
                      <input
                        className={inputClass}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, keyMessage: event.target.value }))
                        }
                        value={form.keyMessage}
                      />
                    </label>
                  </section>
                ) : null}

                {activeStep === 1 ? (
                  <section className="grid gap-5">
                    <div className="grid gap-4 lg:grid-cols-2">
                      <label className={labelClass}>
                        Primary target country or region
                        <input
                          className={inputClass}
                          onChange={(event) =>
                            setForm((current) => ({ ...current, targetRegion: event.target.value }))
                          }
                          value={form.targetRegion}
                        />
                      </label>
                      <label className={labelClass}>
                        Age range
                        <input
                          className={inputClass}
                          onChange={(event) =>
                            setForm((current) => ({ ...current, ageRange: event.target.value }))
                          }
                          value={form.ageRange}
                        />
                      </label>
                      <label className={labelClass}>
                        Gender
                        <select
                          className={inputClass}
                          onChange={(event) =>
                            setForm((current) => ({ ...current, gender: event.target.value }))
                          }
                          value={form.gender}
                        >
                          {["All", "Male", "Female", "Non-binary-inclusive"].map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className={labelClass}>
                        Language targeting
                        <input
                          className={inputClass}
                          onChange={(event) =>
                            setForm((current) => ({ ...current, language: event.target.value }))
                          }
                          value={form.language}
                        />
                      </label>
                    </div>
                    <label className={labelClass}>
                      Interest signals
                      <textarea
                        className={textareaClass}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, interests: event.target.value }))
                        }
                        value={form.interests}
                      />
                    </label>
                    <div className="rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] p-4">
                      <div className="flex items-center gap-2 text-sm font-medium text-[var(--ft-text-primary)]">
                        <Users className="size-4 stroke-[1.5] text-[var(--ft-accent)]" />
                        Audience guidance
                      </div>
                      <p className="mt-2 text-sm leading-6 text-[var(--ft-text-secondary)]">
                        Keep targeting directional. Fliptrybe specialists will refine the final audience inside TikTok and Meta Ads Manager.
                      </p>
                    </div>
                  </section>
                ) : null}

                {activeStep === 2 ? (
                  <section className="grid gap-5">
                    <div>
                      <div className="mb-2 text-xs font-medium text-[var(--ft-text-secondary)]">
                        Destination
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2 2xl:grid-cols-3">
                        {loading ? (
                          <div className="sm:col-span-2 2xl:col-span-3">
                            <LoadingBlock label="Loading destinations" />
                          </div>
                        ) : destinations.length === 0 ? (
                          <div className="sm:col-span-2 2xl:col-span-3">
                            <EmptyState
                              copy="The destination catalog is empty."
                              icon={Rocket}
                              title="No destinations"
                            />
                          </div>
                        ) : (
                          destinations.map((destination) => (
                            <button
                              className="text-left"
                              key={destination}
                              onClick={() =>
                                setForm((current) => ({ ...current, destinationKind: destination }))
                              }
                              type="button"
                            >
                              <PlatformSelectCard
                                checked={form.destinationKind === destination}
                                description={destinationLabels[destination]}
                                platform={destinationPlatform(destination)}
                              />
                            </button>
                          ))
                        )}
                      </div>
                    </div>

                    <label className={labelClass}>
                      Placement preference
                      <select
                        className={inputClass}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, placement: event.target.value }))
                        }
                        value={form.placement}
                      >
                        {[
                          "Any recommended placement",
                          "Feed",
                          "Stories",
                          "Reels",
                          "In-feed video",
                          "Live promotion"
                        ].map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="grid gap-3 lg:grid-cols-2">
                      <div className="rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] p-4">
                        <div className="flex items-center gap-2 text-sm font-medium text-[var(--ft-text-primary)]">
                          <Target className="size-4 stroke-[1.5] text-[var(--ft-accent)]" />
                          TikTok
                        </div>
                        <p className="mt-2 text-sm leading-6 text-[var(--ft-text-secondary)]">
                          Best for short video, creator-led product discovery, and fast awareness.
                        </p>
                      </div>
                      <div className="rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] p-4">
                        <div className="flex items-center gap-2 text-sm font-medium text-[var(--ft-text-primary)]">
                          <Target className="size-4 stroke-[1.5] text-[var(--ft-accent)]" />
                          Meta
                        </div>
                        <p className="mt-2 text-sm leading-6 text-[var(--ft-text-secondary)]">
                          Strong for Instagram and Facebook reach, retargeting, and traffic campaigns.
                        </p>
                      </div>
                    </div>
                  </section>
                ) : null}

                {activeStep === 3 ? (
                  <section className="grid gap-5">
                    <div className="rounded-[var(--radius-sm)] border border-[var(--ft-accent)]/40 bg-[var(--ft-accent-subtle)] p-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-[var(--ft-text-primary)]">
                        <WalletCards className="size-4 stroke-[1.5] text-[var(--ft-accent)]" />
                        Budget guidance
                      </div>
                      <p className="mt-2 text-sm leading-6 text-[var(--ft-text-secondary)]">
                        Minimum NGN 50,000 is recommended for meaningful learning. Your team will confirm final media allocation and any management fee on the invoice.
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {budgetPresets.map((preset) => (
                        <button
                          className={cn(
                            "h-9 rounded-[var(--radius-sm)] border px-3 font-mono text-xs transition",
                            form.budget === preset.value
                              ? "border-[var(--ft-accent)] bg-[var(--ft-accent)] text-[var(--ft-bg-base)]"
                              : "border-[var(--ft-border)] bg-[var(--ft-bg-muted)] text-[var(--ft-text-secondary)] hover:border-[var(--ft-accent)]"
                          )}
                          key={preset.value}
                          onClick={() => setForm((current) => ({ ...current, budget: preset.value }))}
                          type="button"
                        >
                          {preset.label}
                        </button>
                      ))}
                      <span
                        className={cn(
                          "inline-flex h-9 items-center rounded-[var(--radius-sm)] border px-3 font-mono text-xs",
                          selectedBudgetPreset
                            ? "border-[var(--ft-border)] bg-[var(--ft-bg-muted)] text-[var(--ft-text-muted)]"
                            : "border-[var(--ft-accent)] bg-[var(--ft-accent-subtle)] text-[var(--ft-accent)]"
                        )}
                      >
                        Custom
                      </span>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-3">
                      <label className={labelClass}>
                        Total campaign budget
                        <input
                          className={`${inputClass} font-mono text-lg`}
                          inputMode="numeric"
                          onChange={(event) =>
                            setForm((current) => ({ ...current, budget: event.target.value }))
                          }
                          value={form.budget}
                        />
                      </label>
                      <label className={labelClass}>
                        Start date
                        <input
                          className={inputClass}
                          onChange={(event) =>
                            setForm((current) => ({ ...current, startDate: event.target.value }))
                          }
                          type="date"
                          value={form.startDate}
                        />
                      </label>
                      <label className={labelClass}>
                        End date
                        <input
                          className={inputClass}
                          onChange={(event) =>
                            setForm((current) => ({ ...current, endDate: event.target.value }))
                          }
                          type="date"
                          value={form.endDate}
                        />
                      </label>
                    </div>

                    <div className="grid gap-3 lg:grid-cols-3">
                      <div className="rounded-[var(--radius-sm)] bg-[var(--ft-bg-muted)] p-4">
                        <div className="font-mono text-[11px] uppercase tracking-[0.15em] text-[var(--ft-text-muted)]">
                          Duration
                        </div>
                        <div className="mt-2 font-mono text-2xl text-[var(--ft-text-primary)]">
                          {durationDays ? `${durationDays}d` : "Set dates"}
                        </div>
                      </div>
                      <div className="rounded-[var(--radius-sm)] bg-[var(--ft-bg-muted)] p-4">
                        <div className="font-mono text-[11px] uppercase tracking-[0.15em] text-[var(--ft-text-muted)]">
                          Daily spend est.
                        </div>
                        <div className="mt-2 font-mono text-2xl text-[var(--ft-text-primary)]">
                          {dailySpendMinor
                            ? formatCampaignMoney({
                                amountMinor: dailySpendMinor,
                                currency: form.currency
                              })
                            : "Set dates"}
                        </div>
                      </div>
                      <div
                        className="rounded-[var(--radius-sm)] border border-[var(--ft-border-strong)] bg-transparent p-4 text-left transition hover:bg-[var(--ft-bg-muted)]"
                      >
                        <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.15em] text-[var(--ft-text-muted)]">
                          <Calculator className="size-4 stroke-[1.5]" />
                          Estimate after review
                        </div>
                        <div className="mt-2 text-sm text-[var(--ft-text-primary)]">
                          Reach and CPM come with the campaign plan
                        </div>
                      </div>
                    </div>

                    <div className="rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-[var(--ft-text-primary)]">
                            Allocation guide
                          </div>
                          <p className={cn("mt-1", helperClass)}>
                            The ops team can adjust this split after review.
                          </p>
                        </div>
                        <CalendarDays className="size-5 stroke-[1.5] text-[var(--ft-accent)]" />
                      </div>
                      <div className="mt-4 flex h-3 overflow-hidden rounded-[var(--radius-sm)] bg-[var(--ft-bg-surface)]">
                        {allocation.map((item) => (
                          <div
                            className={item.className}
                            key={item.label}
                            style={{ width: `${item.percentage}%` }}
                          />
                        ))}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-3">
                        {allocation.map((item) => (
                          <span
                            className="font-mono text-[11px] uppercase tracking-[0.04em] text-[var(--ft-text-secondary)]"
                            key={item.label}
                          >
                            {item.label} {item.percentage}%
                          </span>
                        ))}
                      </div>
                    </div>
                  </section>
                ) : null}

                {activeStep === 4 ? (
                  <section className="grid gap-5">
                    <div className="rounded-[var(--radius-sm)] border border-[var(--ft-accent)]/35 bg-[var(--ft-accent-subtle)] p-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-[var(--ft-text-primary)]">
                        <ShieldCheck className="size-4 stroke-[1.5] text-[var(--ft-accent)]" />
                        Private creative handoff
                      </div>
                      <p className="mt-2 text-sm leading-6 text-[var(--ft-text-secondary)]">
                        Files are used only by the Fliptrybe campaign team for review, adaptation, and launch proof.
                        Upload source assets here, then the team will confirm what is approved before anything goes live.
                      </p>
                    </div>

                    <div className="grid gap-3 lg:grid-cols-2">
                      {creativeZonesFor(form.destinationKind).map((zone) => (
                        <UploadZone key={zone.label} label={zone.label} spec={zone.spec} />
                      ))}
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                      <label className={labelClass}>
                        Headline copy
                        <input
                          className={inputClass}
                          maxLength={40}
                          onChange={(event) =>
                            setForm((current) => ({ ...current, headline: event.target.value }))
                          }
                          value={form.headline}
                        />
                        <span className={helperClass}>Max 40 characters.</span>
                      </label>
                      <label className={labelClass}>
                        CTA button
                        <select
                          className={inputClass}
                          onChange={(event) =>
                            setForm((current) => ({ ...current, cta: event.target.value }))
                          }
                          value={form.cta}
                        >
                          {ctaOptions.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <label className={labelClass}>
                      Primary copy or caption
                      <textarea
                        className={textareaClass}
                        maxLength={125}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, primaryCopy: event.target.value }))
                        }
                        value={form.primaryCopy}
                      />
                      <span className={helperClass}>Max 125 characters.</span>
                    </label>

                    <div className="rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] p-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-[var(--ft-text-primary)]">
                        <ClipboardList className="size-4 stroke-[1.5] text-[var(--ft-accent)]" />
                        Brief review
                      </div>
                      <dl className="mt-3">
                        <ReviewRow label="Campaign" value={form.name} />
                        <ReviewRow label="Objective" value={objectiveLabels[form.objective]} />
                        <ReviewRow
                          label="Destination"
                          value={`${destinationLabels[form.destinationKind]} / ${form.destinationUrl}`}
                        />
                        <ReviewRow
                          label="Audience"
                          value={`${form.targetRegion}, ${form.ageRange}, ${form.gender}`}
                        />
                        <ReviewRow
                          label="Budget"
                          value={`${formatCampaignMoney(estimatedBudget)} over ${
                            durationDays ? `${durationDays} days` : "selected dates"
                          }`}
                        />
                        <ReviewRow
                          label="Flight"
                          value={`${form.startDate || "Start not set"} to ${form.endDate || "End not set"}`}
                        />
                        <ReviewRow label="Key message" value={form.keyMessage} />
                        <ReviewRow label="Placement" value={form.placement} />
                        <ReviewRow label="Creative CTA" value={form.cta} />
                        <ReviewRow
                          label="Asset handoff"
                          value="Creative files are attached for team review; proof screenshots will be added after launch."
                        />
                      </dl>
                    </div>
                  </section>
                ) : null}
              </div>

              <div className="sticky bottom-16 z-20 flex flex-col-reverse gap-3 border-t border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-4 shadow-[0_-10px_28px_rgba(0,0,0,0.18)] sm:flex-row sm:items-center sm:justify-between sm:p-5 md:bottom-0">
                <button
                  className={cn(
                    "h-10 text-left text-sm font-medium text-[var(--ft-text-secondary)] transition hover:text-[var(--ft-text-primary)] sm:h-auto",
                    activeStep === 0 && "hidden sm:invisible sm:block"
                  )}
                  onClick={goToPreviousStep}
                  type="button"
                >
                  Back
                </button>

                {activeStep < lastStepIndex ? (
                  <Button type="submit">
                    Continue
                    <ArrowRight className="size-4 stroke-[1.5]" />
                  </Button>
                ) : (
                  <Button disabled={submitting || loading} type="submit">
                    <Sparkles className="size-4 stroke-[1.5]" />
                    {submitting ? "Sending brief" : "Send Brief to Team"}
                  </Button>
                )}
              </div>
            </form>
          )}
        </Panel>

        <div className="grid content-start gap-4 xl:sticky xl:top-20">
          <Panel className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-medium text-[var(--ft-text-primary)]">Live brief preview</h2>
                <p className="mt-1 text-sm text-[var(--ft-text-secondary)]">
                  {quotePathLabel}
                </p>
              </div>
              <Megaphone className="size-5 stroke-[1.5] text-[var(--ft-accent)]" />
            </div>

            <div className="mt-5 border-y border-[var(--ft-border)] py-4">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={createdCampaign?.status ?? "DRAFT"} />
                <PlatformChip platform={selectedPlatform} />
              </div>
              <div className="mt-4 text-xl font-medium text-[var(--ft-text-primary)]">
                {form.name || "Untitled campaign"}
              </div>
              <div className="mt-2 text-sm text-[var(--ft-text-secondary)]">
                {objectiveLabels[form.objective]} / {destinationLabels[form.destinationKind]}
              </div>
            </div>

            <div className="divide-y divide-[var(--ft-border)] text-sm">
              <div className="flex items-center justify-between gap-3 py-3">
                <span className="text-[var(--ft-text-secondary)]">Budget</span>
                <span className="font-mono text-[var(--ft-text-primary)]">
                  {formatCampaignMoney(estimatedBudget)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 py-3">
                <span className="text-[var(--ft-text-secondary)]">Daily spend</span>
                <span className="font-mono text-[var(--ft-text-primary)]">
                  {dailySpendMinor
                    ? formatCampaignMoney({
                        amountMinor: dailySpendMinor,
                        currency: form.currency
                      })
                    : "Waiting on dates"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 py-3">
                <span className="text-[var(--ft-text-secondary)]">Reach</span>
                <span className="font-mono text-[var(--ft-text-primary)]">
                  Prepared after review
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 py-3">
                <span className="text-[var(--ft-text-secondary)]">Estimated CPM</span>
                <span className="font-mono text-[var(--ft-text-primary)]">
                  Prepared after review
                </span>
              </div>
            </div>
          </Panel>

          <Panel className="p-4">
            <div className="flex items-start gap-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)]">
                <StepHelpIcon className="size-5 stroke-[1.5] text-[var(--ft-accent)]" />
              </div>
              <div>
                <h2 className="text-base font-medium text-[var(--ft-text-primary)]">{stepHelp.title}</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--ft-text-secondary)]">{stepHelp.body}</p>
              </div>
            </div>
            <div className="mt-4 grid gap-2">
              {stepHelp.points.map((point) => (
                <div
                  className="flex items-start gap-2 border-t border-[var(--ft-border)] pt-2 text-sm text-[var(--ft-text-secondary)] first:border-t-0 first:pt-0"
                  key={point}
                >
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 stroke-[1.5] text-[var(--ft-green)]" />
                  <span>{point}</span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel className="p-4">
            <div className="flex items-center gap-2 font-medium text-[var(--ft-text-primary)]">
              <FileText className="size-5 stroke-[1.5] text-[var(--ft-accent)]" />
              Team handoff
            </div>
            <p className="mt-3 text-sm leading-6 text-[var(--ft-text-secondary)]">
              After submission, our team reviews the brief, confirms the assets, and prepares launch steps within 1 business day. No public launch begins until the plan and funding path are clear.
            </p>
          </Panel>
        </div>
      </section>
      ) : null}
    </CampaignShell>
  );
}
