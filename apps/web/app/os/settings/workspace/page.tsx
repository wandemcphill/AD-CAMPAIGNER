"use client";

import { useCallback, useEffect, useState } from "react";
import { Briefcase, Building2, Save } from "lucide-react";

import { Badge, Button } from "@fliptrybe/ui";
import { Input, Divider, AlertBanner } from "@fliptrybe/ui/components";

import { useApiSession } from "../../../lib/use-session";
import {
  createCompanyProfile,
  loadCompanyProfiles,
  loadWorkspace,
  updateCompanyProfile,
  updateWorkspace,
  type CompanyProfile,
  type CompanyProfileInput,
  type WorkspaceSettings
} from "../workspace-api";

const CAN_MANAGE_CAMPAIGNS_ROLES = new Set(["OWNER", "ADMIN", "MANAGER", "MARKETER"]);

function BusinessProfilePanel({ canEdit }: { canEdit: boolean }) {
  const [profile, setProfile] = useState<CompanyProfile>();
  const [form, setForm] = useState<CompanyProfileInput>({ name: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const [first] = await loadCompanyProfiles();
      setProfile(first);
      setForm(
        first
          ? {
              name: first.name,
              ...(first.legalName ? { legalName: first.legalName } : {}),
              ...(first.websiteUrl ? { websiteUrl: first.websiteUrl } : {}),
              ...(first.industry ? { industry: first.industry } : {}),
              ...(first.countryCode ? { countryCode: first.countryCode } : {}),
              ...(first.city ? { city: first.city } : {}),
              timezone: first.timezone,
              ...(first.contactEmail ? { contactEmail: first.contactEmail } : {}),
              ...(first.contactPhone ? { contactPhone: first.contactPhone } : {})
            }
          : { name: "" }
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load the business profile.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function setField<K extends keyof CompanyProfileInput>(key: K, value: CompanyProfileInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setSaved(false);
  }

  const valid = (form.name ?? "").trim().length >= 2;

  async function handleSave() {
    if (!valid) return;
    setSaving(true);
    setError(undefined);
    setSaved(false);
    try {
      const input: CompanyProfileInput = { ...form, name: form.name.trim() };
      const result = profile ? await updateCompanyProfile(profile.id, input) : await createCompanyProfile(input);
      setProfile(result);
      setSaved(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save the business profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-[var(--radius-xl)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-6">
      <div className="flex items-center gap-2">
        <Briefcase className="size-5 text-[var(--ft-accent)]" />
        <h2 className="font-semibold">Business profile</h2>
      </div>
      <p className="mt-2 text-sm text-[var(--ft-text-secondary)]">
        The advertiser identity your campaigns launch under — shows up on the ops team's Meta
        launch spec instead of the raw campaign name once set.
      </p>

      {error ? (
        <AlertBanner className="mt-4" tone="danger">
          {error}
        </AlertBanner>
      ) : null}
      {saved ? (
        <AlertBanner className="mt-4" tone="success">
          Business profile saved.
        </AlertBanner>
      ) : null}
      {!loading && !canEdit ? (
        <AlertBanner className="mt-4" tone="info">
          Only owners, admins, managers, and marketers can change this.
        </AlertBanner>
      ) : null}

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <Input
          disabled={loading || saving || !canEdit}
          id="cp-name"
          label="Business name"
          onChange={(e) => setField("name", e.currentTarget.value)}
          type="text"
          value={loading ? "" : (form.name ?? "")}
        />
        <Input
          disabled={loading || saving || !canEdit}
          id="cp-legal-name"
          label="Legal name"
          onChange={(e) => setField("legalName", e.currentTarget.value)}
          type="text"
          value={loading ? "" : (form.legalName ?? "")}
        />
        <Input
          disabled={loading || saving || !canEdit}
          id="cp-website"
          label="Website"
          onChange={(e) => setField("websiteUrl", e.currentTarget.value)}
          type="text"
          value={loading ? "" : (form.websiteUrl ?? "")}
        />
        <Input
          disabled={loading || saving || !canEdit}
          id="cp-industry"
          label="Industry"
          onChange={(e) => setField("industry", e.currentTarget.value)}
          type="text"
          value={loading ? "" : (form.industry ?? "")}
        />
        <Input
          disabled={loading || saving || !canEdit}
          id="cp-country"
          label="Country code"
          onChange={(e) => setField("countryCode", e.currentTarget.value.toUpperCase())}
          type="text"
          value={loading ? "" : (form.countryCode ?? "")}
        />
        <Input
          disabled={loading || saving || !canEdit}
          id="cp-city"
          label="City"
          onChange={(e) => setField("city", e.currentTarget.value)}
          type="text"
          value={loading ? "" : (form.city ?? "")}
        />
        <Input
          disabled={loading || saving || !canEdit}
          id="cp-email"
          label="Contact email"
          onChange={(e) => setField("contactEmail", e.currentTarget.value)}
          type="email"
          value={loading ? "" : (form.contactEmail ?? "")}
        />
        <Input
          disabled={loading || saving || !canEdit}
          id="cp-phone"
          label="Contact phone"
          onChange={(e) => setField("contactPhone", e.currentTarget.value)}
          type="text"
          value={loading ? "" : (form.contactPhone ?? "")}
        />
      </div>

      {profile ? (
        <div className="mt-4 flex items-center gap-2 text-xs text-[var(--ft-text-muted)]">
          <span>Verification:</span>
          <Badge tone={profile.verificationStatus === "VERIFIED" ? "success" : "neutral"}>
            {profile.verificationStatus.toLowerCase()}
          </Badge>
        </div>
      ) : null}

      <div className="mt-6 flex justify-end">
        <Button disabled={!canEdit || !valid || saving || loading} onClick={() => void handleSave()}>
          <Save className="size-4" /> {saving ? "Saving…" : profile ? "Save changes" : "Create profile"}
        </Button>
      </div>
    </div>
  );
}

export default function WorkspaceSettingsPage() {
  const { session } = useApiSession();
  const canEdit = session?.role === "OWNER" || session?.role === "ADMIN";
  const canEditBusinessProfile = Boolean(session?.role && CAN_MANAGE_CAMPAIGNS_ROLES.has(session.role));

  const [workspace, setWorkspace] = useState<WorkspaceSettings>();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const result = await loadWorkspace();
      setWorkspace(result);
      setName(result.name);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load workspace settings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const trimmed = name.trim();
  const dirty = workspace !== undefined && trimmed !== workspace.name;
  const valid = trimmed.length >= 2 && trimmed.length <= 80;

  async function handleSave() {
    if (!dirty || !valid) return;
    setSaving(true);
    setError(undefined);
    setSaved(false);
    try {
      const result = await updateWorkspace({ name: trimmed });
      setWorkspace(result);
      setName(result.name);
      setSaved(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save workspace settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-8">
      <div className="rounded-[var(--radius-xl)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-6">
        <div className="flex items-center gap-2">
          <Building2 className="size-5 text-[var(--ft-accent)]" />
          <h2 className="font-semibold">Workspace</h2>
        </div>

        {error ? (
          <AlertBanner className="mt-4" tone="danger">
            {error}
          </AlertBanner>
        ) : null}

        {saved && !dirty ? (
          <AlertBanner className="mt-4" tone="success">
            Workspace settings saved.
          </AlertBanner>
        ) : null}

        {!loading && !canEdit ? (
          <AlertBanner className="mt-4" tone="info">
            Only workspace owners and admins can change these settings.
          </AlertBanner>
        ) : null}

        <div className="mt-6 grid gap-5">
          <Input
            disabled={loading || saving || !canEdit}
            {...(trimmed.length > 0 && !valid
              ? { hint: "Workspace name must be between 2 and 80 characters." }
              : {})}
            id="ws-name"
            label="Workspace name"
            onChange={(e) => {
              setName(e.currentTarget.value);
              setSaved(false);
            }}
            type="text"
            value={loading ? "" : name}
          />
        </div>

        <Divider />

        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">Default currency</div>
            <div className="text-xs text-[var(--ft-text-muted)]">
              Set when the workspace was created. Existing wallet balances and ledger entries are
              denominated in it, so it cannot be changed here.
            </div>
          </div>
          <Badge tone="info">{workspace?.defaultCurrency ?? "—"}</Badge>
        </div>

        <div className="mt-6 flex justify-end">
          <Button
            disabled={!canEdit || !dirty || !valid || saving || loading}
            onClick={() => void handleSave()}
          >
            <Save className="size-4" /> {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>

      <BusinessProfilePanel canEdit={canEditBusinessProfile} />
    </div>
  );
}
