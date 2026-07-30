"use client";

import { useMemo, useState } from "react";
import {
  Bell,
  CheckCircle2,
  CreditCard,
  FileText,
  KeyRound,
  Megaphone,
  RefreshCw,
  Zap
} from "lucide-react";

import { Badge, Button, Panel, SummaryStatStrip, cn } from "@fliptrybe/ui";

import { EmptyState, ErrorNotice, LoadingBlock, PageHeader } from "../../campaigns/components";
import {
  formatNotificationTime,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationRecord
} from "../../notifications/api";
import { useNotificationsData } from "../../notifications/use-notifications-data";

function entityIcon(entityType?: string | null) {
  if (!entityType) return Bell;
  if (entityType.includes("Report")) return FileText;
  if (entityType.includes("DigitalAccess")) return KeyRound;
  if (entityType.includes("Growth")) return Zap;
  if (entityType.includes("Campaign")) return Megaphone;
  if (entityType.includes("Payment") || entityType.includes("Wallet")) return CreditCard;
  return Bell;
}

export default function NotificationsPage() {
  const { error, loading, notifications, refresh, setNotifications } = useNotificationsData();
  const [markingAll, setMarkingAll] = useState(false);
  const [pendingId, setPendingId] = useState<string>();
  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.readAt).length,
    [notifications]
  );

  async function onOpen(notification: NotificationRecord) {
    if (notification.readAt) return;

    setPendingId(notification.id);
    try {
      const updated = await markNotificationRead(notification.id);
      setNotifications((current) =>
        current.map((item) => (item.id === updated.id ? updated : item))
      );
    } finally {
      setPendingId(undefined);
    }
  }

  async function onMarkAllRead() {
    setMarkingAll(true);
    try {
      await markAllNotificationsRead();
      await refresh();
    } finally {
      setMarkingAll(false);
    }
  }

  return (
    <>
      <PageHeader
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button disabled={loading} onClick={() => void refresh()} variant="secondary">
              <RefreshCw className="size-4 stroke-[1.5]" />
              Refresh
            </Button>
            <Button
              disabled={markingAll || loading || unreadCount === 0}
              onClick={() => void onMarkAllRead()}
              variant="secondary"
            >
              <CheckCircle2 className="size-4 stroke-[1.5]" />
              Mark all read
            </Button>
          </div>
        }
        eyebrow={
          <>
            <Badge tone="info">Client inbox</Badge>
            {unreadCount > 0 ? <Badge tone="danger">{unreadCount} unread</Badge> : null}
          </>
        }
        title="Notifications"
      />

      <ErrorNotice message={error} />

      <section className="mt-6">
        <SummaryStatStrip
          items={[
            { label: "total notifications", value: loading ? "..." : notifications.length },
            { label: "unread", value: loading ? "..." : unreadCount },
            {
              label: "read",
              value: loading ? "..." : notifications.length - unreadCount
            }
          ]}
        />
      </section>

      <Panel className="mt-4 overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--ft-border)] p-4 sm:p-5">
          <div>
            <h2 className="text-lg font-medium text-[var(--ft-text-primary)]">Inbox</h2>
            <p className="mt-1 text-sm text-[var(--ft-text-secondary)]">
              Real-time updates from campaigns, wallet, growth services, and digital access.
            </p>
          </div>
          <Bell className="size-5 shrink-0 stroke-[1.5] text-[var(--ft-accent)]" />
        </div>

        {loading ? (
          <div className="p-4">
            <LoadingBlock label="Loading notifications" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-4">
            <EmptyState
              copy="You'll see campaign updates, wallet events, and service notices here as they happen."
              icon={Bell}
              title="No notifications yet"
            />
          </div>
        ) : (
          <div className="divide-y divide-[var(--ft-border)]">
            {notifications.map((notification) => {
              const Icon = entityIcon(notification.entityType);
              const unread = !notification.readAt;

              return (
                <button
                  className={cn(
                    "flex w-full items-start gap-3 p-4 text-left transition hover:bg-[var(--ft-bg-muted)] sm:p-5",
                    unread && "bg-[var(--ft-accent-subtle)]"
                  )}
                  disabled={pendingId === notification.id}
                  key={notification.id}
                  onClick={() => void onOpen(notification)}
                  type="button"
                >
                  <div className="grid size-10 shrink-0 place-items-center rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)]">
                    <Icon className="size-4 stroke-[1.5] text-[var(--ft-accent)]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-[var(--ft-text-primary)]">
                        {notification.title}
                      </span>
                      {unread ? <Badge tone="info">New</Badge> : null}
                    </div>
                    <p className="mt-1 text-sm leading-6 text-[var(--ft-text-secondary)]">
                      {notification.body}
                    </p>
                    <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.04em] text-[var(--ft-text-muted)]">
                      {formatNotificationTime(notification.createdAt)}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </Panel>
    </>
  );
}
