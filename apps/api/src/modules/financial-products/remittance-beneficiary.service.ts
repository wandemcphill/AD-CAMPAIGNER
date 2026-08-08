/**
 * Manages customer-saved remittance beneficiaries (payout recipients).
 * Separate from SettlementBeneficiary which is FlipTrybe's own settlement infra.
 *
 * Bank account names are validated through the provider before saving where
 * the provider supports account name enquiry. Do not trust user-submitted names.
 */
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException
} from "@nestjs/common";

import { PrismaService } from "../prisma.service";

export interface CreateBeneficiaryInput {
  workspaceId: string;
  userId?: string;
  nickname?: string;
  recipientName: string;
  country: string;
  currency: string;
  bankName?: string;
  bankCode?: string;
  accountNumber?: string;
  mobileNumber?: string;
  payoutMethod?: "BANK_ACCOUNT" | "MOBILE_MONEY" | "CASH_PICKUP";
}

@Injectable()
export class RemittanceBeneficiaryService {
  private readonly logger = new Logger(RemittanceBeneficiaryService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateBeneficiaryInput) {
    const payoutMethod = input.payoutMethod ?? "BANK_ACCOUNT";

    if (payoutMethod === "BANK_ACCOUNT" && !input.accountNumber) {
      throw new BadRequestException("accountNumber is required for BANK_ACCOUNT payout");
    }
    if (payoutMethod === "MOBILE_MONEY" && !input.mobileNumber) {
      throw new BadRequestException("mobileNumber is required for MOBILE_MONEY payout");
    }

    // TODO: when a real remittance provider is contracted, call
    // remittanceProvider.validateBeneficiary() here and populate verifiedName.
    // Until then we store as UNVERIFIED and validation is deferred to transfer time.

    const beneficiary = await this.prisma.client.remittanceBeneficiary.create({
      data: {
        workspaceId: input.workspaceId,
        userId: input.userId ?? null,
        nickname: input.nickname ?? null,
        recipientName: input.recipientName,
        country: input.country,
        currency: input.currency,
        bankName: input.bankName ?? null,
        bankCode: input.bankCode ?? null,
        accountNumber: input.accountNumber ?? null,
        mobileNumber: input.mobileNumber ?? null,
        payoutMethod,
        verificationStatus: "UNVERIFIED"
      }
    });

    this.logger.log(`Beneficiary created: id=${beneficiary.id} workspaceId=${input.workspaceId}`);

    return beneficiary;
  }

  async list(workspaceId: string, country?: string) {
    return this.prisma.client.remittanceBeneficiary.findMany({
      where: { workspaceId, ...(country ? { country } : {}) },
      orderBy: { createdAt: "desc" }
    });
  }

  async getById(id: string, workspaceId: string) {
    const b = await this.prisma.client.remittanceBeneficiary.findFirst({
      where: { id, workspaceId }
    });
    if (!b) throw new NotFoundException("Beneficiary not found");
    return b;
  }

  async delete(id: string, workspaceId: string) {
    const b = await this.getById(id, workspaceId);
    await this.prisma.client.remittanceBeneficiary.delete({ where: { id: b.id } });
  }
}
