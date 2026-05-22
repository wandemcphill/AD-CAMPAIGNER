import Link from "next/link";
import type { ReactNode } from "react";

import { Badge, cn } from "@fliptrybe/ui";

import { navItems, providerTone, statusTone, type OtpStatus, type ProviderState } from "./data";

export function AdminOtpShell({ children, active }: { children: ReactNode; active: string }) {
  return (
    <main className="min-h-screen">
      <div className="grid min-h-screen grid-cols-1 xl:grid-cols-[260px_1fr]">
        <aside className="border-b border-zinc-200 bg-zinc-950 px-4 py-4 text-white xl:border-r xl:border-b-0">
          <Link className="flex items-center gap-3" href="/otp">
            <div className="flex size-10 items-center justify-center rounded-md bg-white text-sm font-semibold text-zinc-950">
              AO
            </div>
            <div>
              <div className="text-sm font-semibold">Admin OTP</div>
              <div className="text-xs text-zinc-400">Marketplace controls</div>
            </div>
          </Link>

          <nav className="mt-6 grid grid-cols-2 gap-1 xl:grid-cols-1">
            {navItems.map((item) => (
              <Link
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
              </Link>
            ))}
          </nav>

          <div className="mt-6 hidden rounded-lg border border-white/10 bg-white/5 p-4 xl:block">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">Policy mode</div>
              <Badge tone="warning">Guarded</Badge>
            </div>
            <div className="mt-4 grid gap-3 text-sm text-zinc-300">
              <div className="flex justify-between">
                <span>Refund SLA</span>
                <span className="font-medium text-white">10m</span>
              </div>
              <div className="flex justify-between">
                <span>Auto refund</span>
                <span className="font-medium text-white">On</span>
              </div>
              <div className="flex justify-between">
                <span>Route mixing</span>
                <span className="font-medium text-white">Smart</span>
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

export function StatusBadge({ status }: { status: OtpStatus }) {
  return <Badge tone={statusTone[status]}>{status}</Badge>;
}

export function ProviderBadge({ state }: { state: ProviderState }) {
  return <Badge tone={providerTone[state]}>{state}</Badge>;
}
