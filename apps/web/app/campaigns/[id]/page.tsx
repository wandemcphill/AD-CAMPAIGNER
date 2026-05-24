import { fallbackCampaigns } from "../data";
import { CampaignDetailClient } from "./campaign-detail-client";

export function generateStaticParams() {
  return fallbackCampaigns.map((campaign) => ({ id: campaign.id }));
}

export default async function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return <CampaignDetailClient campaignId={id} />;
}
