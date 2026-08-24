"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, RefreshCw, Target } from "lucide-react";
import { Badge, Button, Panel } from "@fliptrybe/ui";
import { ErrorNotice, PageHeader } from "../../../growth-services/components";
import { navItems } from "../../../growth-services/data";
import type { GrowthService } from "../../../growth-services/data";
import { loadGrowthCatalog, type GrowthCategory } from "../../../growth-services/api";
import { OrderGrowthServiceButton } from "../../../growth-services/order-modal";
import { SectionTabs } from "../../section-tabs";

const OUTCOMES = [
  { title: "Grow TikTok followers", query: "followers" },
  { title: "Reach Nigerian viewers", query: "views" },
  { title: "Promote TikTok LIVE", query: "live" },
  { title: "Grow a campaign", query: "engagement" }
] as const;

export default function GrowthServicesCatalogPage() {
  const [services, setServices] = useState<GrowthService[]>([]);
  const [categories, setCategories] = useState<GrowthCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [outcome, setOutcome] = useState("followers");

  const refresh = useCallback(async () => { setLoading(true); setError(undefined); try { const catalog = await loadGrowthCatalog(); setServices(catalog.services); setCategories(catalog.categories); } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not load the growth catalog."); } finally { setLoading(false); } }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const grouped = useMemo(() => {
    const byCategory = new Map<string, GrowthService[]>();
    for (const service of services) { const list = byCategory.get(service.category) ?? []; list.push(service); byCategory.set(service.category, list); }
    const orderedKeys = categories.length > 0 ? categories.map((c) => c.label) : [...byCategory.keys()];
    return orderedKeys.filter((key) => byCategory.has(key)).map((key) => ({ category: key, services: byCategory.get(key)! }));
  }, [services, categories]);

  const filtered = useMemo(() => {
    const haystack = (service: GrowthService) => `${service.name} ${service.description} ${service.category} ${service.platform}`.toLowerCase();
    return grouped.map((group) => ({ ...group, services: group.services.filter((service) => haystack(service).includes(outcome)) })).filter((group) => group.services.length > 0);
  }, [grouped, outcome]);

  return (
    <>
      <PageHeader action={<Button disabled={loading} onClick={() => void refresh()} variant="secondary"><RefreshCw className="size-4" />Refresh</Button>} eyebrow={<><Badge tone="info">Customer catalog</Badge><Badge tone="warning">Risk visible</Badge></>} title="Grow your audience" />
      <div className="mt-5"><SectionTabs items={navItems} /></div>
      <section className="mt-5 rounded-[26px] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-5 shadow-[var(--shadow-sm)] sm:p-6">
        <div className="flex items-start gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[var(--ft-accent)]/10 text-[var(--ft-accent)]"><Target className="size-5" /></span><div><div className="font-mono text-[9px] uppercase tracking-[0.18em] text-[var(--ft-accent)]">Choose the outcome</div><p className="mt-1 text-sm text-[var(--ft-text-secondary)]">Tell FlipTrybe what you want to achieve. We’ll show the matching growth services instead of making you decode provider names.</p></div></div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{OUTCOMES.map((item) => <button key={item.query} type="button" onClick={() => setOutcome(item.query)} className={`group rounded-2xl border p-3 text-left transition ${outcome === item.query ? "border-[var(--ft-accent)] bg-[var(--ft-accent-subtle)]" : "border-[var(--ft-border)] bg-[var(--ft-bg-surface)] hover:border-[var(--ft-accent)]/35"}`}><div className="flex items-center justify-between gap-2 text-xs font-semibold">{item.title}<ArrowRight className="size-3.5 transition group-hover:translate-x-1" /></div><div className="mt-1 text-[10px] text-[var(--ft-text-muted)]">Personalized service matching</div></button>)}</div>
      </section>
      <ErrorNotice message={error} />
      {loading ? <Panel className="mt-6 p-4 text-sm text-[var(--ft-text-muted)]">Loading catalog</Panel> : services.length === 0 ? <Panel className="mt-6 p-4 text-sm text-[var(--ft-text-muted)]">No growth services are available yet.</Panel> : filtered.length === 0 ? <Panel className="mt-6 p-5"><div className="text-sm font-semibold">No exact match yet</div><p className="mt-1 text-xs leading-5 text-[var(--ft-text-muted)]">Try another outcome. Your catalog is unchanged.</p></Panel> : filtered.map((group) => <section className="mt-8 first:mt-6" key={group.category}><h2 className="text-sm font-mono uppercase tracking-[0.04em] text-[var(--ft-text-muted)]">{group.category}</h2><div className="mt-3 grid gap-4 xl:grid-cols-3">{group.services.map((service) => <Panel className={service.enabled ? "p-4" : "border-dashed p-4 opacity-70"} key={service.code}><div className="flex items-start justify-between gap-3"><div className="grid size-11 place-items-center rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)]"><service.icon className="size-5 text-[var(--ft-text-primary)]" /></div><div className="flex flex-wrap justify-end gap-2"><Badge tone={service.enabled ? "success" : "neutral"}>{service.enabled ? "Enabled" : "Disabled"}</Badge><Badge tone={service.riskTone}>Risk</Badge></div></div><h3 className="mt-4 text-lg font-semibold text-[var(--ft-text-primary)]">{service.name}</h3><p className="mt-2 min-h-16 text-sm leading-6 text-[var(--ft-text-muted)]">{service.description}</p><div className="mt-4 divide-y divide-[var(--ft-border)] rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] text-sm">{[["Platform", service.platform],["Price", service.price],["Quantity", `${service.minimumQuantity.toLocaleString()}-${service.maximumQuantity.toLocaleString()}`],["ETA", service.expectedCompletion]].map(([label, value]) => <div className="flex justify-between gap-3 px-3 py-2" key={label}><span className="text-[var(--ft-text-muted)]">{label}</span><span className="text-right font-medium text-[var(--ft-text-primary)]">{value}</span></div>)}</div><p className="mt-3 min-h-10 text-xs leading-5 text-[var(--ft-text-muted)]">{service.riskSummary}</p><div className="mt-4"><OrderGrowthServiceButton service={service} /></div></Panel>)}</div></section>)}
    </>
  );
}
