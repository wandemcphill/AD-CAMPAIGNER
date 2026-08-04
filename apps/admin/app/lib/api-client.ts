export type ApiMoney = {
  amountMinor: number;
  currency: string;
};

export type ApiSession = {
  user: {
    id: string;
    name: string;
    username: string;
    displayName?: string;
    email?: string;
    defaultWorkspaceId?: string;
  };
  defaultWorkspaceId?: string;
  workspace: {
    id: string;
    name: string;
    defaultCurrency: string;
  };
  organization?: {
    id: string;
    name: string;
    slug: string;
  };
  role?: string;
  permissions?: string[];
};

export type AuthCredentials = {
  username: string;
  password: string;
  confirmPassword?: string;
  displayName?: string;
};

export type AuthResult = {
  session: ApiSession;
  token?: string;
  expiresAt?: string;
};

type SessionSource = Partial<ApiSession> & {
  token?: string;
  expiresAt?: string;
  defaultWorkspaceId?: string;
};

type AuthEnvelope = SessionSource & {
  data?: SessionSource;
  session?: SessionSource;
};

type ApiRequestOptions = RequestInit & {
  token?: string;
  timeoutMs?: number;
};

const tokenStorageKey = "fliptrybe.authToken";
const sessionChangeEvent = "fliptrybe-session-changed";

function normalizeApiBaseUrl(raw: string) {
  const stripped = raw.trim().replace(/\/+$/, "");
  const base = stripped || "http://localhost:4000/v1";

  return base.endsWith("/v1") ? base : `${base}/v1`;
}

export function getApiBaseUrl() {
  return normalizeApiBaseUrl(
    process.env.NEXT_PUBLIC_API_BASE_URL ??
      process.env.NEXT_PUBLIC_API_URL ??
      "http://localhost:4000/v1"
  );
}

export function getStoredToken() {
  if (typeof window === "undefined") {
    return undefined;
  }

  return window.localStorage.getItem(tokenStorageKey) ?? undefined;
}

export function setStoredToken(token: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(tokenStorageKey, token);
  window.dispatchEvent(new Event(sessionChangeEvent));
}

export function clearStoredToken() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(tokenStorageKey);
  window.dispatchEvent(new Event(sessionChangeEvent));
}

export function subscribeToSessionChanges(handler: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  window.addEventListener(sessionChangeEvent, handler);
  window.addEventListener("storage", handler);

  return () => {
    window.removeEventListener(sessionChangeEvent, handler);
    window.removeEventListener("storage", handler);
  };
}

export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

function endpoint(path: string) {
  return `${getApiBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function messageFromPayload(payload: unknown) {
  if (!isRecord(payload)) {
    return undefined;
  }

  const message = payload.message;
  if (Array.isArray(message)) {
    return message.join(", ");
  }
  if (typeof message === "string") {
    return message;
  }
  if (typeof payload.error === "string") {
    return payload.error;
  }

  return undefined;
}

async function readErrorMessage(response: Response) {
  try {
    const payload = (await response.json()) as unknown;

    return messageFromPayload(payload) ?? response.statusText;
  } catch {
    return response.statusText;
  }
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}) {
  const { token, timeoutMs = 12_000, signal, ...requestOptions } = options;
  const headers = new Headers(requestOptions.headers);
  const activeToken = token ?? getStoredToken();
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs);

  if (signal?.aborted) {
    controller.abort();
  } else if (signal) {
    signal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  if (requestOptions.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (activeToken && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${activeToken}`);
  }

  let response: Response;

  try {
    response = await fetch(endpoint(path), {
      ...requestOptions,
      headers,
      cache: "no-store",
      signal: controller.signal
    });
  } catch (caught) {
    if (controller.signal.aborted) {
      throw new ApiClientError("Admin API request timed out. Check NEXT_PUBLIC_API_URL and API health.", 408);
    }
    throw caught;
  } finally {
    globalThis.clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new ApiClientError(await readErrorMessage(response), response.status);
  }
  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

function normalizeAuthPayload(payload: AuthEnvelope): AuthResult {
  const source = payload.session ?? payload.data ?? payload;
  const session: ApiSession = {
    user: source.user ?? { id: "", name: "Unknown user", username: "unknown" },
    workspace: source.workspace ?? {
      id: "",
      name: "Workspace",
      defaultCurrency: "NGN"
    }
  };

  if (source.organization) {
    session.organization = source.organization;
  }
  if (source.role) {
    session.role = source.role;
  }
  if (source.permissions) {
    session.permissions = source.permissions;
  }
  if (source.defaultWorkspaceId) {
    session.defaultWorkspaceId = source.defaultWorkspaceId;
  }

  const result: AuthResult = { session };
  const token = payload.token ?? source.token;
  const expiresAt = payload.expiresAt ?? source.expiresAt;

  if (token) {
    result.token = token;
  }
  if (expiresAt) {
    result.expiresAt = expiresAt;
  }

  return result;
}

async function authPost(path: string, credentials?: AuthCredentials) {
  const payload = await apiRequest<AuthEnvelope>(path, {
    method: "POST",
    body: JSON.stringify(credentials ?? {})
  });
  const result = normalizeAuthPayload(payload);

  if (result.token) {
    setStoredToken(result.token);
  }

  return result;
}

export function login(credentials: AuthCredentials) {
  return authPost("/auth/login", credentials);
}

export function register(credentials: AuthCredentials) {
  return authPost("/auth/register", credentials);
}

export async function logout() {
  try {
    await apiRequest<unknown>("/auth/logout", { method: "POST" });
  } finally {
    clearStoredToken();
  }
}

export async function fetchCurrentSession() {
  const result = normalizeAuthPayload(await apiRequest<AuthEnvelope>("/auth/session"));

  return result.session;
}

export function formatMoney(money?: ApiMoney) {
  if (!money) {
    return "Set price";
  }

  return new Intl.NumberFormat("en-NG", {
    currency: money.currency,
    maximumFractionDigits: 0,
    style: "currency"
  }).format(money.amountMinor / 100);
}
