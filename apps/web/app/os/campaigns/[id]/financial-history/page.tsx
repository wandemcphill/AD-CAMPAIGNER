import { CampaignFinancialHistoryClient } from "./financial-history-client";

export default async function CampaignFinancialHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return <CampaignFinancialHistoryClient campaignId={id} />;
}
