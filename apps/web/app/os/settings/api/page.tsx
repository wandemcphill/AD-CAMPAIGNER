"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// This route used to render its own API-key UI from a hardcoded MOCK_KEYS array
// while /os/settings/integrations already had a fully wired API Keys tab
// (loadApiKeys / createApiKey / revokeApiKey against /developer/api-keys).
// Two implementations of one feature, one of them fake. The real one wins; this
// route stays as a deep link so existing bookmarks keep working.
export default function ApiSettingsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/os/settings/integrations?tab=keys");
  }, [router]);

  return <main className="min-h-screen bg-[var(--ft-bg-base)]" />;
}
