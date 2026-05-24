import { Suspense } from "react";

import { AdminCampaignOpsShell, LoadingRows } from "../components";
import { AdminCampaignOpsDetailClient } from "./detail-client";

export default function AdminCampaignOpsDetailPage() {
  return (
    <Suspense
      fallback={
        <AdminCampaignOpsShell active="/campaign-ops/queue">
          <div className="mt-6 overflow-hidden rounded-lg border border-zinc-200 bg-white">
            <LoadingRows count={4} />
          </div>
        </AdminCampaignOpsShell>
      }
    >
      <AdminCampaignOpsDetailClient />
    </Suspense>
  );
}
