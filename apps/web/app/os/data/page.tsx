"use client";

import { useEffect } from "react";

// /os/airtime/data is the real nested route for the Data tab — this route
// exists so the nav's "Data" item, and any stale bookmarks/links to the old
// "/os/airtime?tab=data" deep link's shim, still resolve correctly.
export default function DataRedirectPage() {
  useEffect(() => {
    window.location.replace("/os/airtime/data");
  }, []);

  return <main className="min-h-screen bg-[var(--ft-bg-base)]" />;
}
