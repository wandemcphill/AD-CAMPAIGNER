"use client";

import {
  apiRequest,
  formatMoney,
  type ApiMoney
} from "../lib/api-client";
import {
  adminAccessEnabled,
  metrics as fallbackMetrics,
  requests as fallbackRequests,
  services as fallbackServices,
  statusTone,
  type AdminAccessRequest,
  type AdminAccessService,
  type AdminMetric,
  type AdminServiceState
} from "./data";
import { subscribeToSessionChanges } from "../lib/api-client";

export type AdminDigitalAccessSource = "api" | "disabled" | "fallback";

export type AdminDigitalAccessState = {
  error?: string;
  loading: boolean;
  metrics: AdminMetric[];
  requests: AdminAccessRequest[];
  services: AdminAccessService[];
  source: AdminDigitalAccessSource;
};

type ApiPlan = {
  id: string;
  isActive?: boolean;
};

type ApiService = {
  id: string;
  name: string;
  category: string;
  startingPrice: ApiMoney;
  deliveryEta: string;
  isActive?: boolean;
  plans: ApiPlan[];
};

type ApiRequest = {
  id: string;
  userId?: string;
  serviceName: string;
  planName: string;
  contactValue: string;
  status: string;
  assignedTo?: string;
  amount: ApiMoney;
  createdAt: string;
};

type ApiOverview = {
  totals: {
    pending: number;
    processing: number;
    fulfilled: number;
    cancelled: number;
    failed: number;
  };
  revenue: ApiMoney;
  activeServices: number;
  draftServices: number;
  recentRequests: ApiRequest[];
};

type Paginated<T> = {
  items: T[];
  nextCursor?: string | null;
};

const defaultState: AdminDigitalAccessState = {
  loading: false,
  metrics: fallbackMetrics,
  requests: fallbackRequests,
  services: fallbackServices,
  source: adminAccessEnabled ? "fallback" : "disabled"
};

function normalizeStatus(status: string): AdminAccessRequest["status"] {
  const normalized = status.toLowerCase();

  return normalized in statusTone ? (normalized as AdminAccessRequest["status"]) : "pending";
}

function serviceState(service: ApiService): AdminServiceState {
  return service.isActive === false ? "draft" : "active";
}

function ageFrom(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const minutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));

  if (minutes < 60) {
    return `${minutes}m`;
  }
  if (minutes < 1440) {
    return `${Math.round(minutes / 60)}h`;
  }

  return `${Math.round(minutes / 1440)}d`;
}

function mapRequest(request: ApiRequest): AdminAccessRequest {
  return {
    id: request.id,
    customer: request.userId ?? "Workspace user",
    contact: request.contactValue,
    service: request.serviceName,
    plan: request.planName,
    amount: formatMoney(request.amount),
    status: normalizeStatus(request.status),
    assignedTo: request.assignedTo ?? "Unassigned",
    age: ageFrom(request.createdAt)
  };
}

function mapService(service: ApiService, requests: AdminAccessRequest[]): AdminAccessService {
  return {
    id: service.id,
    name: service.name,
    category: service.category,
    plans: service.plans.length,
    startingPrice: formatMoney(service.startingPrice),
    eta: service.deliveryEta,
    state: serviceState(service),
    demand: requests.filter((request) => request.service === service.name).length
  };
}

function buildMetrics(overview: ApiOverview): AdminMetric[] {
  const openRequests = overview.totals.pending + overview.totals.processing;
  const closedRequests =
    overview.totals.fulfilled + overview.totals.cancelled + overview.totals.failed;
  const totalRequests = openRequests + closedRequests;
  const refundRate =
    totalRequests > 0
      ? `${Math.round(((overview.totals.cancelled + overview.totals.failed) / totalRequests) * 100)}%`
      : "0%";

  return [
    {
      label: "Open requests",
      value: String(openRequests),
      detail: "Awaiting or in fulfillment",
      tone: "info"
    },
    {
      label: "Fulfilled",
      value: String(overview.totals.fulfilled),
      detail: "Completed manually",
      tone: "success"
    },
    {
      label: "Refund rate",
      value: refundRate,
      detail: "Cancelled or failed",
      tone: "warning"
    },
    {
      label: "Revenue",
      value: formatMoney(overview.revenue),
      detail: "Fulfilled request value"
    }
  ];
}

export async function loadAdminDigitalAccessData() {
  if (!adminAccessEnabled) {
    return defaultState;
  }

  const [overview, servicesPage, requestsPage] = await Promise.all([
    apiRequest<ApiOverview>("/admin/digital-access/overview"),
    apiRequest<Paginated<ApiService>>("/admin/digital-access/services"),
    apiRequest<Paginated<ApiRequest>>("/admin/digital-access/requests")
  ]);
  const requests =
    requestsPage.items.length > 0
      ? requestsPage.items.map(mapRequest)
      : overview.recentRequests.map(mapRequest);
  const services =
    servicesPage.items.length > 0
      ? servicesPage.items.map((service) => mapService(service, requests))
      : fallbackServices;

  return {
    loading: false,
    metrics: buildMetrics(overview),
    requests,
    services,
    source: "api" as const
  };
}

export { defaultState, subscribeToSessionChanges };
