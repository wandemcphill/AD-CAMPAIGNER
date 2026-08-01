"use client";

import { type ReactNode, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  CreditCard,
  LayoutDashboard,
  Package,
  Server,
  ShoppingCart,
  Users,
} from "lucide-react";

import { Badge, ThemeToggle, cn } from "@fliptrybe/ui";
import { useApiSession } from "../lib/use-session";

const NAV = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { label: "Users", href: "/admin/users", icon: Users },
  { label: "Orders", href: "/admin/orders", icon: ShoppingCart },
  { label: "Payments", href: "/admin/payments", icon: CreditCard },
  { label: "Digital Products", href: "/admin/products", icon: Package },
  { label: "Providers", href: "/admin/providers", icon: Server },
  { label: "Analytics", href: "/admin/analytics", icon: BarChart3 },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { loading, session } = useApiSession();

  useEffect(() => {
    if (!loading && !session) {
      window.location.replace("/login");
    }
  }, [loading, session]);

  if (loading || !session) {
    return <main className="min-h-screen bg-[var(--ft-bg-base)]" />;
  }

  return (
    <div className="flex min-h-screen bg-[var(--ft-bg-base)] text-[var(--ft-text-primary)]">
      {/* Sidebar */}
      <aside className="hidden w-[240px] shrink-0 border-r border-[var(--ft-border)] bg-[var(--ft-bg-raised)] lg:flex lg:flex-col">
        <div className="flex h-14 items-center gap-2 border-b border-[var(--ft-border)] px-5">
          <div className="grid size-7 place-items-center rounded-[var(--radius-sm)] bg-[var(--ft-accent)] font-mono text-[10px] font-bold text-[var(--ft-text-inverse)]">
            FT
          </div>
          <span className="text-sm font-bold">Admin</span>
          <span className="ml-auto"><Badge tone="warning">Staff</Badge></span>
        </div>

        <nav className="flex-1 overflow-y-auto p-3">
          <div className="grid gap-0.5">
            {NAV.map((item) => {
              const active = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
              return (
                <Link
                  className={cn(
                    "flex items-center gap-2.5 rounded-[var(--radius-md)] px-3 py-2 text-sm transition",
                    active
                      ? "bg-[var(--ft-accent)]/10 font-medium text-[var(--ft-accent)]"
                      : "text-[var(--ft-text-secondary)] hover:bg-[var(--ft-bg-muted)] hover:text-[var(--ft-text-primary)]"
                  )}
                  href={item.href}
                  key={item.href}
                >
                  <item.icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="border-t border-[var(--ft-border)] p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <Activity className="size-3.5 text-[var(--ft-green)]" />
              <span className="text-xs text-[var(--ft-text-muted)]">System healthy</span>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="border-b border-[var(--ft-border)] bg-[var(--ft-bg-raised)] px-6 py-3 lg:hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="grid size-7 place-items-center rounded-[var(--radius-sm)] bg-[var(--ft-accent)] font-mono text-[10px] font-bold text-[var(--ft-text-inverse)]">
                FT
              </div>
              <span className="text-sm font-bold">Admin</span>
            </div>
            <ThemeToggle />
          </div>
          <div className="mt-2 flex gap-1 overflow-x-auto pb-1">
            {NAV.map((item) => {
              const active = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
              return (
                <Link
                  className={cn(
                    "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition",
                    active
                      ? "bg-[var(--ft-accent)] text-[var(--ft-text-inverse)]"
                      : "text-[var(--ft-text-secondary)] hover:bg-[var(--ft-bg-muted)]"
                  )}
                  href={item.href}
                  key={item.href}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}
