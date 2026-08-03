"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle, RefreshCw, XCircle } from "lucide-react";

import { Button, Panel } from "@fliptrybe/ui";

import { apiRequest } from "../../lib/api-client";

interface TaskCompletion {
  id: string;
  status: string;
  createdAt: string;
  task: { label: string; taskType: string; campaign?: { id: string; name?: string } };
  participant: {
    user: { name: string; displayName?: string; email?: string };
  };
}

async function loadReviewQueue() {
  return apiRequest<{ completions: TaskCompletion[] }>("/admin/rewards/review-queue");
}

export default function AdminRewardsReviewQueuePage() {
  const [completions, setCompletions] = useState<TaskCompletion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [resolving, setResolving] = useState<string>();

  const refresh = useCallback(async () => {
    setError(undefined);
    try {
      const data = await loadReviewQueue();
      setCompletions(data.completions);
    } catch {
      setError("Could not load reward review queue.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function resolveCompletion(id: string, resolution: "VERIFIED" | "REJECTED") {
    setResolving(id);
    try {
      await apiRequest(`/admin/rewards/completions/${id}/resolve`, {
        method: "POST",
        body: JSON.stringify({ resolution })
      });
      await refresh();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Could not resolve completion.");
    } finally {
      setResolving(undefined);
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Reward Review Queue</h1>
          <p className="text-sm text-muted-foreground">{completions.length} pending completions</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => void refresh()} disabled={loading}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
          <Link href="/rewards">
            <Button variant="secondary">Campaigns</Button>
          </Link>
        </div>
      </div>

      {error && (
        <Panel>
          <p className="text-sm text-destructive">{error}</p>
        </Panel>
      )}

      {loading && (
        <Panel>
          <p className="text-sm text-muted-foreground animate-pulse">Loading...</p>
        </Panel>
      )}

      {!loading && !error && (
        <Panel>
          {completions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No reward completions are waiting for review.</p>
          ) : (
            <div className="divide-y">
              {completions.map((completion) => (
                <div key={completion.id} className="flex items-center gap-3 py-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      {completion.participant.user.displayName ?? completion.participant.user.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {completion.task.label} - {completion.task.campaign?.name ?? completion.task.campaign?.id ?? "Campaign"} -{" "}
                      {new Date(completion.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => void resolveCompletion(completion.id, "VERIFIED")}
                      disabled={resolving === completion.id}
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Approve
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => void resolveCompletion(completion.id, "REJECTED")}
                      disabled={resolving === completion.id}
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      )}
    </div>
  );
}
