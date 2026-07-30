export type AutomationTriggerKindDto =
  | "BUDGET_THRESHOLD"
  | "PERFORMANCE_THRESHOLD"
  | "SCHEDULE"
  | "WALLET_BALANCE"
  | "CREATIVE_AGE";

export type AutomationWorkflowStatusDto = "ACTIVE" | "PAUSED" | "DRAFT";

export interface CreateAutomationWorkflowDto {
  name: string;
  triggerKind: AutomationTriggerKindDto;
  triggerSummary: string;
  actionSummary: string;
  config?: Record<string, unknown>;
}

export interface UpdateAutomationWorkflowDto {
  name?: string;
  triggerKind?: AutomationTriggerKindDto;
  triggerSummary?: string;
  actionSummary?: string;
  status?: AutomationWorkflowStatusDto;
  config?: Record<string, unknown>;
}
