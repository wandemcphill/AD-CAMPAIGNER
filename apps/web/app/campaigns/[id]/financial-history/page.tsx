import { fallbackCampaigns } from "../../data";
import { CampaignFinancialHistoryClient } from "./financial-history-client";

export function generateStaticParams() {
  return fallbackCampaigns.map((campaign) => ({ id: campaign.id }));
}

export default async function CampaignFinancialHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return <CampaignFinancialHistoryClient campaignId={id} />;
}
