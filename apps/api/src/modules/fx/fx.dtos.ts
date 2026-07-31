export interface SetFxRateDto {
  rate: number; // decimal NGN per USD, e.g. 1450.25
  bufferBps?: number;
  note?: string;
  confirmLargeChange?: boolean;
}
