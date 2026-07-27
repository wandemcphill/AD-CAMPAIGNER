import type { LucideIcon } from "lucide-react";
import {
  BadgeCheck,
  BriefcaseBusiness,
  Clapperboard,
  ClipboardCheck,
  FileText,
  Image,
  Layers3,
  Megaphone,
  MessageCircle,
  MessageSquareText,
  Mic2,
  MousePointerClick,
  PenLine,
  Search,
  Share2,
  Sparkles,
  UserCheck,
  Users,
  Video,
  WandSparkles
} from "lucide-react";

export type GenerationStep = {
  accent: string;
  detail: string;
  icon: LucideIcon;
  label: string;
  metric: string;
};

export const generationSteps: GenerationStep[] = [
  {
    accent: "var(--flip-amber)",
    detail: "Lagos buyers, creator affinity, mobile-first purchase paths",
    icon: Users,
    label: "Audience",
    metric: "2.4M"
  },
  {
    accent: "var(--flip-indigo)",
    detail: "Proof-led hooks, urgency windows, WhatsApp closing prompts",
    icon: MessageSquareText,
    label: "Copy",
    metric: "18"
  },
  {
    accent: "var(--flip-terracotta)",
    detail: "Pattern, product silhouette, offer stack, creator-safe export",
    icon: Image,
    label: "Flyer",
    metric: "4"
  },
  {
    accent: "var(--flip-emerald)",
    detail: "Storyboard beats, kinetic captions, thumb-stop motion",
    icon: Clapperboard,
    label: "Video",
    metric: "6"
  },
  {
    accent: "var(--flip-white)",
    detail: "Meta, TikTok, Google, and WhatsApp campaign packet",
    icon: Megaphone,
    label: "Campaign",
    metric: "Live"
  }
];

export const proofSignals = [
  "Audience graph locked",
  "Creative variants printing",
  "Budget rails balancing",
  "Distribution packet sealed"
];

export const navItems = [
  { href: "#engine", label: "Engine" },
  { href: "#agency-os", label: "Agency OS" },
  { href: "#marketplace", label: "Marketplace" }
];

export const footerSignals = [
  { icon: BadgeCheck, label: "Phase 1 shell" },
  { icon: Megaphone, label: "Hero engine" },
  { icon: Clapperboard, label: "Particle canvas" }
];

export const creationNodes = [
  {
    accent: "var(--flip-emerald)",
    copy: "Storyboard, captions, product closeups, and platform-safe timing assemble into a short-form sequence.",
    icon: Video,
    label: "Video",
    output: "9:16 launch reel"
  },
  {
    accent: "var(--flip-indigo)",
    copy: "Kinetic typography and offer pulses lock to the hook so the first three seconds carry the sale.",
    icon: Share2,
    label: "Motion Graphics",
    output: "Animated offer pack"
  },
  {
    accent: "var(--flip-terracotta)",
    copy: "Product silhouette, pattern language, and proof blocks print into feed and story-ready flyers.",
    icon: Image,
    label: "Flyers",
    output: "4 creative sizes"
  },
  {
    accent: "var(--flip-amber)",
    copy: "Angles, CTAs, objections, and WhatsApp closers generate as structured campaign copy.",
    icon: FileText,
    label: "Copywriting",
    output: "18 variants"
  },
  {
    accent: "var(--flip-white)",
    copy: "Clean product composites and marketplace thumbnails form without leaving the campaign canvas.",
    icon: MousePointerClick,
    label: "Product Images",
    output: "12 exports"
  }
];

export const channels = [
  { accent: "var(--flip-indigo)", icon: Share2, label: "Meta", metric: "48k reach" },
  { accent: "var(--flip-terracotta)", icon: Video, label: "TikTok", metric: "12 reels" },
  { accent: "var(--flip-amber)", icon: Search, label: "Google", metric: "6.8x intent" },
  { accent: "var(--flip-emerald)", icon: MessageCircle, label: "WhatsApp", metric: "320 chats" }
];

export const optimizationMetrics = [
  { label: "CTR", values: ["2.8%", "4.1%", "5.6%", "6.2%"] },
  { label: "ROAS", values: ["3.2x", "4.8x", "5.4x", "6.1x"] },
  { label: "Messages", values: ["124", "238", "410", "684"] },
  { label: "Conversions", values: ["18", "42", "73", "116"] }
];

export const agencyTabs = [
  {
    accent: "var(--flip-amber)",
    icon: BriefcaseBusiness,
    label: "Clients",
    lines: ["Kemi Shoes", "Saffron Skin", "Northside Foods"],
    stat: "24 active"
  },
  {
    accent: "var(--flip-indigo)",
    icon: ClipboardCheck,
    label: "Campaign Queue",
    lines: ["TikTok launch", "WhatsApp retargeting", "Google intent capture"],
    stat: "18 jobs"
  },
  {
    accent: "var(--flip-emerald)",
    icon: FileText,
    label: "AI Reports",
    lines: ["Weekly ROAS memo", "Creative fatigue alert", "Budget shift proof"],
    stat: "6 ready"
  },
  {
    accent: "var(--flip-terracotta)",
    icon: UserCheck,
    label: "Team Members",
    lines: ["Strategist assigned", "Designer reviewing", "Closer on WhatsApp"],
    stat: "9 online"
  }
];

export const marketplaceTalent = [
  {
    accent: "var(--flip-indigo)",
    category: "Agencies",
    match: "98%",
    name: "Lagos Launch Studio",
    tags: ["Meta", "TikTok", "Beauty"]
  },
  {
    accent: "var(--flip-emerald)",
    category: "Freelancers",
    match: "94%",
    name: "Amina Growth Ops",
    tags: ["WhatsApp", "Funnels", "Retail"]
  },
  {
    accent: "var(--flip-amber)",
    category: "Designers",
    match: "91%",
    name: "Pattern House",
    tags: ["Flyers", "Brand", "Commerce"]
  },
  {
    accent: "var(--flip-terracotta)",
    category: "Copywriters",
    match: "89%",
    name: "Proof Copy Desk",
    tags: ["Hooks", "Offers", "DM scripts"]
  },
  {
    accent: "var(--flip-white)",
    category: "Video Editors",
    match: "87%",
    name: "Motion Sprint",
    tags: ["Reels", "UGC", "Captions"]
  }
];

export const creativePipeline = [
  { accent: "var(--flip-amber)", icon: Sparkles, label: "Prompt", text: "Grow my skincare brand in Abuja" },
  { accent: "var(--flip-indigo)", icon: PenLine, label: "Storyboard", text: "Hook, proof, offer, close" },
  { accent: "var(--flip-emerald)", icon: Mic2, label: "Voice", text: "Warm founder narration" },
  { accent: "var(--flip-terracotta)", icon: Video, label: "Video", text: "9:16 product motion cut" },
  { accent: "var(--flip-white)", icon: Layers3, label: "Motion Graphics", text: "Price pulse and CTA overlays" },
  { accent: "var(--flip-amber)", icon: WandSparkles, label: "Final Advertisement", text: "Ready for Meta, TikTok, WhatsApp" }
];

export const finalCollapseItems = [
  "Audience graph",
  "Creative packet",
  "Channel routing",
  "Optimization loop",
  "Agency workflow",
  "Marketplace bench"
];
