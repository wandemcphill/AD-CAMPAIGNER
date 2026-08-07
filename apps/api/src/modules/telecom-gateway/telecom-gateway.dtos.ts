export interface DetectNumberDto {
  phoneNumber: string;
}

export interface ProductsQueryDto {
  operatorId: string;
}

export interface BuyTelecomAirtimeDto {
  phoneNumber: string;
  operatorId: string;
  amountMinor: number;
  /** Set true only after FlipTrybe checkout has confirmed payment for this purchase. */
  paymentConfirmed: boolean;
}

export interface BuyTelecomDataDto {
  phoneNumber: string;
  operatorId: string;
  bundleId: string;
  /** Set true only after FlipTrybe checkout has confirmed payment for this purchase. */
  paymentConfirmed: boolean;
}

export interface TelecomOrderQueryDto {
  page?: number;
  limit?: number;
  countryIso?: string;
  status?: string;
}
