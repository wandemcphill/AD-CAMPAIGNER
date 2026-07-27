"use client";

import {
  Bot,
  Gamepad2,
  KeyRound,
  Music2,
  Palette,
  ShieldCheck,
  Sparkles,
  Tv,
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
  accessEnabled,
  categories as fallbackCategories,
  statusTone,
  type AccessCategory,
  type AccessPlan,
  type AccessRequest,
  type AccessService
} from "./data";

export type DigitalAccessSource = "api" | "disabled" | "fallback";

export type DigitalAccessState = {
  categories: AccessCategory[];
  error?: string;
  loading: boolean;
  requests: AccessRequest[];
  services: AccessService[];
  source: DigitalAccessSource;
};

type ApiCategory = {
  id: string;
  name: string;
  slug: string;
  isActive?: boolean;
};

type ApiPlan = {
  id: string;
  planName: string;
  duration: string;
  price: ApiMoney;
  description: string;
  isActive?: boolean;
};

type ApiService = {
  id: string;
  name: string;
  category: string;
  slug: string;
  description: string;
  startingPrice: ApiMoney;
  deliveryEta: string;
  isActive?: boolean;
  isFeatured?: boolean;
  plans: ApiPlan[];
};

type ApiRequest = {
  id: string;
  serviceId: string;
  planId: string;
  serviceName: string;
  planName: string;
  contactValue: string;
  status: string;
  amount: ApiMoney;
  createdAt: string;
  updatedAt: string;
};

type Paginated<T> = {
  items: T[];
  nextCursor?: string | null;
};

type CreateRequestInput = {
  serviceId?: string;
  serviceSlug?: string;
  planId: string;
  contactType: "email" | "whatsapp";
  contactValue: string;
  notes?: string;
};

type CreateRequestResponse = {
  request: ApiRequest;
};

const defaultState: DigitalAccessState = {
  categories: fallbackCategories,
  loading: false,
  requests: [],
  services: [],
  source: accessEnabled ? "fallback" : "disabled"
};

function categoryVisual(slug: string): Pick<AccessCategory, "icon" | "tone"> {
  const fallback = fallbackCategories.find((category) => category.slug === slug);

  if (fallback) {
    return { icon: fallback.icon, tone: fallback.tone };
  }
  if (slug.includes("stream")) {
    return { icon: Tv, tone: "text-[var(--ft-purple)]" };
  }
  if (slug.includes("game")) {
    return { icon: Gamepad2, tone: "text-[var(--ft-green)]" };
  }
  if (slug.includes("infra") || slug.includes("vpn") || slug.includes("security")) {
    return { icon: ShieldCheck, tone: "text-[var(--ft-yellow)]" };
  }

  return { icon: Sparkles, tone: "text-[var(--ft-accent)]" };
}

function serviceIcon(service: Pick<ApiService, "category" | "name" | "slug">): LucideIcon {
  const fallback = fallbackCategories.find(
    (item) => service.category.toLowerCase().includes(item.label.toLowerCase())
  );

  if (fallback) {
    return fallback.icon;
  }
  const categoryFallback = fallbackCategories.find(
    (item) => item.slug === service.slug || service.category.toLowerCase().includes(item.slug)
  );
  const haystack = `${service.name} ${service.slug} ${service.category}`.toLowerCase();

  if (categoryFallback) {
    return categoryFallback.icon;
  }
  if (haystack.includes("canva") || haystack.includes("design")) {
    return Palette;
  }
  if (haystack.includes("spotify") || haystack.includes("music")) {
    return Music2;
  }
  if (haystack.includes("game") || haystack.includes("coin")) {
    return Gamepad2;
  }
  if (haystack.includes("vpn") || haystack.includes("security") || haystack.includes("infra")) {
    return KeyRound;
  }
  if (haystack.includes("chat") || haystack.includes("ai")) {
    return Bot;
  }

  return KeyRound;
}

function normalizeStatus(status: string): AccessRequest["status"] {
  const normalized = status.toLowerCase();

  return normalized in statusTone ? (normalized as AccessRequest["status"]) : "pending";
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

function mapCategory(category: ApiCategory): AccessCategory {
  const visual = categoryVisual(category.slug);

  return {
    label: category.name,
    slug: category.slug,
    icon: visual.icon,
    tone: visual.tone
  };
}

function mapPlan(plan: ApiPlan): AccessPlan {
  return {
    id: plan.id,
    name: plan.planName,
    duration: plan.duration,
    price: formatMoney(plan.price),
    description: plan.description
  };
}

export function mapService(service: ApiService): AccessService {
  return {
    id: service.id,
    name: service.name,
    category: service.category,
    slug: service.slug,
    description: service.description,
    startingPrice: formatMoney(service.startingPrice),
    deliveryEta: service.deliveryEta,
    icon: serviceIcon(service),
    ...(service.isFeatured ? { featured: true } : {}),
    plans: service.plans.filter((plan) => plan.isActive !== false).map(mapPlan)
  };
}

export function mapRequest(request: ApiRequest): AccessRequest {
  return {
    id: request.id,
    service: request.serviceName,
    plan: request.planName,
    contact: request.contactValue,
    amount: formatMoney(request.amount),
    status: normalizeStatus(request.status),
    createdAt: formatDate(request.createdAt),
    updatedAt: formatDate(request.updatedAt)
  };
}

export async function loadDigitalAccessData(includeRequests: boolean) {
  if (!accessEnabled) {
    return defaultState;
  }

  const [categoryPayload, servicePayload, requestPayload] = await Promise.all([
    apiRequest<ApiCategory[]>("/digital-access/categories"),
    apiRequest<Paginated<ApiService>>("/digital-access/services"),
    includeRequests && getStoredToken()
      ? apiRequest<ApiRequest[]>("/digital-access/requests")
      : Promise.resolve(undefined)
  ]);

  const categories =
    categoryPayload.length > 0 ? categoryPayload.map(mapCategory) : fallbackCategories;
  const services = servicePayload.items.map(mapService);
  const requests = requestPayload ? requestPayload.map(mapRequest) : [];

  return {
    categories,
    loading: false,
    requests,
    services,
    source: "api" as const
  };
}

export async function createDigitalAccessRequest(input: CreateRequestInput) {
  const body = {
    ...input,
    idempotencyKey: `web_${Date.now()}_${Math.random().toString(36).slice(2)}`
  };

  return apiRequest<CreateRequestResponse>("/digital-access/requests", {
    method: "POST",
    body: JSON.stringify(body)
  });
}

export { defaultState, subscribeToSessionChanges };
