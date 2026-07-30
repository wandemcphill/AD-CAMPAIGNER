"use client";

import { useState } from "react";
import { Building2, Save, Upload } from "lucide-react";

import { Badge, Button } from "@fliptrybe/ui";
import { Input, Divider } from "@fliptrybe/ui/components";

export default function WorkspaceSettingsPage() {
  const [name, setName] = useState("FlipTrybe Studio");
  const [slug, setSlug] = useState("fliptrybe-studio");
  const [timezone, setTimezone] = useState("Africa/Lagos");

  return (
    <div className="grid gap-8">
      <div className="rounded-[var(--radius-xl)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-6">
        <div className="flex items-center gap-2">
          <Building2 className="size-5 text-[var(--ft-accent)]" />
          <h2 className="font-semibold">Workspace</h2>
        </div>

        <div className="mt-6 grid gap-5">
          <div className="flex items-center gap-4">
            <div className="grid size-16 place-items-center rounded-[var(--radius-lg)] border-2 border-dashed border-[var(--ft-border)] bg-[var(--ft-bg-surface)]">
              <Upload className="size-5 text-[var(--ft-text-muted)]" />
            </div>
            <div>
              <div className="text-sm font-medium">Workspace logo</div>
              <div className="text-xs text-[var(--ft-text-muted)]">PNG, JPG up to 2MB</div>
            </div>
          </div>

          <Input id="ws-name" label="Workspace name" onChange={(e) => setName(e.currentTarget.value)} type="text" value={name} />
          <Input id="ws-slug" label="Workspace URL slug" hint="fliptrybe.com/ws/your-slug" onChange={(e) => setSlug(e.currentTarget.value)} type="text" value={slug} />

          <div className="grid gap-1.5">
            <label className="text-sm font-medium" htmlFor="tz">Timezone</label>
            <select
              className="h-11 rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-4 text-sm outline-none focus:border-[var(--ft-accent)]"
              id="tz"
              onChange={(e) => setTimezone(e.target.value)}
              value={timezone}
            >
              <option value="Africa/Lagos">Africa/Lagos (WAT)</option>
              <option value="Africa/Nairobi">Africa/Nairobi (EAT)</option>
              <option value="Europe/London">Europe/London (GMT)</option>
              <option value="America/New_York">America/New York (EST)</option>
            </select>
          </div>
        </div>

        <Divider />

        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">Default currency</div>
            <div className="text-xs text-[var(--ft-text-muted)]">All wallet transactions use this currency</div>
          </div>
          <Badge tone="info">NGN (₦)</Badge>
        </div>

        <div className="mt-6 flex justify-end">
          <Button><Save className="size-4" /> Save changes</Button>
        </div>
      </div>
    </div>
  );
}
