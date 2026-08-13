"use client";

import Link from "next/link";
import type { Route } from "next";
import {
  Banknote,
  Bitcoin,
  Gift,
  GraduationCap,
  Globe,
  Globe2,
  KeyRound,
  Lightbulb,
  Phone,
  Smartphone,
  Trophy,
  Tv,
  Wifi,
  type LucideIcon
} from "lucide-react";

import { useFeatureFlags } from "../../lib/feature-flags";

type ServiceCard = {
  label: string;
  description: string;
  href: Route;
  icon: LucideIcon;
  flag?: string;
};

type ServiceCategory = { title: string; items: ServiceCard[] };

// Customer-facing catalog. Each card is product-oriented ("Airtime", "Gift Cards")
// — never a supplier/provider name. Cards are hidden unless their feature flag is on,
// mirroring the shell sidebar gating so we never link to a vertical this deployment
// answers 503 for.
const CATEGORIES: ServiceCategory[] = [
  {
    title: "Connectivity",
    items: [
      { label: "Airtime", description: "Top up any network instantly", href: "/os/airtime/airtime", icon: Phone, flag: "vtu" },
      { label: "Data", description: "Buy data bundles", href: "/os/airtime/data", icon: Wifi, flag: "vtu" },
      { label: "International Top-Up", description: "Send airtime abroad", href: "/os/telecom", icon: Globe2, flag: "telecomGateway" },
      { label: "International Numbers", description: "Get numbers worldwide", href: "/os/numbers", icon: Globe, flag: "virtualNumbers" },
      { label: "My Numbers", description: "Manage your numbers", href: "/os/numbers/mine", icon: Smartphone, flag: "virtualNumbers" },
    ],
  },
  {
    title: "Digital Value",
    items: [
      { label: "Gift Cards", description: "Buy and sell gift cards", href: "/os/digital-value", icon: Gift, flag: "giftCardSell" },
      { label: "Digital Access", description: "Premium digital products", href: "/os/digital-access", icon: KeyRound, flag: "digitalAccess" },
    ],
  },
  {
    title: "Bills & Utilities",
    items: [
      { label: "Electricity", description: "Pay electricity bills", href: "/os/utilities/electricity", icon: Lightbulb, flag: "billsElectricity" },
      { label: "Cable TV", description: "Renew your subscription", href: "/os/utilities/cable", icon: Tv, flag: "billsCable" },
      { label: "Education", description: "Pay education fees", href: "/os/utilities/education", icon: GraduationCap, flag: "billsEducation" },
      { label: "Bet Funding", description: "Fund betting wallets", href: "/os/utilities/betting", icon: Trophy, flag: "billsBetting" },
    ],
  },
  {
    title: "Digital Assets",
    items: [
      { label: "Sell Crypto", description: "Convert crypto to cash", href: "/os/crypto", icon: Bitcoin, flag: "cryptoSell" },
      { label: "Buy RMB", description: "Purchase Chinese yuan", href: "/os/rmb", icon: Banknote, flag: "rmbBuy" },
    ],
  },
];

export default function ServicesHubPage() {
  const { flags, ready } = useFeatureFlags();

  function isEnabled(flag?: string) {
    if (!flag) return true;
    return ready && flags[flag] === true;
  }

  const visibleCategories = CATEGORIES.map((category) => ({
    ...category,
    items: category.items.filter((item) => isEnabled(item.flag)),
  })).filter((category) => category.items.length > 0);

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">Services</h1>
        <p className="mt-1 text-sm text-[var(--ft-text-secondary)]">
          Airtime, data, gift cards, utilities and more — all in one place.
        </p>
      </header>

      {visibleCategories.length === 0 ? (
        <div className="rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-8 text-center text-sm text-[var(--ft-text-muted)]">
          Services are being set up for your workspace. Check back shortly.
        </div>
      ) : (
        <div className="grid gap-8">
          {visibleCategories.map((category) => (
            <section key={category.title}>
              <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--ft-text-muted)]">
                {category.title}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {category.items.map((item) => (
                  <Link
                    className="group flex items-start gap-3 rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-4 transition hover:border-[var(--ft-accent)]/40 hover:bg-[var(--ft-bg-muted)]"
                    href={item.href}
                    key={item.href}
                  >
                    <div className="grid size-10 shrink-0 place-items-center rounded-[var(--radius-md)] bg-[var(--ft-accent)]/10 text-[var(--ft-accent)]">
                      <item.icon className="size-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold group-hover:text-[var(--ft-accent)]">{item.label}</div>
                      <div className="mt-0.5 text-xs text-[var(--ft-text-muted)]">{item.description}</div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
