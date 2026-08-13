export type InvoiceLineItemInput = {
  description: string;
  quantity: number;
  unitPriceMinor: number;
};

export type CreateInvoiceDto = {
  customerName: string;
  customerEmail?: string;
  currency?: string;
  notes?: string;
  dueAt?: string;
  lineItems: InvoiceLineItemInput[];
};
