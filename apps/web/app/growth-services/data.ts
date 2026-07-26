import {
  BarChart3,
  Eye,
  Heart,
  MousePointerClick,
  Send,
  ShieldAlert,
  UserPlus,
  Users,
  type LucideIcon
} from "lucide-react";

export type GrowthService = {
  code: string;
  name: string;
  platform: string;
  category: string;
  description: string;
  price: string;
  minimumQuantity: number;
  maximumQuantity: number;
  quantityStep: number;
  expectedCompletion: string;
  enabled: boolean;
  riskTone: "neutral" | "success" | "warning" | "danger" | "info";
  riskSummary: string;
  icon: LucideIcon;
};

export type GrowthOrderStatus =
  | "PENDING"
  | "SUBMITTED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "FAILED"
  | "REFUNDED";

export type GrowthOrder = {
  id: string;
  serviceName: string;
  platform: string;
  destinationUrl: string;
  quantityOrdered: number;
  quantityDelivered: number;
  status: GrowthOrderStatus;
  amount: string;
  expectedCompletionAt: string;
  updatedAt: string;
};

export type GrowthMetric = {
  label: string;
  value: string;
  detail: string;
  tone?: "neutral" | "success" | "warning" | "info";
};

export const growthEnabled = process.env.NEXT_PUBLIC_ENABLE_GROWTH_SERVICES !== "false";

export const fallbackServices: GrowthService[] = [
  {
    code: "tiktok-views",
    name: "TikTok Views",
    platform: "TikTok",
    category: "TikTok",
    description: "View delivery for public TikTok videos and profile-linked posts.",
    price: "NGN 1,800 / 1k",
    minimumQuantity: 100,
    maximumQuantity: 100000,
    quantityStep: 100,
    expectedCompletion: "4-24 hours",
    enabled: true,
    riskTone: "warning",
    riskSummary: "Artificial views can be filtered or reviewed by platform integrity systems.",
    icon: Eye
  },
  {
    code: "tiktok-followers",
    name: "TikTok Followers",
    platform: "TikTok",
    category: "TikTok",
    description: "Follower delivery for public TikTok profiles.",
    price: "NGN 6,200 / 1k",
    minimumQuantity: 100,
    maximumQuantity: 25000,
    quantityStep: 100,
    expectedCompletion: "12-72 hours",
    enabled: true,
    riskTone: "danger",
    riskSummary: "Follower services carry high drop, account, and reputation risk.",
    icon: UserPlus
  },
  {
    code: "instagram-likes",
    name: "Instagram Likes",
    platform: "Instagram",
    category: "Instagram",
    description: "Like delivery for public Instagram posts or reels.",
    price: "NGN 3,000 / 1k",
    minimumQuantity: 50,
    maximumQuantity: 50000,
    quantityStep: 50,
    expectedCompletion: "6-36 hours",
    enabled: true,
    riskTone: "warning",
    riskSummary: "Likes can drop after delivery and can conflict with authenticity rules.",
    icon: Heart
  },
  {
    code: "youtube-views",
    name: "YouTube Views",
    platform: "YouTube",
    category: "YouTube",
    description: "View delivery for public YouTube videos.",
    price: "NGN 4,500 / 1k",
    minimumQuantity: 100,
    maximumQuantity: 100000,
    quantityStep: 100,
    expectedCompletion: "1-5 days",
    enabled: true,
    riskTone: "danger",
    riskSummary: "Invalid views may be removed and can affect channel trust.",
    icon: BarChart3
  },
  {
    code: "telegram-members",
    name: "Telegram Members",
    platform: "Telegram",
    category: "Telegram",
    description: "Member delivery for public Telegram channels or groups.",
    price: "NGN 4,200 / 1k",
    minimumQuantity: 100,
    maximumQuantity: 50000,
    quantityStep: 100,
    expectedCompletion: "1-5 days",
    enabled: true,
    riskTone: "warning",
    riskSummary: "Member adds can drop when groups moderate aggressively.",
    icon: Send
  },
  {
    code: "website-traffic",
    name: "Website Traffic",
    platform: "Website",
    category: "Traffic",
    description: "Traffic delivery for public landing pages.",
    price: "NGN 2,500 / 1k",
    minimumQuantity: 500,
    maximumQuantity: 250000,
    quantityStep: 500,
    expectedCompletion: "2-7 days",
    enabled: false,
    riskTone: "danger",
    riskSummary: "Disabled until traffic source quality and analytics exclusions are approved.",
    icon: MousePointerClick
  }
];

export const fallbackOrders: GrowthOrder[] = [
  {
    id: "GR-1042",
    serviceName: "TikTok Views",
    platform: "TikTok",
    destinationUrl: "https://www.tiktok.com/@fliptrybe",
    quantityOrdered: 1000,
    quantityDelivered: 640,
    status: "IN_PROGRESS",
    amount: "NGN 2,700",
    expectedCompletionAt: "Today, 18:00",
    updatedAt: "Delivery in progress"
  },
  {
    id: "GR-1038",
    serviceName: "Instagram Likes",
    platform: "Instagram",
    destinationUrl: "https://www.instagram.com/fliptrybe",
    quantityOrdered: 500,
    quantityDelivered: 500,
    status: "COMPLETED",
    amount: "NGN 2,100",
    expectedCompletionAt: "Completed",
    updatedAt: "Completed by supplier"
  }
];

export const statusTone = {
  PENDING: "warning",
  SUBMITTED: "info",
  IN_PROGRESS: "info",
  COMPLETED: "success",
  FAILED: "danger",
  REFUNDED: "neutral"
} as const;

export const navItems = [
  { label: "Storefront", href: "/growth-services", icon: Users },
  { label: "Services", href: "/growth-services/services", icon: ShieldAlert },
  { label: "Orders", href: "/growth-services/orders", icon: BarChart3 }
];
