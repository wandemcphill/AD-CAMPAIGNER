"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";

import { Divider, Toggle } from "@fliptrybe/ui/components";

import { ErrorNotice, LoadingBlock } from "../../../campaigns/components";
import {
  loadNotificationPreferences,
  updateNotificationPreference,
  type NotificationPreferenceRecord
} from "../../../notifications/api";

const NOTIFICATION_GROUPS = [
  {
    title: "Campaigns",
    items: [
      { id: "campaign-launch", label: "Campaign launched", desc: "When a campaign goes live", default: true },
      { id: "campaign-end", label: "Campaign ended", desc: "When a campaign completes or is paused", default: true },
      { id: "campaign-budget", label: "Budget alerts", desc: "When spend reaches 80% or 100% of budget", default: true },
    ],
  },
  {
    title: "Wallet",
    items: [
      { id: "wallet-credit", label: "Funds added", desc: "When money is deposited to your wallet", default: true },
      { id: "wallet-debit", label: "Funds deducted", desc: "Campaign holds and service purchases", default: false },
      { id: "wallet-low", label: "Low balance", desc: "When balance drops below ₦5,000", default: true },
    ],
  },
  {
    title: "Team",
    items: [
      { id: "team-invite", label: "New member joined", desc: "When someone accepts a team invitation", default: true },
      { id: "team-role", label: "Role changes", desc: "When a member's role is updated", default: false },
    ],
  },
];

export default function NotificationSettingsPage() {
  const [preferences, setPreferences] = useState<Record<string, NotificationPreferenceRecord>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [pendingId, setPendingId] = useState<string>();

  useEffect(() => {
    loadNotificationPreferences()
      .then((rows) => {
        setPreferences(Object.fromEntries(rows.map((row) => [row.eventName, row])));
      })
      .catch((caught: unknown) => {
        setError(caught instanceof Error ? caught.message : "Preferences failed to load.");
      })
      .finally(() => setLoading(false));
  }, []);

  function isEnabled(itemId: string, fallback: boolean) {
    return preferences[itemId]?.inApp ?? fallback;
  }

  async function toggle(itemId: string, fallback: boolean) {
    const nextValue = !isEnabled(itemId, fallback);
    setPendingId(itemId);
    setError(undefined);
    try {
      const updated = await updateNotificationPreference(itemId, { inApp: nextValue });
      setPreferences((current) => ({ ...current, [itemId]: updated }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save that preference.");
    } finally {
      setPendingId(undefined);
    }
  }

  return (
    <div className="grid gap-8">
      <div className="rounded-[var(--radius-xl)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-6">
        <div className="flex items-center gap-2">
          <Bell className="size-5 text-[var(--ft-accent)]" />
          <h2 className="font-semibold">Notifications</h2>
        </div>
        <p className="mt-2 text-sm text-[var(--ft-text-secondary)]">
          Choose what you want to be notified about in-app. Changes save immediately.
        </p>

        <ErrorNotice message={error} />

        {loading ? (
          <div className="mt-4">
            <LoadingBlock label="Loading preferences" />
          </div>
        ) : (
          NOTIFICATION_GROUPS.map((group, gi) => (
            <div key={group.title}>
              {gi > 0 && <Divider />}
              <div className="mt-4 mb-3 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--ft-text-muted)]">
                {group.title}
              </div>
              <div className="grid gap-3">
                {group.items.map((item) => (
                  <div
                    className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-4 py-3 transition"
                    key={item.id}
                    style={pendingId === item.id ? { opacity: 0.6 } : undefined}
                  >
                    <div>
                      <div className="text-sm font-medium">{item.label}</div>
                      <div className="text-xs text-[var(--ft-text-muted)]">{item.desc}</div>
                    </div>
                    <Toggle
                      checked={isEnabled(item.id, item.default)}
                      onChange={() => void toggle(item.id, item.default)}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
