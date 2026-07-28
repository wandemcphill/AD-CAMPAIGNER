import { ClaimClient } from "./claim-client";

export default async function ClaimPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  return <ClaimClient token={token} />;
}
