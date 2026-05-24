"use client";

import { CheckCircle2, PlugZap, RefreshCw, Rocket, ShieldCheck } from "lucide-react";

import { Badge, Button, Panel } from "@fliptrybe/ui";

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

  return (
    <CampaignShell active="/onboarding">
      <PageHeader
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button disabled={loading} onClick={() => void refresh()} variant="secondary">
              <RefreshCw className="size-4" />
              Refresh
            </Button>
            <a className={secondaryLinkButtonClass} href="/billing">
              Billing
            </a>
            <a className={linkButtonClass} href="/campaigns/new">
              <Rocket className="size-4" />
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
        title="Workspace readiness"
      />

      <ErrorNotice message={error} />

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {onboardingSteps.map((step) => {
          const ready = stepReady(step.label);

          return (
            <Panel className="p-4" key={step.label}>
              <div className="flex items-start justify-between gap-3">
                <step.icon className={ready ? "size-5 text-green-600" : "size-5 text-zinc-500"} />
                <Badge tone={ready ? "success" : "warning"}>
                  {ready ? "Ready" : sessionLoading ? "Checking" : "Pending"}
                </Badge>
              </div>
              <div className="mt-4 font-semibold text-zinc-950">{step.label}</div>
            </Panel>
          );
        })}
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-zinc-950">Session</h2>
              <p className="mt-1 text-sm text-zinc-500">Workspace identity for campaign APIs.</p>
            </div>
            <ShieldCheck className="size-5 text-green-600" />
          </div>
          <div className="mt-5 rounded-md border border-zinc-200 bg-zinc-50 p-4">
            {session ? (
              <div className="grid gap-2 text-sm">
                <div className="font-semibold text-zinc-950">{session.workspace.name}</div>
                <div className="text-zinc-600">{session.user.email}</div>
                <div className="text-zinc-500">{session.role ?? "member"}</div>
              </div>
            ) : (
              <EmptyState
                copy="Use the session panel in the left rail to connect a workspace."
                icon={ShieldCheck}
                title="No active session"
              />
            )}
          </div>
        </Panel>

        <Panel className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-zinc-950">Provider check</h2>
              <p className="mt-1 text-sm text-zinc-500">{health?.service ?? "Campaign platform"}</p>
            </div>
            <PlugZap className="size-5 text-sky-600" />
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {loading ? (
              <div className="sm:col-span-2">
                <LoadingBlock label="Loading provider health" />
              </div>
            ) : providers.length === 0 ? (
              <div className="sm:col-span-2">
                <EmptyState
                  copy="Provider health will appear when the platform health endpoint responds."
                  icon={PlugZap}
                  title="No provider health"
                />
              </div>
            ) : (
              providers.map(([name, provider]) => (
                <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3" key={name}>
                  <div className="flex items-center gap-2 text-sm font-medium text-zinc-950">
                    <CheckCircle2 className="size-4 text-green-600" />
                    {name}
                  </div>
                  <div className="mt-2 text-sm text-zinc-500">{provider}</div>
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
              <h2 className="text-lg font-semibold text-zinc-950">Destination catalog</h2>
              <p className="mt-1 text-sm text-zinc-500">Available campaign endpoints.</p>
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
                  className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-700"
                  key={destination}
                >
                  {destinationLabels[destination]}
                </div>
              ))
            )}
          </div>
        </Panel>
      </section>
    </CampaignShell>
  );
}
