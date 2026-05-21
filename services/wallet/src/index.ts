export const walletService = {
  name: "wallet",
  responsibilities: ["balances", "holds", "withdrawals", "ledger projections"],
  queues: ["payments", "audit-events"]
} as const;
