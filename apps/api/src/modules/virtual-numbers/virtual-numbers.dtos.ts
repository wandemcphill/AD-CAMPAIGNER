export interface PurchaseNumberDto {
  productId: string;
}

export interface RenewNumberDto {
  durationDays: number;
}

export interface NumbersListQueryDto {
  page?: number;
  limit?: number;
  status?: string;
}

export interface MessagesListQueryDto {
  page?: number;
  limit?: number;
}
