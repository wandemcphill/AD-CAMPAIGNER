"use client";

import { useCallback, useEffect, useState } from "react";
import { Globe, MessageSquare } from "lucide-react";

import { Badge, Panel, PermissionDenied } from "@fliptrybe/ui";

import { EmptyState, ErrorNotice, LoadingBlock } from "../../campaigns/components";
import { isForbiddenError } from "../../lib/api-client";
import { loadCountries, type NumberCountry } from "./api";

export default function NumbersCountryGridPage() {
  const [countries, setCountries] = useState<NumberCountry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [forbidden, setForbidden] = useState(false);

  const refresh = useCallback(async () => {
    setError(undefined);
    setForbidden(false);
    try {
      setCountries(await loadCountries());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We could not load available countries.");
      setForbidden(isForbiddenError(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (forbidden) {
    return (
      <PermissionDenied>
        You do not have permission to view virtual numbers for this workspace. Contact your
        workspace owner if you believe this is a mistake.
      </PermissionDenied>
    );
  }

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center gap-2">
          <Globe className="size-5 text-[var(--ft-accent)]" />
          <h1 className="text-xl font-bold">International Numbers</h1>
        </div>
        <p className="mt-1 text-sm text-[var(--ft-text-secondary)]">
          Get a real number to receive SMS from services around the world.
        </p>

        <ErrorNotice message={error} />

        <div className="mt-6">
          {loading ? (
            <Panel className="p-6">
              <LoadingBlock label="Loading countries" />
            </Panel>
          ) : countries.length === 0 ? (
            <Panel className="p-6">
              <EmptyState
                copy="No countries are available right now — check back shortly."
                icon={Globe}
                title="No countries available"
              />
            </Panel>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {countries.map((country) => (
                <a href={`/os/numbers/${country.isoCode}`} key={country.isoCode}>
                  <Panel className="flex items-center gap-4 p-4 transition hover:border-[var(--ft-accent)]/40">
                    <div className="text-3xl">{country.flagEmoji}</div>
                    <div className="flex-1">
                      <div className="text-sm font-semibold">{country.name}</div>
                      <div className="text-xs text-[var(--ft-text-muted)]">{country.dialPrefix}</div>
                    </div>
                    <Badge tone="info">
                      <MessageSquare className="size-3" />
                      SMS
                    </Badge>
                  </Panel>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
