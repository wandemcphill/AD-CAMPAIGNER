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

type InvoiceListResponse = Invoice[] | { data?: unknown; invoices?: unknown };

function normalizeInvoices(value: InvoiceListResponse): Invoice[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") {
    if (Array.isArray(value.data)) return value.data as Invoice[];
    if (Array.isArray(value.invoices)) return value.invoices as Invoice[];
  }
  throw new Error("The invoice service returned an invalid invoice list.");
}

export async function listInvoices(): Promise<Invoice[]> {
  const response = await apiRequest<InvoiceListResponse>("/invoices");
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
