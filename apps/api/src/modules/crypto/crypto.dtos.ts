export interface RateQueryDto {
  amount?: number;
}

export interface DepositAddressQueryDto {
  asset: string;
  network?: string;
}

export interface CreateDepositAddressDto {
  asset: string;
  network?: string;
  idempotencyKey: string;
}
