"use client";

import type { OtpOrder as ApiOtpOrder, OtpService } from "@fliptrybe/types";

import { apiRequest, formatMoney, getStoredToken } from "../lib/api-client";
import {
  quickStats as fallbackQuickStats,
  services as fallbackServices,
  type OtpMetric,
  type OtpOrder,
  type OtpServiceRow,
  type OtpStatus,
  type OtpWalletLedgerEntry,
  type OtpWalletSummary
} from "./data";

type ApiWallet = {
  availableBalance?: { amountMinor: number; currency: string };
  heldBalance?: { amountMinor: number; currency: string };
};

export type OtpDashboardData = {
  services: OtpServiceRow[];
  orders: OtpOrder[];
  wallet: OtpWalletSummary;
  walletLedger: OtpWalletLedgerEntry[];
  quickStats: typeof fallbackQuickStats;
  loadedFromApi: boolean;
};

const countryNames =
  typeof Intl !== "undefined" && "DisplayNames" in Intl
    ? new Intl.DisplayNames(["en"], { type: "region" })
    : undefined;

function countryName(code: string) {
  return countryNames?.of(code.toUpperCase()) ?? code.toUpperCase();
}

function expiryText(order: ApiOtpOrder) {
  if (!order.expiresAt) {
    return "Pending";
  }

  const remainingMs = new Date(order.expiresAt).getTime() - Date.now();
  if (remainingMs <= 0) {
    return "0:00";
  }

  const minutes = Math.floor(remainingMs / 60_000);
  const seconds = Math.floor((remainingMs % 60_000) / 1_000);

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function timeText(value?: string) {
  if (!value) {
    return "Now";
  }

  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function mapStatus(status: ApiOtpOrder["status"]): OtpStatus {
  if (
    status === "CHARGED" ||
    status === "ALLOCATING" ||
    status === "WAITING" ||
    status === "RECEIVED" ||
    status === "EXPIRED" ||
    status === "REFUNDED" ||
    status === "COMPLETED"
  ) {
    return status;
  }

  return "WAITING";
}

function mapService(service: OtpService): OtpServiceRow {
  return {
    name: service.name,
    country: countryName(service.countryCode),
    price: "Quote at checkout",
    stock: service.visible ? 1 : 0,
    success: service.requiresAdminApproval ? "Approval required" : "Beta route",
    eta: service.providerTier === "PREMIUM" ? "Manual" : "Live",
    tag: service.providerTier === "PREMIUM" ? "Guarded" : "Live",
    serviceCode: service.code,
    countryCode: service.countryCode
  };
}

function mapOrder(order: ApiOtpOrder): OtpOrder {
  const status = mapStatus(order.status);

  return {
    id: order.id,
    service: order.serviceName,
    country: countryName(order.countryCode),
    status,
    number: order.phoneNumberMasked ?? "Awaiting provider allocation",
    code: order.message?.redactedMessage ?? null,
    amount: formatMoney(order.amount),
    route: `${order.providerTier.toLowerCase()} route`,
    requestedAt: timeText(order.createdAt),
    expiresIn: expiryText(order),
    events: [
      { label: "Order charged", at: timeText(order.createdAt), tone: "success" },
      {
        label:
          status === "RECEIVED"
            ? "OTP received"
            : status === "REFUNDED"
              ? "Wallet refunded"
              : "Provider route active",
        at: timeText(order.updatedAt),
        tone: status === "REFUNDED" ? "neutral" : status === "RECEIVED" ? "info" : "warning"
      }
    ]
  };
}

function walletSummary(wallet?: ApiWallet): OtpWalletSummary {
  return {
    available: formatMoney(wallet?.availableBalance),
    held: formatMoney(wallet?.heldBalance),
    spentToday: "Live ledger"
  };
}

function quickStatsFrom(orders: OtpOrder[], wallet: OtpWalletSummary): OtpMetric[] {
  const liveOrders = orders.filter((order) =>
    ["CHARGED", "ALLOCATING", "WAITING", "RECEIVED"].includes(order.status)
  );
  const refunds = orders.filter((order) => order.status === "REFUNDED").length;

  return [
    {
      ...fallbackQuickStats[0]!,
      value: wallet.available,
      detail: "Available OTP wallet balance"
    },
    {
      ...fallbackQuickStats[1]!,
      value: String(liveOrders.length),
      detail: `${orders.length} total API orders`
    },
    {
      ...fallbackQuickStats[2]!,
      value:
        orders.length > 0
          ? `${Math.round(((orders.length - refunds) / orders.length) * 100)}%`
          : "No orders",
      detail: "Completion health from live orders"
    },
    {
      ...fallbackQuickStats[3]!,
      value: String(refunds),
      detail: "Refunded OTP orders"
    }
  ];
}

export async function loadOtpDashboard(): Promise<OtpDashboardData> {
  const token = getStoredToken();
  let services = fallbackServices;
  let loadedFromApi = false;

  try {
    services = (await apiRequest<OtpService[]>("/otp/services")).map(mapService);
    loadedFromApi = true;
  } catch {
    services = fallbackServices;
  }

  if (!token) {
    const wallet = { available: "Sign in", held: "Sign in", spentToday: "Sign in to view" };

    return {
      services,
      orders: [],
      wallet,
      walletLedger: [],
      quickStats: quickStatsFrom([], wallet),
      loadedFromApi
    };
  }

  const [apiOrders, wallet] = await Promise.all([
    apiRequest<ApiOtpOrder[]>("/otp/orders"),
    apiRequest<ApiWallet>("/otp/wallet")
  ]);
  const orders = apiOrders.map(mapOrder);
  const summary = walletSummary(wallet);

  return {
    services,
    orders,
    wallet: summary,
    walletLedger: apiOrders.slice(0, 8).map((order) => ({
      label: `${order.serviceName} OTP debit`,
      amount: `-${formatMoney(order.amount)}`,
      rail: order.id,
      status:
        order.status === "REFUNDED"
          ? "REFUNDED"
          : order.status === "COMPLETED" || order.status === "RECEIVED"
            ? "COMPLETED"
            : "WAITING",
      at: timeText(order.createdAt)
    })),
    quickStats: quickStatsFrom(orders, summary),
    loadedFromApi
  };
}

export function createOtpOrder(service: OtpServiceRow) {
  return apiRequest<{ order: ApiOtpOrder }>("/otp/orders", {
    method: "POST",
    body: JSON.stringify({
      serviceCode: service.serviceCode ?? service.name.toLowerCase().replaceAll(" ", "_"),
      countryCode: service.countryCode ?? service.country.slice(0, 2).toUpperCase(),
      attestationAccepted: true,
      idempotencyKey: `otp_${Date.now()}`
    })
  });
}
