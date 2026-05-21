import {
  Activity,
  BarChart3,
  Bot,
  CreditCard,
  Gauge,
  Megaphone,
  MessageCircle,
  PlayCircle,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet
} from "lucide-react";

import { Badge, Button, MetricCard, Panel } from "@fliptrybe/ui";

import { MotionSection } from "./ui/motion-section";

const nav = [
  { label: "Campaigns", icon: Megaphone },
  { label: "Live", icon: PlayCircle },
  { label: "SMM", icon: Users },
  { label: "Wallet", icon: Wallet },
  { label: "Analytics", icon: BarChart3 },
  { label: "Support", icon: MessageCircle }
];

const destinations = [
  "TikTok LIVE",
  "TikTok box game",
  "TikTok Shop",
  "Instagram Reels",
  "Facebook Live",
  "WhatsApp channel",
  "Telegram group",
  "YouTube channel",
  "Website",
  "FlipTrybe store"
];

const campaigns = [
  { name: "TikTok LIVE launch boost", channel: "TikTok", status: "Active", spend: "NGN 182,400" },
  { name: "Reels commerce sprint", channel: "Instagram", status: "Queued", spend: "NGN 96,000" },
  { name: "WhatsApp channel growth", channel: "WhatsApp", status: "Review", spend: "NGN 74,500" }
];

const chart = [48, 66, 58, 82, 76, 91, 104, 96, 118, 132, 127, 148];

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[252px_1fr]">
        <aside className="border-b border-zinc-200 bg-white/82 px-4 py-4 backdrop-blur lg:border-b-0 lg:border-r">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-md bg-zinc-950 text-sm font-semibold text-white">
              FT
            </div>
            <div>
              <div className="text-sm font-semibold text-zinc-950">FlipTrybe</div>
              <div className="text-xs text-zinc-500">Growth OS</div>
            </div>
          </div>

          <nav className="mt-6 grid grid-cols-2 gap-1 lg:grid-cols-1">
            {nav.map((item) => (
              <button
                className="flex h-10 items-center gap-3 rounded-md px-3 text-left text-sm font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-950"
                key={item.label}
              >
                <item.icon className="size-4" />
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          <Panel className="mt-6 hidden p-4 lg:block">
            <div className="flex items-center gap-2 text-sm font-medium text-zinc-950">
              <ShieldCheck className="size-4 text-green-600" />
              Workspace verified
            </div>
            <div className="mt-3 text-sm leading-6 text-zinc-600">
              KYC, audit logging, team roles, and wallet controls are active for this workspace.
            </div>
          </Panel>
        </aside>

        <section className="px-4 py-4 sm:px-6 lg:px-8">
          <header className="flex flex-col gap-4 border-b border-zinc-200 pb-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="info">Global campaign desk</Badge>
                <Badge tone="success">Mock providers online</Badge>
              </div>
              <h1 className="mt-3 text-3xl font-semibold tracking-normal text-zinc-950 sm:text-4xl">
                Campaign operations
              </h1>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="flex h-10 min-w-64 items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-500">
                <Search className="size-4" />
                Search campaigns, stores, channels
              </div>
              <Button>
                <Sparkles className="size-4" />
                New campaign
              </Button>
            </div>
          </header>

          <MotionSection className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Active spend" value="NGN 1.25M" detail="+18.6% ROI this week" tone="success" />
            <MetricCard label="Live viewers" value="1,240" detail="TikTok boost running" tone="info" />
            <MetricCard label="Queued orders" value="37" detail="SMM fulfillment healthy" tone="warning" />
            <MetricCard label="Wallet balance" value="NGN 12.5M" detail="NGN 175k reserved" />
          </MotionSection>

          <div className="mt-6 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <Panel className="p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-zinc-950">Campaign builder</h2>
                  <p className="mt-1 text-sm text-zinc-500">Meta, TikTok, live, social, store, app, and traffic goals.</p>
                </div>
                <Badge tone="neutral">Draft autosaved</Badge>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <label className="grid gap-2 text-sm font-medium text-zinc-700">
                  Objective
                  <select className="h-11 rounded-md border border-zinc-200 bg-white px-3 text-zinc-950">
                    <option>Engagement</option>
                    <option>Live viewers</option>
                    <option>Website traffic</option>
                    <option>App installs</option>
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-medium text-zinc-700">
                  Budget
                  <input
                    className="h-11 rounded-md border border-zinc-200 bg-white px-3 text-zinc-950"
                    defaultValue="NGN 250,000"
                  />
                </label>
                <label className="grid gap-2 text-sm font-medium text-zinc-700 md:col-span-2">
                  Destination URL
                  <input
                    className="h-11 rounded-md border border-zinc-200 bg-white px-3 text-zinc-950"
                    defaultValue="https://tiktok.com/@fliptrybe/live"
                  />
                </label>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
                {destinations.map((destination) => (
                  <button
                    className="min-h-16 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-left text-sm font-medium text-zinc-700 transition hover:border-zinc-950 hover:bg-white hover:text-zinc-950"
                    key={destination}
                  >
                    {destination}
                  </button>
                ))}
              </div>
            </Panel>

            <Panel className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-zinc-950">AI growth desk</h2>
                  <p className="mt-1 text-sm text-zinc-500">Captions, hashtags, audiences, and creative angles.</p>
                </div>
                <Bot className="size-5 text-orange-500" />
              </div>

              <div className="mt-5 space-y-3">
                {["Hook creator buyers during the first 10 minutes.", "Target Lagos, London, Toronto creator-commerce clusters.", "Use proof-led captions and scarcity windows."].map(
                  (item) => (
                    <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700" key={item}>
                      {item}
                    </div>
                  )
                )}
              </div>

              <Button className="mt-5 w-full" variant="secondary">
                <Sparkles className="size-4" />
                Generate campaign copy
              </Button>
            </Panel>
          </div>

          <div className="mt-6 grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
            <Panel className="overflow-hidden">
              <div className="border-b border-zinc-200 p-4">
                <h2 className="text-lg font-semibold text-zinc-950">Campaign queue</h2>
              </div>
              <div className="divide-y divide-zinc-200">
                {campaigns.map((campaign) => (
                  <div className="grid gap-3 p-4 sm:grid-cols-[1fr_auto_auto] sm:items-center" key={campaign.name}>
                    <div>
                      <div className="font-medium text-zinc-950">{campaign.name}</div>
                      <div className="text-sm text-zinc-500">{campaign.channel}</div>
                    </div>
                    <Badge tone={campaign.status === "Active" ? "success" : campaign.status === "Review" ? "warning" : "info"}>
                      {campaign.status}
                    </Badge>
                    <div className="text-sm font-medium text-zinc-700">{campaign.spend}</div>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-zinc-950">Performance pulse</h2>
                  <p className="mt-1 text-sm text-zinc-500">Spend, reach, conversions, and livestream velocity.</p>
                </div>
                <Gauge className="size-5 text-sky-600" />
              </div>

              <div className="mt-5 flex h-64 items-end gap-2 rounded-md border border-zinc-200 bg-zinc-50 p-4">
                {chart.map((value, index) => (
                  <div className="flex flex-1 items-end" key={value + index}>
                    <div
                      className="w-full rounded-t-sm bg-zinc-950"
                      style={{ height: `${Math.max(18, value)}px` }}
                    />
                  </div>
                ))}
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                <div>
                  <div className="text-zinc-500">Reach</div>
                  <div className="mt-1 font-semibold text-zinc-950">428.5k</div>
                </div>
                <div>
                  <div className="text-zinc-500">Clicks</div>
                  <div className="mt-1 font-semibold text-zinc-950">18.4k</div>
                </div>
                <div>
                  <div className="text-zinc-500">CPA</div>
                  <div className="mt-1 font-semibold text-zinc-950">NGN 642</div>
                </div>
              </div>
            </Panel>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {[
              { icon: Activity, title: "Realtime updates", copy: "Campaign, livestream, notification, and admin channels are ready." },
              { icon: CreditCard, title: "Wallet controls", copy: "Korapay, Paystack, Stripe, and manual rails sit behind adapter contracts." },
              { icon: ShieldCheck, title: "Governance", copy: "RBAC, audit logging, moderation, and fraud signals are wired into the shell." }
            ].map((item) => (
              <Panel className="p-4" key={item.title}>
                <item.icon className="size-5 text-zinc-950" />
                <div className="mt-4 font-semibold text-zinc-950">{item.title}</div>
                <div className="mt-2 text-sm leading-6 text-zinc-500">{item.copy}</div>
              </Panel>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
