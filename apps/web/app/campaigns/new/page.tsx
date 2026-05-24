"use client";

import { type FormEvent, useMemo, useState } from "react";
import { ArrowRight, Calculator, CheckCircle2, RefreshCw, Rocket, Sparkles } from "lucide-react";

import { Badge, Button, Panel, cn } from "@fliptrybe/ui";
import type { Campaign, CampaignObjective, CurrencyCode, DestinationKind } from "@fliptrybe/types";

import {
  amountToMinor,
  createCampaign,
  formatCampaignMoney,
  quoteCampaign
} from "../api";
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
import { destinationLabels, objectiveLabels, objectiveOptions, type CampaignQuote } from "../data";
import { useCampaignBuilderData } from "../use-campaign-dashboard-data";

type CampaignFormState = {
  budget: string;
  currency: CurrencyCode;
  destinationKind: DestinationKind;
  destinationUrl: string;
  name: string;
  objective: CampaignObjective;
};

const initialForm: CampaignFormState = {
  budget: "250000",
  currency: "NGN",
  destinationKind: "INSTAGRAM_REEL",
  destinationUrl: "https://instagram.com/fliptrybe",
  name: "Creator growth sprint",
  objective: "ENGAGEMENT"
};

function toCreatePayload(form: CampaignFormState) {
  const destinationUrl = form.destinationUrl.trim();
  const name = form.name.trim();

  return {
    ...(name ? { name } : {}),
    objective: form.objective,
    budgetMinor: amountToMinor(form.budget),
    currency: form.currency,
    destinationKind: form.destinationKind,
    ...(destinationUrl ? { destinationUrl } : {})
  };
}

export default function NewCampaignPage() {
  const { destinations, error, loading, refresh, source } = useCampaignBuilderData();
  const [form, setForm] = useState<CampaignFormState>(initialForm);
  const [quote, setQuote] = useState<CampaignQuote>();
  const [createdCampaign, setCreatedCampaign] = useState<Campaign>();
  const [formError, setFormError] = useState<string>();
  const [quoting, setQuoting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const estimatedBudget = useMemo(
    () => ({ amountMinor: amountToMinor(form.budget), currency: form.currency }),
    [form.budget, form.currency]
  );

  async function handleQuote() {
    setFormError(undefined);
    setQuoting(true);
    try {
      const payload = toCreatePayload(form);
      setQuote(
        await quoteCampaign({
          objective: payload.objective,
          budgetMinor: payload.budgetMinor,
          currency: payload.currency,
          destinationKind: payload.destinationKind
        })
      );
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "Could not quote this campaign.");
    } finally {
      setQuoting(false);
    }
  }

  async function submitCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(undefined);
    setSubmitting(true);
    try {
      const payload = toCreatePayload(form);
      if (!payload.budgetMinor) {
        throw new Error("Budget must be greater than zero.");
      }
      setCreatedCampaign(await createCampaign(payload));
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "Could not create this campaign.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    void submitCampaign(event);
  }

  return (
    <CampaignShell active="/campaigns/new">
      <PageHeader
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button disabled={loading} onClick={() => void refresh()} variant="secondary">
              <RefreshCw className="size-4" />
              Refresh
            </Button>
            <a className={secondaryLinkButtonClass} href="/campaigns">
              Campaigns
              <ArrowRight className="size-4" />
            </a>
          </div>
        }
        eyebrow={
          <>
            <Badge tone="info">Campaign builder</Badge>
            <SourceBadge source={source} />
          </>
        }
        title="New campaign"
      />

      <ErrorNotice message={error ?? formError} />

      <section className="mt-6 grid gap-4 xl:grid-cols-[1fr_0.85fr]">
        <Panel className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-zinc-950">Launch setup</h2>
              <p className="mt-1 text-sm text-zinc-500">Objective, budget, and destination.</p>
            </div>
            <Rocket className="size-5 text-sky-600" />
          </div>

          <form className="mt-5 grid gap-4" onSubmit={handleSubmit}>
            <label className="grid gap-2 text-sm font-medium text-zinc-700">
              Campaign name
              <input
                className="h-11 rounded-md border border-zinc-200 bg-white px-3 text-zinc-950"
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                value={form.name}
              />
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium text-zinc-700">
                Objective
                <select
                  className="h-11 rounded-md border border-zinc-200 bg-white px-3 text-zinc-950"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      objective: event.target.value as CampaignObjective
                    }))
                  }
                  value={form.objective}
                >
                  {objectiveOptions.map((objective) => (
                    <option key={objective} value={objective}>
                      {objectiveLabels[objective]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 text-sm font-medium text-zinc-700">
                Budget
                <input
                  className="h-11 rounded-md border border-zinc-200 bg-white px-3 text-zinc-950"
                  inputMode="numeric"
                  onChange={(event) => setForm((current) => ({ ...current, budget: event.target.value }))}
                  value={form.budget}
                />
              </label>
            </div>

            <label className="grid gap-2 text-sm font-medium text-zinc-700">
              Destination URL
              <input
                className="h-11 rounded-md border border-zinc-200 bg-white px-3 text-zinc-950"
                onChange={(event) =>
                  setForm((current) => ({ ...current, destinationUrl: event.target.value }))
                }
                value={form.destinationUrl}
              />
            </label>

            <div>
              <div className="text-sm font-medium text-zinc-700">Destination</div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {loading ? (
                  <div className="sm:col-span-2 xl:col-span-3">
                    <LoadingBlock label="Loading destinations" />
                  </div>
                ) : destinations.length === 0 ? (
                  <div className="sm:col-span-2 xl:col-span-3">
                    <EmptyState
                      copy="The destination catalog is empty."
                      icon={Rocket}
                      title="No destinations"
                    />
                  </div>
                ) : (
                  destinations.map((destination) => (
                    <button
                      className={cn(
                        "min-h-12 rounded-md border px-3 py-2 text-left text-sm font-medium transition",
                        form.destinationKind === destination
                          ? "border-zinc-950 bg-zinc-950 text-white"
                          : "border-zinc-200 bg-zinc-50 text-zinc-700 hover:border-zinc-950 hover:bg-white"
                      )}
                      key={destination}
                      onClick={() =>
                        setForm((current) => ({ ...current, destinationKind: destination }))
                      }
                      type="button"
                    >
                      {destinationLabels[destination]}
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button disabled={quoting || loading} onClick={() => void handleQuote()} type="button" variant="secondary">
                <Calculator className="size-4" />
                {quoting ? "Quoting" : "Quote"}
              </Button>
              <Button disabled={submitting || loading} type="submit">
                <Sparkles className="size-4" />
                {submitting ? "Creating" : "Create campaign"}
              </Button>
            </div>
          </form>
        </Panel>

        <div className="grid gap-4">
          <Panel className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-zinc-950">Estimate</h2>
                <p className="mt-1 text-sm text-zinc-500">{formatCampaignMoney(estimatedBudget)} budget</p>
              </div>
              <Calculator className="size-5 text-green-600" />
            </div>
            {quote ? (
              <div className="mt-5 grid gap-3 text-sm">
                <div className="flex justify-between rounded-md bg-zinc-50 p-3">
                  <span className="text-zinc-500">Reach</span>
                  <span className="font-semibold text-zinc-950">
                    {quote.estimatedReach.min.toLocaleString()} - {quote.estimatedReach.max.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between rounded-md bg-zinc-50 p-3">
                  <span className="text-zinc-500">Estimated CPM</span>
                  <span className="font-semibold text-zinc-950">
                    {formatCampaignMoney({
                      amountMinor: quote.estimatedCpmMinor,
                      currency: quote.currency
                    })}
                  </span>
                </div>
              </div>
            ) : (
              <div className="mt-5">
                <EmptyState
                  copy="Quote results will show provider reach and CPM."
                  icon={Calculator}
                  title="No quote yet"
                />
              </div>
            )}
          </Panel>

          {createdCampaign ? (
            <Panel className="p-4">
              <div className="flex items-center gap-2 font-semibold text-zinc-950">
                <CheckCircle2 className="size-5 text-green-600" />
                Campaign created
              </div>
              <div className="mt-4 grid gap-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Status</span>
                  <StatusBadge status={createdCampaign.status} />
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Budget</span>
                  <span className="font-semibold text-zinc-950">
                    {formatCampaignMoney(createdCampaign.budget)}
                  </span>
                </div>
              </div>
              <a className={`${linkButtonClass} mt-4 w-full`} href={`/campaigns/${createdCampaign.id}`}>
                Open campaign
                <ArrowRight className="size-4" />
              </a>
            </Panel>
          ) : null}
        </div>
      </section>
    </CampaignShell>
  );
}
