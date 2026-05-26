import { Suspense } from "react";

import { AdminCampaignOpsShell, LoadingRows } from "../components";
import { AdminCampaignOpsDetailClient } from "./detail-client";

export default function AdminCampaignOpsDetailPage() {
  return (
    <Suspense
      fallback={
        <AdminCampaignOpsShell active="/campaign-ops/queue">
          <div className="mt-6 overflow-hidden rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)]">
            <LoadingRows count={4} />
          </div>
        </AdminCampaignOpsShell>
      }
    >
      <AdminCampaignOpsDetailClient />
    </Suspense>
  );
}
