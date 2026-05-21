export const paymentsService = {
  name: "payments",
  gateways: ["korapay", "paystack", "stripe", "manual"],
  responsibilities: ["intents", "webhooks", "reconciliation", "payout workflows"]
} as const;
