"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, CreditCard, Eye, XCircle } from "lucide-react";

import { Badge, Button } from "@fliptrybe/ui";
import { TabBar, Drawer, AlertBanner } from "@fliptrybe/ui/components";

type Payment = {
  id: string;
  reference: string;
  user: string;
  amount: string;
  method: string;
  status: "successful" | "pending" | "failed" | "flagged";
  provider: string;
  timestamp: string;
};

const MOCK_PAYMENTS: Payment[] = [
  { id: "1", reference: "PAY-9281", user: "Tunde Okoro", amount: "₦50,000", method: "Bank Transfer", status: "successful", provider: "Korapay", timestamp: "2025-07-29 14:30" },
  { id: "2", reference: "PAY-9282", user: "Chi Studios", amount: "₦120,000", method: "Card", status: "successful", provider: "Paystack", timestamp: "2025-07-29 14:15" },
  { id: "3", reference: "PAY-9283", user: "Amara Kalu", amount: "₦5,000", method: "Bank Transfer", status: "pending", provider: "Korapay", timestamp: "2025-07-29 13:50" },
  { id: "4", reference: "PAY-9284", user: "Segun Balogun", amount: "₦200,000", method: "Card", status: "flagged", provider: "Paystack", timestamp: "2025-07-29 13:20" },
  { id: "5", reference: "PAY-9285", user: "Guest User", amount: "₦1,000", method: "USSD", status: "failed", provider: "Korapay", timestamp: "2025-07-29 12:00" },
];

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  successful: "success",
  pending: "warning",
  failed: "danger",
  flagged: "danger",
};

const STATUS_ICON = {
  successful: CheckCircle2,
  pending: CreditCard,
  failed: XCircle,
  flagged: AlertTriangle,
} as const;

const TABS = [
  { id: "all", label: "All", count: 5 },
  { id: "successful", label: "Successful", count: 2 },
  { id: "pending", label: "Pending", count: 1 },
  { id: "flagged", label: "Flagged", count: 1 },
  { id: "failed", label: "Failed", count: 1 },
];

export default function PaymentsPage() {
  const [tab, setTab] = useState("all");
  const [selected, setSelected] = useState<Payment>();

  const filtered = MOCK_PAYMENTS.filter((p) => tab === "all" || p.status === tab);

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold">Payments</h1>
      <p className="mt-1 text-sm text-[var(--ft-text-secondary)]">Verify payments and monitor fraud detection</p>

      <AlertBanner className="mt-4" tone="warning">
        1 payment flagged for review — ₦200,000 card transaction from Segun Balogun exceeds velocity threshold.
      </AlertBanner>

      <div className="mt-6">
        <TabBar items={TABS} onChange={setTab} value={tab} />
      </div>

      <div className="mt-4 overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--ft-border)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--ft-border)] bg-[var(--ft-bg-surface)]">
              <th className="px-4 py-3 text-left font-medium text-[var(--ft-text-muted)]">Reference</th>
              <th className="px-4 py-3 text-left font-medium text-[var(--ft-text-muted)]">User</th>
              <th className="px-4 py-3 text-left font-medium text-[var(--ft-text-muted)]">Amount</th>
              <th className="px-4 py-3 text-left font-medium text-[var(--ft-text-muted)]">Method</th>
              <th className="px-4 py-3 text-left font-medium text-[var(--ft-text-muted)]">Provider</th>
              <th className="px-4 py-3 text-left font-medium text-[var(--ft-text-muted)]">Status</th>
              <th className="px-4 py-3 text-left font-medium text-[var(--ft-text-muted)]">Time</th>
              <th className="w-10 px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--ft-border)]">
            {filtered.map((payment) => {
              const Icon = STATUS_ICON[payment.status] ?? CreditCard;
              return (
                <tr className="bg-[var(--ft-bg-raised)] transition hover:bg-[var(--ft-bg-muted)]" key={payment.id}>
                  <td className="px-4 py-3 font-mono text-xs font-medium">{payment.reference}</td>
                  <td className="px-4 py-3">{payment.user}</td>
                  <td className="px-4 py-3 font-mono text-xs">{payment.amount}</td>
                  <td className="px-4 py-3 text-[var(--ft-text-secondary)]">{payment.method}</td>
                  <td className="px-4 py-3 text-[var(--ft-text-secondary)]">{payment.provider}</td>
                  <td className="px-4 py-3">
                    <Badge tone={STATUS_TONE[payment.status] ?? "neutral"}>
                      <Icon className="size-3" />
                      {payment.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-[var(--ft-text-muted)]">{payment.timestamp}</td>
                  <td className="px-4 py-3">
                    <button className="text-[var(--ft-text-muted)] hover:text-[var(--ft-accent)]" onClick={() => setSelected(payment)} type="button">
                      <Eye className="size-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Drawer onClose={() => setSelected(undefined)} open={Boolean(selected)} title="Payment Details">
        {selected && (
          <div className="grid gap-4">
            {selected.status === "flagged" && (
              <AlertBanner tone="danger">
                This payment was flagged by the fraud detection system. Review before approving.
              </AlertBanner>
            )}
            {[
              { label: "Reference", value: selected.reference },
              { label: "User", value: selected.user },
              { label: "Amount", value: selected.amount },
              { label: "Method", value: selected.method },
              { label: "Provider", value: selected.provider },
              { label: "Status", value: selected.status },
              { label: "Timestamp", value: selected.timestamp },
            ].map((item) => (
              <div className="flex justify-between border-b border-[var(--ft-border)] pb-2 text-sm" key={item.label}>
                <span className="text-[var(--ft-text-muted)]">{item.label}</span>
                <span className="font-medium">{item.value}</span>
              </div>
            ))}
            {selected.status === "flagged" && (
              <div className="flex gap-3">
                <Button className="flex-1 justify-center" variant="secondary">Approve</Button>
                <Button className="flex-1 justify-center text-[var(--ft-red)]" variant="ghost">Reject</Button>
              </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}
