"use client";

import { apiRequest, getStoredToken, type ApiMoney } from "../../lib/api-client";
import { accessEnabled } from "../../digital-access/data";
import { growthEnabled } from "../../growth-services/data";

export type UnifiedOrderSource =
  | "growth"
  | "digital-access"
  | "airtime"
  | "bills"
  | "telecom"
  | "rmb";

export interface UnifiedOrder {
  id: string;
  source: UnifiedOrderSource;
  sourceLabel: string;
  title: string;
  detail: string;
  amountMinor: number;
  currency: string;
  status: string;
  createdAt: string;
  /** Deep link to the vertical's own surface. Cast to `Route` at the Link. */
  href: string;
}

export const orderSourceLabels: Record<UnifiedOrderSource, string> = {
  growth: "Growth services",
  "digital-access": "Digital access",
  airtime: "Airtime & data",
  bills: "Bills",
  telecom: "International top-up",
  rmb: "RMB transfers"
};

// Each vertical keeps its own order table and its own endpoint; there is no
// unified order model on the backend. This fans out and normalises instead of
// introducing one, so a vertical that is flag-disabled or permission-denied
// simply drops out rather than failing the page.
type Fetcher = () => Promise<UnifiedOrder[]>;

type GrowthOrderShape = {
  id: string;
  serviceName: string;
  platform: string;
  quantityOrdered: number;
  status: string;
  amount: ApiMoney;
  updatedAt: string;
};

type AccessRequestShape = {
  id: string;
  serviceName: string;
  planName: string;
  status: string;
  amount: ApiMoney;
  createdAt: string;
};

type VtuOrderShape = {
  id: string;
  productType: string;
  network: string;
  msisdnMasked: string;
  amountMinor: number;
  status: string;
  createdAt: string;
};

type BillsOrderShape = {
  id: string;
  productType: string;
  msisdnMasked: string;
  amountMinor: number;
  status: string;
  createdAt: string;
};

type TelecomOrderShape = {
  id: string;
  productType: string;
  operatorName: string | null;
  countryIso: string;
  msisdnMasked: string;
  amountMinor: number;
  currency: string;
  status: string;
  createdAt: string;
};

type RmbOrderShape = {
  id: string;
  channel: string;
  rmbAmount: string;
  ngnAmountMinor: number;
  recipientName: string;
  status: string;
  createdAt: string;
};

function titleCase(value: string) {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

const fetchers: Array<{ source: UnifiedOrderSource; enabled: boolean; load: Fetcher }> = [
  {
    source: "growth",
    enabled: growthEnabled,
    load: async () => {
      const orders = await apiRequest<GrowthOrderShape[]>("/growth/orders");

      return orders.map((order) => ({
        id: order.id,
        source: "growth" as const,
        sourceLabel: orderSourceLabels.growth,
        title: order.serviceName,
        detail: `${order.platform} · ${order.quantityOrdered.toLocaleString()} ordered`,
        amountMinor: order.amount.amountMinor,
        currency: order.amount.currency,
        status: order.status,
        // GrowthOrder exposes no createdAt on the API shape.
        createdAt: order.updatedAt,
        href: "/os/growth/orders"
      }));
    }
  },
  {
    source: "digital-access",
    enabled: accessEnabled,
    load: async () => {
      const requests = await apiRequest<AccessRequestShape[]>("/digital-access/requests");

      return requests.map((request) => ({
        id: request.id,
        source: "digital-access" as const,
        sourceLabel: orderSourceLabels["digital-access"],
        title: request.serviceName,
        detail: request.planName,
        amountMinor: request.amount.amountMinor,
        currency: request.amount.currency,
        status: request.status,
        createdAt: request.createdAt,
        href: `/os/digital-access/requests/${request.id}`
      }));
    }
  },
  {
    source: "airtime",
    enabled: true,
    load: async () => {
      const res = await apiRequest<{ orders: VtuOrderShape[] }>("/vtu/orders");

      return res.orders.map((order) => ({
        id: order.id,
        source: "airtime" as const,
        sourceLabel: orderSourceLabels.airtime,
        title: `${titleCase(order.productType)} · ${order.network}`,
        detail: order.msisdnMasked,
        amountMinor: order.amountMinor,
        currency: "NGN",
        status: order.status,
        createdAt: order.createdAt,
        href: "/os/airtime"
      }));
    }
  },
  {
    source: "bills",
    enabled: true,
    load: async () => {
      const res = await apiRequest<{ orders: BillsOrderShape[] }>("/vtu/bills/orders");

      return res.orders.map((order) => ({
        id: order.id,
        source: "bills" as const,
        sourceLabel: orderSourceLabels.bills,
        title: titleCase(order.productType),
        detail: order.msisdnMasked,
        amountMinor: order.amountMinor,
        currency: "NGN",
        status: order.status,
        createdAt: order.createdAt,
        href: "/os/utilities"
      }));
    }
  },
  {
    source: "telecom",
    enabled: true,
    load: async () => {
      const res = await apiRequest<{ orders: TelecomOrderShape[] }>("/telecom/orders");

      return res.orders.map((order) => ({
        id: order.id,
        source: "telecom" as const,
        sourceLabel: orderSourceLabels.telecom,
        title: `${titleCase(order.productType)} · ${order.operatorName ?? order.countryIso}`,
        detail: order.msisdnMasked,
        amountMinor: order.amountMinor,
        currency: order.currency,
        status: order.status,
        createdAt: order.createdAt,
        href: "/os/telecom"
      }));
    }
  },
  {
    source: "rmb",
    enabled: true,
    load: async () => {
      const orders = await apiRequest<RmbOrderShape[]>("/rmb/orders");

      return orders.map((order) => ({
        id: order.id,
        source: "rmb" as const,
        sourceLabel: orderSourceLabels.rmb,
        title: `¥${order.rmbAmount} to ${order.recipientName}`,
        detail: order.channel,
        amountMinor: order.ngnAmountMinor,
        currency: "NGN",
        status: order.status,
        createdAt: order.createdAt,
        href: "/os/rmb"
      }));
    }
  }
];

export interface UnifiedOrdersResult {
  orders: UnifiedOrder[];
  /** Sources that errored. Surfaced so a partial list is never shown as complete. */
  unavailable: UnifiedOrderSource[];
}

export async function loadAllOrders(): Promise<UnifiedOrdersResult> {
  if (!getStoredToken()) {
    return { orders: [], unavailable: [] };
  }

  const active = fetchers.filter((fetcher) => fetcher.enabled);
  const settled = await Promise.allSettled(active.map((fetcher) => fetcher.load()));

  const orders: UnifiedOrder[] = [];
  const unavailable: UnifiedOrderSource[] = [];

  settled.forEach((result, index) => {
    const source = active[index]?.source;
    if (!source) return;

    if (result.status === "fulfilled") {
      orders.push(...result.value);
    } else {
      unavailable.push(source);
    }
  });

  orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return { orders, unavailable };
}
