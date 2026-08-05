"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Camera,
  Copy,
  Globe,
  Key,
  Plug,
  Plus,
  Trash2,
  Webhook
} from "lucide-react";

import { Badge, Button } from "@fliptrybe/ui";
import { Input, TabBar } from "@fliptrybe/ui/components";

import { useApiSession } from "../../../lib/use-session";
import {
  API_KEY_SCOPES,
  createApiKey,
  createWebhookSubscription,
  loadApiKeys,
  loadProvidersOverview,
  loadSupportedWebhookEvents,
  loadWebhookDeliveries,
  loadWebhookSubscriptions,
  revokeApiKey,
  revokeWebhookSubscription,
  type ApiKeyEnvironment,
  type ApiKeyRecord,
  type CreatedApiKey,
  type CreatedWebhookSubscription,
  type OutgoingWebhookSubscription,
  type ProviderCategory,
  type WebhookDelivery
} from "../../../developer/api";

const TABS = [
  { id: "connected", label: "Connected Services" },
  { id: "providers", label: "Providers" },
  { id: "webhooks", label: "Webhooks" },
  { id: "keys", label: "API Keys" }
];

const CONNECTED_SERVICES = {
  Advertising: [
    { name: "TikTok Ads", icon: Camera, description: "Launch and manage TikTok ad campaigns from FlipTrybe." },
    { name: "Meta Ads", icon: Globe, description: "Facebook & Instagram campaign management." },
    { name: "Google Ads", icon: Globe, description: "Search, Display, and YouTube ad campaigns." }
  ],
  "Creator Platforms": [
    { name: "TikTok", icon: Camera, description: "Sync creator profiles and content for the marketplace." },
    { name: "Instagram", icon: Camera, description: "Sync creator profiles and content for the marketplace." },
    { name: "YouTube", icon: Globe, description: "Sync creator channel stats for the marketplace." }
  ]
};

function ConnectedServicesTab() {
  return (
    <div className="grid gap-6">
      <div className="rounded-[var(--radius-md)] border border-[var(--ft-blue)]/30 bg-[var(--ft-blue-subtle)] p-3 text-xs leading-5 text-[var(--ft-text-secondary)]">
        None of these are connected yet — no OAuth integration has been built for any of them. This
        is what will eventually let FlipTrybe act on your behalf on these platforms.
      </div>
      {Object.entries(CONNECTED_SERVICES).map(([category, services]) => (
        <div key={category}>
          <h3 className="mb-2 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--ft-text-muted)]">{category}</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {services.map((service) => (
              <div
                className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-4"
                key={service.name}
              >
                <div className="grid size-10 shrink-0 place-items-center rounded-[var(--radius-md)] bg-[var(--ft-bg-muted)]">
                  <service.icon className="size-5 text-[var(--ft-text-secondary)]" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{service.name}</div>
                  <div className="text-xs text-[var(--ft-text-muted)]">{service.description}</div>
                </div>
                <Badge tone="warning">Coming soon</Badge>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function statusTone(status: string): "success" | "warning" | "danger" | "neutral" {
  if (status === "HEALTHY") return "success";
  if (status === "DEGRADED") return "warning";
  if (status === "DOWN") return "danger";
  return "neutral";
}

function ProvidersTab({ isAdmin }: { isAdmin: boolean }) {
  const [categories, setCategories] = useState<ProviderCategory[]>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    loadProvidersOverview()
      .then((r) => setCategories(r.categories))
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Providers failed to load."))
      .finally(() => setLoading(false));
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-6 text-center text-sm text-[var(--ft-text-muted)]">
        Only workspace admins can view provider status.
      </div>
    );
  }

  if (loading) return <p className="text-sm text-[var(--ft-text-muted)]">Loading providers...</p>;
  if (error) return <div className="text-sm text-[var(--ft-red)]">{error}</div>;

  return (
    <div className="grid gap-5">
      <p className="text-xs text-[var(--ft-text-muted)]">
        These are external services FlipTrybe uses behind the scenes to fulfill operations — not
        something you connect yourself.
      </p>
      {categories?.map((category) => (
        <div className="rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-4" key={category.key}>
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">{category.label}</h3>
            {category.providers.length === 0 && (
              <Badge tone="warning">Not configured</Badge>
            )}
          </div>
          {category.note ? <p className="mt-1 text-xs text-[var(--ft-text-muted)]">{category.note}</p> : null}
          {category.providers.length > 0 ? (
            <div className="mt-3 grid gap-2">
              {category.providers.map((provider) => (
                <div className="flex items-center justify-between rounded-[var(--radius-md)] bg-[var(--ft-bg-raised)] p-3" key={provider.name}>
                  <div>
                    <div className="text-sm font-medium">{provider.name}</div>
                    <div className="text-xs text-[var(--ft-text-muted)]">
                      {provider.services.join(", ")}
                      {provider.reason ? ` — ${provider.reason}` : ""}
                    </div>
                  </div>
                  <Badge tone={statusTone(provider.status)}>{provider.status.toLowerCase()}</Badge>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function WebhooksTab({ isAdmin }: { isAdmin: boolean }) {
  const [events, setEvents] = useState<string[]>([]);
  const [subs, setSubs] = useState<OutgoingWebhookSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [showCreate, setShowCreate] = useState(false);
  const [targetUrl, setTargetUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [createdSecret, setCreatedSecret] = useState<CreatedWebhookSubscription>();
  const [busy, setBusy] = useState<string>();
  const [expandedId, setExpandedId] = useState<string>();
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);

  async function refresh() {
    setError(undefined);
    try {
      const [eventList, subList] = await Promise.all([loadSupportedWebhookEvents(), loadWebhookSubscriptions()]);
      setEvents(eventList);
      setSubs(subList);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Webhooks failed to load.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  function toggleEvent(event: string) {
    setSelectedEvents((prev) => (prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]));
  }

  async function onCreate() {
    if (!targetUrl.trim() || selectedEvents.length === 0) return;
    setBusy("create");
    setError(undefined);
    try {
      const result = await createWebhookSubscription({ targetUrl: targetUrl.trim(), events: selectedEvents });
      setCreatedSecret(result);
      setTargetUrl("");
      setSelectedEvents([]);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create that subscription.");
    } finally {
      setBusy(undefined);
    }
  }

  async function onRevoke(id: string) {
    setBusy(id);
    try {
      await revokeWebhookSubscription(id);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not revoke that subscription.");
    } finally {
      setBusy(undefined);
    }
  }

  async function onExpand(id: string) {
    if (expandedId === id) {
      setExpandedId(undefined);
      return;
    }
    setExpandedId(id);
    try {
      setDeliveries(await loadWebhookDeliveries(id));
    } catch {
      setDeliveries([]);
    }
  }

  return (
    <div className="grid gap-6">
      <div>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Outgoing Webhooks</h3>
          <Button onClick={() => setShowCreate((v) => !v)} variant="secondary">
            <Plus className="size-4" /> New subscription
          </Button>
        </div>
        <p className="mt-1 text-xs text-[var(--ft-text-muted)]">
          Subscribe your own endpoint to real FlipTrybe events. Payloads are HMAC-signed.
        </p>

        {error ? <div className="mt-3 text-sm text-[var(--ft-red)]">{error}</div> : null}

        {showCreate && (
          <div className="mt-4 grid gap-3 rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-4">
            <Input
              id="webhook-url"
              label="Target URL"
              onChange={(e) => setTargetUrl(e.currentTarget.value)}
              placeholder="https://your-domain.com/webhooks/fliptrybe"
              value={targetUrl}
            />
            <div>
              <div className="mb-1.5 text-xs text-[var(--ft-text-muted)]">Events</div>
              <div className="flex flex-wrap gap-1.5">
                {events.map((event) => (
                  <button
                    className="rounded-full border px-2.5 py-1 text-xs transition"
                    key={event}
                    onClick={() => toggleEvent(event)}
                    style={
                      selectedEvents.includes(event)
                        ? { borderColor: "var(--ft-accent)", background: "var(--ft-accent-subtle)", color: "var(--ft-accent)" }
                        : { borderColor: "var(--ft-border)" }
                    }
                    type="button"
                  >
                    {event}
                  </button>
                ))}
              </div>
            </div>
            <Button disabled={!targetUrl.trim() || selectedEvents.length === 0 || busy === "create"} onClick={() => void onCreate()}>
              {busy === "create" ? "Creating..." : "Create subscription"}
            </Button>
          </div>
        )}

        {createdSecret ? (
          <div className="mt-4 rounded-[var(--radius-lg)] border border-[var(--ft-yellow)]/30 bg-[var(--ft-yellow-subtle)] p-4">
            <div className="text-sm font-medium">Signing secret (shown once)</div>
            <div className="mt-2 flex items-center justify-between gap-2 rounded-[var(--radius-md)] bg-[var(--ft-bg-raised)] p-2">
              <code className="break-all text-xs">{createdSecret.signingSecret}</code>
              <button
                onClick={() => void navigator.clipboard.writeText(createdSecret.signingSecret)}
                type="button"
              >
                <Copy className="size-4 text-[var(--ft-text-muted)]" />
              </button>
            </div>
            <Button className="mt-3" onClick={() => setCreatedSecret(undefined)} variant="secondary">Done</Button>
          </div>
        ) : null}

        <div className="mt-4 grid gap-2">
          {loading ? (
            <p className="text-sm text-[var(--ft-text-muted)]">Loading...</p>
          ) : subs.length === 0 ? (
            <p className="text-sm text-[var(--ft-text-muted)]">No webhook subscriptions yet.</p>
          ) : (
            subs.map((sub) => (
              <div className="rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-4" key={sub.id}>
                <div className="flex items-center gap-3">
                  <Webhook className="size-4 shrink-0 text-[var(--ft-text-secondary)]" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{sub.targetUrl}</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {sub.events.map((e) => <Badge key={e} tone="neutral">{e}</Badge>)}
                    </div>
                  </div>
                  <Badge tone={sub.isActive ? "success" : "neutral"}>{sub.isActive ? "active" : "revoked"}</Badge>
                  <Button onClick={() => void onExpand(sub.id)} variant="secondary">Deliveries</Button>
                  {sub.isActive ? (
                    <button disabled={busy === sub.id} onClick={() => void onRevoke(sub.id)} type="button">
                      <Trash2 className="size-4 text-[var(--ft-red)]" />
                    </button>
                  ) : null}
                </div>
                {expandedId === sub.id ? (
                  <div className="mt-3 grid gap-1 border-t border-[var(--ft-border)] pt-3">
                    {deliveries.length === 0 ? (
                      <p className="text-xs text-[var(--ft-text-muted)]">No deliveries yet.</p>
                    ) : (
                      deliveries.map((d) => (
                        <div className="flex items-center justify-between text-xs" key={d.id}>
                          <span>{d.eventName}</span>
                          <span className="text-[var(--ft-text-muted)]">
                            {d.status}{d.responseStatus ? ` (${d.responseStatus})` : ""} · {new Date(d.createdAt).toLocaleString()}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>
      </div>

      {isAdmin ? (
        <div className="rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-3 text-xs text-[var(--ft-text-muted)]">
          <AlertTriangle className="mr-1 inline size-3.5 text-[var(--ft-yellow)]" />
          Incoming webhook event logs (provider callbacks) are visible in the admin dashboard.
        </div>
      ) : null}
    </div>
  );
}

function ApiKeysTab() {
  const [keys, setKeys] = useState<ApiKeyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [environment, setEnvironment] = useState<ApiKeyEnvironment>("TEST");
  const [scopes, setScopes] = useState<string[]>([]);
  const [createdKey, setCreatedKey] = useState<CreatedApiKey>();
  const [busy, setBusy] = useState<string>();

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

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">API Keys</h3>
        <Button onClick={() => setShowCreate((v) => !v)} variant="secondary">
          <Plus className="size-4" /> New key
        </Button>
      </div>

      {error ? <div className="text-sm text-[var(--ft-red)]">{error}</div> : null}

      {showCreate && (
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
          <Button disabled={!name.trim() || busy === "create"} onClick={() => void onCreate()}>
            {busy === "create" ? "Creating..." : "Create key"}
          </Button>
        </div>
      )}

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

      <div className="grid gap-2">
        {loading ? (
          <p className="text-sm text-[var(--ft-text-muted)]">Loading...</p>
        ) : keys.length === 0 ? (
          <p className="text-sm text-[var(--ft-text-muted)]">No API keys yet.</p>
        ) : (
          keys.map((key) => (
            <div className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-4" key={key.id}>
              <Key className="size-4 shrink-0 text-[var(--ft-text-secondary)]" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm font-medium">
                  {key.name}
                  <Badge tone={key.environment === "PRODUCTION" ? "warning" : "neutral"}>{key.environment}</Badge>
                </div>
                <div className="mt-1 font-mono text-xs text-[var(--ft-text-muted)]">{key.keyPrefix}</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {key.scopes.map((s) => <Badge key={s} tone="neutral">{s}</Badge>)}
                </div>
              </div>
              {key.revokedAt ? (
                <Badge tone="neutral">revoked</Badge>
              ) : (
                <button disabled={busy === key.id} onClick={() => void onRevoke(key.id)} type="button">
                  <Trash2 className="size-4 text-[var(--ft-red)]" />
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function IntegrationsPage() {
  const router = useRouter();
  const { session } = useApiSession();
  const isAdmin = session?.role === "OWNER" || session?.role === "ADMIN";
  const visibleTabs = isAdmin ? TABS : TABS.filter((tabItem) => tabItem.id === "connected");
  const [tab, setTab] = useState("connected");

  useEffect(() => {
    if (session && !isAdmin) {
      router.replace("/os/settings/profile");
    }
  }, [isAdmin, router, session]);

  useEffect(() => {
    if (!visibleTabs.some((tabItem) => tabItem.id === tab)) {
      setTab(visibleTabs[0]?.id ?? "connected");
    }
  }, [tab, visibleTabs]);

  if (session && !isAdmin) {
    return null;
  }

  return (
    <div className="grid gap-6">
      <div className="rounded-[var(--radius-xl)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-6">
        <div className="flex items-center gap-2">
          <Plug className="size-5 text-[var(--ft-accent)]" />
          <h2 className="font-semibold">Integrations & Developer</h2>
        </div>
        <p className="mt-2 text-sm text-[var(--ft-text-secondary)]">
          FlipTrybe&apos;s external-service architecture — what you can connect, what FlipTrybe uses
          behind the scenes, and how to build against the FlipTrybe API.
        </p>

        <div className="mt-6">
          <TabBar items={visibleTabs} onChange={setTab} value={tab} />
        </div>

        <div className="mt-6">
          {tab === "connected" && <ConnectedServicesTab />}
          {tab === "providers" && <ProvidersTab isAdmin={isAdmin} />}
          {tab === "webhooks" && <WebhooksTab isAdmin={isAdmin} />}
          {tab === "keys" && <ApiKeysTab />}
        </div>
      </div>
    </div>
  );
}
