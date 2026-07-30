"use client";

import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";

import { cn } from "@fliptrybe/ui";

export type SectionTab = { label: string; href: string; icon: LucideIcon };

/**
 * Horizontal sub-navigation for multi-page sections inside the OS shell.
 * Replaces the per-section sidebars those sections carried before the shell
 * was unified, so a section keeps its own navigation without a second rail.
 */
export function SectionTabs({ items }: { items: SectionTab[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-[var(--ft-border)] pb-px">
      {items.map((item) => {
        const active = pathname === item.href;

        return (
          <a
            className={cn(
              "flex shrink-0 items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition",
              active
                ? "border-[var(--ft-accent)] text-[var(--ft-accent)]"
                : "border-transparent text-[var(--ft-text-secondary)] hover:text-[var(--ft-text-primary)]"
            )}
            href={item.href}
            key={item.href}
          >
            <item.icon className="size-4 stroke-[1.5]" />
            {item.label}
          </a>
        );
      })}
    </nav>
  );
}
