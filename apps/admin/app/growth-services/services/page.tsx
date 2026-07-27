"use client";

import { useState } from "react";
import { CheckCircle2, RefreshCw, Save } from "lucide-react";

import { Badge, Button, Panel } from "@fliptrybe/ui";

import { updateGrowthService } from "../api";
import {
  AdminEmptyState,
  AdminErrorNotice,
  AdminGrowthShell,
  AdminPageHeader
} from "../components";
import type { AdminGrowthService } from "../data";
import { useAdminGrowthData } from "../use-admin-growth-data";

export default function AdminGrowthServicesPage() {
  const { error, loading, refresh, services, suppliers } = useAdminGrowthData();
  const [savingCode, setSavingCode] = useState<string>();
  const [saveMessage, setSaveMessage] = useState<string>();

  async function saveService(service: AdminGrowthService, formData: FormData) {
    setSavingCode(service.code);
    setSaveMessage(undefined);

    try {
      await updateGrowthService(service.code, {
        enabled: formData.get("enabled") === "on",
        marginBps: Number(formData.get("marginBps") ?? service.marginBps),
        maximumQuantity: Number(formData.get("maximumQuantity") ?? service.maximumQuantity),
        preferredSupplier: getFormString(formData, "preferredSupplier"),
        expectedCompletion: getFormString(
          formData,
          "expectedCompletion",
          service.expectedCompletion
        )
      });
      setSaveMessage(`${service.name} updated.`);
      await refresh();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Service update failed.";
      setSaveMessage(message);
    } finally {
      setSavingCode(undefined);
    }
  }

  return (
    <AdminGrowthShell active="/growth-services/services">
      <AdminPageHeader
        action={
          <Button disabled={loading} onClick={() => void refresh()} variant="secondary">
            <RefreshCw className="size-4" />
            Refresh
          </Button>
        }
        eyebrow={
          <>
            <Badge tone="info">Catalog controls</Badge>
            <Badge tone="warning">Margin and routing</Badge>
          </>
        }
        title="Service controls"
      />

      <AdminErrorNotice message={error} />
      {saveMessage ? (
        <div className="mt-4 rounded-md border border-[var(--ft-blue)]/40 bg-[var(--ft-blue-subtle)] p-3 text-sm text-[var(--ft-blue)]">
          {saveMessage}
        </div>
      ) : null}

      <section className="mt-6 grid gap-4">
        {services.length === 0 ? (
          <AdminEmptyState
            title="No growth services returned"
            detail="Enable Growth Services admin APIs and configure catalog rows to manage pricing, margins, and supplier routing."
          />
        ) : (
          services.map((service) => (
          <Panel className="p-4" key={service.code}>
            <form
              className="grid gap-4 xl:grid-cols-[1fr_1.3fr_auto] xl:items-end"
              onSubmit={(event) => {
                event.preventDefault();
                void saveService(service, new FormData(event.currentTarget));
              }}
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold text-[var(--ft-text-primary)]">{service.name}</h2>
                  <Badge tone={service.enabled ? "success" : "neutral"}>
                    {service.enabled ? "Enabled" : "Disabled"}
                  </Badge>
                  <Badge tone={service.riskTone}>Risk</Badge>
                </div>
                <div className="mt-2 text-sm text-[var(--ft-text-muted)]">
                  {service.platform} - {service.price} - {service.routingStrategy}
                </div>
                <p className="mt-2 text-xs leading-5 text-[var(--ft-text-muted)]">
                  {service.riskSummary}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <label className="grid gap-2 text-sm font-medium text-[var(--ft-text-secondary)]">
                  Enabled
                  <span className="flex h-11 items-center rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3">
                    <input
                      className="size-4 accent-[var(--ft-accent)]"
                      defaultChecked={service.enabled}
                      name="enabled"
                      type="checkbox"
                    />
                  </span>
                </label>
                <label className="grid gap-2 text-sm font-medium text-[var(--ft-text-secondary)]">
                  Margin bps
                  <input
                    className="h-11 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-[var(--ft-text-primary)]"
                    defaultValue={service.marginBps}
                    min={0}
                    name="marginBps"
                    step={100}
                    type="number"
                  />
                </label>
                <label className="grid gap-2 text-sm font-medium text-[var(--ft-text-secondary)]">
                  Supplier
                  <select
                    className="h-11 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-[var(--ft-text-primary)]"
                    defaultValue={service.preferredSupplier}
                    name="preferredSupplier"
                  >
                    <option value="">Auto route</option>
                    {suppliers.map((supplier) => (
                      <option key={supplier.name} value={supplier.name}>
                        {supplier.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-medium text-[var(--ft-text-secondary)]">
                  Max quantity
                  <input
                    className="h-11 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-[var(--ft-text-primary)]"
                    defaultValue={service.maximumQuantity}
                    min={1}
                    name="maximumQuantity"
                    type="number"
                  />
                </label>
                <label className="grid gap-2 text-sm font-medium text-[var(--ft-text-secondary)] sm:col-span-2 xl:col-span-4">
                  Expected completion
                  <input
                    className="h-11 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-[var(--ft-text-primary)]"
                    defaultValue={service.expectedCompletion}
                    name="expectedCompletion"
                  />
                </label>
              </div>

              <Button disabled={savingCode === service.code} type="submit">
                {savingCode === service.code ? (
                  <CheckCircle2 className="size-4" />
                ) : (
                  <Save className="size-4" />
                )}
                Save
              </Button>
            </form>
          </Panel>
          ))
        )}
      </section>
    </AdminGrowthShell>
  );
}

function getFormString(formData: FormData, key: string, fallback = "") {
  const value = formData.get(key);

  return typeof value === "string" ? value : fallback;
}
