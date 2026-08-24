import Link from "next/link";
import { ArrowRight, Banknote, Bitcoin, CreditCard, Gift, Globe2, Plane, Send, Sparkles, Tv, Users } from "lucide-react";

const missions = [
  { title: "Send money to Nigeria", description: "Start with your corridor, amount and recipient. Review fees before you confirm.", href: "/os/financial-products/remittance", icon: Send, label: "Global transfer", status: "Live" },
  { title: "Pay China", description: "Buy RMB and use supported China payment rails for suppliers and businesses.", href: "/os/rmb", icon: Banknote, label: "RMB · China", status: "Live" },
  { title: "Buy or sell USDT / USDC", description: "Enter the digital-dollar journey with the asset, rate and settlement clearly separated.", href: "/os/crypto", icon: Bitcoin, label: "Digital dollars", status: "Live" },
  { title: "Get a virtual card", description: "Explore supported card products for international online spending and subscriptions.", href: "/os/financial-products/cards", icon: CreditCard, label: "Spend globally", status: "Live" },
  { title: "Buy or sell gift cards", description: "Choose whether you want to purchase a supported card or turn an eligible card into value.", href: "/os/digital-value", icon: Gift, label: "Digital value", status: "Live" },
  { title: "Grow on TikTok", description: "Choose Nigerian followers, Nigerian LIVE viewers or a broader creator-growth outcome.", href: "/os/growth/services", icon: Users, label: "Audience growth", status: "Live" },
  { title: "Promote a LIVE", description: "Find the creator-growth path designed around LIVE reach and campaign outcomes.", href: "/os/growth/services", icon: Tv, label: "TikTok LIVE", status: "Live" },
  { title: "Book travel", description: "Explore flights, safaris and tours as travel experiences become available through FlipTrybe.", href: "/os/services", icon: Plane, label: "Travel", status: "Explore" },
  { title: "Manage global money", description: "See the wider layer for USD, GBP, EUR, cards, transfers and digital dollars.", href: "/os/financial-products", icon: Globe2, label: "Global money", status: "Explore" }
];

export default function StartCenterPage() {
  return (
    <main className="min-h-full px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <section className="relative overflow-hidden rounded-[30px] border border-[var(--ft-border-strong)] bg-[var(--ft-bg-raised)] p-6 shadow-[var(--shadow-lg)] sm:p-8 lg:p-10">
          <div className="pointer-events-none absolute -right-28 -top-28 size-80 rounded-full bg-[var(--ft-accent)]/10 blur-3xl" />
          <div className="relative max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 py-1.5 font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--ft-accent)]"><Sparkles className="size-3.5" /> FlipTrybe Technology</div>
            <h1 className="mt-5 text-balance font-[var(--font-display)] text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">Start with the job. We’ll take care of the product.</h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-[var(--ft-text-secondary)] sm:text-base">Money, China payments, digital dollars, cards, gift cards and audience growth live in one customer OS. Pick what you are trying to accomplish and follow the guided path.</p>
          </div>
          <div className="relative mt-7 grid gap-3 sm:grid-cols-3">
            {[['Move', 'Send, receive and settle money across supported corridors.', Send], ['Spend', 'Use cards, gift cards and supported international services.', CreditCard], ['Grow', 'Reach audiences, promote LIVE and build campaigns.', Users]].map(([title, text, Icon]) => {
              const I = Icon as typeof Send;
              return <div key={String(title)} className="rounded-2xl border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-4"><I className="size-4 text-[var(--ft-accent)]" /><div className="mt-3 text-sm font-semibold">{String(title)}</div><p className="mt-1 text-xs leading-5 text-[var(--ft-text-muted)]">{String(text)}</p></div>;
            })}
          </div>
        </section>

        <section className="mt-6">
          <div className="flex items-end justify-between gap-4"><div><div className="font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--ft-accent)]">Choose your mission</div><h2 className="mt-1 text-2xl font-semibold tracking-tight">What are you here to do?</h2></div><span className="hidden font-mono text-[9px] uppercase tracking-wider text-[var(--ft-text-muted)] sm:inline">9 customer paths</span></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {missions.map((mission) => <Link key={mission.title} href={mission.href} className="group flex min-h-[180px] flex-col rounded-[24px] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-5 shadow-[var(--shadow-sm)] transition duration-300 hover:-translate-y-1 hover:border-[var(--ft-accent)]/45 hover:shadow-[var(--shadow-lg)]">
              <div className="flex items-start justify-between gap-3"><span className="grid size-11 place-items-center rounded-2xl border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] text-[var(--ft-accent)]"><mission.icon className="size-5" /></span><span className="rounded-full border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-2 py-1 font-mono text-[8px] font-semibold uppercase tracking-wider text-[var(--ft-text-muted)]">{mission.status}</span></div>
              <div className="mt-5 font-mono text-[9px] uppercase tracking-[0.15em] text-[var(--ft-text-muted)]">{mission.label}</div>
              <h3 className="mt-1 text-sm font-semibold">{mission.title}</h3>
              <p className="mt-1 flex-1 text-xs leading-5 text-[var(--ft-text-secondary)]">{mission.description}</p>
              <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-[var(--ft-accent)]">Start journey <ArrowRight className="size-3.5 transition group-hover:translate-x-1" /></div>
            </Link>)}
          </div>
        </section>

        <div className="mt-6 rounded-2xl border border-[var(--ft-border)] bg-[var(--ft-bg-muted)]/50 p-4 text-xs leading-5 text-[var(--ft-text-muted)]"><strong className="text-[var(--ft-text-secondary)]">Availability is explicit.</strong> Live services lead to actionable journeys. Where a capability is still being introduced, FlipTrybe labels it as such rather than pretending a transaction is available.</div>
      </div>
    </main>
  );
}
