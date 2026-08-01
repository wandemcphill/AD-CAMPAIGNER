/**
 * Data Transfer Objects for Trust Engine API.
 * Phase 1: core DTOs only. Additional DTOs in Phase 13 (admin dashboard).
 */

import { IsString, IsObject, IsOptional, IsEnum, IsUUID } from 'class-validator';
import type { AssetClass } from '@fliptrybe/service-trust-engine';

export class CreateSubmissionDto {
  @IsEnum(['GIFT_CARD', 'AIRTIME_PIN', 'RECHARGE_VOUCHER', 'DIGITAL_COUPON'])
  assetClass!: AssetClass;

  @IsObject()
  submissionProfile!: Record<string, unknown>;

  @IsOptional()
  @IsUUID()
  mediaAssetId?: string;

  @IsOptional()
  @IsString()
  uploadUrl?: string;

  @IsOptional()
  @IsString()
  secret?: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}

export class SubmissionStatusDto {
  @IsUUID()
  submissionId!: string;
}

export class CreateSubmissionResponseDto {
  submissionId!: string;
  status!: string;
  createdAt!: string;
  message!: string;
  mediaAsset?: {
    id: string;
    url: string;
    secure_url: string;
  };
}

export class SubmissionStatusResponseDto {
  submissionId!: string;
  status!: string;
  assetClass!: string;
  createdAt!: string;
  processedAt?: string;
  verdict?: {
    result: string;
    reasons: string[];
    explained: string;
  };
  moderationQueue?: {
    position: number;
    estimatedWait: number;
  };
  nextStep?: string;
}
