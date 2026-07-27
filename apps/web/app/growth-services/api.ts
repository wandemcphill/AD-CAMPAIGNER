"use client";

import {
  BarChart3,
  Eye,
  Heart,
  MousePointerClick,
  Send,
  UserPlus,
  Users,
  type LucideIcon
} from "lucide-react";

import {
  apiRequest,
  formatMoney,
  getStoredToken,
  subscribeToSessionChanges,
  type ApiMoney
} from "../lib/api-client";
import {
  growthEnabled,
  type GrowthOrder,
  type GrowthOrderStatus,
  type GrowthService
} from "./data";

export type GrowthState = {
  error?: string;
  loading: boolean;
  orders: GrowthOrder[];
  services: GrowthService[];
  source: "api" | "disabled" | "fallback";
};

type ApiGrowthRisk = {
  platformPolicyRisk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  accountRisk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  refundRisk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  reputationRisk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  summary: string;
};

type ApiGrowthService = {
  code: string;
  name: string;
  platform: string;
  category: string;
  description: string;
  enabled: boolean;
  baseRate: ApiMoney;
  minimumQuantity: number;
  maximumQuantity: number;
  quantityStep: number;
  expectedCompletion: string;
  risk: ApiGrowthRisk;
};

type ApiGrowthOrder = {
  id: string;
  serviceName: string;
  platform: string;
  destinationUrl: string;
  quantityOrdered: number;
  quantityDelivered: number;
  status: GrowthOrderStatus;
  amount: ApiMoney;
  expectedCompletionAt: string;
  updatedAt: string;
};

type CreateOrderInput = {
  serviceCode: string;
  quantity: number;
  destinationUrl: string;
};

type CreateOrderResponse = {
  order: ApiGrowthOrder;
  reviewRequired: boolean;
};

const defaultState: GrowthState = {
  loading: false,
  orders: [],
  services: [],
  source: growthEnabled ? "fallback" : "disabled"
};

function normalizePlatform(platform: string) {
  return platform.charAt(0).toUpperCase() + platform.slice(1).toLowerCase();
}

function serviceIcon(service: Pick<ApiGrowthService, "code" | "name" | "platform">): LucideIcon {
  const haystack = `${service.code} ${service.name} ${service.platform}`.toLowerCase();

  if (haystack.includes("follower") || haystack.includes("subscriber")) {
    return UserPlus;
  }
  if (haystack.includes("like")) {
    return Heart;
  }
  if (haystack.includes("view")) {
    return Eye;
  }
  if (haystack.includes("telegram")) {
    return Send;
  }
  if (haystack.includes("traffic") || haystack.includes("website")) {
    return MousePointerClick;
  }
  if (haystack.includes("member")) {
    return Users;
  }

  return BarChart3;
}

function riskTone(risk: ApiGrowthRisk): GrowthService["riskTone"] {
  if (
    risk.platformPolicyRisk === "CRITICAL" ||
    risk.accountRisk === "CRITICAL" ||
    risk.refundRisk === "CRITICAL" ||
    risk.reputationRisk === "CRITICAL"
  ) {
    return "danger";
  }
  if (
    risk.platformPolicyRisk === "HIGH" ||
    risk.accountRisk === "HIGH" ||
    risk.refundRisk === "HIGH" ||
    risk.reputationRisk === "HIGH"
  ) {
    return "warning";
  }

  return "info";
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function mapService(service: ApiGrowthService): GrowthService {
  return {
    code: service.code,
    name: service.name,
    platform: normalizePlatform(service.platform),
    category: service.category,
    description: service.description,
    price: `${formatMoney(service.baseRate)} / 1k`,
    minimumQuantity: service.minimumQuantity,
    maximumQuantity: service.maximumQuantity,
    quantityStep: service.quantityStep,
    expectedCompletion: service.expectedCompletion,
    enabled: service.enabled,
    riskTone: riskTone(service.risk),
    riskSummary: service.risk.summary,
    icon: serviceIcon(service)
  };
}

function mapOrder(order: ApiGrowthOrder): GrowthOrder {
  return {
    id: order.id,
    serviceName: order.serviceName,
    platform: normalizePlatform(order.platform),
    destinationUrl: order.destinationUrl,
    quantityOrdered: order.quantityOrdered,
    quantityDelivered: order.quantityDelivered,
    status: order.status,
    amount: formatMoney(order.amount),
    expectedCompletionAt: formatDate(order.expectedCompletionAt),
    updatedAt: formatDate(order.updatedAt)
  };
}

export async function loadGrowthData(includeOrders: boolean) {
  if (!growthEnabled) {
    return defaultState;
  }

  const [servicesPayload, ordersPayload] = await Promise.all([
    apiRequest<ApiGrowthService[]>("/growth/services"),
    includeOrders && getStoredToken()
      ? apiRequest<ApiGrowthOrder[]>("/growth/orders")
      : Promise.resolve(undefined)
  ]);

  return {
    loading: false,
    orders: ordersPayload ? ordersPayload.map(mapOrder) : [],
    services: servicesPayload.map(mapService),
    source: "api" as const
  };
}

export async function createGrowthOrder(input: CreateOrderInput) {
  const response = await apiRequest<CreateOrderResponse>("/growth/orders", {
    method: "POST",
    body: JSON.stringify(input)
  });

  return {
    ...response,
    order: mapOrder(response.order)
  };
}

export { defaultState, subscribeToSessionChanges };
