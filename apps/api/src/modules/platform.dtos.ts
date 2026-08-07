import type {
  CampaignObjective,
  CurrencyCode,
  DestinationKind,
  SmmServiceKind
} from "@fliptrybe/types";

export interface CreateCampaignDto {
  name?: string;
  objective?: CampaignObjective;
  budgetMinor?: number;
  currency?: CurrencyCode;
  destinationKind?: DestinationKind;
  destinationUrl?: string;
}

export interface QuoteCampaignDto {
  objective?: CampaignObjective;
  budgetMinor?: number;
  currency?: CurrencyCode;
  destinationKind?: DestinationKind;
}

export interface CreatePaymentIntentDto {
  amountMinor?: number;
  currency?: CurrencyCode;
  customerEmail?: string;
  customerName?: string;
  redirectUrl?: string;
  webhookUrl?: string;
}

export interface CreateSmmOrderDto {
  serviceKind?: SmmServiceKind;
  quantity?: number;
  destinationKind?: DestinationKind;
  destinationUrl?: string;
}

export interface CreateGrowthOrderDto {
  serviceCode?: string;
  quantity?: number;
  destinationUrl?: string;
  /** Delivery email, required when the service's destinationKind is DELIVERY_CONTACT. */
  deliveryContact?: string;
  idempotencyKey?: string;
}

export interface UpdateGrowthServiceDto {
  enabled?: boolean;
  marginBps?: number;
  preferredSupplier?: string;
  maximumQuantity?: number;
  expectedCompletion?: string;
  adminNote?: string;
}

export interface UpdateGrowthOrderDto {
  status?: "PENDING" | "SUBMITTED" | "IN_PROGRESS" | "COMPLETED" | "FAILED" | "REFUNDED";
  quantityDelivered?: number;
  supplierReference?: string;
  supplierName?: string;
  adminNote?: string;
  failureReason?: string;
}

export interface SmmSupplierReferenceDto {
  supplierReference?: string;
}

export interface SmmSupplierReferencesDto {
  supplierReferences?: string[];
}

export interface CreateSupportTicketDto {
  subject?: string;
  priority?: "LOW" | "NORMAL" | "HIGH" | "URGENT";
}
