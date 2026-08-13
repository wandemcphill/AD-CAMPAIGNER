import { apiRequest } from "../../../lib/api-client";

export type PaymentLinkStatus = "ACTIVE" | "DISABLED" | "EXPIRED";

export type PaymentLink = {
  id: string;
  reference: string;
  title: string;
  description: string | null;
  amountMinor: number | null;
  currency: string;
  status: PaymentLinkStatus;
  collectCustomerInfo: boolean;
  timesPaid: number;
  totalCollectedMinor: number;
  expiresAt: string | null;
  createdAt: string | null;
};

export type CreatePaymentLinkInput = {
  title: string;
  description?: string;
  amountMinor?: number | null;
  currency?: string;
  collectCustomerInfo?: boolean;
  expiresAt?: string;
};

export function listPaymentLinks() {
  return apiRequest<PaymentLink[]>("/payment-links");
}

export function createPaymentLink(input: CreatePaymentLinkInput) {
  return apiRequest<PaymentLink>("/payment-links", { method: "POST", body: JSON.stringify(input) });
}

export function disablePaymentLink(id: string) {
  return apiRequest<PaymentLink>(`/payment-links/${encodeURIComponent(id)}/disable`, { method: "POST" });
}

export function paymentLinkUrl(reference: string) {
  if (typeof window === "undefined") return `/pay/${reference}`;
  return `${window.location.origin}/pay/${reference}`;
}

export function formatPaymentLinkMoney(amountMinor: number, currency: string) {
  const major = amountMinor / 100;
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(major);
  } catch {
    return `${currency} ${major.toFixed(2)}`;
  }
}
