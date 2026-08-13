export type CreatePaymentLinkDto = {
  title: string;
  description?: string;
  amountMinor?: number | null;
  currency?: string;
  collectCustomerInfo?: boolean;
  expiresAt?: string;
};

export type PayPaymentLinkDto = {
  amountMinor?: number;
  payerEmail?: string;
  payerName?: string;
  redirectUrl?: string;
};
