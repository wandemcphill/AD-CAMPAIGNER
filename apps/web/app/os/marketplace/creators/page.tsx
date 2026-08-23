"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Globe, RefreshCw, Search } from "lucide-react";
import { motion } from "framer-motion";

import { Badge, Button } from "@fliptrybe/ui";
import { TabBar } from "@fliptrybe/ui/components";

import { EmptyState, ErrorNotice, LoadingBlock } from "../../../campaigns/components";
import {
  formatEngagement,
  formatFollowers,
  loadMarketplaceCreators,
  type MarketplaceCreatorRecord
} from "../../../marketplace/api";
import Link from "next/link";

const NICHE_TABS = [
  { id: "all", label: "All" },
  { id: "Beauty", label: "Beauty" },
  { id: "Tech", label: "Tech" },
  { id: "Fashion", label: "Fashion" },
  { id: "Food", label: "Food" },
  { id: "Fitness", label: "Fitness" },
  { id: "Lifestyle", label: "Lifestyle" },
];

function formatRate(rateMinor: number, currency: string) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency, maximumFractionDigits: 0 }).format(rateMinor / 100);
}

export default function CreatorMarketplacePage() {
  const [niche, setNiche] = useState("all");
  const [search, setSearch] = useState("");
  const [creators, setCreators] = useState<MarketplaceCreatorRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  async function refresh() {
    setError(undefined);
    try {
      setCreators(await loadMarketplaceCreators(niche === "all" ? undefined : niche));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Creators failed to load.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    void refresh();
  }, [niche]);

  const filtered = creators.filter((c) => {
    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Globe className="size-5 text-[var(--ft-accent)]" />
            <h1 className="text-xl font-bold">Creator Marketplace</h1>
          </div>
          <p className="mt-1 text-sm text-[var(--ft-text-secondary)]">Discover creators with real audiences and proven engagement</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/os/marketplace/applications">
            <Button variant="secondary">My Applications</Button>
          </Link>
          <Link href="/os/marketplace/creators/apply">
            <Button>Apply as Creator</Button>
          </Link>
          <Button disabled={loading} onClick={() => void refresh()} variant="secondary">
            <RefreshCw className="size-4" /> Refresh
          </Button>
        </div>
      </div>

      <ErrorNotice message={error} />

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <TabBar items={NICHE_TABS} onChange={setNiche} value={niche} />
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[var(--ft-text-muted)]" />
          <input
            className="h-9 w-56 rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] pl-9 pr-3 text-sm outline-none placeholder:text-[var(--ft-text-muted)] focus:border-[var(--ft-accent)]"
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search creators..."
            value={search}
          />
        </div>
      </div>

      {loading ? (
        <div className="mt-6">
          <LoadingBlock label="Loading creators" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            action={
              <Link href="/os/marketplace/creators/apply">
                <Button variant="secondary">Apply as Creator</Button>
              </Link>
            }
            copy="No creators have been listed in this marketplace yet. This catalog is curated separately and hasn't been seeded."
            icon={Globe}
            title="No creators listed yet"
          />
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((creator, i) => (
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              className="rounded-[var(--radius-xl)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-5 transition hover:border-[var(--ft-accent)]/30 hover:shadow-[var(--shadow-md)]"
              initial={{ opacity: 0, y: 8 }}
              key={creator.id}
              transition={{ delay: i * 0.03 }}
            >
              <div className="flex items-start gap-3">
                <div className="grid size-14 place-items-center rounded-full bg-[var(--ft-accent)]/10 text-lg font-bold text-[var(--ft-accent)]">
                  {creator.name[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold">{creator.name}</span>
                    {creator.verified && <CheckCircle2 className="size-3.5 text-[var(--ft-accent)]" />}
                  </div>
                  <p className="text-xs text-[var(--ft-text-muted)]">{creator.bio}</p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                <div className="rounded-[var(--radius-md)] bg-[var(--ft-bg-surface)] p-2 text-center">
                  <div className="text-sm font-bold">{formatFollowers(creator.followerCount)}</div>
                  <div className="text-[10px] text-[var(--ft-text-muted)]">Followers</div>
                </div>
                <div className="rounded-[var(--radius-md)] bg-[var(--ft-bg-surface)] p-2 text-center">
                  <div className="text-sm font-bold text-[var(--ft-green)]">{formatEngagement(creator.engagementBps)}</div>
                  <div className="text-[10px] text-[var(--ft-text-muted)]">Engagement</div>
                </div>
                <div className="rounded-[var(--radius-md)] bg-[var(--ft-bg-surface)] p-2 text-center">
                  <div className="text-sm font-bold">{creator.pastCampaigns}</div>
                  <div className="text-[10px] text-[var(--ft-text-muted)]">Campaigns</div>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-1">
                {creator.platforms.map((p) => <Badge key={p} tone="neutral">{p}</Badge>)}
                {creator.languages.map((l) => <Badge key={l} tone="info">{l}</Badge>)}
              </div>

              <div className="mt-4">
                <span className="text-lg font-bold text-[var(--ft-accent)]">
                  {formatRate(creator.rateMinor, creator.currency)}
                  <span className="text-xs font-normal text-[var(--ft-text-muted)]"> /post</span>
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
