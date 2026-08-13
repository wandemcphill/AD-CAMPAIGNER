"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Briefcase, FileText, Globe, Search, Star, Store, Zap } from "lucide-react";
import { motion } from "framer-motion";

import { Badge } from "@fliptrybe/ui";

import {
  formatEngagement,
  formatFollowers,
  formatRating,
  loadMarketplaceAgencies,
  loadMarketplaceCreators,
  type MarketplaceAgencyRecord,
  type MarketplaceCreatorRecord
} from "../../marketplace/api";
import { SectionTabs, type SectionTab } from "../section-tabs";

const MARKETPLACE_TABS: SectionTab[] = [
  { label: "Overview", href: "/os/marketplace", icon: Store },
  { label: "Agencies", href: "/os/marketplace/agencies", icon: Briefcase },
  { label: "Creators", href: "/os/marketplace/creators", icon: Globe },
];

export default function MarketplacePage() {
  const [query, setQuery] = useState("");
  const [agencies, setAgencies] = useState<MarketplaceAgencyRecord[]>([]);
  const [creators, setCreators] = useState<MarketplaceCreatorRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([loadMarketplaceAgencies(), loadMarketplaceCreators()])
      .then(([agencyList, creatorList]) => {
        setAgencies(agencyList.slice(0, 3));
        setCreators(creatorList.slice(0, 3));
      })
      .catch(() => {
        // Featured strips are supplementary; the dedicated agencies/creators
        // pages surface a real error state if the catalog fails to load.
      })
      .finally(() => setLoading(false));
  }, []);

  function onSearchSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (query.trim()) {
      window.location.href = `/os/search?q=${encodeURIComponent(query.trim())}`;
    }
  }

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <SectionTabs items={MARKETPLACE_TABS} />

      {/* Hero */}
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-[var(--radius-xl)] border border-[var(--ft-accent)]/20 bg-gradient-to-br from-[var(--ft-bg-raised)] via-[var(--ft-bg-surface)] to-[var(--ft-bg-raised)] p-8"
        initial={{ opacity: 0, y: 12 }}
      >
        <div className="relative z-10">
          <div className="flex items-center gap-2">
            <Store className="size-5 text-[var(--ft-accent)]" />
            <Badge tone="info">Marketplace</Badge>
          </div>
          <h1 className="mt-3 text-2xl font-bold">Growth Marketplace</h1>
          <p className="mt-1 text-sm text-[var(--ft-text-secondary)]">
            Connect with top agencies, creators, and growth services — all in one place.
          </p>

          <form className="relative mt-6 max-w-xl" onSubmit={onSearchSubmit}>
            <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[var(--ft-text-muted)]" />
            <input
              className="h-12 w-full rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] pl-11 pr-4 text-sm outline-none placeholder:text-[var(--ft-text-muted)] focus:border-[var(--ft-accent)]"
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search agencies, creators, services..."
              value={query}
            />
          </form>
        </div>
        <div className="pointer-events-none absolute -right-20 -top-20 size-60 rounded-full bg-[var(--ft-accent)]/5 blur-3xl" />
      </motion.div>

      {/* Quick nav */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { icon: Briefcase, label: "Agencies", href: "/os/marketplace/agencies", desc: "Verified marketing agencies" },
          { icon: Globe, label: "Creators", href: "/os/marketplace/creators", desc: "Influencers & content creators" },
          { icon: Zap, label: "Growth Services", href: "/os/growth", desc: "AI-curated growth products" },
          { icon: FileText, label: "My Applications", href: "/os/marketplace/applications", desc: "Track your agency/creator applications" },
        ].map((item) => (
          <a
            className="group rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-4 transition hover:border-[var(--ft-accent)]/30"
            href={item.href}
            key={item.label}
          >
            <item.icon className="size-6 text-[var(--ft-accent)]" />
            <div className="mt-2 text-sm font-semibold">{item.label}</div>
            <div className="mt-0.5 text-xs text-[var(--ft-text-muted)]">{item.desc}</div>
          </a>
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        {/* Featured agencies */}
        <section className="rounded-[var(--radius-xl)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Top Agencies</h2>
            <a className="text-xs text-[var(--ft-accent)]" href="/os/marketplace/agencies">View all <ArrowRight className="inline size-3" /></a>
          </div>
          <div className="mt-3 grid gap-2">
            {loading ? (
              <p className="text-xs text-[var(--ft-text-muted)]">Loading...</p>
            ) : agencies.length === 0 ? (
              <p className="text-xs text-[var(--ft-text-muted)]">No agencies listed yet.</p>
            ) : (
              agencies.map((a) => (
                <div className="flex items-center gap-4 rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-3 transition hover:border-[var(--ft-accent)]/30" key={a.id}>
                  <div className="grid size-11 place-items-center rounded-[var(--radius-md)] bg-[var(--ft-accent)]/10 text-sm font-bold text-[var(--ft-accent)]">
                    {a.name[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{a.name}</div>
                    <div className="text-xs text-[var(--ft-text-muted)]">{a.specialty} · {a.campaignCount} campaigns</div>
                  </div>
                  <div className="flex items-center gap-1 text-xs">
                    <Star className="size-3 fill-[var(--ft-yellow)] text-[var(--ft-yellow)]" />
                    {formatRating(a.ratingBps)}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Featured creators */}
        <section className="rounded-[var(--radius-xl)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Top Creators</h2>
            <a className="text-xs text-[var(--ft-accent)]" href="/os/marketplace/creators">View all <ArrowRight className="inline size-3" /></a>
          </div>
          <div className="mt-3 grid gap-2">
            {loading ? (
              <p className="text-xs text-[var(--ft-text-muted)]">Loading...</p>
            ) : creators.length === 0 ? (
              <p className="text-xs text-[var(--ft-text-muted)]">No creators listed yet.</p>
            ) : (
              creators.map((c) => (
                <div className="flex items-center gap-4 rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-3 transition hover:border-[var(--ft-accent)]/30" key={c.id}>
                  <div className="grid size-11 place-items-center rounded-full bg-[var(--ft-accent)]/10 text-sm font-bold text-[var(--ft-accent)]">
                    {c.name[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{c.name}</div>
                    <div className="text-xs text-[var(--ft-text-muted)]">{c.niche} · {formatFollowers(c.followerCount)} followers</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-[var(--ft-text-muted)]">{formatEngagement(c.engagementBps)} eng.</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
