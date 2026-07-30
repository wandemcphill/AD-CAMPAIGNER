import { redirect } from "next/navigation";

export default async function DigitalAccessRequestDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  redirect(`/os/digital-access/requests/${id}`);
}
