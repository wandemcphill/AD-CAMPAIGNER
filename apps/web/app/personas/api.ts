"use client";

import { apiRequest } from "../lib/api-client";

export type PersonaType = "SYNTHETIC" | "VERIFIED" | "CAST";
export type PersonaStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";

export type PersonaRecord = {
  id: string;
  name: string;
  role: string;
  type: PersonaType;
  status: PersonaStatus;
  description?: string | null;
  hasVoice: boolean;
  hasMotion: boolean;
  consentedAt?: string | null;
  createdAt: string;
};

export type CreatePersonaInput = {
  name: string;
  role: string;
  type: PersonaType;
  description?: string;
  hasVoice?: boolean;
  hasMotion?: boolean;
};

export type UpdatePersonaInput = Partial<{
  name: string;
  role: string;
  status: PersonaStatus;
  description: string;
  hasVoice: boolean;
  hasMotion: boolean;
}>;

export async function loadPersonas() {
  return apiRequest<PersonaRecord[]>("/personas");
}

export async function createPersona(input: CreatePersonaInput) {
  return apiRequest<PersonaRecord>("/personas", { method: "POST", body: JSON.stringify(input) });
}

export async function updatePersona(id: string, input: UpdatePersonaInput) {
  return apiRequest<PersonaRecord>(`/personas/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input)
  });
}

export async function markPersonaConsented(id: string) {
  return apiRequest<PersonaRecord>(`/personas/${encodeURIComponent(id)}/consent`, {
    method: "PATCH"
  });
}

export async function deletePersona(id: string) {
  return apiRequest<{ ok: boolean }>(`/personas/${encodeURIComponent(id)}`, { method: "DELETE" });
}
