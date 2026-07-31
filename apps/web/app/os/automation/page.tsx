"use client";

import { useEffect, useState } from "react";
import {
  Bot,
  Calendar,
  GitBranch,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  Workflow,
  Zap
} from "lucide-react";

import { Badge, Button, cn } from "@fliptrybe/ui";
import { Drawer, Input } from "@fliptrybe/ui/components";

import { EmptyState, ErrorNotice, LoadingBlock } from "../../campaigns/components";
import {
  createAutomationWorkflow,
  deleteAutomationWorkflow,
  loadAutomationWorkflows,
  triggerKindLabel,
  updateAutomationWorkflowStatus,
  type AutomationTriggerKind,
  type AutomationWorkflowRecord,
  type CreateAutomationWorkflowInput
} from "../../automation/api";

const TEMPLATES: Array<{
  name: string;
  desc: string;
  icon: typeof Zap;
  preset: CreateAutomationWorkflowInput;
}> = [
  {
    name: "Budget guardian",
    desc: "Pause campaigns when spend exceeds threshold",
    icon: Zap,
    preset: {
      name: "Budget guardian",
      triggerKind: "BUDGET_THRESHOLD",
      triggerSummary: "Spend exceeds a set threshold",
      actionSummary: "Pause the campaign"
    }
  },
  {
    name: "Performance scaler",
    desc: "Auto-increase budget for high-ROAS campaigns",
    icon: Sparkles,
    preset: {
      name: "Performance scaler",
      triggerKind: "PERFORMANCE_THRESHOLD",
      triggerSummary: "ROAS stays above target for 7 days",
      actionSummary: "Increase budget"
    }
  },
  {
    name: "Scheduled reports",
    desc: "Send performance digests on a schedule",
    icon: Calendar,
    preset: {
      name: "Scheduled reports",
      triggerKind: "SCHEDULE",
      triggerSummary: "Every day at 8am",
      actionSummary: "Send a performance digest"
    }
  },
  {
    name: "Low balance alert",
    desc: "Flag campaigns when wallet balance drops",
    icon: Bot,
    preset: {
      name: "Low balance alert",
      triggerKind: "WALLET_BALANCE",
      triggerSummary: "Wallet balance drops below threshold",
      actionSummary: "Send a low-balance notification"
    }
  }
];

const emptyForm: CreateAutomationWorkflowInput = {
  name: "",
  triggerKind: "BUDGET_THRESHOLD",
  triggerSummary: "",
  actionSummary: ""
};

function formatLastRun(value?: string | null) {
  if (!value) return "Never run";
  return new Date(value).toLocaleString();
}

export default function AutomationPage() {
  const [workflows, setWorkflows] = useState<AutomationWorkflowRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState<string>();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CreateAutomationWorkflowInput>(emptyForm);

  async function refresh() {
    setError(undefined);
    try {
      setWorkflows(await loadAutomationWorkflows());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Workflows failed to load.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  function openTemplate(preset: CreateAutomationWorkflowInput) {
    setForm(preset);
    setShowCreate(true);
  }

  async function onCreate() {
    if (!form.name.trim() || !form.triggerSummary.trim() || !form.actionSummary.trim()) return;

    setBusy("create");
    setError(undefined);
    try {
      await createAutomationWorkflow(form);
      setForm(emptyForm);
      setShowCreate(false);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create that workflow.");
    } finally {
      setBusy(undefined);
    }
  }

  async function onToggle(workflow: AutomationWorkflowRecord) {
    setBusy(workflow.id);
    try {
      await updateAutomationWorkflowStatus(
        workflow.id,
        workflow.status === "ACTIVE" ? "PAUSED" : "ACTIVE"
      );
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update that workflow.");
    } finally {
      setBusy(undefined);
    }
  }

  async function onDelete(workflow: AutomationWorkflowRecord) {
    setBusy(workflow.id);
    try {
      await deleteAutomationWorkflow(workflow.id);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not remove that workflow.");
    } finally {
      setBusy(undefined);
    }
  }

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Workflow className="size-5 text-[var(--ft-accent)]" />
            <h1 className="text-xl font-bold">Automation</h1>
          </div>
          <p className="mt-1 text-sm text-[var(--ft-text-secondary)]">
            Active workflows are evaluated automatically — schedule triggers every 5 minutes,
            budget and wallet thresholds every 15 minutes.
          </p>
        </div>
        <div className="flex gap-2">
          <Button disabled={loading} onClick={() => void refresh()} variant="secondary">
            <RefreshCw className="size-4" /> Refresh
          </Button>
          <Button onClick={() => { setForm(emptyForm); setShowCreate(true); }}>
            <Plus className="size-4" /> Create workflow
          </Button>
        </div>
      </div>

      <ErrorNotice message={error} />

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {TEMPLATES.map((t) => (
          <button
            className="group rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-4 text-left transition hover:border-[var(--ft-accent)]/30"
            key={t.name}
            onClick={() => openTemplate(t.preset)}
            type="button"
          >
            <t.icon className="size-5 text-[var(--ft-accent)]" />
            <div className="mt-2 text-sm font-medium">{t.name}</div>
            <div className="mt-0.5 text-xs text-[var(--ft-text-muted)]">{t.desc}</div>
          </button>
        ))}
      </div>

      <div className="mt-6 rounded-[var(--radius-xl)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)]">
        <div className="border-b border-[var(--ft-border)] p-4">
          <h2 className="font-semibold">Workflows</h2>
        </div>
        {loading ? (
          <div className="p-4">
            <LoadingBlock label="Loading workflows" />
          </div>
        ) : workflows.length === 0 ? (
          <div className="p-4">
            <EmptyState
              action={<Button onClick={() => { setForm(emptyForm); setShowCreate(true); }}><Plus className="size-4" /> Create workflow</Button>}
              copy="Use a template above or create a workflow from scratch."
              icon={Workflow}
              title="No workflows yet"
            />
          </div>
        ) : (
          workflows.map((wf) => (
            <div className="flex items-center gap-4 border-b border-[var(--ft-border)] p-4 last:border-0" key={wf.id}>
              <div className={cn(
                "grid size-9 place-items-center rounded-full",
                wf.status === "ACTIVE" ? "bg-[var(--ft-green)]/10" : wf.status === "PAUSED" ? "bg-[var(--ft-yellow)]/10" : "bg-[var(--ft-bg-muted)]"
              )}>
                {wf.status === "ACTIVE" ? <Play className="size-4 text-[var(--ft-green)]" /> :
                 wf.status === "PAUSED" ? <Pause className="size-4 text-[var(--ft-yellow)]" /> :
                 <GitBranch className="size-4 text-[var(--ft-text-muted)]" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{wf.name}</div>
                <div className="text-xs text-[var(--ft-text-muted)]">
                  {triggerKindLabel[wf.triggerKind]}: {wf.triggerSummary} → {wf.actionSummary}
                </div>
                <div className="mt-1 text-[10px] text-[var(--ft-text-muted)]">
                  {wf.runCount} runs · {formatLastRun(wf.lastRunAt)}
                </div>
              </div>
              <Badge tone={wf.status === "ACTIVE" ? "success" : wf.status === "PAUSED" ? "warning" : "neutral"}>
                {wf.status.toLowerCase()}
              </Badge>
              <Button disabled={busy === wf.id} onClick={() => void onToggle(wf)} variant="secondary">
                {wf.status === "ACTIVE" ? "Pause" : "Activate"}
              </Button>
              <Button disabled={busy === wf.id} onClick={() => void onDelete(wf)} variant="secondary">
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))
        )}
      </div>

      <Drawer onClose={() => setShowCreate(false)} open={showCreate} title="Create Workflow">
        <div className="grid gap-5">
          <Input
            id="workflow-name"
            label="Name"
            onChange={(e) => setForm((f) => ({ ...f, name: e.currentTarget.value }))}
            placeholder="e.g. Budget guardian"
            value={form.name}
          />
          <div className="grid gap-1.5">
            <label className="text-sm font-medium" htmlFor="workflow-trigger-kind">Trigger type</label>
            <select
              className="h-11 rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-4 text-sm outline-none focus:border-[var(--ft-accent)]"
              id="workflow-trigger-kind"
              onChange={(e) => setForm((f) => ({ ...f, triggerKind: e.target.value as AutomationTriggerKind }))}
              value={form.triggerKind}
            >
              {(Object.keys(triggerKindLabel) as AutomationTriggerKind[]).map((kind) => (
                <option key={kind} value={kind}>{triggerKindLabel[kind]}</option>
              ))}
            </select>
          </div>
          <Input
            id="workflow-trigger-summary"
            label="When..."
            onChange={(e) => setForm((f) => ({ ...f, triggerSummary: e.currentTarget.value }))}
            placeholder="e.g. Spend exceeds ₦2,000 CPA for 48h"
            value={form.triggerSummary}
          />
          <Input
            id="workflow-action-summary"
            label="Then..."
            onChange={(e) => setForm((f) => ({ ...f, actionSummary: e.currentTarget.value }))}
            placeholder="e.g. Pause the campaign"
            value={form.actionSummary}
          />
          <Button
            className="w-full justify-center"
            disabled={!form.name.trim() || !form.triggerSummary.trim() || !form.actionSummary.trim() || busy === "create"}
            onClick={() => void onCreate()}
          >
            {busy === "create" ? "Creating..." : "Create workflow"}
          </Button>
        </div>
      </Drawer>
    </div>
  );
}
