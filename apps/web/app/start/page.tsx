import { ArrowRight, Banknote, Bitcoin, CreditCard, Gift, Plane, Send, Sparkles, Users } from "lucide-react";

const jobs = [
  { title: "Send money to Nigeria", description: "Start a supported transfer from the USA, UK, Europe or Canada.", icon: Send, href: "/register?intent=send-money", tag: "GLOBAL TRANSFERS" },
  { title: "Pay China", description: "Buy RMB for supported supplier, Alipay and WeChat payment journeys.", icon: Banknote, href: "/register?intent=pay-china", tag: "RMB / CHINA" },
  { title: "Buy or sell USDT / USDC", description: "Explore supported stablecoin buy and sell journeys.", icon: Bitcoin, href: "/register?intent=crypto", tag: "DIGITAL DOLLARS" },
  { title: "Get a virtual card", description: "Explore supported international subscription and online-spend options.", icon: CreditCard, href: "/register?intent=virtual-card", tag: "GLOBAL SPENDING" },
  { title: "Buy or sell gift cards", description: "Purchase supported gift cards or submit eligible cards for sale.", icon: Gift, href: "/register?intent=gift-cards", tag: "DIGITAL VALUE" },
  { title: "Book a trip", description: "Explore supported flights, hotels, safaris, tours and activities.", icon: Plane, href: "/register?intent=travel", tag: "TRAVEL" },
  { title: "Grow Nigerian TikTok reach", description: "Discover supported audience-growth options for followers, views and LIVE viewers.", icon: Users, href: "/register?intent=tiktok-growth", tag: "AUDIENCE GROWTH" },
  { title: "Launch an ad campaign", description: "Turn an audience goal into a campaign workflow when available.", icon: Sparkles, href: "/register?intent=campaign", tag: "ADVERTISING" },
];

export default function StartPage() {
  return (
    <main className="min-h-screen bg-[var(--ft-bg-base)] px-4 py-10 text-[var(--ft-text-primary)] sm:px-6 sm:py-16" style={{ backgroundImage: "var(--ft-bg-page-gradient)" }}>
      <div className="mx-auto max-w-6xl">
        <header className="flex items-center justify-between gap-4">
          <a href="/" className="flex items-center gap-3" aria-label="FlipTrybe Technology home">
            <img src="/brand/logo-horizontal-light.svg" alt="FlipTrybe Technology" className="h-8 w-auto" />
          </a>
          <a href="/login" className="rounded-full border border-[var(--ft-border-strong)] bg-[var(--ft-bg-surface)] px-4 py-2.5 text-sm font-semibold">Sign in</a>
        </header>

        <section className="mx-auto max-w-4xl pb-10 pt-20 text-center sm:pt-24">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ft-text-secondary)]">
            <Sparkles className="size-3.5 text-[var(--ft-accent)]" /> Start with the job, not the menu
          </div>
          <h1 className="mt-6 font-[var(--font-display)] text-5xl font-semibold leading-[0.98] tracking-[-0.055em] sm:text-7xl">What are you trying to do?</h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-[var(--ft-text-secondary)] sm:text-lg sm:leading-8">Pick an outcome and we will take you into the right FlipTrybe experience. One account, one operating layer, many jobs.</p>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="FlipTrybe customer jobs">
          {jobs.map(({ title, description, icon: Icon, href, tag }) => (
            <a key={title} href={href} className="group flex min-h-64 flex-col rounded-[28px] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-5 shadow-[var(--shadow-sm)] transition duration-300 hover:-translate-y-1 hover:border-[var(--ft-accent)]/45 hover:shadow-[var(--shadow-lg)]">
              <div className="flex items-start justify-between gap-3">
                <span className="grid size-12 place-items-center rounded-2xl border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] text-[var(--ft-accent)]"><Icon className="size-5" /></span>
                <ArrowRight className="size-4 text-[var(--ft-text-muted)] transition group-hover:translate-x-1 group-hover:text-[var(--ft-accent)]" />
              </div>
              <span className="mt-6 font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-[var(--ft-text-muted)]">{tag}</span>
              <h2 className="mt-2 text-lg font-semibold tracking-tight">{title}</h2>
              <p className="mt-2 flex-1 text-sm leading-6 text-[var(--ft-text-secondary)]">{description}</p>
              <span className="mt-5 inline-flex w-fit rounded-full bg-[var(--ft-accent)] px-4 py-2 text-xs font-bold text-white">Start here</span>
            </a>
          ))}
        </section>

        <section className="mx-auto mt-12 max-w-3xl rounded-[28px] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-6 text-center sm:p-8">
          <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--ft-text-muted)]">Not sure yet?</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight">Explore everything first.</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[var(--ft-text-secondary)]">Browse the full customer platform, then choose a job when you are ready.</p>
          <a href="/#what-you-can-do" className="mt-5 inline-flex items-center gap-2 rounded-full border border-[var(--ft-border-strong)] bg-[var(--ft-bg-raised)] px-5 py-3 text-sm font-semibold transition hover:border-[var(--ft-accent)]">Explore FlipTrybe <ArrowRight className="size-4" /></a>
        </section>
      </div>
    </main>
  );
}
