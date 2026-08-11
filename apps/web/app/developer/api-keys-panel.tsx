"use client";

import { useEffect, useState } from "react";
import { Copy, Key, RefreshCw, Trash2 } from "lucide-react";

import { Badge, Button } from "@fliptrybe/ui";
import { Input } from "@fliptrybe/ui/components";

import {
  API_KEY_SCOPES,
  createApiKey,
  loadApiKeys,
  revokeApiKey,
  type ApiKeyEnvironment,
  type ApiKeyRecord,
  type CreatedApiKey
} from "./api";

// Shared API key management UI — used by both the merged Settings > AI Configuration
// page and the Integrations & Developer > API Keys tab, so there is one implementation
// against the real /developer/api-keys endpoints (list, create, revoke) instead of two.
export function ApiKeysPanel() {
  const [keys, setKeys] = useState<ApiKeyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [environment, setEnvironment] = useState<ApiKeyEnvironment>("TEST");
  const [scopes, setScopes] = useState<string[]>([]);
  const [createdKey, setCreatedKey] = useState<CreatedApiKey>();
  const [busy, setBusy] = useState<string>();
  const [scopeOpenId, setScopeOpenId] = useState<string>();

  async function refresh() {
    setError(undefined);
    try {
      setKeys(await loadApiKeys());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "API keys failed to load.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  function toggleScope(scope: string) {
    setScopes((prev) => (prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]));
  }

  async function onCreate() {
    if (!name.trim()) return;
    setBusy("create");
    setError(undefined);
    try {
      const result = await createApiKey({ name: name.trim(), environment, scopes });
      setCreatedKey(result);
      setName("");
      setScopes([]);
      setShowCreate(false);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create that key.");
    } finally {
      setBusy(undefined);
    }
  }

  async function onRevoke(id: string) {
    setBusy(id);
    try {
      await revokeApiKey(id);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not revoke that key.");
    } finally {
      setBusy(undefined);
    }
  }

  // "Rotate" isn't a distinct backend operation — there's no PATCH/rotate endpoint on
  // /developer/api-keys. We approximate it with the two real operations that do exist:
  // issue a fresh key with the same name/environment/scopes, then revoke the old one.
  async function onRotate(key: ApiKeyRecord) {
    setBusy(key.id);
    setError(undefined);
    try {
      const result = await createApiKey({ name: key.name, environment: key.environment, scopes: key.scopes });
      await revokeApiKey(key.id);
      setCreatedKey(result);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not rotate that key.");
    } finally {
      setBusy(undefined);
    }
  }

  async function onCopy(key: ApiKeyRecord) {
    await navigator.clipboard.writeText(key.keyPrefix);
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">API Keys</h3>
      </div>

      {error ? <div className="text-sm text-[var(--ft-red)]">{error}</div> : null}

      {createdKey ? (
        <div className="rounded-[var(--radius-lg)] border border-[var(--ft-yellow)]/30 bg-[var(--ft-yellow-subtle)] p-4">
          <div className="text-sm font-medium">API key (shown once — copy it now)</div>
          <div className="mt-2 flex items-center justify-between gap-2 rounded-[var(--radius-md)] bg-[var(--ft-bg-raised)] p-2">
            <code className="break-all text-xs">{createdKey.key}</code>
            <button onClick={() => void navigator.clipboard.writeText(createdKey.key)} type="button">
              <Copy className="size-4 text-[var(--ft-text-muted)]" />
            </button>
          </div>
          <Button className="mt-3" onClick={() => setCreatedKey(undefined)} variant="secondary">Done</Button>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)]">
        {loading ? (
          <p className="p-4 text-sm text-[var(--ft-text-muted)]">Loading...</p>
        ) : keys.length === 0 ? (
          <p className="p-4 text-sm text-[var(--ft-text-muted)]">No API keys yet. Generate one below.</p>
        ) : (
          <div className="divide-y divide-[var(--ft-border)]">
            {keys.map((key) => (
              <div className="grid gap-3 p-4" key={key.id}>
                <div className="flex flex-wrap items-center gap-3">
                  <Key className="size-4 shrink-0 text-[var(--ft-text-secondary)]" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      {key.name}
                      <Badge tone={key.environment === "PRODUCTION" ? "warning" : "neutral"}>{key.environment}</Badge>
                      {key.revokedAt ? <Badge tone="neutral">revoked</Badge> : null}
                    </div>
                    <div className="mt-1 font-mono text-xs text-[var(--ft-text-muted)]">{key.keyPrefix}</div>
                  </div>
                  {!key.revokedAt ? (
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        className="flex items-center gap-1 rounded-[var(--radius-md)] border border-[var(--ft-border)] px-2.5 py-1.5 text-xs hover:bg-[var(--ft-bg-muted)]"
                        onClick={() => void onCopy(key)}
                        type="button"
                      >
                        <Copy className="size-3.5" /> Copy
                      </button>
                      <button
                        className="flex items-center gap-1 rounded-[var(--radius-md)] border border-[var(--ft-border)] px-2.5 py-1.5 text-xs hover:bg-[var(--ft-bg-muted)] disabled:opacity-50"
                        disabled={busy === key.id}
                        onClick={() => void onRotate(key)}
                        type="button"
                      >
                        <RefreshCw className="size-3.5" /> {busy === key.id ? "Rotating..." : "Rotate"}
                      </button>
                      <button
                        className="flex items-center gap-1 rounded-[var(--radius-md)] border border-[var(--ft-border)] px-2.5 py-1.5 text-xs hover:bg-[var(--ft-bg-muted)]"
                        onClick={() => setScopeOpenId((prev) => (prev === key.id ? undefined : key.id))}
                        type="button"
                      >
                        Scope
                      </button>
                      <button disabled={busy === key.id} onClick={() => void onRevoke(key.id)} type="button">
                        <Trash2 className="size-4 text-[var(--ft-red)]" />
                      </button>
                    </div>
                  ) : null}
                </div>
                {scopeOpenId === key.id ? (
                  <div className="flex flex-wrap gap-1.5 rounded-[var(--radius-md)] bg-[var(--ft-bg-raised)] p-2.5">
                    {key.scopes.length === 0 ? (
                      <span className="text-xs text-[var(--ft-text-muted)]">No scopes assigned.</span>
                    ) : (
                      key.scopes.map((s) => <Badge key={s} tone="neutral">{s}</Badge>)
                    )}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreate ? (
        <div className="grid gap-3 rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-4">
          <Input id="key-name" label="Name" onChange={(e) => setName(e.currentTarget.value)} placeholder="e.g. Zapier integration" value={name} />
          <div className="flex gap-2">
            {(["TEST", "PRODUCTION"] as ApiKeyEnvironment[]).map((env) => (
              <button
                className="rounded-full border px-3 py-1 text-xs"
                key={env}
                onClick={() => setEnvironment(env)}
                style={
                  environment === env
                    ? { borderColor: "var(--ft-accent)", background: "var(--ft-accent-subtle)", color: "var(--ft-accent)" }
                    : { borderColor: "var(--ft-border)" }
                }
                type="button"
              >
                {env}
              </button>
            ))}
          </div>
          <div>
            <div className="mb-1.5 text-xs text-[var(--ft-text-muted)]">Scopes</div>
            <div className="flex flex-wrap gap-1.5">
              {API_KEY_SCOPES.map((scope) => (
                <button
                  className="rounded-full border px-2.5 py-1 text-xs"
                  key={scope}
                  onClick={() => toggleScope(scope)}
                  style={
                    scopes.includes(scope)
                      ? { borderColor: "var(--ft-accent)", background: "var(--ft-accent-subtle)", color: "var(--ft-accent)" }
                      : { borderColor: "var(--ft-border)" }
                  }
                  type="button"
                >
                  {scope}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <Button disabled={!name.trim() || busy === "create"} onClick={() => void onCreate()}>
              {busy === "create" ? "Creating..." : "Create key"}
            </Button>
            <Button onClick={() => setShowCreate(false)} variant="secondary">Cancel</Button>
          </div>
        </div>
      ) : (
        <Button onClick={() => setShowCreate(true)} variant="secondary">Generate New Key</Button>
      )}
    </div>
  );
}
