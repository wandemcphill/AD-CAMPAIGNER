import { createPrismaClient } from "../src/index";

// One-off backfill for ProviderMapping (Gap 5, stage 1/2 of the convergence plan).
// Reads the existing inline providerName/providerReference-equivalent columns off
// each customer-facing resource entity and upserts a ProviderMapping row. Idempotent
// (upsert on the entityType+entityId unique constraint) — safe to re-run.
//
// This does NOT touch the source tables or remove their inline columns. It also
// does not run automatically on new writes going forward — services still write
// providerName directly onto their own tables. Keeping ProviderMapping in sync as
// the actual read/write chokepoint is the follow-up (stage 2 proper), deliberately
// out of scope here.

const db = createPrismaClient();

interface MappingRow {
  entityType: string;
  entityId: string;
  domain:
    | "VTU"
    | "VIRTUAL_NUMBER"
    | "GIFT_CARD"
    | "AIRTIME_CASHOUT"
    | "CRYPTO"
    | "RMB"
    | "VIRTUAL_ACCOUNT"
    | "VIRTUAL_CARD"
    | "REMITTANCE";
  providerName: string;
  providerReference: string | null;
}

async function collectVtuOrders(): Promise<MappingRow[]> {
  const rows = await db.vtuOrder.findMany({
    where: { providerName: { not: null } },
    select: { id: true, providerName: true, providerReference: true }
  });
  return rows.map((r) => ({
    entityType: "VtuOrder",
    entityId: r.id,
    domain: "VTU",
    providerName: r.providerName!,
    providerReference: r.providerReference
  }));
}

async function collectVirtualNumbers(): Promise<MappingRow[]> {
  const rows = await db.virtualNumber.findMany({
    select: { id: true, providerName: true, providerNumberId: true }
  });
  return rows.map((r) => ({
    entityType: "VirtualNumber",
    entityId: r.id,
    domain: "VIRTUAL_NUMBER",
    providerName: r.providerName,
    providerReference: r.providerNumberId
  }));
}

async function collectVirtualNumberOrders(): Promise<MappingRow[]> {
  const rows = await db.virtualNumberOrder.findMany({
    where: { providerName: { not: null } },
    select: { id: true, providerName: true, providerReference: true }
  });
  return rows.map((r) => ({
    entityType: "VirtualNumberOrder",
    entityId: r.id,
    domain: "VIRTUAL_NUMBER",
    providerName: r.providerName!,
    providerReference: r.providerReference
  }));
}

async function collectGiftCardSellTransactions(): Promise<MappingRow[]> {
  const rows = await db.giftCardSellTransaction.findMany({
    select: { id: true, providerName: true, providerTransactionId: true }
  });
  return rows.map((r) => ({
    entityType: "GiftCardSellTransaction",
    entityId: r.id,
    domain: "GIFT_CARD",
    providerName: r.providerName,
    providerReference: r.providerTransactionId
  }));
}

async function collectGiftCardPurchaseTransactions(): Promise<MappingRow[]> {
  const rows = await db.giftCardPurchaseTransaction.findMany({
    select: { id: true, supplierName: true, supplierOrderId: true, supplierTransactionId: true }
  });
  return rows.map((r) => ({
    entityType: "GiftCardPurchaseTransaction",
    entityId: r.id,
    domain: "GIFT_CARD",
    providerName: r.supplierName,
    providerReference: r.supplierOrderId ?? r.supplierTransactionId
  }));
}

async function collectAirtimeCashoutTransactions(): Promise<MappingRow[]> {
  const rows = await db.airtimeCashoutTransaction.findMany({
    select: { id: true, providerName: true, providerTransactionId: true }
  });
  return rows.map((r) => ({
    entityType: "AirtimeCashoutTransaction",
    entityId: r.id,
    domain: "AIRTIME_CASHOUT",
    providerName: r.providerName,
    providerReference: r.providerTransactionId
  }));
}

async function collectCryptoDepositAddresses(): Promise<MappingRow[]> {
  const rows = await db.cryptoDepositAddress.findMany({
    select: { id: true, providerName: true, address: true }
  });
  return rows.map((r) => ({
    entityType: "CryptoDepositAddress",
    entityId: r.id,
    domain: "CRYPTO",
    providerName: r.providerName,
    providerReference: r.address
  }));
}

async function collectCryptoSellTransactions(): Promise<MappingRow[]> {
  const rows = await db.cryptoSellTransaction.findMany({
    select: { id: true, providerName: true, providerReference: true }
  });
  return rows.map((r) => ({
    entityType: "CryptoSellTransaction",
    entityId: r.id,
    domain: "CRYPTO",
    providerName: r.providerName,
    providerReference: r.providerReference
  }));
}

async function collectRmbOrders(): Promise<MappingRow[]> {
  const rows = await db.rmbOrder.findMany({
    select: { id: true, providerName: true, providerReference: true }
  });
  return rows.map((r) => ({
    entityType: "RmbOrder",
    entityId: r.id,
    domain: "RMB",
    providerName: r.providerName,
    providerReference: r.providerReference
  }));
}

async function collectVirtualAccounts(): Promise<MappingRow[]> {
  const rows = await db.virtualAccount.findMany({
    select: { id: true, providerName: true, providerAccountId: true }
  });
  return rows.map((r) => ({
    entityType: "VirtualAccount",
    entityId: r.id,
    domain: "VIRTUAL_ACCOUNT",
    providerName: r.providerName,
    providerReference: r.providerAccountId
  }));
}

async function collectVirtualCards(): Promise<MappingRow[]> {
  const rows = await db.virtualCard.findMany({
    select: { id: true, providerName: true, providerCardId: true }
  });
  return rows.map((r) => ({
    entityType: "VirtualCard",
    entityId: r.id,
    domain: "VIRTUAL_CARD",
    providerName: r.providerName,
    providerReference: r.providerCardId || null
  }));
}

async function collectRemittanceTransfers(): Promise<MappingRow[]> {
  const rows = await db.remittanceTransfer.findMany({
    where: { providerName: { not: "" } },
    select: { id: true, providerName: true, providerReference: true }
  });
  return rows.map((r) => ({
    entityType: "RemittanceTransfer",
    entityId: r.id,
    domain: "REMITTANCE",
    providerName: r.providerName,
    providerReference: r.providerReference
  }));
}

async function main() {
  const collectors = [
    collectVtuOrders,
    collectVirtualNumbers,
    collectVirtualNumberOrders,
    collectGiftCardSellTransactions,
    collectGiftCardPurchaseTransactions,
    collectAirtimeCashoutTransactions,
    collectCryptoDepositAddresses,
    collectCryptoSellTransactions,
    collectRmbOrders,
    collectVirtualAccounts,
    collectVirtualCards,
    collectRemittanceTransfers
  ];

  let total = 0;
  for (const collect of collectors) {
    const rows = await collect();
    for (const row of rows) {
      await db.providerMapping.upsert({
        where: { entityType_entityId: { entityType: row.entityType, entityId: row.entityId } },
        create: {
          entityType: row.entityType,
          entityId: row.entityId,
          domain: row.domain,
          providerName: row.providerName,
          ...(row.providerReference ? { providerReference: row.providerReference } : {})
        },
        update: {
          domain: row.domain,
          providerName: row.providerName,
          providerReference: row.providerReference
        }
      });
      total += 1;
    }
    console.log(`${collect.name}: ${rows.length} rows backfilled`);
  }

  console.log(`ProviderMapping backfill complete: ${total} rows total`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
