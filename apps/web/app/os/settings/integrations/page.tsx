"use client";

import { CheckCircle2, ExternalLink, Plug, Webhook } from "lucide-react";

import { Badge, Button } from "@fliptrybe/ui";

type Integration = {
  id: string;
  name: string;
  description: string;
  status: "connected" | "available" | "coming_soon";
  category: string;
};

const INTEGRATIONS: Integration[] = [
  { id: "1", name: "TikTok Ads", description: "Run campaigns on TikTok", status: "connected", category: "Advertising" },
  { id: "2", name: "Meta Ads", description: "Facebook & Instagram campaigns", status: "available", category: "Advertising" },
  { id: "3", name: "Google Ads", description: "Search, display, and YouTube ads", status: "coming_soon", category: "Advertising" },
  { id: "4", name: "Korapay", description: "Payment processing & disbursement", status: "connected", category: "Payments" },
  { id: "5", name: "Paystack", description: "Card payments & transfers", status: "connected", category: "Payments" },
  { id: "6", name: "Slack", description: "Campaign notifications", status: "available", category: "Notifications" },
  { id: "7", name: "WhatsApp Business", description: "Customer engagement", status: "coming_soon", category: "Messaging" },
];

const STATUS_CONFIG: Record<string, { tone: "success" | "neutral" | "warning"; label: string }> = {
  connected: { tone: "success", label: "Connected" },
  available: { tone: "neutral", label: "Available" },
  coming_soon: { tone: "warning", label: "Coming soon" },
};

export default function IntegrationsPage() {
  return (
    <div className="grid gap-8">
      <div className="rounded-[var(--radius-xl)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-6">
        <div className="flex items-center gap-2">
          <Webhook className="size-5 text-[var(--ft-accent)]" />
          <h2 className="font-semibold">Integrations</h2>
          <Badge tone="success">3 connected</Badge>
        </div>
        <p className="mt-2 text-sm text-[var(--ft-text-secondary)]">
          Connect external services to enhance your campaigns
        </p>

        <div className="mt-6 grid gap-3">
          {INTEGRATIONS.map((integration) => {
            const status = STATUS_CONFIG[integration.status];
            return (
              <div
                className="flex items-center gap-4 rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-4 transition hover:border-[var(--ft-accent)]/30"
                key={integration.id}
              >
                <div className="grid size-10 place-items-center rounded-[var(--radius-md)] bg-[var(--ft-bg-muted)]">
                  <Plug className="size-5 text-[var(--ft-text-secondary)]" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{integration.name}</span>
                    {integration.status === "connected" && <CheckCircle2 className="size-3.5 text-[var(--ft-green)]" />}
                  </div>
                  <div className="text-xs text-[var(--ft-text-muted)]">{integration.description}</div>
                </div>
                <Badge tone={status?.tone ?? "neutral"}>{status?.label ?? integration.status}</Badge>
                {integration.status === "available" && (
                  <Button variant="secondary">
                    Connect
                    <ExternalLink className="size-3.5" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
