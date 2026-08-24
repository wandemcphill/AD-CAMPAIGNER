"use client";

import type { ComponentProps } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { cn } from "@fliptrybe/ui";

type LinkHref = ComponentProps<typeof Link>["href"];
const asHref = (href: string) => href as LinkHref;

export type SectionTab = { label: string; href: string; icon: LucideIcon };

export function SectionTabs({ items }: { items: SectionTab[] }) {
  const pathname = usePathname();

  return (
    <nav className="ft-section-tabs flex gap-1 overflow-x-auto rounded-2xl border border-[var(--ft-border)] bg-[var(--ft-bg-surface)]/70 p-1 shadow-[var(--shadow-sm)] backdrop-blur-xl">
      {items.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition",
              active
                ? "bg-[var(--ft-accent)] text-white shadow-[var(--shadow-sm)]"
                : "text-[var(--ft-text-secondary)] hover:bg-[var(--ft-bg-muted)] hover:text-[var(--ft-text-primary)]"
            )}
            href={asHref(item.href)}
            key={item.href}
          >
            <item.icon className="size-3.5" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
