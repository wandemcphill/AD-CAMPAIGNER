import { ServiceUnavailableException } from "@nestjs/common";
import { describe, expect, it } from "vitest";

import type { PrismaService } from "../prisma.service";
import type { ProviderRouterService } from "../providers/provider-router.service";
import { FinancialProductsService } from "./financial-products.service";
import type { FinancialReconciliationService } from "./financial-reconciliation.service";

/**
 * Regression guard for the provider-name resolution seam.
 *
 * ProviderRouterService.select() returns `ProviderConfig.name`. That column is
 * globally @unique, so a vendor serving two domains gets two rows with distinct
 * suffixed names ("swappr-virtual-account", "swappr-remittance"). The
 * build*Adapter factories used to switch on the bare vendor name only, so every
 * real selection fell through to `default:` and threw ServiceUnavailable — while
 * the service's own tests passed, because they stubbed the router to return the
 * bare name the switch expected and the seed never produces.
 *
 * These tests call the real factories with the exact strings that reach them in
 * production, so that seam can't silently break again:
 *
 *   1. ProviderConfig row names (from seed-financial-products.ts) — what the
 *      router hands to select*Adapter on a new order.
 *   2. Bare adapter names — what gets persisted on VirtualAccount /
 *      VirtualCard / RemittanceTransfer rows, and what getAccount(),
 *      closeAccount() and getCard() re-derive an adapter from later.
 *
 * The adapter factories read credentials from process.env with empty-string
 * defaults, so they construct fine without real keys — this asserts resolution,
 * not connectivity.
 */

// Mirrors packages/database/prisma/seed-financial-products.ts. If a row is added
// there, add it here and to VENDOR_BY_PROVIDER_CONFIG_NAME in the service.
const SEEDED_PROVIDER_CONFIG_NAMES = {
  account: ["swappr-virtual-account"],
  card: ["payscribe-virtual-card"],
  remittance: ["swappr-remittance", "yativo-remittance", "fincra-remittance"]
} as const;

// The `name` each adapter reports, and therefore what lands in the DB column.
const PERSISTED_ADAPTER_NAMES = {
  account: ["swappr", "payscribe"],
  card: ["payscribe"],
  remittance: ["swappr", "yativo", "fincra"]
} as const;

function buildService() {
  return new FinancialProductsService(
    {} as unknown as PrismaService,
    {} as unknown as ProviderRouterService,
    {} as unknown as FinancialReconciliationService
  );
}

type Factories = {
  buildAccountAdapter: (name: string) => { name: string };
  buildCardAdapter: (name: string) => { name: string };
  buildRemittanceAdapter: (name: string) => { name: string };
};

const factories = () => buildService() as unknown as Factories;

describe("financial provider name resolution", () => {
  describe("ProviderConfig row names resolve to an adapter", () => {
    it.each(SEEDED_PROVIDER_CONFIG_NAMES.account)("virtual account: %s", (configName) => {
      expect(factories().buildAccountAdapter(configName).name).toBe("swappr");
    });

    it.each(SEEDED_PROVIDER_CONFIG_NAMES.card)("virtual card: %s", (configName) => {
      expect(factories().buildCardAdapter(configName).name).toBe("payscribe");
    });

    it.each(SEEDED_PROVIDER_CONFIG_NAMES.remittance)("remittance: %s", (configName) => {
      const adapter = factories().buildRemittanceAdapter(configName);
      expect(configName.startsWith(adapter.name)).toBe(true);
    });
  });

  describe("persisted adapter names still resolve, for lifecycle reads", () => {
    it.each(PERSISTED_ADAPTER_NAMES.account)("virtual account: %s", (adapterName) => {
      expect(factories().buildAccountAdapter(adapterName).name).toBe(adapterName);
    });

    it.each(PERSISTED_ADAPTER_NAMES.card)("virtual card: %s", (adapterName) => {
      expect(factories().buildCardAdapter(adapterName).name).toBe(adapterName);
    });

    it.each(PERSISTED_ADAPTER_NAMES.remittance)("remittance: %s", (adapterName) => {
      expect(factories().buildRemittanceAdapter(adapterName).name).toBe(adapterName);
    });
  });

  // The mapping is an explicit table, not suffix-stripping, precisely so an
  // unknown row fails loudly instead of being coerced into a vendor it happens
  // to share a prefix with.
  describe("unknown provider names fail loudly", () => {
    it("rejects an unmapped config row rather than guessing from its prefix", () => {
      const build = factories();
      expect(() => build.buildRemittanceAdapter("swappr-payouts-v2")).toThrow(
        ServiceUnavailableException
      );
      expect(() => build.buildCardAdapter("sudo-virtual-card")).toThrow(
        ServiceUnavailableException
      );
      expect(() => build.buildAccountAdapter("")).toThrow(ServiceUnavailableException);
    });
  });
});
