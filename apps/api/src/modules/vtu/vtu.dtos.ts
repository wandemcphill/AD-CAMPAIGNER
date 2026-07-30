import type { VtuNetwork } from "@fliptrybe/providers";

export interface BuyAirtimeDto {
  network: VtuNetwork;
  msisdn: string;
  faceValueMinor: number;
}

export interface BuyDataDto {
  network: VtuNetwork;
  msisdn: string;
  providerPlanId: string;
}

export interface VtuOrderQueryDto {
  page?: number;
  limit?: number;
  network?: VtuNetwork;
  status?: string;
}

export interface AdminVtuRouteUpdateDto {
  priority?: number;
  enabled?: boolean;
}
