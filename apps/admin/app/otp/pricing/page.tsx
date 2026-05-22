import { BadgeDollarSign, Save } from "lucide-react";

import { Badge, Button, Panel } from "@fliptrybe/ui";

import { AdminOtpShell, AdminPageHeader } from "../components";
import { pricingRows } from "../data";

export default function AdminOtpPricingPage() {
  return (
    <AdminOtpShell active="/otp/pricing">
      <AdminPageHeader
        eyebrow={<Badge tone="info">Margin rules</Badge>}
        title="Pricing"
        action={
          <Button>
            <Save className="size-4" /> Save changes
          </Button>
        }
      />

      <div className="mt-6 grid gap-4 xl:grid-cols-[0.7fr_1.3fr]">
        <Panel className="p-4">
          <BadgeDollarSign className="size-5 text-zinc-950" />
          <h2 className="mt-4 text-lg font-semibold text-zinc-950">Global guardrails</h2>
          <div className="mt-5 grid gap-4">
            <label className="grid gap-2 text-sm font-medium text-zinc-700">
              Minimum margin
              <input
                className="h-11 rounded-md border border-zinc-200 bg-white px-3 text-zinc-950"
                defaultValue="NGN 75"
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-zinc-700">
              High-risk surcharge
              <input
                className="h-11 rounded-md border border-zinc-200 bg-white px-3 text-zinc-950"
                defaultValue="12%"
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-zinc-700">
              Auto-reprice interval
              <select className="h-11 rounded-md border border-zinc-200 bg-white px-3 text-zinc-950">
                <option>15 minutes</option>
                <option>30 minutes</option>
                <option>Hourly</option>
              </select>
            </label>
          </div>
        </Panel>

        <Panel className="overflow-hidden">
          <div className="divide-y divide-zinc-200">
            {pricingRows.map((row) => (
              <div
                className="grid gap-3 p-4 lg:grid-cols-[1fr_0.8fr_0.6fr_0.5fr_0.6fr_0.6fr] lg:items-center"
                key={`${row.service}-${row.country}`}
              >
                <div>
                  <div className="font-semibold text-zinc-950">{row.service}</div>
                  <div className="text-sm text-zinc-500">{row.country}</div>
                </div>
                <Badge tone="neutral">Auto</Badge>
                <div className="text-sm text-zinc-600">
                  Base <span className="font-semibold text-zinc-950">{row.base}</span>
                </div>
                <div className="text-sm text-zinc-600">{row.markup}</div>
                <div className="text-sm font-semibold text-zinc-950">{row.user}</div>
                <div className="text-sm text-green-700">{row.margin}</div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </AdminOtpShell>
  );
}
