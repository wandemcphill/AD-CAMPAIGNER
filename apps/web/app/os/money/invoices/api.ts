import { apiRequest } from "../../../lib/api-client";

export type InvoiceStatus = "DRAFT" | "SENT" | "PAID" | "OVERDUE" | "VOID";

export type InvoiceLineItem = {
  id: string;
  description: string;
  quantity: number;
  unitPriceMinor: number;
  amountMinor: number;
};

export type Invoice = {
  id: string;
  number: string;
  status: InvoiceStatus;
  customerName: string;
  customerEmail: string | null;
  currency: string;
  subtotalMinor: number;
  totalMinor: number;
  amountPaidMinor: number;
  notes: string | null;
  issuedAt: string | null;
  dueAt: string | null;
  paidAt: string | null;
  createdAt: string | null;
  lineItems: InvoiceLineItem[];
};

export type CreateInvoiceInput = {
  customerName: string;
  customerEmail?: string;
  currency?: string;
  notes?: string;
  dueAt?: string;
  lineItems: { description: string; quantity: number; unitPriceMinor: number }[];
};

function isInvoiceRecord(value: unknown): value is Invoice {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.number === "string" &&
    typeof record.status === "string" &&
    typeof record.customerName === "string" &&
    typeof record.currency === "string"
  );
}

function normalizeInvoices(value: unknown): Invoice[] {
  const candidates =
    Array.isArray(value)
      ? value
      : value && typeof value === "object"
        ? ((value as Record<string, unknown>).data ?? (value as Record<string, unknown>).invoices)
        : undefined;

  if (!Array.isArray(candidates)) {
    throw new Error("The invoice service returned an invalid invoice list.");
  }

  return candidates.filter(isInvoiceRecord);
}

export async function listInvoices(): Promise<Invoice[]> {
  const response = await apiRequest<unknown>("/invoices");
  return normalizeInvoices(response);
}

export function createInvoice(input: CreateInvoiceInput) {
  return apiRequest<Invoice>("/invoices", { method: "POST", body: JSON.stringify(input) });
}

export function sendInvoice(id: string) {
  return apiRequest<Invoice>(`/invoices/${encodeURIComponent(id)}/send`, { method: "POST" });
}

export function markInvoicePaid(id: string) {
  return apiRequest<Invoice>(`/invoices/${encodeURIComponent(id)}/mark-paid`, { method: "POST" });
}

export function voidInvoice(id: string) {
  return apiRequest<Invoice>(`/invoices/${encodeURIComponent(id)}/void`, { method: "POST" });
}

// Minor units -> display string. Amounts are integers (kobo/cents).
export function formatInvoiceMoney(amountMinor: number, currency: string) {
  const major = amountMinor / 100;
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(major);
  } catch {
    return `${currency} ${major.toFixed(2)}`;
  }
}
