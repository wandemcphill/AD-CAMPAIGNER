"use client";

import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Link2,
  MapPin,
  Megaphone,
  RefreshCw,
  ShieldCheck,
  WalletCards
} from "lucide-react";

import {
  Badge,
  Button,
  ContextualHelpCard,
  Panel,
  PermissionDenied,
  PlatformChip,
  SummaryStatStrip,
  TimelineEvent,
  ValueSkeleton
} from "@fliptrybe/ui";

import {
  EmptyState,
  ErrorNotice,
  LoadingBlock,
  PageHeader,
  SourceBadge,
  destinationPlatform,
  linkButtonClass,
  secondaryLinkButtonClass
} from "../../campaigns/components";
import { destinationLabels } from "../../campaigns/data";
import { useOnboardingData } from "../../campaigns/use-campaign-dashboard-data";
import { useApiSession } from "../../lib/use-session";
import Link from "next/link";

const profileSections = [
  {
    copy: "Account identity, workspace name, and preferred campaign channels.",
    icon: Building2,
    label: "Account info"
  },
  {
    copy: "Primary contact details and team handoff notes for client-visible updates.",
    icon: ShieldCheck,
    label: "Contact"
  },
  {
    copy: "Invoice address, tax details if applicable, and wallet funding preference.",
    icon: WalletCards,
    label: "Billing"
  },
  {
    copy: "Website, store, WhatsApp, TikTok, Instagram, Facebook, and other launch destinations.",
    icon: Link2,
    label: "Brand links"
  },
  {
    copy: "Industry, brand notes, tone of voice, creative constraints, and offer positioning.",
    icon: Megaphone,
    label: "Brand planning"
  }
] as const;

export default function ProfilePage() {
  const { destinations, error, forbidden, loading, refresh, source } = useOnboardingData();
  const { loading: sessionLoading, session } = useApiSession();

  const completionItems = [
    {
      detail:
        session?.workspace?.name ??
        "Your workspace will be created automatically when you sign in.",
      href: "/os/campaigns",
      ready: Boolean(session?.workspace?.name),
      title: "Workspace identity"
    },
    {
      detail:
        session?.user.name ??
        "Add a display name for approvals, reports, and published handoff notes.",
      href: "/os/campaigns",
      ready: Boolean(session?.user.name),
      title: "Client contact"
    },
    {
      detail:
        destinations.length > 0
          ? `${destinations.length} destinations available for campaign briefs.`
          : "Add at least one website, store, social profile, or WhatsApp destination.",
      href: "/os/campaigns/new",
      ready: destinations.length > 0,
      title: "Launch destinations"
    },
    {
      detail:
        "Billing context is confirmed from Wallet & Billing before an approved campaign starts.",
      href: "/os/wallet",
      ready: false,
      title: "Billing details"
    },
    {
      detail:
        "Industry, brand notes, tone of voice, and creative constraints still need a dedicated profile capture.",
      href: "/os/campaigns/new",
      ready: false,
      title: "Brand planning details"
    }
  ];
  const readyCount = completionItems.filter((item) => item.ready).length;
  const completion = Math.round((readyCount / completionItems.length) * 100);
  const setupGapCount = completionItems.length - readyCount;
  const nextProfileAction = completionItems.find((item) => !item.ready);

  if (forbidden) {
    return (
      <PermissionDenied>
        You do not have permission to view this profile page for this workspace. Contact your
        workspace owner if you believe this is a mistake.
      </PermissionDenied>
    );
  }

  return (
    <>
      <PageHeader
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              className="w-full sm:w-auto"
              disabled={loading}
              onClick={() => void refresh()}
              variant="secondary"
            >
              <RefreshCw className="size-4 stroke-[1.5]" />
              Refresh
            </Button>
            <Link
              className={`${secondaryLinkButtonClass} w-full sm:w-auto`}
              href={session ? "/os/wallet" : "/login"}
            >
              {session ? "Wallet & Billing" : "Sign in"}
            </Link>
            <Link className={`${linkButtonClass} w-full sm:w-auto`} href={session ? "/os/campaigns/new" : "/register"}>
              {session ? "Start Campaign" : "Create account"}
              <ArrowRight className="size-4 stroke-[1.5]" />
            </Link>
          </div>
        }
        eyebrow={
          <>
            <Badge tone="info">Business profile</Badge>
            <SourceBadge source={source} />
          </>
        }
        title="Business Profile"
      />

      <ErrorNotice message={error} />

      <section className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-4">
          <Panel className="overflow-hidden">
            <div className="grid gap-4 border-b border-[var(--ft-border)] p-5 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={completion >= 80 ? "success" : "warning"}>
                    {completion}% complete
                  </Badge>
                  <Badge tone="neutral">
                    {readyCount} of {completionItems.length} ready
                  </Badge>
                </div>
                <h2 className="mt-3 text-xl font-medium text-[var(--ft-text-primary)]">
                  {session?.workspace?.name ?? "Complete your business profile"}
                </h2>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--ft-text-secondary)]">
                  Fliptrybe uses this profile to understand the business, prepare campaign plans,
                  create invoices, and keep the right client contact in the loop.
                </p>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--ft-bg-muted)]">
                  <div
                    className="h-full rounded-full bg-[var(--ft-accent)] transition-[width]"
                    style={{ width: `${completion}%` }}
                  />
                </div>
                {nextProfileAction ? (
                  <div className="mt-3 rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] p-3 text-sm leading-6 text-[var(--ft-text-secondary)]">
                    <span className="font-medium text-[var(--ft-text-primary)]">
                      Next profile step:
                    </span>{" "}
                    {nextProfileAction.title} - {nextProfileAction.detail}
                  </div>
                ) : (
                  <div className="mt-3 rounded-[var(--radius-sm)] border border-[var(--ft-green)]/30 bg-[var(--ft-green-subtle)] p-3 text-sm leading-6 text-[var(--ft-text-secondary)]">
                    This profile has enough context for the team to prepare campaign plans and
                    client updates.
                  </div>
                )}
              </div>
              <div className="rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] p-4 text-center">
                <div className="font-mono text-4xl font-semibold text-[var(--ft-text-primary)]">
                  {completion}%
                </div>
                <div className="mt-1 font-mono text-micro tracking-[0.04em] text-[var(--ft-text-muted)] uppercase">
                  profile readiness
                </div>
              </div>
            </div>

            <div className="p-5">
                <SummaryStatStrip
                items={[
                  {
                    label: "workspace",
                    value: sessionLoading ? "Checking" : session ? "Ready" : "Signed out"
                  },
                  { label: "destinations", value: loading ? <ValueSkeleton width="w-10" /> : destinations.length },
                  { label: "setup gaps", value: loading ? <ValueSkeleton width="w-10" /> : setupGapCount }
                ]}
              />
            </div>
          </Panel>

          <Panel className="p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-medium text-[var(--ft-text-primary)]">
                  Required launch profile
                </h2>
                <p className="mt-1 text-sm leading-6 text-[var(--ft-text-secondary)]">
                  These are the business details the team needs before a campaign can move
                  confidently from brief to plan, invoice, and production.
                </p>
              </div>
              <ShieldCheck className="size-5 shrink-0 stroke-[1.5] text-[var(--ft-accent)]" />
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {profileSections.map((section, index) => {
                const completionItem = [
                  completionItems[0],
                  completionItems[1],
                  completionItems[3],
                  completionItems[2],
                  completionItems[4]
                ][index];

                return (
                  <article
                    className="rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] p-4"
                    key={section.label}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="grid size-10 place-items-center rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)]">
                          {completionItem?.ready ? (
                            <CheckCircle2 className="size-5 stroke-[1.5] text-[var(--ft-green)]" />
                          ) : (
                            <section.icon className="size-5 stroke-[1.5] text-[var(--ft-accent)]" />
                          )}
                        </div>
                        <h3 className="font-medium text-[var(--ft-text-primary)]">
                          {section.label}
                        </h3>
                      </div>
                      {completionItem ? (
                        <Badge tone={completionItem.ready ? "success" : "warning"}>
                          {completionItem.ready ? "Ready" : "Needed"}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-3 text-sm leading-6 text-[var(--ft-text-secondary)]">
                      {section.copy}
                    </p>
                    {completionItem ? (
                      <p className="mt-3 rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-3 text-xs leading-5 text-[var(--ft-text-secondary)]">
                        {completionItem.detail}
                      </p>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </Panel>
        </div>

        <div className="grid content-start gap-4">
          {!session && !sessionLoading ? (
            <EmptyState
              action={
                <Link className={linkButtonClass} href="/login">
                  Sign in
                  <ArrowRight className="size-4 stroke-[1.5]" />
                </Link>
              }
              copy="A signed-in session connects this profile to campaign briefs, invoices, reports, and operator updates."
              icon={ShieldCheck}
              title="Sign in required"
            />
          ) : null}

          <ContextualHelpCard title="Why this profile matters">
            The business profile turns Fliptrybe from a blank campaign form into a managed service
            desk. Operators use it to understand the client, write better plans, avoid billing
            confusion, and publish reports that sound specific to the business.
          </ContextualHelpCard>

          <Panel className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-medium text-[var(--ft-text-primary)]">
                  Profile checklist
                </h2>
                <p className="mt-1 text-sm text-[var(--ft-text-secondary)]">
                  Completion is based on launch-critical client details.
                </p>
              </div>
              <Badge tone={completion >= 80 ? "success" : "warning"}>{setupGapCount} gaps</Badge>
            </div>
            <div className="mt-4 grid gap-2">
              {completionItems.map((item) => (
                <a
                  className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] p-3 transition hover:border-[var(--ft-accent)]"
                  href={session ? item.href : "/login"}
                  key={item.title}
                >
                  <span className="grid size-8 place-items-center rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)]">
                    <CheckCircle2
                      className={`size-4 stroke-[1.5] ${
                        item.ready ? "text-[var(--ft-green)]" : "text-[var(--ft-text-muted)]"
                      }`}
                    />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-[var(--ft-text-primary)]">
                      {item.title}
                    </span>
                    <span className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--ft-text-secondary)]">
                      {item.detail}
                    </span>
                  </span>
                  <Badge tone={item.ready ? "success" : "warning"}>
                    {item.ready ? "Ready" : "Needed"}
                  </Badge>
                </a>
              ))}
            </div>
          </Panel>

          <Panel className="p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-[var(--ft-text-primary)]">
                Account configuration
              </div>
              <Badge tone="info">Managed</Badge>
            </div>
            <div className="mt-4 grid gap-3 text-sm text-[var(--ft-text-secondary)]">
              <div className="flex justify-between">
                <span>Briefs</span>
                <span className="font-medium text-[var(--ft-text-primary)]">Human review</span>
              </div>
              <div className="flex justify-between">
                <span>Payment</span>
                <span className="font-medium text-[var(--ft-text-primary)]">Wallet held</span>
              </div>
              <div className="flex justify-between">
                <span>Reports</span>
                <span className="font-medium text-[var(--ft-text-primary)]">Published by team</span>
              </div>
            </div>
          </Panel>

          <Panel className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-medium text-[var(--ft-text-primary)]">
                  Launch destinations
                </h2>
                <p className="mt-1 text-sm text-[var(--ft-text-secondary)]">
                  Platforms and links available for campaign briefs.
                </p>
              </div>
              <MapPin className="size-5 shrink-0 stroke-[1.5] text-[var(--ft-blue)]" />
            </div>

            <div className="mt-5 grid gap-2">
              {loading ? <LoadingBlock label="Loading destinations" /> : null}
              {!loading && destinations.length === 0 ? (
                <EmptyState
                  copy="Add campaign destinations so the team knows where ads should send people."
                  icon={Link2}
                  title="No destinations yet"
                />
              ) : null}
              {!loading
                ? destinations.slice(0, 6).map((destination) => (
                    <div
                      className="flex items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] p-3"
                      key={destination}
                    >
                      <div className="min-w-0">
                        <PlatformChip platform={destinationPlatform(destination)} />
                        <div className="mt-2 truncate text-sm font-medium text-[var(--ft-text-primary)]">
                          {destinationLabels[destination]}
                        </div>
                      </div>
                      <Badge tone="neutral">Available</Badge>
                    </div>
                  ))
                : null}
            </div>
          </Panel>

          <Panel className="p-4">
            <div className="font-medium text-[var(--ft-text-primary)]">Next setup actions</div>
            <div className="mt-4 grid gap-4">
              <TimelineEvent
                timestamp="Before first brief"
                title="Confirm billing details"
                type="system"
              >
                Make sure invoice context and campaign funding are ready in Wallet & Billing.
              </TimelineEvent>
              <TimelineEvent
                timestamp="Before team review"
                title="Add brand planning details"
                type="operator"
              >
                Industry, tone, constraints, and social links help operators shape the campaign plan
                faster.
              </TimelineEvent>
              <TimelineEvent
                timestamp="After profile is complete"
                title="Submit first campaign"
                type="milestone"
              >
                Send the brief to the Fliptrybe team for review and planning.
              </TimelineEvent>
            </div>
          </Panel>
        </div>
      </section>
    </>
  );
}
