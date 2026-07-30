"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Search as SearchIcon } from "lucide-react";
import { motion } from "framer-motion";

import { Badge, Panel } from "@fliptrybe/ui";

import {
  search as runSearch,
  searchResultHref,
  searchResultLabel,
  type SearchResult
} from "../../search/api";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    if (!debouncedQuery) {
      setResults([]);
      setError(undefined);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(undefined);

    runSearch(debouncedQuery)
      .then((response) => {
        if (!cancelled) setResults(response.results);
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Search failed. Try again.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="relative">
          <SearchIcon className="absolute left-5 top-1/2 size-5 -translate-y-1/2 text-[var(--ft-text-muted)]" />
          <input
            autoFocus
            className="h-14 w-full rounded-[var(--radius-xl)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] pl-14 pr-5 text-lg outline-none transition placeholder:text-[var(--ft-text-muted)] focus:border-[var(--ft-accent)] focus:shadow-[0_0_0_3px_var(--ft-accent-glow)]"
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search campaigns, team, growth orders, vouchers..."
            value={query}
          />
        </div>

        {!debouncedQuery && (
          <p className="mt-6 text-sm text-[var(--ft-text-muted)]">
            Search across campaigns, team members, growth orders, and vouchers in your workspace.
          </p>
        )}

        {error ? (
          <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--ft-red)]/30 bg-[var(--ft-red-subtle)] p-3 text-sm text-[var(--ft-text-secondary)]">
            {error}
          </div>
        ) : null}

        {debouncedQuery && !error && (
          <motion.div animate={{ opacity: 1 }} className="mt-4" initial={{ opacity: 0 }}>
            <div className="mb-2 text-xs text-[var(--ft-text-muted)]">
              {loading ? "Searching..." : `${results.length} result${results.length === 1 ? "" : "s"} for "${debouncedQuery}"`}
            </div>

            {!loading && results.length === 0 ? (
              <Panel className="p-6 text-center text-sm text-[var(--ft-text-muted)]">
                No matches. Try a different name or keyword.
              </Panel>
            ) : (
              <Panel className="overflow-hidden p-2">
                <div className="grid gap-1">
                  {results.map((result) => (
                    <a
                      className="flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-left transition hover:bg-[var(--ft-bg-muted)]"
                      href={searchResultHref[result.type](result.id)}
                      key={`${result.type}-${result.id}`}
                    >
                      <Badge tone="neutral">{searchResultLabel[result.type]}</Badge>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{result.title}</div>
                        <div className="text-xs text-[var(--ft-text-muted)]">{result.meta}</div>
                      </div>
                      <ArrowRight className="size-3.5 shrink-0 text-[var(--ft-text-muted)]" />
                    </a>
                  ))}
                </div>
              </Panel>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
