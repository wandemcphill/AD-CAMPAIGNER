import type { ReactNode } from "react";

import { Badge, cn } from "@fliptrybe/ui";

import {
  adminAccessEnabled,
  navItems,
  serviceTone,
  statusTone,
  type AdminAccessRequest,
  type AdminServiceState
} from "./data";

export function AdminDigitalAccessShell({
  children,
  active
}: {
  children: ReactNode;
  active: string;
}) {
  return (
    <main className="min-h-screen">
      <div className="grid min-h-screen grid-cols-1 xl:grid-cols-[260px_1fr]">
        <aside className="border-b border-zinc-200 bg-zinc-950 px-4 py-4 text-white xl:border-r xl:border-b-0">
          <a className="flex items-center gap-3" href="/digital-access">
            <div className="flex size-10 items-center justify-center rounded-md bg-white text-sm font-semibold text-zinc-950">
              DA
            </div>
            <div>
              <div className="text-sm font-semibold">Digital Access</div>
              <div className="text-xs text-zinc-400">Admin suite</div>
            </div>
          </a>

          <nav className="mt-6 grid grid-cols-2 gap-1 xl:grid-cols-1">
            {navItems.map((item) => (
              <a
                className={cn(
                  "flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition",
                  active === item.href
                    ? "bg-white text-zinc-950"
                    : "text-zinc-300 hover:bg-white/10 hover:text-white"
                )}
                href={item.href}
                key={item.href}
              >
                <item.icon className="size-4" />
                <span>{item.label}</span>
              </a>
            ))}
          </nav>

          <div className="mt-6 hidden rounded-lg border border-white/10 bg-white/5 p-4 xl:block">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">Feature flag</div>
              <Badge tone={adminAccessEnabled ? "success" : "warning"}>
                {adminAccessEnabled ? "Live" : "Off"}
              </Badge>
            </div>
            <div className="mt-4 grid gap-3 text-sm text-zinc-300">
              <div className="flex justify-between">
                <span>Payment</span>
                <span className="font-medium text-white">Wallet debit</span>
              </div>
              <div className="flex justify-between">
                <span>Refunds</span>
                <span className="font-medium text-white">Auto reversal</span>
              </div>
              <div className="flex justify-between">
                <span>Catalog</span>
                <span className="font-medium text-white">Owner managed</span>
              </div>
            </div>
          </div>
        </aside>

        <section className="px-4 py-4 sm:px-6 lg:px-8">{children}</section>
      </div>
    </main>
  );
}

export function AdminPageHeader({
  eyebrow,
  title,
  action
}: {
  eyebrow: ReactNode;
  title: string;
  action?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 border-b border-zinc-200 pb-5 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-2">{eyebrow}</div>
        <h1 className="mt-3 text-2xl font-semibold tracking-normal text-zinc-950 sm:text-3xl">
          {title}
        </h1>
      </div>
      {action}
    </header>
  );
}

export function RequestStatus({ request }: { request: AdminAccessRequest }) {
  return <Badge tone={statusTone[request.status]}>{request.status}</Badge>;
}

export function ServiceStateBadge({ state }: { state: AdminServiceState }) {
  return <Badge tone={serviceTone[state]}>{state}</Badge>;
}
