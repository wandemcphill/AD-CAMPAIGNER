export interface CreateRmbOrderDto {
  channel: "alipay" | "wechat" | "bank";
  accountType?: "nigerian" | "chinese";
  rmbAmount: number;
  recipientName: string;
  recipientIdentifier?: string;
  recipientBankName?: string;
  recipientBankAccountNumber?: string;
  /** Hosted URL of the recipient's Alipay/WeChat receive QR code, from the /media upload-intent flow. */
  qrCodeUrl?: string;
  description: string;
  idempotencyKey: string;
}
