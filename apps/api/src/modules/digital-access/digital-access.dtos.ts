import type { DigitalAccessContactType, DigitalAccessRequestStatus } from "@fliptrybe/types";

export interface DigitalAccessListQueryDto {
  category?: string;
  q?: string;
  cursor?: string;
  limit?: number | string;
}

export interface DigitalAccessRequestQueryDto {
  status?: DigitalAccessRequestStatus;
  category?: string;
  q?: string;
  cursor?: string;
  limit?: number | string;
}

export interface CreateDigitalAccessRequestDto {
  serviceId?: string;
  serviceSlug?: string;
  planId: string;
  contactType: DigitalAccessContactType;
  contactValue: string;
  notes?: string;
  idempotencyKey?: string;
}

export interface DigitalAccessCategoryDto {
  name?: string;
  slug?: string;
  description?: string;
  sortOrder?: number;
  isActive?: boolean;
}

export interface DigitalAccessServiceDto {
  name?: string;
  category?: string;
  slug?: string;
  description?: string;
  startingPriceMinor?: number;
  deliveryEta?: string;
  isActive?: boolean;
  isFeatured?: boolean;
  thumbnail?: string;
}

export interface DigitalAccessPlanDto {
  serviceId?: string;
  planName?: string;
  duration?: string;
  priceMinor?: number;
  description?: string;
  isActive?: boolean;
}

export interface DigitalAccessStatusDto {
  status: DigitalAccessRequestStatus;
}

export interface DigitalAccessAssignDto {
  assignedTo?: string | null;
}
