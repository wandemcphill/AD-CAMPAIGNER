import Link from "next/link";
import type { ReactNode } from "react";

import { Badge, Panel, cn } from "@fliptrybe/ui";

import { navItems, statusTone, type OtpStatus } from "./data";

export function OtpShell({ children, active }: { children: ReactNode; active: string }) {
  return (
    <main className="min-h-screen">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[236px_1fr]">
        <aside className="border-b border-zinc-200 bg-white/88 px-4 py-4 backdrop-blur lg:border-r lg:border-b-0">
          <Link className="flex items-center gap-3" href="/otp">
            <div className="flex size-10 items-center justify-center rounded-md bg-zinc-950 text-sm font-semibold text-white">
              FT
            </div>
            <div>
              <div className="text-sm font-semibold text-zinc-950">OTP Desk</div>
              <div className="text-xs text-zinc-500">Marketplace</div>
            </div>
          </Link>

          <nav className="mt-6 grid grid-cols-2 gap-1 lg:grid-cols-1">
            {navItems.map((item) => (
              <Link
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
              </Link>
            ))}
          </nav>

          <Panel className="mt-6 hidden p-4 lg:block">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-zinc-950">Route health</div>
              <Badge tone="success">Live</Badge>
            </div>
            <div className="mt-4 grid gap-3 text-sm text-zinc-600">
              <div className="flex justify-between">
                <span>Inventory</span>
                <span className="font-medium text-zinc-950">5,430</span>
              </div>
              <div className="flex justify-between">
                <span>Median OTP</span>
                <span className="font-medium text-zinc-950">31s</span>
              </div>
              <div className="flex justify-between">
                <span>Refund window</span>
                <span className="font-medium text-zinc-950">10m</span>
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

export function StatusBadge({ status }: { status: OtpStatus }) {
  return <Badge tone={statusTone[status]}>{status}</Badge>;
}

export function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-medium text-zinc-500 uppercase">{label}</div>
      <div className="mt-1 text-sm font-semibold text-zinc-950">{value}</div>
    </div>
  );
}
