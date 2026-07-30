import { redirect } from "next/navigation";

export default async function CampaignFinancialHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  redirect(`/os/campaigns/${id}/financial-history`);
}
