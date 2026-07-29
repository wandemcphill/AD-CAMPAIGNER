"use client";

import { motion } from "framer-motion";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";

import { trackHomepageEvent } from "./analytics";
import { marketplaceTalent } from "./data";
import { SummaryStatStrip } from "@fliptrybe/ui";

type MarketplaceProps = {
  reducedMotion: boolean;
};

export function Marketplace({ reducedMotion }: MarketplaceProps) {
  const [query, setQuery] = useState("");
  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    if (!normalized) {
      return marketplaceTalent;
    }

    return marketplaceTalent.filter((talent) =>
      [talent.category, talent.name, ...talent.tags].some((value) =>
        value.toLowerCase().includes(normalized.split(" ")[0] ?? normalized)
      )
    );
  }, [query]);
  const hasQuery = query.trim().length > 0;
  const visibleResults = results.length > 0 ? results : [];
  const updateQuery = (nextQuery: string) => {
    setQuery(nextQuery);
    trackHomepageEvent("marketplace_search_changed", {
      queryLength: nextQuery.trim().length,
      resultCount: marketplaceTalent.filter((talent) =>
        [talent.category, talent.name, ...talent.tags].some((value) =>
          value.toLowerCase().includes((nextQuery.trim().toLowerCase().split(" ")[0] ?? "").toLowerCase())
        )
      ).length
    });
  };

  return (
    <section
      className="relative border-t border-white/10 bg-[#050507] px-4 py-20 sm:px-6"
      id="marketplace"
    >
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-end">
          <div>
            <div className="font-mono text-xs uppercase tracking-[0.26em] text-[var(--flip-emerald)]">
              05 / Marketplace
            </div>
            <h2 className="mt-4 max-w-xl text-4xl font-black tracking-normal text-white sm:text-5xl">
              Find the people the campaign needs next.
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-6 text-white/58">
              Search curated agencies, designers, writers, and media operators that can slot into
              a live campaign without breaking the flow of the dashboard.
            </p>
          </div>
          <div className="grid gap-3">
            <label className="relative block">
              <span className="sr-only">Search marketplace talent</span>
              <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-white/42" />
              <input
                aria-describedby="marketplace-result-count"
                className="h-14 w-full rounded-md border border-white/12 bg-white/[0.06] pr-4 pl-12 text-white outline-none transition placeholder:text-white/35 focus:border-[var(--flip-amber)]"
                onChange={(event) => updateQuery(event.target.value)}
                placeholder="Search agencies, designers, video editors"
                value={query}
              />
            </label>
            <SummaryStatStrip
              items={[
                { label: "catalog", value: String(marketplaceTalent.length) },
                { label: "visible", value: String(visibleResults.length) },
                { label: "query", value: query.trim() || "All talent" }
              ]}
            />
          </div>
        </div>

        <p
          aria-live="polite"
          className="mt-4 font-mono text-xs uppercase tracking-[0.2em] text-white/40"
          id="marketplace-result-count"
        >
          {visibleResults.length > 0
            ? `${visibleResults.length} marketplace ${visibleResults.length === 1 ? "match" : "matches"}`
            : "No exact marketplace match"}
        </p>

        <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {visibleResults.map((talent, index) => (
            <motion.article
              animate={{ y: reducedMotion ? 0 : [0, -6, 0] }}
              className="min-h-[260px] rounded-[12px] border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl"
              key={talent.name}
              transition={{ delay: index * 0.1, duration: 3, repeat: reducedMotion ? 0 : Infinity }}
            >
              <div className="flex items-center justify-between gap-3">
                <span
                  className="rounded-md border border-white/10 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em]"
                  style={{ color: talent.accent }}
                >
                  {talent.category}
                </span>
                <span className="font-mono text-xs text-white/48">{talent.match}</span>
              </div>
              <h3 className="mt-8 text-2xl font-bold text-white">{talent.name}</h3>
              <div className="mt-5 flex flex-wrap gap-2">
                {talent.tags.map((tag) => (
                  <span
                    className="rounded-md border border-white/10 bg-black/28 px-2.5 py-1.5 text-xs text-white/58"
                    key={tag}
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <div className="mt-7 h-1.5 overflow-hidden rounded-full bg-white/8">
                <motion.div
                  animate={{ width: talent.match }}
                  className="h-full rounded-full"
                  style={{ backgroundColor: talent.accent }}
                  transition={{ duration: reducedMotion ? 0 : 0.9 }}
                />
              </div>
            </motion.article>
          ))}
          {visibleResults.length === 0 ? (
            <div className="rounded-[12px] border border-white/10 bg-white/[0.04] p-5 text-white/58 md:col-span-2 xl:col-span-5">
              <div className="text-xl font-semibold text-white">No exact match yet.</div>
              <p className="mt-2 text-sm leading-6">
                Try searching agencies, designers, copywriters, video editors, WhatsApp, TikTok,
                flyers, or funnels.
              </p>
              {hasQuery ? (
                <button
                  className="mt-4 rounded-md border border-white/12 px-3 py-2 text-sm font-semibold text-white transition hover:border-white/24"
                  onClick={() => updateQuery("")}
                  type="button"
                >
                  Show all marketplace talent
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
