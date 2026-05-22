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
