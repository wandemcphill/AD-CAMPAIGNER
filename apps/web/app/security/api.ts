"use client";

import { apiRequest } from "../lib/api-client";

export type TwoFactorStatus = {
  enabled: boolean;
  enabledAt: string | null;
  remainingBackupCodes: number;
};

export type TwoFactorSetup = {
  secret: string;
  otpauthUri: string;
};

export type TwoFactorConfirmResult = {
  enabled: boolean;
  backupCodes: string[];
};

export type SessionRecord = {
  id: string;
  deviceName: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  expiresAt: string;
  isCurrent: boolean;
};

export async function loadTwoFactorStatus() {
  return apiRequest<TwoFactorStatus>("/security/two-factor");
}

export async function setupTwoFactor() {
  return apiRequest<TwoFactorSetup>("/security/two-factor/setup", { method: "POST" });
}

export async function confirmTwoFactor(code: string) {
  return apiRequest<TwoFactorConfirmResult>("/security/two-factor/confirm", {
    method: "POST",
    body: JSON.stringify({ code })
  });
}

export async function disableTwoFactor(code: string) {
  return apiRequest<{ enabled: boolean }>("/security/two-factor/disable", {
    method: "POST",
    body: JSON.stringify({ code })
  });
}

export async function loadSessions() {
  return apiRequest<SessionRecord[]>("/auth/sessions");
}

export async function revokeSession(id: string) {
  return apiRequest<{ ok: boolean }>(`/auth/sessions/${encodeURIComponent(id)}`, {
    method: "DELETE"
  });
}

export function parseUserAgent(userAgent: string | null) {
  if (!userAgent) return "Unknown device";
  if (/iphone/i.test(userAgent)) return "iPhone";
  if (/ipad/i.test(userAgent)) return "iPad";
  if (/android/i.test(userAgent)) return "Android device";
  if (/windows/i.test(userAgent)) return "Windows PC";
  if (/macintosh|mac os/i.test(userAgent)) return "Mac";
  if (/linux/i.test(userAgent)) return "Linux PC";
  return "Unknown device";
}
