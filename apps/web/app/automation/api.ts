"use client";

import { apiRequest } from "../lib/api-client";

export type AutomationTriggerKind =
  | "BUDGET_THRESHOLD"
  | "PERFORMANCE_THRESHOLD"
  | "SCHEDULE"
  | "WALLET_BALANCE"
  | "CREATIVE_AGE";

export type AutomationWorkflowStatus = "ACTIVE" | "PAUSED" | "DRAFT";

export type AutomationWorkflowRecord = {
  id: string;
  name: string;
  triggerKind: AutomationTriggerKind;
  triggerSummary: string;
  actionSummary: string;
  status: AutomationWorkflowStatus;
  runCount: number;
  lastRunAt?: string | null;
  createdAt: string;
};

export type CreateAutomationWorkflowInput = {
  name: string;
  triggerKind: AutomationTriggerKind;
  triggerSummary: string;
  actionSummary: string;
};

export async function loadAutomationWorkflows() {
  return apiRequest<AutomationWorkflowRecord[]>("/automation/workflows");
}

export async function createAutomationWorkflow(input: CreateAutomationWorkflowInput) {
  return apiRequest<AutomationWorkflowRecord>("/automation/workflows", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function updateAutomationWorkflowStatus(id: string, status: AutomationWorkflowStatus) {
  return apiRequest<AutomationWorkflowRecord>(`/automation/workflows/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ status })
  });
}

export async function deleteAutomationWorkflow(id: string) {
  return apiRequest<{ ok: boolean }>(`/automation/workflows/${encodeURIComponent(id)}`, {
    method: "DELETE"
  });
}

export const triggerKindLabel: Record<AutomationTriggerKind, string> = {
  BUDGET_THRESHOLD: "Budget threshold",
  PERFORMANCE_THRESHOLD: "Performance threshold",
  SCHEDULE: "Schedule",
  WALLET_BALANCE: "Wallet balance",
  CREATIVE_AGE: "Creative age"
};
