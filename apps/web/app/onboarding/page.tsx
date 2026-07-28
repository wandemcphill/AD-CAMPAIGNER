"use client";

import { ArrowRight, CheckCircle2, PlugZap, RefreshCw, Rocket, ShieldCheck } from "lucide-react";

import { Badge, Button, MetricStrip, Panel, PlatformChip, cn } from "@fliptrybe/ui";

import {
  CampaignShell,
  EmptyState,
  ErrorNotice,
  LoadingBlock,
  PageHeader,
  SourceBadge,
  linkButtonClass,
  secondaryLinkButtonClass
} from "../campaigns/components";
import { destinationLabels, onboardingSteps } from "../campaigns/data";
import { useOnboardingData } from "../campaigns/use-campaign-dashboard-data";
import { useApiSession } from "../lib/use-session";

const onboardingStepCopy: Record<string, string> = {
  "Workspace session": "Sign in once and the platform creates the workspace session automatically.",
  Destinations: "Confirm the social, store, app, or website endpoints available for launch plans.",
  "Billing rail": "Prepare wallet and invoice context before budgets move into campaign holds.",
  "First campaign": "Submit a managed brief so operators can review, quote, and prepare launch.",
  "Provider check": "Check service health before relying on provider data for live operations."
};

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

export default function OnboardingPage() {
  const { destinations, error, health, loading, refresh, source } = useOnboardingData();
  const { loading: sessionLoading, session } = useApiSession();
  const providers = health ? Object.entries(health.providers) : [];

  function stepReady(label: string) {
    if (label === "Workspace session") {
      return Boolean(session);
    }
    if (label === "Destinations") {
      return destinations.length > 0;
    }
    if (label === "Provider check") {
      return Boolean(health);
    }

    return source === "api" || Boolean(session);
  }

  const stepStates = onboardingSteps.map((step) => ({
    ...step,
    ready: stepReady(step.label)
  }));
  const readySteps = stepStates.filter((step) => step.ready).length;

  return (
    <CampaignShell active="/onboarding">
      <PageHeader
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button className="w-full sm:w-auto" disabled={loading} onClick={() => void refresh()} variant="secondary">
              <RefreshCw className="size-4 stroke-[1.5]" />
              Refresh
            </Button>
            <a className={`${secondaryLinkButtonClass} w-full sm:w-auto`} href="/billing">
              Billing
            </a>
            <a className={`${linkButtonClass} w-full sm:w-auto`} href="/campaigns/new">
              <Rocket className="size-4 stroke-[1.5]" />
              New campaign
            </a>
          </div>
        }
        eyebrow={
          <>
            <Badge tone="info">Onboarding</Badge>
            <SourceBadge source={source} />
          </>
        }
        title="Business Setup"
      />

      <ErrorNotice message={error} />

      <section className="mt-6">
        <MetricStrip
          items={[
            {
              label: "Workspace",
              value: session ? "Ready" : sessionLoading ? "Checking" : "Signed out",
              detail: session?.workspace.name ?? "Sign in to create your workspace automatically"
            },
            {
              label: "Destinations",
              value: loading ? "..." : String(destinations.length),
              detail: "Available endpoints"
            },
            {
              label: "Providers",
              value: loading ? "..." : String(providers.length),
              detail: health?.service ?? "Campaign platform"
            },
            {
              label: "Readiness",
              value: `${readySteps}/${stepStates.length}`,
              detail: "Workspace checks"
            }
          ]}
        />
      </section>

      <section className="mt-4 grid gap-3 border-y border-[var(--ft-border)] py-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div>
          <h2 className="text-lg font-medium text-[var(--ft-text-primary)]">Managed services readiness</h2>
          <p className="mt-1 text-sm leading-6 text-[var(--ft-text-secondary)]">
            Complete the workspace, destination, billing, and provider checks before campaign operators begin launch work.
          </p>
        </div>
        <a
          className={`${secondaryLinkButtonClass} w-full sm:w-auto`}
          href={session ? (readySteps === stepStates.length ? "/campaigns/new" : "/billing") : "/login"}
        >
          {session
            ? readySteps === stepStates.length
              ? "Start campaign"
              : "Continue setup"
            : "Sign in"}
          <ArrowRight className="size-4 stroke-[1.5]" />
        </a>
      </section>

      <section className="mt-4 border-b border-[var(--ft-border)] pb-4">
        <div className="grid gap-2 sm:grid-cols-5">
          {stepStates.map((step, index) => (
            <div
              className="rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-3"
              key={step.label}
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "grid size-7 shrink-0 place-items-center rounded-[var(--radius-sm)] border font-mono text-[11px]",
                    step.ready
                      ? "border-[var(--ft-accent)] bg-[var(--ft-accent)] text-[var(--ft-bg-base)]"
                      : index === readySteps
                        ? "border-[var(--ft-yellow)] text-[var(--ft-yellow)]"
                        : "border-[var(--ft-border-strong)] text-[var(--ft-text-muted)]"
                  )}
                >
                  {step.ready ? <CheckCircle2 className="size-4 stroke-[1.5]" /> : index + 1}
                </span>
                <span className="min-w-0 truncate text-sm font-medium text-[var(--ft-text-primary)]">
                  {step.label}
                </span>
              </div>
              <span
                className={cn(
                  "mt-3 block h-1.5 rounded-full",
                  step.ready
                    ? "bg-[var(--ft-accent)]"
                    : index === readySteps
                      ? "bg-[var(--ft-yellow)]"
                      : "bg-[var(--ft-bg-muted)]"
                  )}
              />
            </div>
          ))}
        </div>
        <div className="mt-3 font-mono text-[11px] font-medium uppercase tracking-[0.04em] text-[var(--ft-text-muted)]">
          Setup progress / {readySteps} of {stepStates.length} ready
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {stepStates.map((step) => (
          <Panel className="p-4" key={step.label}>
            <div className="flex items-start justify-between gap-3">
              <step.icon
                className={cn(
                  "size-5 stroke-[1.5]",
                  step.ready ? "text-[var(--ft-green)]" : "text-[var(--ft-text-muted)]"
                )}
              />
                <Badge tone={step.ready ? "success" : "warning"}>
                {step.ready ? "Ready" : sessionLoading ? "Checking" : "Signed out"}
              </Badge>
            </div>
            <div className="mt-4 font-medium text-[var(--ft-text-primary)]">{step.label}</div>
            <p className="mt-2 text-sm leading-6 text-[var(--ft-text-secondary)]">
              {onboardingStepCopy[step.label]}
            </p>
          </Panel>
        ))}
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-medium text-[var(--ft-text-primary)]">Session</h2>
              <p className="mt-1 text-sm text-[var(--ft-text-secondary)]">
                Workspace identity for campaign APIs.
              </p>
            </div>
            <ShieldCheck className="size-5 stroke-[1.5] text-[var(--ft-green)]" />
          </div>
            <div className="mt-5 border-y border-[var(--ft-border)] py-4">
            {session ? (
              <div className="grid gap-2 text-sm">
                <div className="font-medium text-[var(--ft-text-primary)]">{session.workspace.name}</div>
                <div className="text-[var(--ft-text-secondary)]">{session.user.name}</div>
                <div className="text-xs text-[var(--ft-text-muted)]">@{session.user.username}</div>
                <div className="font-mono text-[11px] uppercase tracking-[0.04em] text-[var(--ft-text-muted)]">
                  {session.role ?? "member"}
                </div>
              </div>
            ) : (
              <EmptyState
                copy="Use the login screen to create your workspace and attach this session automatically."
                icon={ShieldCheck}
                title="Sign in required"
              />
            )}
          </div>
        </Panel>

        <Panel className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-medium text-[var(--ft-text-primary)]">Provider check</h2>
              <p className="mt-1 text-sm text-[var(--ft-text-secondary)]">
                {health?.service ?? "Campaign platform"}
              </p>
            </div>
            <PlugZap className="size-5 stroke-[1.5] text-[var(--ft-blue)]" />
          </div>
          <div className="mt-5 divide-y divide-[var(--ft-border)] border-y border-[var(--ft-border)]">
            {loading ? (
              <div className="py-4">
                <LoadingBlock label="Loading provider health" />
              </div>
            ) : providers.length === 0 ? (
              <div className="py-4">
                <EmptyState
                  copy="Provider health will appear when the platform health endpoint responds."
                  icon={PlugZap}
                  title="No provider health"
                />
              </div>
            ) : (
              providers.map(([name, provider]) => (
                <div className="grid gap-2 py-3 sm:grid-cols-[1fr_auto] sm:items-center" key={name}>
                  <div className="flex items-center gap-2 text-sm font-medium text-[var(--ft-text-primary)]">
                    <CheckCircle2 className="size-4 stroke-[1.5] text-[var(--ft-green)]" />
                    {name}
                  </div>
                  <Badge tone={source === "fallback" ? "neutral" : "success"}>{provider}</Badge>
                </div>
              ))
            )}
          </div>
        </Panel>
      </section>

      <section className="mt-6">
        <Panel className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-medium text-[var(--ft-text-primary)]">Destination catalog</h2>
              <p className="mt-1 text-sm text-[var(--ft-text-secondary)]">
                Available campaign endpoints.
              </p>
            </div>
            <Badge tone="info">{destinations.length}</Badge>
          </div>
          <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {loading ? (
              <div className="sm:col-span-2 lg:col-span-3">
                <LoadingBlock label="Loading destinations" />
              </div>
            ) : destinations.length === 0 ? (
              <div className="sm:col-span-2 lg:col-span-3">
                <EmptyState
                  copy="Destination options will appear after the catalog endpoint responds."
                  icon={Rocket}
                  title="No destinations"
                />
              </div>
            ) : (
              destinations.map((destination) => (
                <div
                  className="grid gap-2 border-l-2 border-[var(--ft-border)] bg-transparent px-3 py-3 text-sm text-[var(--ft-text-secondary)]"
                  key={destination}
                >
                  <PlatformChip platform={destinationPlatform(destination)} />
                  <span className="font-medium text-[var(--ft-text-primary)]">
                    {destinationLabels[destination]}
                  </span>
                </div>
              ))
            )}
          </div>
        </Panel>
      </section>
    </CampaignShell>
  );
}
