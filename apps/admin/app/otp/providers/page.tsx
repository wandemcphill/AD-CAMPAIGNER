import { PauseCircle, PlayCircle } from "lucide-react";

import { Badge, Button, Panel } from "@fliptrybe/ui";

import { AdminOtpShell, AdminPageHeader, ProviderBadge } from "../components";
import { providers } from "../data";

export default function AdminOtpProvidersPage() {
  return (
    <AdminOtpShell active="/otp/providers">
      <AdminPageHeader
        eyebrow={<Badge tone="info">Provider routing</Badge>}
        title="Providers"
        action={
          <Button>
            <PlayCircle className="size-4" /> Add route
          </Button>
        }
      />

      <Panel className="mt-6 overflow-hidden">
        <div className="divide-y divide-zinc-200">
          {providers.map((provider) => (
            <div
              className="grid gap-3 p-4 xl:grid-cols-[1fr_auto_auto_auto_auto_auto_auto] xl:items-center"
              key={provider.name}
            >
              <div>
                <div className="font-semibold text-zinc-950">{provider.name}</div>
                <div className="text-sm text-zinc-500">{provider.spend} processed today</div>
              </div>
              <ProviderBadge state={provider.state} />
              <div className="text-sm text-zinc-600">
                <span className="font-semibold text-zinc-950">{provider.fill}</span> fill
              </div>
              <div className="text-sm text-zinc-600">
                <span className="font-semibold text-zinc-950">{provider.latency}</span> latency
              </div>
              <div className="text-sm text-zinc-600">
                <span className="font-semibold text-zinc-950">{provider.stock}</span> stock
              </div>
              <div className="text-sm text-zinc-600">
                <span className="font-semibold text-zinc-950">{provider.refund}</span> refund
              </div>
              <Button
                className="px-3"
                variant={provider.state === "paused" ? "secondary" : "ghost"}
              >
                <PauseCircle className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      </Panel>
    </AdminOtpShell>
  );
}
