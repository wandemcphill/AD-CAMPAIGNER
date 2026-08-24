import { Injectable, NotFoundException } from "@nestjs/common";

import { PrismaService } from "../prisma.service";

const PAYMENT_STATUSES = ["PENDING", "REQUIRES_ACTION", "COMPLETED", "FAILED", "CANCELLED"] as const;
type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

function asMinorAmount(value: number | null | undefined) {
  return typeof value === "number" ? value : 0;
}

@Injectable()
export class AdminFinanceService {
  constructor(private readonly db: PrismaService) {}

  async listPayments(input: {
    q?: string;
    status?: PaymentStatus;
    limit?: number;
  }) {
    const term = input.q?.trim() ?? "";
    const limit = Math.min(Math.max(Number(input.limit) || 50, 1), 100);

    const [payments, grouped] = await Promise.all([
      this.db.paymentIntent.findMany({
        where: {
          ...(input.status ? { status: input.status } : {}),
          ...(term
            ? {
                OR: [
                  { id: term },
                  { providerReference: { contains: term, mode: "insensitive" } },
                  { customerEmail: { contains: term, mode: "insensitive" } },
                  { customerName: { contains: term, mode: "insensitive" } }
                ]
              }
            : {})
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        select: {
          id: true,
          workspaceId: true,
          gateway: true,
          amountMinor: true,
          currency: true,
          status: true,
          providerReference: true,
          customerEmail: true,
          customerName: true,
          campaignId: true,
          completedAt: true,
          creditedAt: true,
          createdAt: true,
          updatedAt: true,
          workspace: { select: { id: true, name: true } },
          campaign: { select: { id: true, name: true } }
        }
      }),
      this.db.paymentIntent.groupBy({
        by: ["status"],
        _count: { _all: true },
        _sum: { amountMinor: true }
      })
    ]);

    const counts = Object.fromEntries(
      PAYMENT_STATUSES.map((status) => {
        const row = grouped.find((item) => item.status === status);
        return [
          status,
          {
            count: row?._count._all ?? 0,
            amountMinor: asMinorAmount(row?._sum.amountMinor)
          }
        ];
      })
    );

    return {
      payments: payments.map((payment) => ({
        ...payment,
        amount: {
          amountMinor: payment.amountMinor,
          currency: payment.currency
        }
      })),
      counts,
      limit
    };
  }

  async getPayment(id: string) {
    const payment = await this.db.paymentIntent.findUnique({
      where: { id },
      select: {
        id: true,
        workspaceId: true,
        gateway: true,
        amountMinor: true,
        currency: true,
        status: true,
        providerReference: true,
        checkoutUrl: true,
        customerEmail: true,
        customerName: true,
        campaignId: true,
        campaignInvoiceId: true,
        idempotencyKey: true,
        providerPayload: true,
        metadata: true,
        completedAt: true,
        creditedAt: true,
        createdAt: true,
        updatedAt: true,
        workspace: { select: { id: true, name: true } },
        campaign: { select: { id: true, name: true } }
      }
    });

    if (!payment) {
      throw new NotFoundException(`Payment ${id} not found.`);
    }

    return {
      ...payment,
      amount: {
        amountMinor: payment.amountMinor,
        currency: payment.currency
      }
    };
  }
}
