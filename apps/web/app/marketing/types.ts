export type NavigationTab =
  | "landing"
  | "dashboard"
  | "ai-studio"
  | "campaigns"
  | "creative-library"
  | "marketplace"
  | "wallet"
  | "analytics"
  | "logo-brand"
  | "claude-handoff"
  | "settings";

export interface Campaign {
  id: string;
  name: string;
  platform: "Meta (IG/FB)" | "TikTok" | "Google PMax" | "WhatsApp API";
  status: "Active" | "Paused" | "Draft" | "Completed";
  budget: string;
  spent: string;
  roas: string;
  conversions: number;
  ctr: string;
  cpa: string;
  startDate: string;
  targetAudience: string;
}

export interface AICreative {
  id: string;
  title: string;
  format: "Image Ad" | "Video Reel" | "Motion Graphics" | "Product Flyer" | "Voiceover Script" | "WhatsApp Flow";
  aspectRatio: "1:1 Square" | "9:16 Vertical Story" | "16:9 Landscape";
  previewUrl: string;
  prompt: string;
  createdAt: string;
  status: "Ready" | "Processing";
  downloadsCount: number;
}
