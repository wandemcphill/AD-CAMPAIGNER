"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, Eye, RefreshCw, Search, Sparkles, Users, type LucideIcon } from "lucide-react";

import { Badge, Button, Panel } from "@fliptrybe/ui";

import { ErrorNotice, PageHeader } from "../../../growth-services/components";
import { navItems } from "../../../growth-services/data";
import type { GrowthService } from "../../../growth-services/data";
import { loadGrowthCatalog, type GrowthCategory } from "../../../growth-services/api";
import { OrderGrowthServiceButton } from "../../../growth-services/order-modal";
import { SectionTabs } from "../../section-tabs";

type IntentCard = { title: string; description: string; icon: LucideIcon; tone: string; match: string };

const INTENTS: IntentCard[] = [
  { title: "Grow Nigerian followers", description: "Find available audience-growth services designed for creator accounts.", icon: Users, tone: "var(--ft-purple)", match: "follower" },
  { title: "Drive viewers to LIVE", description: "Prioritize services that help put your LIVE in front of more viewers.", icon: Eye, tone: "var(--ft-red)", match: "live" },
  { title: "Increase engagement", description: "Explore services aimed at improving the signals around your content.", icon: Sparkles, tone: "var(--ft-accent)", match: "engagement" }
];

export default function GrowthServicesCatalogPage() {
  const [services, setServices] = useState<GrowthService[]>([]);
  const [categories, setCategories] = useState<GrowthCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [query, setQuery] = useState("");
  const [intent, setIntent] = useState<string>();

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const catalog = await loadGrowthCatalog();
      setServices(catalog.services);
      setCategories(catalog.categories);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load the growth catalog.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const filteredServices = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return services.filter((service) => {
      const haystack = `${service.name} ${service.description} ${service.category} ${service.platform}`.toLowerCase();
      const matchesQuery = !normalized || haystack.includes(normalized);
      const matchesIntent = !intent || haystack.includes(intent);
      return matchesQuery && matchesIntent;
    });
  }, [intent, query, services]);

  const grouped = useMemo(() => {
    const byCategory = new Map<string, GrowthService[]>();
    for (const service of filteredServices) {
      const list = byCategory.get(service.category) ?? [];
      list.push(service);
      byCategory.set(service.category, list);
    }
    const orderedKeys = categories.length > 0 ? categories.map((c) => c.label) : [...byCategory.keys()];
    return orderedKeys.filter((key) => byCategory.has(key)).map((key) => ({ category: key, services: byCategory.get(key)! }));
  }, [filteredServices, categories]);

  return (
    <>
      <PageHeader
        action={<Button disabled={loading} onClick={() => void refresh()} variant="secondary"><RefreshCw className="size-4" />Refresh</Button>}
        eyebrow={<><Badge tone="info">Customer growth</Badge><Badge tone="warning">Risk visible</Badge></>}
        title="Grow your audience"
      />

      <div className="mt-5"><SectionTabs items={navItems} /></div>

      <Panel className="mt-5 overflow-hidden p-0">
        <div className="bg-[var(--ft-bg-muted)] p-5 sm:p-6">
          <div className="font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--ft-accent)]">Outcome first</div>
          <h2 className="mt-1 text-xl font-semibold tracking-[-0.02em]">Tell us what you want to grow.</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--ft-text-muted)]">You do not need to understand provider names or service codes. Start with the result you want, then compare the available options.</p>
          <div className="mt-5 grid gap-2 lg:grid-cols-3">
            {INTENTS.map((item) => <button className={`group rounded-2xl border p-4 text-left transition ${intent === item.match ? "border-[var(--ft-accent)] bg-[var(--ft-accent)]/8" : "border-[var(--ft-border)] bg-[var(--ft-bg-surface)] hover:border-[var(--ft-accent)]/30"}`} key={item.match} onClick={() => setIntent(intent === item.match ? undefined : item.match)} type="button"><div className="flex items-start justify-between"><span className="grid size-10 place-items-center rounded-xl border border-[var(--ft-border)] bg-[var(--ft-bg-muted)]" style={{ color: item.tone }}><item.icon className="size-5" /></span><ArrowRight className="size-4 text-[var(--ft-text-muted)] transition group-hover:translate-x-1" /></div><div className="mt-4 text-sm font-semibold">{item.title}</div><p className="mt-1 text-xs leading-5 text-[var(--ft-text-muted)]">{item.description}</p></button>)}
          </div>
        </div>
        <div className="border-t border-[var(--ft-border)] p-4 sm:p-5"><label className="relative block"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--ft-text-muted)]" /><input aria-label="Search growth services" className="h-11 w-full rounded-xl border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] pl-10 pr-4 text-sm outline-none placeholder:text-[var(--ft-text-muted)] focus:border-[var(--ft-accent)]" onChange={(e) => setQuery(e.target.value)} placeholder="Search followers, LIVE, engagement, TikTok..." value={query} /></label></div>
      </Panel>

      <ErrorNotice message={error} />
      {!loading && (query || intent) && <div className="mt-4 text-xs text-[var(--ft-text-muted)]">Showing {filteredServices.length} matching service{filteredServices.length === 1 ? "" : "s"}.</div>}

      {loading ? <Panel className="mt-6 p-4 text-sm text-[var(--ft-text-muted)]">Loading catalog</Panel> : filteredServices.length === 0 ? <Panel className="mt-6 p-8 text-center"><div className="text-sm font-semibold">No matching services</div><p className="mt-1 text-xs text-[var(--ft-text-muted)]">Try another outcome or clear the search.</p><Button className="mt-4" onClick={() => { setQuery(""); setIntent(undefined); }} variant="secondary">Clear filters</Button></Panel> : grouped.map((group) => <section className="mt-8 first:mt-6" key={group.category}><h2 className="text-sm font-mono uppercase tracking-[0.04em] text-[var(--ft-text-muted)]">{group.category}</h2><div className="mt-3 grid gap-4 xl:grid-cols-3">{group.services.map((service) => <Panel className={service.enabled ? "p-4" : "border-dashed p-4 opacity-70"} key={service.code}><div className="flex items-start justify-between gap-3"><div className="grid size-11 place-items-center rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)]"><service.icon className="size-5 text-[var(--ft-text-primary)]" /></div><div className="flex flex-wrap justify-end gap-2"><Badge tone={service.enabled ? "success" : "neutral"}>{service.enabled ? "Enabled" : "Disabled"}</Badge><Badge tone={service.riskTone}>Risk</Badge></div></div><h3 className="mt-4 text-lg font-semibold text-[var(--ft-text-primary)]">{service.name}</h3><p className="mt-2 min-h-16 text-sm leading-6 text-[var(--ft-text-muted)]">{service.description}</p><div className="mt-4 divide-y divide-[var(--ft-border)] rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] text-sm">{[["Platform", service.platform],["Price", service.price],["Quantity", `${service.minimumQuantity.toLocaleString()}-${service.maximumQuantity.toLocaleString()}`],["ETA", service.expectedCompletion]].map(([label, value]) => <div className="flex justify-between gap-3 px-3 py-2" key={label}><span className="text-[var(--ft-text-muted)]">{label}</span><span className="text-right font-medium text-[var(--ft-text-primary)]">{value}</span></div>)}</div><p className="mt-3 min-h-10 text-xs leading-5 text-[var(--ft-text-muted)]">{service.riskSummary}</p><div className="mt-4"><OrderGrowthServiceButton service={service} /></div></Panel>)}</div></section>)}
    </>
  );
}
