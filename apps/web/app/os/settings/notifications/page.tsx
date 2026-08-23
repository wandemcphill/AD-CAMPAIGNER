"use client";

import { Fragment, useEffect, useState } from "react";
import { Bell, Mail, MessageCircle, MessageSquare, Smartphone } from "lucide-react";

import { Divider, Toggle } from "@fliptrybe/ui/components";

import { ErrorNotice, LoadingBlock } from "../../../campaigns/components";
import {
  loadNotificationPreferences,
  updateNotificationPreference,
  type NotificationPreferenceRecord
} from "../../../notifications/api";

type Channel = "inApp" | "email" | "sms" | "whatsapp";

const CHANNELS: Array<{ key: Channel; label: string; icon: typeof Bell }> = [
  { key: "inApp", label: "In-app", icon: Smartphone },
  { key: "email", label: "Email", icon: Mail },
  { key: "sms", label: "SMS", icon: MessageSquare },
  { key: "whatsapp", label: "WhatsApp", icon: MessageCircle }
];

const NOTIFICATION_GROUPS = [
  {
    title: "Campaigns",
    items: [
      {
        id: "campaign-launch",
        label: "Campaign launched",
        desc: "When a campaign goes live",
        defaults: { inApp: true, email: true, sms: false, whatsapp: false }
      },
      {
        id: "campaign-end",
        label: "Campaign ended",
        desc: "When a campaign completes or is paused",
        defaults: { inApp: true, email: true, sms: false, whatsapp: false }
      },
      {
        id: "campaign-budget",
        label: "Budget alerts",
        desc: "When spend reaches 80% or 100% of budget",
        defaults: { inApp: true, email: true, sms: false, whatsapp: false }
      }
    ]
  },
  {
    title: "Wallet & Finance",
    items: [
      {
        id: "wallet-credit",
        label: "Funds added",
        desc: "When money is deposited to your wallet",
        defaults: { inApp: true, email: true, sms: false, whatsapp: false }
      },
      {
        id: "wallet-debit",
        label: "Funds deducted",
        desc: "Campaign holds and service purchases",
        defaults: { inApp: true, email: false, sms: false, whatsapp: false }
      },
      {
        id: "wallet-low",
        label: "Low balance",
        desc: "When balance drops below ₦5,000",
        defaults: { inApp: true, email: true, sms: true, whatsapp: true }
      }
    ]
  },
  {
    title: "Approvals",
    items: [
      {
        id: "approval-requested",
        label: "Approval requested",
        desc: "When something needs your sign-off",
        defaults: { inApp: true, email: true, sms: false, whatsapp: false }
      },
      {
        id: "approval-decided",
        label: "Approval decided",
        desc: "When your submission is approved or rejected",
        defaults: { inApp: true, email: true, sms: false, whatsapp: false }
      }
    ]
  },
  {
    title: "Security & Team",
    items: [
      {
        id: "security-login",
        label: "New sign-in",
        desc: "When your account is accessed from a new device",
        defaults: { inApp: true, email: true, sms: true, whatsapp: true }
      },
      {
        id: "team-role",
        label: "Role changes",
        desc: "When a team member's role is updated",
        defaults: { inApp: true, email: false, sms: false, whatsapp: false }
      }
    ]
  }
];

export default function NotificationSettingsPage() {
  const [preferences, setPreferences] = useState<Record<string, NotificationPreferenceRecord>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [pendingKey, setPendingKey] = useState<string>();

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

  function isEnabled(itemId: string, channel: Channel, fallback: boolean) {
    return preferences[itemId]?.[channel] ?? fallback;
  }

  async function toggle(itemId: string, channel: Channel, fallback: boolean) {
    const key = `${itemId}:${channel}`;
    const nextValue = !isEnabled(itemId, channel, fallback);
    setPendingKey(key);
    setError(undefined);
    try {
      const updated = await updateNotificationPreference(itemId, { [channel]: nextValue });
      setPreferences((current) => ({ ...current, [itemId]: updated }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save that preference.");
    } finally {
      setPendingKey(undefined);
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
          Choose which channel each type of update reaches you on. Changes save immediately.
        </p>

        <ErrorNotice message={error} />

        {loading ? (
          <div className="mt-4">
            <LoadingBlock label="Loading preferences" />
          </div>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse">
              <thead>
                <tr>
                  <th className="w-full" />
                  {CHANNELS.map((channel) => (
                    <th
                      className="px-3 pb-2 text-center font-mono text-micro font-normal uppercase tracking-[0.08em] text-[var(--ft-text-muted)]"
                      key={channel.key}
                    >
                      <span className="flex flex-col items-center gap-1">
                        <channel.icon className="size-3.5" />
                        {channel.label}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {NOTIFICATION_GROUPS.map((group, gi) => (
                  <Fragment key={group.title}>
                    <tr key={`${group.title}-header`}>
                      <td className="pt-4 pb-2 font-mono text-micro uppercase tracking-[0.08em] text-[var(--ft-text-muted)]" colSpan={CHANNELS.length + 1}>
                        {gi > 0 && <Divider />}
                        <div className={gi > 0 ? "mt-4" : ""}>{group.title}</div>
                      </td>
                    </tr>
                    {group.items.map((item) => (
                      <tr key={item.id}>
                        <td className="rounded-l-[var(--radius-md)] border border-r-0 border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-4 py-3">
                          <div className="text-sm font-medium">{item.label}</div>
                          <div className="text-xs text-[var(--ft-text-muted)]">{item.desc}</div>
                        </td>
                        {CHANNELS.map((channel, ci) => {
                          const key = `${item.id}:${channel.key}`;
                          return (
                            <td
                              className={cnCell(ci, CHANNELS.length)}
                              key={key}
                              style={pendingKey === key ? { opacity: 0.6 } : undefined}
                            >
                              <div className="flex justify-center">
                                <Toggle
                                  checked={isEnabled(item.id, channel.key, item.defaults[channel.key])}
                                  onChange={() => void toggle(item.id, channel.key, item.defaults[channel.key])}
                                />
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function cnCell(index: number, total: number) {
  const base = "border-t border-b border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-3 py-3";
  if (index === total - 1) return `${base} rounded-r-[var(--radius-md)] border-r`;
  return base;
}
