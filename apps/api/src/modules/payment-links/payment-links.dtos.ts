export type CreatePaymentLinkDto = {
  title: string;
  description?: string;
  amountMinor?: number | null;
  currency?: string;
  collectCustomerInfo?: boolean;
  expiresAt?: string;
};
