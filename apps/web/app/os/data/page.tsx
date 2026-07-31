"use client";

import { useEffect } from "react";

// /os/airtime already handles both airtime and data via tabs (see vtu-api.ts) — this
// route exists so the nav's "Data" item deep-links straight to the Data tab and still
// gets correct active-state highlighting (which a raw query-string href would break).
export default function DataRedirectPage() {
  useEffect(() => {
    window.location.replace("/os/airtime?tab=data");
  }, []);

  return <main className="min-h-screen bg-[var(--ft-bg-base)]" />;
}
