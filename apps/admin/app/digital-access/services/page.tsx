"use client";

import { useEffect, useState } from "react";
import { ImagePlus, Plus, RefreshCw, Search } from "lucide-react";

import { Badge, Button, Panel } from "@fliptrybe/ui";

import {
  createAdminDigitalAccessCategory,
  createAdminDigitalAccessService,
  loadAdminDigitalAccessCategories,
  renameAdminDigitalAccessCategory,
  setAdminDigitalAccessServiceActive,
  type AdminDigitalAccessCategory
} from "../api";
import {
  AdminDigitalAccessShell,
  AdminEmptyState,
  AdminErrorNotice,
  AdminPageHeader,
  ServiceStateBadge
} from "../components";
import type { AdminAccessService } from "../data";
import { useAdminDigitalAccessData } from "../use-admin-digital-access-data";

function priceToMinor(value: string) {
  const normalized = Number(value.replace(/[^\d.]/g, ""));
  if (!Number.isFinite(normalized) || normalized <= 0) return 0;
  return Math.round(normalized * 100);
}

function ServiceEditor({
  categories,
  onCreated
}: {
  categories: AdminDigitalAccessCategory[];
  onCreated: () => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [eta, setEta] = useState("");
  const [thumbnail, setThumbnail] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState<string>();

  const valid = name.trim().length > 0 && category.trim().length > 0 && description.trim().length > 0;

  async function handleCreate() {
    if (!valid) return;
    setPending(true);
    setError(undefined);
    setSuccess(undefined);
    try {
      await createAdminDigitalAccessService({
        name: name.trim(),
        category: category.trim(),
        deliveryEta: eta.trim() || "Manual review",
        startingPriceMinor: priceToMinor(price),
        description: description.trim(),
        ...(thumbnail.trim() ? { thumbnail: thumbnail.trim() } : {})
      });
      setName("");
      setEta("");
      setThumbnail("");
      setDescription("");
      setPrice("");
      setSuccess("Service created as a draft. Activate it from the list once it's ready.");
      await onCreated();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create this service.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Panel className="p-4">
      <h2 className="text-lg font-semibold text-[var(--ft-text-primary)]">Service editor</h2>
      <div className="mt-5 grid gap-3">
        <label className="grid gap-2 text-sm font-medium text-[var(--ft-text-secondary)]">
          Service name
          <input
            className="h-11 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-[var(--ft-text-primary)]"
            disabled={pending}
            onChange={(event) => setName(event.target.value)}
            value={name}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-[var(--ft-text-secondary)]">
          Category
          <select
            className="h-11 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-[var(--ft-text-primary)]"
            disabled={pending || categories.length === 0}
            onChange={(event) => setCategory(event.target.value)}
            value={category}
          >
            <option value="">{categories.length === 0 ? "No categories yet" : "Choose a category"}</option>
            {categories.map((item) => (
              <option key={item.id} value={item.slug}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-medium text-[var(--ft-text-secondary)]">
          Delivery ETA
          <input
            className="h-11 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-[var(--ft-text-primary)]"
            disabled={pending}
            onChange={(event) => setEta(event.target.value)}
            placeholder="e.g. Manual review, 24 hours"
            value={eta}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-[var(--ft-text-secondary)]">
          Starting price (NGN)
          <input
            className="h-11 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-[var(--ft-text-primary)]"
            disabled={pending}
            inputMode="decimal"
            onChange={(event) => setPrice(event.target.value)}
            value={price}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-[var(--ft-text-secondary)]">
          Thumbnail URL
          <input
            className="h-11 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-[var(--ft-text-primary)]"
            disabled={pending}
            onChange={(event) => setThumbnail(event.target.value)}
            value={thumbnail}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-[var(--ft-text-secondary)]">
          Description
          <textarea
            className="min-h-24 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 py-2 text-[var(--ft-text-primary)]"
            disabled={pending}
            onChange={(event) => setDescription(event.target.value)}
            value={description}
          />
        </label>
        {success ? (
          <div className="rounded-md border border-[var(--ft-green)]/40 bg-[var(--ft-green-subtle)] p-3 text-sm text-[var(--ft-green)]">
            {success}
          </div>
        ) : null}
        {error ? <AdminErrorNotice message={error} /> : null}
        <div className="grid grid-cols-2 gap-2">
          <Button disabled type="button" variant="secondary">
            <ImagePlus className="size-4" />
            Cloudinary
          </Button>
          <Button disabled={!valid || pending} onClick={() => void handleCreate()} type="button">
            {pending ? "Creating..." : "Create service draft"}
          </Button>
        </div>
        <p className="text-xs leading-5 text-[var(--ft-text-muted)]">
          New services start as a draft — nothing is customer-visible until you activate it from
          the list on the right. Direct Cloudinary upload isn't wired here yet; paste a hosted
          image URL in the meantime.
        </p>
      </div>
    </Panel>
  );
}

function ServiceListItem({
  onChanged,
  service
}: {
  onChanged: () => Promise<void>;
  service: AdminAccessService;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const nextActive = service.state !== "active";

  async function toggle() {
    setPending(true);
    setError(undefined);
    try {
      await setAdminDigitalAccessServiceActive(service.id, nextActive);
      await onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update this service.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Panel className="p-4">
      <div className="grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-[var(--ft-text-primary)]">{service.name}</h2>
            <ServiceStateBadge state={service.state} />
          </div>
          <div className="mt-1 text-sm text-[var(--ft-text-muted)]">
            {service.category} - {service.eta}
          </div>
        </div>
        <div className="text-sm font-semibold text-[var(--ft-text-primary)]">{service.startingPrice}</div>
        <div className="flex gap-2">
          <a href="/digital-access/pricing/">
            <Button type="button" variant="secondary">
              Plans
            </Button>
          </a>
          <Button disabled={pending} onClick={() => void toggle()} variant={nextActive ? "secondary" : "danger"}>
            {pending ? "Saving..." : nextActive ? "Activate" : "Pause"}
          </Button>
        </div>
      </div>
      {error ? (
        <div className="mt-2">
          <AdminErrorNotice message={error} />
        </div>
      ) : null}
    </Panel>
  );
}

export default function AdminDigitalAccessServicesPage() {
  const { error, loading, refresh, services } = useAdminDigitalAccessData();
  const [categories, setCategories] = useState<AdminDigitalAccessCategory[]>([]);
  const [categoryDraft, setCategoryDraft] = useState("");
  const [categoryError, setCategoryError] = useState<string>();
  const [addingCategory, setAddingCategory] = useState(false);
  const [renamingId, setRenamingId] = useState<string>();
  const [renameDraft, setRenameDraft] = useState("");
  const [renaming, setRenaming] = useState(false);

  async function refreshCategories() {
    try {
      setCategories(await loadAdminDigitalAccessCategories());
    } catch {
      // Non-critical for this page — the create form just falls back to
      // "No categories yet" rather than blocking the whole screen.
    }
  }

  useEffect(() => {
    void refreshCategories();
  }, []);

  async function handleAddCategory() {
    const name = categoryDraft.trim();
    if (!name) return;
    setAddingCategory(true);
    setCategoryError(undefined);
    try {
      await createAdminDigitalAccessCategory({ name });
      setCategoryDraft("");
      await refreshCategories();
    } catch (caught) {
      setCategoryError(caught instanceof Error ? caught.message : "Could not create this category.");
    } finally {
      setAddingCategory(false);
    }
  }

  async function handleRenameCategory(id: string) {
    const name = renameDraft.trim();
    if (!name) return;
    setRenaming(true);
    setCategoryError(undefined);
    try {
      await renameAdminDigitalAccessCategory(id, { name });
      setRenamingId(undefined);
      setRenameDraft("");
      await refreshCategories();
    } catch (caught) {
      setCategoryError(caught instanceof Error ? caught.message : "Could not rename this category.");
    } finally {
      setRenaming(false);
    }
  }

  return (
    <AdminDigitalAccessShell active="/digital-access/services/">
      <AdminPageHeader
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="flex h-10 min-w-64 items-center gap-2 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-sm text-[var(--ft-text-muted)]">
              <Search className="size-4" />
              Search services
            </div>
            <Button disabled={loading} onClick={() => void refresh()} variant="secondary">
              <RefreshCw className="size-4" />
              Refresh
            </Button>
          </div>
        }
        eyebrow={
          <>
            <Badge tone="info">Dynamic catalog</Badge>
            <Badge tone="warning">Draft safe</Badge>
          </>
        }
        title="Service management"
      />

      <AdminErrorNotice message={error} />

      <section className="mt-4 flex flex-wrap items-end gap-2 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-3">
        <label className="grid gap-1.5 text-xs font-medium text-[var(--ft-text-secondary)]">
          New category
          <input
            className="h-9 w-56 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-sm text-[var(--ft-text-primary)]"
            disabled={addingCategory}
            onChange={(event) => setCategoryDraft(event.target.value)}
            placeholder="e.g. Streaming"
            value={categoryDraft}
          />
        </label>
        <Button disabled={!categoryDraft.trim() || addingCategory} onClick={() => void handleAddCategory()}>
          <Plus className="size-4" />
          {addingCategory ? "Adding..." : "Add category"}
        </Button>
        {categoryError ? <AdminErrorNotice message={categoryError} /> : null}

        {categories.length > 0 ? (
          <div className="grid w-full gap-1.5 pt-2">
            {categories.map((category) =>
              renamingId === category.id ? (
                <div className="flex items-center gap-2" key={category.id}>
                  <input
                    className="h-8 w-56 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-2 text-xs text-[var(--ft-text-primary)]"
                    disabled={renaming}
                    onChange={(event) => setRenameDraft(event.target.value)}
                    value={renameDraft}
                  />
                  <Button
                    className="h-7 px-2 text-xs"
                    disabled={!renameDraft.trim() || renaming}
                    onClick={() => void handleRenameCategory(category.id)}
                  >
                    Save
                  </Button>
                  <button
                    className="text-xs text-[var(--ft-text-muted)] hover:text-[var(--ft-text-primary)]"
                    onClick={() => setRenamingId(undefined)}
                    type="button"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs text-[var(--ft-text-secondary)]" key={category.id}>
                  <span className="w-56 truncate">{category.name}</span>
                  <button
                    className="text-[var(--ft-accent)] hover:underline"
                    onClick={() => {
                      setRenamingId(category.id);
                      setRenameDraft(category.name);
                    }}
                    type="button"
                  >
                    Rename
                  </button>
                </div>
              )
            )}
          </div>
        ) : null}
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <ServiceEditor categories={categories} onCreated={refresh} />

        <div className="grid gap-3">
          {loading ? (
            <AdminEmptyState title="Loading services" detail="Refreshing the Digital Access catalog." />
          ) : services.length === 0 ? (
            <AdminEmptyState
              title="No services returned"
              detail="Configured Digital Access services will appear here after the admin API returns catalog rows."
            />
          ) : (
            services.map((service) => (
              <ServiceListItem key={service.id} onChanged={refresh} service={service} />
            ))
          )}
        </div>
      </section>
    </AdminDigitalAccessShell>
  );
}
