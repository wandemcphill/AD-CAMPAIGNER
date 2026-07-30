"use client";

import { useState } from "react";
import { Code2, Copy, Eye, EyeOff, Key, Plus, Trash2 } from "lucide-react";

import { Badge, Button } from "@fliptrybe/ui";
import { Divider, AlertBanner } from "@fliptrybe/ui/components";

type ApiKey = { id: string; name: string; key: string; created: string; lastUsed: string };

const MOCK_KEYS: ApiKey[] = [
  { id: "1", name: "Production", key: "ft_live_a1b2c3d4e5f6g7h8i9j0", created: "Jan 15, 2025", lastUsed: "Today" },
  { id: "2", name: "Staging", key: "ft_test_k1l2m3n4o5p6q7r8s9t0", created: "Mar 20, 2025", lastUsed: "3 days ago" },
];

export default function ApiSettingsPage() {
  const [keys, setKeys] = useState(MOCK_KEYS);
  const [showKey, setShowKey] = useState<string>();

  function handleCopy(text: string) {
    void navigator.clipboard.writeText(text);
  }

  return (
    <div className="grid gap-8">
      <div className="rounded-[var(--radius-xl)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Code2 className="size-5 text-[var(--ft-accent)]" />
            <h2 className="font-semibold">API Keys</h2>
          </div>
          <Button><Plus className="size-4" /> Create key</Button>
        </div>
        <p className="mt-2 text-sm text-[var(--ft-text-secondary)]">
          Manage API keys for programmatic access to FlipTrybe
        </p>

        <AlertBanner className="mt-4" tone="warning">
          Keep your API keys secret. Do not share them in client-side code or public repositories.
        </AlertBanner>

        <div className="mt-6 divide-y divide-[var(--ft-border)]">
          {keys.map((apiKey) => (
            <div className="flex items-center gap-4 py-4" key={apiKey.id}>
              <div className="grid size-10 place-items-center rounded-[var(--radius-md)] bg-[var(--ft-bg-muted)]">
                <Key className="size-4 text-[var(--ft-text-muted)]" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{apiKey.name}</span>
                  <Badge tone={apiKey.name === "Production" ? "success" : "neutral"}>
                    {apiKey.name === "Production" ? "live" : "test"}
                  </Badge>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <code className="font-mono text-xs text-[var(--ft-text-muted)]">
                    {showKey === apiKey.id ? apiKey.key : `${apiKey.key.slice(0, 12)}${"•".repeat(12)}`}
                  </code>
                  <button
                    className="text-[var(--ft-text-muted)] hover:text-[var(--ft-text-primary)]"
                    onClick={() => setShowKey(showKey === apiKey.id ? undefined : apiKey.id)}
                    type="button"
                  >
                    {showKey === apiKey.id ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                  </button>
                  <button
                    className="text-[var(--ft-text-muted)] hover:text-[var(--ft-accent)]"
                    onClick={() => handleCopy(apiKey.key)}
                    type="button"
                  >
                    <Copy className="size-3.5" />
                  </button>
                </div>
                <div className="mt-1 text-xs text-[var(--ft-text-muted)]">
                  Created {apiKey.created} · Last used {apiKey.lastUsed}
                </div>
              </div>
              <button
                className="text-[var(--ft-text-muted)] hover:text-[var(--ft-red)]"
                onClick={() => setKeys((prev) => prev.filter((k) => k.id !== apiKey.id))}
                type="button"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>

        <Divider label="webhooks" />

        <div className="mt-4 rounded-[var(--radius-lg)] border border-dashed border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-6 text-center">
          <Code2 className="mx-auto size-8 text-[var(--ft-text-muted)]" />
          <div className="mt-2 text-sm font-medium">No webhooks configured</div>
          <div className="mt-1 text-xs text-[var(--ft-text-muted)]">Receive real-time event notifications via HTTP</div>
          <Button className="mt-4" variant="secondary"><Plus className="size-4" /> Add webhook</Button>
        </div>
      </div>
    </div>
  );
}
