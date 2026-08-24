"use client";

import { useEffect, useState } from "react";
import { Briefcase, CheckCircle2, MapPin, RefreshCw, Search, Star } from "lucide-react";
import { motion } from "framer-motion";

import { Badge, Button } from "@fliptrybe/ui";
import { TabBar } from "@fliptrybe/ui/components";

import { EmptyState, ErrorNotice, LoadingBlock } from "../../../campaigns/components";
import {
  formatRating,
  loadMarketplaceAgencies,
  type MarketplaceAgencyRecord
} from "../../../marketplace/api";
import Link from "next/link";

const SPEC_TABS = [
  { id: "all", label: "All" },
  { id: "Social Media", label: "Social Media" },
  { id: "PPC / Google", label: "PPC / Google" },
  { id: "SEO", label: "SEO" },
  { id: "Video Production", label: "Video" },
  { id: "Influencer Marketing", label: "Influencer" },
];

export default function AgencyMarketplacePage() {
  const [spec, setSpec] = useState("all");
  const [search, setSearch] = useState("");
  const [agencies, setAgencies] = useState<MarketplaceAgencyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  async function refresh() {
    setError(undefined);
    try {
      setAgencies(await loadMarketplaceAgencies(spec === "all" ? undefined : spec));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Agencies failed to load.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    void refresh();
  }, [spec]);

  const filtered = agencies.filter((a) => {
    if (search && !a.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Briefcase className="size-5 text-[var(--ft-accent)]" />
            <h1 className="text-xl font-bold">Agency Marketplace</h1>
          </div>
          <p className="mt-1 text-sm text-[var(--ft-text-secondary)]">Verified agencies with transparent pricing and proven results</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/os/marketplace/applications">
            <Button variant="secondary">My Applications</Button>
          </Link>
          <Link href="/os/marketplace/agencies/apply">
            <Button>Apply as Agency</Button>
          </Link>
          <Button disabled={loading} onClick={() => void refresh()} variant="secondary">
            <RefreshCw className="size-4" /> Refresh
          </Button>
        </div>
      </div>

      <ErrorNotice message={error} />

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <TabBar items={SPEC_TABS} onChange={setSpec} value={spec} />
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[var(--ft-text-muted)]" />
          <input
            className="h-9 w-56 rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] pl-9 pr-3 text-sm outline-none placeholder:text-[var(--ft-text-muted)] focus:border-[var(--ft-accent)]"
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search agencies..."
            value={search}
          />
        </div>
      </div>

      {loading ? (
        <div className="mt-6">
          <LoadingBlock label="Loading agencies" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            action={
              <Link href="/os/marketplace/agencies/apply">
                <Button variant="secondary">Apply as Agency</Button>
              </Link>
            }
            copy="No agencies have been listed in this marketplace yet. This catalog is curated separately and hasn't been seeded."
            icon={Briefcase}
            title="No agencies listed yet"
          />
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((agency, i) => (
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              className="rounded-[var(--radius-xl)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-5 transition hover:border-[var(--ft-accent)]/30 hover:shadow-[var(--shadow-md)]"
              initial={{ opacity: 0, y: 8 }}
              key={agency.id}
              transition={{ delay: i * 0.03 }}
            >
              <div className="flex items-start gap-3">
                <div className="grid size-12 place-items-center rounded-[var(--radius-md)] bg-[var(--ft-accent)]/10 text-lg font-bold text-[var(--ft-accent)]">
                  {agency.name[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold">{agency.name}</span>
                    {agency.verified && <CheckCircle2 className="size-3.5 text-[var(--ft-accent)]" />}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[var(--ft-text-muted)]">
                    <MapPin className="size-3" /> {agency.location}
                    <Star className="size-3 fill-[var(--ft-yellow)] text-[var(--ft-yellow)]" />
                    {formatRating(agency.ratingBps)} ({agency.reviewCount})
                  </div>
                </div>
              </div>

              <p className="mt-3 text-xs text-[var(--ft-text-secondary)]">{agency.description}</p>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-[var(--radius-md)] bg-[var(--ft-bg-surface)] p-2 text-center">
                  <div className="text-sm font-bold">{agency.campaignCount}</div>
                  <div className="text-micro text-[var(--ft-text-muted)]">Campaigns</div>
                </div>
                <div className="rounded-[var(--radius-md)] bg-[var(--ft-bg-surface)] p-2 text-center">
                  <div className="text-sm font-bold">{agency.teamSize}</div>
                  <div className="text-micro text-[var(--ft-text-muted)]">Team size</div>
                </div>
              </div>

              {agency.packages.length > 0 ? (
                <div className="mt-3">
                  <div className="mb-1 text-micro text-[var(--ft-text-muted)]">Packages</div>
                  <div className="flex flex-wrap gap-1">
                    {agency.packages.map((p) => (
                      <Badge key={p} tone="neutral">{p}</Badge>
                    ))}
                  </div>
                </div>
              ) : null}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
