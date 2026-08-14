"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, Info, Save } from "lucide-react";

import { Button } from "@fliptrybe/ui";
import { Divider, Input } from "@fliptrybe/ui/components";

import { useApiSession } from "../../../lib/use-session";
import { ApiKeysPanel } from "../../../developer/api-keys-panel";
import { loadAiConfig, updateAiConfig, type AiConfig } from "../../../developer/api";

const MODEL_PROVIDERS = ["OpenAI", "Gemini"] as const;
const DEFAULT_ENDPOINTS: Record<(typeof MODEL_PROVIDERS)[number], string> = {
  OpenAI: "https://api.openai.com/v1",
  Gemini: "https://generativelanguage.googleapis.com/v1beta"
};
const DEFAULT_SYSTEM_PROMPT =
  "You are an expert ad copywriter. Generate engaging, high-converting ad copy for ...";

export default function AiConfigurationPage() {
  const router = useRouter();
  const { session } = useApiSession();
  const isAdmin = Boolean(session?.isPlatformAdmin);

  useEffect(() => {
    if (session && !isAdmin) {
      router.replace("/os/settings/profile");
    }
  }, [isAdmin, router, session]);

  const [provider, setProvider] = useState<(typeof MODEL_PROVIDERS)[number]>("OpenAI");
  const [endpoint, setEndpoint] = useState(DEFAULT_ENDPOINTS.OpenAI);
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [lastSaved, setLastSaved] = useState<AiConfig>();

  function applyConfig(config: AiConfig) {
    setProvider(config.modelProvider);
    setEndpoint(config.apiEndpoint);
    setSystemPrompt(config.systemPromptOverride || DEFAULT_SYSTEM_PROMPT);
    setLastSaved(config);
  }

  async function refresh() {
    setError(undefined);
    try {
      applyConfig(await loadAiConfig());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "AI configuration failed to load.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  function onProviderChange(value: string) {
    const next = value as (typeof MODEL_PROVIDERS)[number];
    setProvider(next);
    setEndpoint(DEFAULT_ENDPOINTS[next]);
  }

  async function onSave() {
    setSaving(true);
    setError(undefined);
    try {
      const result = await updateAiConfig({
        modelProvider: provider,
        apiEndpoint: endpoint,
        systemPromptOverride: systemPrompt
      });
      applyConfig(result);
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 2500);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save AI configuration.");
    } finally {
      setSaving(false);
    }
  }

  function onCancel() {
    if (lastSaved) {
      applyConfig(lastSaved);
      return;
    }
    setProvider("OpenAI");
    setEndpoint(DEFAULT_ENDPOINTS.OpenAI);
    setSystemPrompt(DEFAULT_SYSTEM_PROMPT);
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
          Per-workspace settings for the model provider integration, persisted to the server.
        </p>

        {error ? <div className="mt-3 text-sm text-[var(--ft-red)]">{error}</div> : null}

        <div className="mt-6 grid gap-5">
          <div className="grid gap-1.5">
            <label className="text-sm font-medium" htmlFor="model-provider">Model Provider</label>
            <select
              className="h-11 rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-4 text-sm outline-none focus:border-[var(--ft-accent)]"
              disabled={loading}
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
            disabled={loading}
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
              disabled={loading}
              id="system-prompt"
              onChange={(e) => setSystemPrompt(e.currentTarget.value)}
              value={systemPrompt}
            />
          </div>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <Button disabled={loading || saving} onClick={() => void onSave()}>
            <Save className="size-4" /> {saving ? "Saving..." : "Save Changes"}
          </Button>
          <Button disabled={loading || saving} onClick={onCancel} variant="secondary">Cancel</Button>
          {savedNotice ? (
            <span className="text-xs text-[var(--ft-text-muted)]">Saved.</span>
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
