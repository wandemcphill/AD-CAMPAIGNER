/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access */
import { Injectable } from "@nestjs/common";

import { PrismaService } from "../prisma.service";

const VTU_PROVIDERS = ["clubkonnect", "vtpass"];
const VIRTUAL_NUMBER_PROVIDERS = ["smspool", "5sim", "smspva"];

function isSecretConfigured(value: string | undefined) {
  const trimmed = value?.trim();
  return Boolean(trimmed && trimmed !== "..." && !trimmed.startsWith("replace-"));
}

@Injectable()
export class ProvidersService {
  constructor(private readonly prisma: PrismaService) {}

  private get db() {
    return this.prisma.client;
  }

  private async latestHealthByName(providers: string[], domain: "VTU" | "VIRTUAL_NUMBER") {
    const rows = await this.db.providerHealth.findMany({
      where: { providerName: { in: providers }, domain },
      orderBy: { checkedAt: "desc" },
      distinct: ["providerName"]
    });

    return providers.map((name) => {
      const row = rows.find((r: any) => r.providerName === name);
      return {
        name,
        status: row?.status ?? "DISABLED",
        latencyMs: row?.latencyMs ?? null,
        successRateBps: row?.successRateBps ?? null,
        lastCheckedAt: row?.checkedAt ?? null,
        reason: row?.reason ?? null
      };
    });
  }

  async overview() {
    const [vtu, virtualNumbers, fxRateCount, korapayConfigured] = await Promise.all([
      this.latestHealthByName(VTU_PROVIDERS, "VTU"),
      this.latestHealthByName(VIRTUAL_NUMBER_PROVIDERS, "VIRTUAL_NUMBER"),
      this.db.fxRate.count(),
      Promise.resolve(
        process.env.PAYMENT_PROVIDER === "live" && isSecretConfigured(process.env.KORAPAY_SECRET_KEY)
      )
    ]);

    return {
      categories: [
        {
          key: "airtime_data",
          label: "Airtime & Data",
          providers: vtu.map((p) => ({
            ...p,
            services: ["Airtime top-up", "Data bundles"],
            configurationState: p.status === "DISABLED" ? "not_configured" : "configured"
          }))
        },
        {
          key: "virtual_numbers",
          label: "Virtual Numbers (International SMS)",
          providers: virtualNumbers.map((p) => ({
            ...p,
            services: ["SMS-receiving numbers"],
            configurationState: p.status === "DISABLED" ? "not_configured" : "configured"
          }))
        },
        {
          key: "payments",
          label: "Payments",
          providers: [
            {
              name: "korapay",
              status: korapayConfigured ? "HEALTHY" : "DISABLED",
              latencyMs: null,
              successRateBps: null,
              lastCheckedAt: null,
              reason: korapayConfigured ? null : "PAYMENT_PROVIDER is not set to live, or KORAPAY_SECRET_KEY is missing.",
              services: ["Wallet top-up", "Payment intents"],
              configurationState: korapayConfigured ? "configured" : "not_configured"
            }
          ]
        },
        {
          key: "fx",
          label: "FX",
          providers: [
            {
              name: "admin_managed_rate",
              status: fxRateCount > 0 ? "HEALTHY" : "DEGRADED",
              latencyMs: null,
              successRateBps: null,
              lastCheckedAt: null,
              reason: fxRateCount > 0 ? null : "No FX rate has ever been set — quotes use a bootstrap fallback.",
              services: ["USD/NGN conversion for digital products"],
              configurationState: fxRateCount > 0 ? "configured" : "bootstrap_fallback"
            }
          ]
        },
        {
          key: "global_digital_products",
          label: "Global Digital Products",
          providers: [],
          configurationState: "not_configured",
          note: "No provider adapter is wired for this category yet."
        },
        {
          key: "virtual_cards",
          label: "Virtual Cards",
          providers: [],
          configurationState: "not_configured",
          note: "No card-issuing provider is connected yet."
        }
      ]
    };
  }
}
