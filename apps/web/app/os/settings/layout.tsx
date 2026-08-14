"use client";

import { type ReactNode } from "react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Bot,
  Building2,
  CreditCard,
  LifeBuoy,
  Plug,
  Shield,
  SlidersHorizontal,
  UserCircle,
  Users,
  type LucideIcon
} from "lucide-react";

import { cn } from "@fliptrybe/ui";
import { useApiSession } from "../../lib/use-session";

type SettingsNavItem = { label: string; href: Route; icon: LucideIcon };
type SettingsNavGroup = { group: string; items: SettingsNavItem[] };

const SETTINGS_NAV: SettingsNavGroup[] = [
  { group: "Account", items: [
    { label: "Workspace", href: "/os/settings/workspace", icon: Building2 },
    { label: "Profile", href: "/os/settings/profile", icon: UserCircle },
  ]},
  { group: "Security", items: [
    { label: "Security", href: "/os/settings/security", icon: Shield },
  ]},
  { group: "Preferences", items: [
    { label: "Preferences", href: "/os/settings/preferences", icon: SlidersHorizontal },
    { label: "Notifications", href: "/os/settings/notifications", icon: Bell },
  ]},
  { group: "Team", items: [
    { label: "Team", href: "/os/settings/team", icon: Users },
  ]},
  { group: "Billing", items: [
    { label: "Wallet", href: "/os/settings/wallet", icon: CreditCard },
  ]},
  { group: "Help", items: [
    { label: "Support", href: "/os/support", icon: LifeBuoy },
  ]},
  { group: "AI & Developer", items: [
    // One page (see apps/web/app/os/settings/ai/page.tsx) holds both the AI Configuration
    // form and the API Keys panel, mirroring the merged-screen mockup where both are
    // sections of a single settings surface rather than separate routes.
    { label: "AI Configuration / API Keys", href: "/os/settings/ai", icon: Bot },
  ]},
  { group: "Integrations & Developer", items: [
    { label: "Integrations & Developer", href: "/os/settings/integrations", icon: Plug },
  ]},
];

export default function SettingsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { session } = useApiSession();
  // AI configuration, API keys and webhook management are internal platform
  // infrastructure: their API endpoints require admin:access, which resolves solely
  // from isPlatformAdmin (never a workspace OWNER/ADMIN role). Gate the links on the
  // same flag so we never show a workspace owner a tab whose data 403s.
  const isPlatformAdmin = Boolean(session?.isPlatformAdmin);
  const platformAdminOnlyHrefs: Route[] = ["/os/settings/integrations", "/os/settings/ai"];
  const visibleNav = SETTINGS_NAV.map((group) => ({
    ...group,
    items: group.items.filter((item) => isPlatformAdmin || !platformAdminOnlyHrefs.includes(item.href))
  })).filter((group) => group.items.length > 0);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold">Settings</h1>
      <p className="mt-1 text-sm text-[var(--ft-text-secondary)]">
        Manage your workspace, profile, and preferences
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[220px_1fr]">
        {/* Side nav */}
        <nav className="hidden lg:block">
          <div className="sticky top-8 grid gap-6">
            {visibleNav.map((group) => (
              <div key={group.group}>
                <div className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--ft-text-muted)]">
                  {group.group}
                </div>
                <div className="grid gap-0.5">
                  {group.items.map((item) => {
                    const active = pathname.startsWith(item.href);
                    return (
                      <Link
                        className={cn(
                          "flex items-center gap-2 rounded-[var(--radius-md)] px-3 py-1.5 text-sm transition",
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
              </div>
            ))}
          </div>
        </nav>

        {/* Mobile tabs */}
        <div className="overflow-x-auto lg:hidden">
          <div className="flex gap-1 pb-2">
            {visibleNav.flatMap((g) => g.items).map((item) => {
              const active = pathname.startsWith(item.href);
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

        {/* Content */}
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
