import type { ReactNode } from "react";

import { Badge, Panel, cn } from "@fliptrybe/ui";

import { accessEnabled, navItems, statusTone, type AccessRequest } from "./data";

export function DigitalAccessShell({ children, active }: { children: ReactNode; active: string }) {
  return (
    <main className="min-h-screen">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[244px_1fr]">
        <aside className="border-b border-zinc-200 bg-white/90 px-4 py-4 backdrop-blur lg:border-r lg:border-b-0">
          <a className="flex items-center gap-3" href="/digital-access">
            <div className="flex size-10 items-center justify-center rounded-md bg-zinc-950 text-sm font-semibold text-white">
              DA
            </div>
            <div>
              <div className="text-sm font-semibold text-zinc-950">Digital Access</div>
              <div className="text-xs text-zinc-500">Creator services</div>
            </div>
          </a>

          <nav className="mt-6 grid grid-cols-3 gap-1 lg:grid-cols-1">
            {navItems.map((item) => (
              <a
                className={cn(
                  "flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition",
                  active === item.href
                    ? "bg-zinc-950 text-white"
                    : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950"
                )}
                href={item.href}
                key={item.href}
              >
                <item.icon className="size-4" />
                <span>{item.label}</span>
              </a>
            ))}
          </nav>

          <Panel className="mt-6 hidden p-4 lg:block">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-zinc-950">Rollout mode</div>
              <Badge tone={accessEnabled ? "success" : "warning"}>
                {accessEnabled ? "Live" : "Setup"}
              </Badge>
            </div>
            <div className="mt-4 grid gap-3 text-sm text-zinc-600">
              <div className="flex justify-between">
                <span>Payment</span>
                <span className="font-medium text-zinc-950">Wallet</span>
              </div>
              <div className="flex justify-between">
                <span>Fulfillment</span>
                <span className="font-medium text-zinc-950">Manual</span>
              </div>
              <div className="flex justify-between">
                <span>Refunds</span>
                <span className="font-medium text-zinc-950">Automatic</span>
              </div>
            </div>
          </Panel>
        </aside>

        <section className="px-4 py-4 sm:px-6 lg:px-8">{children}</section>
      </div>
    </main>
  );
}

export function PageHeader({
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

export function RequestStatus({ request }: { request: AccessRequest }) {
  return <Badge tone={statusTone[request.status]}>{request.status}</Badge>;
}
