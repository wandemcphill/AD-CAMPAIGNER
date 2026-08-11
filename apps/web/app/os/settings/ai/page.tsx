"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, Info, Save } from "lucide-react";

import { Button } from "@fliptrybe/ui";
import { Divider, Input } from "@fliptrybe/ui/components";

import { useApiSession } from "../../../lib/use-session";
import { ApiKeysPanel } from "../../../developer/api-keys-panel";

const MODEL_PROVIDERS = ["OpenAI", "Gemini"] as const;
const DEFAULT_ENDPOINTS: Record<(typeof MODEL_PROVIDERS)[number], string> = {
  OpenAI: "https://api.openai.com/v1",
  Gemini: "https://generativelanguage.googleapis.com/v1beta"
};

// NOTE: there is no backend for AI configuration yet — no controller persists model
// provider / endpoint / system-prompt settings (only apps/api/src/modules/ai-brain.client.ts
// exists, and that's a client for calling an AI provider, not settings CRUD). Save Changes
// below only updates local component state; it does not call any API. Wire this up to a
// real endpoint once one exists instead of pretending this already persists.
export default function AiConfigurationPage() {
  const router = useRouter();
  const { session } = useApiSession();
  const isAdmin = session?.role === "OWNER" || session?.role === "ADMIN";

  useEffect(() => {
    if (session && !isAdmin) {
      router.replace("/os/settings/profile");
    }
  }, [isAdmin, router, session]);

  const [provider, setProvider] = useState<(typeof MODEL_PROVIDERS)[number]>("OpenAI");
  const [endpoint, setEndpoint] = useState(DEFAULT_ENDPOINTS.OpenAI);
  const [systemPrompt, setSystemPrompt] = useState(
    "You are an expert ad copywriter. Generate engaging, high-converting ad copy for ..."
  );
  const [savedNotice, setSavedNotice] = useState(false);

  function onProviderChange(value: string) {
    const next = value as (typeof MODEL_PROVIDERS)[number];
    setProvider(next);
    setEndpoint(DEFAULT_ENDPOINTS[next]);
  }

  function onSave() {
    // Not backend-wired — see note above. This just acknowledges the click locally.
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2500);
  }

  function onCancel() {
    setProvider("OpenAI");
    setEndpoint(DEFAULT_ENDPOINTS.OpenAI);
    setSystemPrompt("You are an expert ad copywriter. Generate engaging, high-converting ad copy for ...");
  }

  if (session && !isAdmin) {
    return null;
  }

  return (
    <div className="grid gap-8">
      <div className="rounded-[var(--radius-xl)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-6">
        <div className="flex items-center gap-2">
          <Bot className="size-5 text-[var(--ft-accent)]" />
          <h2 className="font-semibold">AI Configuration</h2>
        </div>
        <p className="mt-2 flex items-start gap-1.5 text-xs text-[var(--ft-text-muted)]">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          Not yet backed by a live endpoint — these settings are placeholders for the model
          provider integration and are not persisted to the server.
        </p>

        <div className="mt-6 grid gap-5">
          <div className="grid gap-1.5">
            <label className="text-sm font-medium" htmlFor="model-provider">Model Provider</label>
            <select
              className="h-11 rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-4 text-sm outline-none focus:border-[var(--ft-accent)]"
              id="model-provider"
              onChange={(e) => onProviderChange(e.target.value)}
              value={provider}
            >
              {MODEL_PROVIDERS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          <Input
            id="api-endpoint"
            label="API Endpoint"
            onChange={(e) => setEndpoint(e.currentTarget.value)}
            value={endpoint}
          />

          <div className="grid gap-1.5">
            <label className="text-sm font-medium" htmlFor="system-prompt">
              System Prompt Overrides (Campaign Automation)
            </label>
            <textarea
              className="min-h-[110px] resize-y rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-4 py-3 text-sm outline-none focus:border-[var(--ft-accent)]"
              id="system-prompt"
              onChange={(e) => setSystemPrompt(e.currentTarget.value)}
              value={systemPrompt}
            />
          </div>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <Button onClick={onSave}><Save className="size-4" /> Save Changes</Button>
          <Button onClick={onCancel} variant="secondary">Cancel</Button>
          {savedNotice ? (
            <span className="text-xs text-[var(--ft-text-muted)]">Saved locally (not sent to a server).</span>
          ) : null}
        </div>
      </div>

      <Divider />

      <div id="api-keys" className="rounded-[var(--radius-xl)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-6">
        <ApiKeysPanel />
      </div>
    </div>
  );
}
