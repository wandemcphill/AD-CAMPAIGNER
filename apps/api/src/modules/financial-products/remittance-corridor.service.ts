/**
 * Remittance corridor configuration service.
 * Corridors are database-driven — no hard-coded routes in application code.
 * Admin enables/disables corridors without a deploy.
 */
import { Injectable, NotFoundException } from "@nestjs/common";

import { PrismaService } from "../prisma.service";

@Injectable()
export class RemittanceCorridorService {
  constructor(private readonly prisma: PrismaService) {}

  async listEnabled() {
    return this.prisma.client.remittanceCorridor.findMany({
      where: { enabled: true },
      orderBy: [{ sourceCountry: "asc" }, { destinationCountry: "asc" }]
    });
  }

  async findCorridor(
    sourceCountry: string,
    sourceCurrency: string,
    destinationCountry: string,
    destinationCurrency: string
  ) {
    const corridor = await this.prisma.client.remittanceCorridor.findUnique({
      where: {
        sourceCountry_sourceCurrency_destinationCountry_destinationCurrency: {
          sourceCountry,
          sourceCurrency,
          destinationCountry,
          destinationCurrency
        }
      }
    });

    if (!corridor) throw new NotFoundException("Remittance corridor not configured");
    if (!corridor.enabled) throw new NotFoundException("Remittance corridor is currently unavailable");

    return corridor;
  }

  /** Seed the six initial corridors. Safe to call multiple times (upsert). */
  async seedInitialCorridors() {
    const corridors = [
      { sourceCountry: "GB", sourceCurrency: "GBP", destinationCountry: "NG", destinationCurrency: "NGN" },
      { sourceCountry: "US", sourceCurrency: "USD", destinationCountry: "NG", destinationCurrency: "NGN" },
      { sourceCountry: "GB", sourceCurrency: "GBP", destinationCountry: "GH", destinationCurrency: "GHS" },
      { sourceCountry: "US", sourceCurrency: "USD", destinationCountry: "GH", destinationCurrency: "GHS" },
      { sourceCountry: "GB", sourceCurrency: "GBP", destinationCountry: "LR", destinationCurrency: "LRD" },
      { sourceCountry: "US", sourceCurrency: "USD", destinationCountry: "LR", destinationCurrency: "LRD" }
    ];

    for (const c of corridors) {
      await this.prisma.client.remittanceCorridor.upsert({
        where: {
          sourceCountry_sourceCurrency_destinationCountry_destinationCurrency: {
            sourceCountry: c.sourceCountry,
            sourceCurrency: c.sourceCurrency,
            destinationCountry: c.destinationCountry,
            destinationCurrency: c.destinationCurrency
          }
        },
        create: {
          ...c,
          // Corridors are created DISABLED by default — admin enables after
          // provider verification and KYB/compliance sign-off.
          enabled: false,
          notes: "Pending provider verification and compliance sign-off"
        },
        update: {}
      });
    }
  }
}
