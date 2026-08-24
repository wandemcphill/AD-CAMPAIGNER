"use client";

import { useEffect, useState } from "react";
import {
  Bot,
  CheckCircle2,
  Mic,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Trash2,
  User,
  Video
} from "lucide-react";
import { motion } from "framer-motion";

import { Badge, Button, cn } from "@fliptrybe/ui";
import { Drawer, Input, TabBar, Toggle } from "@fliptrybe/ui/components";

import { EmptyState, ErrorNotice, LoadingBlock } from "../../campaigns/components";
import {
  createPersona,
  deletePersona,
  loadPersonas,
  markPersonaConsented,
  updatePersona,
  type CreatePersonaInput,
  type PersonaRecord,
  type PersonaType
} from "../../personas/api";

const TABS = [
  { id: "all", label: "All" },
  { id: "SYNTHETIC", label: "Synthetic" },
  { id: "VERIFIED", label: "Verified" },
  { id: "CAST", label: "Cast Members" },
];

const TYPE_OPTIONS: Array<{ value: PersonaType; label: string }> = [
  { value: "SYNTHETIC", label: "Synthetic (AI-generated)" },
  { value: "VERIFIED", label: "Verified (real identity, consented)" },
  { value: "CAST", label: "Cast member (campaign actor)" },
];

const emptyForm: CreatePersonaInput = { name: "", role: "", type: "SYNTHETIC", description: "" };

export default function AiPersonasPage() {
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [personas, setPersonas] = useState<PersonaRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState<string>();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CreatePersonaInput>(emptyForm);

  async function refresh() {
    setError(undefined);
    try {
      setPersonas(await loadPersonas());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Personas failed to load.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const filtered = personas.filter((p) => {
    if (tab !== "all" && p.type !== tab) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  async function onCreate() {
    if (!form.name.trim() || !form.role.trim()) return;

    setBusy("create");
    setError(undefined);
    try {
      await createPersona(form);
      setForm(emptyForm);
      setShowCreate(false);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create that persona.");
    } finally {
      setBusy(undefined);
    }
  }

  async function onToggleActive(persona: PersonaRecord) {
    setBusy(persona.id);
    try {
      await updatePersona(persona.id, {
        status: persona.status === "ACTIVE" ? "DRAFT" : "ACTIVE"
      });
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update that persona.");
    } finally {
      setBusy(undefined);
    }
  }

  async function onConsent(persona: PersonaRecord) {
    setBusy(persona.id);
    try {
      await markPersonaConsented(persona.id);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not record consent.");
    } finally {
      setBusy(undefined);
    }
  }

  async function onDelete(persona: PersonaRecord) {
    setBusy(persona.id);
    try {
      await deletePersona(persona.id);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not remove that persona.");
    } finally {
      setBusy(undefined);
    }
  }

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Bot className="size-5 text-[var(--ft-accent)]" />
            <h1 className="text-xl font-bold">AI Personas</h1>
          </div>
          <p className="mt-1 text-sm text-[var(--ft-text-secondary)]">Manage synthetic & verified personas for campaigns</p>
        </div>
        <div className="flex gap-2">
          <Button disabled={loading} onClick={() => void refresh()} variant="secondary">
            <RefreshCw className="size-4" /> Refresh
          </Button>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="size-4" /> Create persona
          </Button>
        </div>
      </div>

      <div className="mt-4 rounded-[var(--radius-lg)] border border-[var(--ft-yellow)]/30 bg-[var(--ft-yellow)]/5 p-3">
        <div className="flex items-center gap-2 text-xs font-medium">
          <Shield className="size-3.5 text-[var(--ft-yellow)]" />
          Consent Architecture Active
        </div>
        <p className="mt-1 text-xs text-[var(--ft-text-secondary)]">
          Verified personas need explicit consent before use — record it with the Consent action
          below. Synthetic personas are clearly labeled. No third-party cloning is permitted.
        </p>
      </div>

      <ErrorNotice message={error} />

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <TabBar items={TABS} onChange={setTab} value={tab} />
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[var(--ft-text-muted)]" />
          <input
            className="h-9 w-56 rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] pl-9 pr-3 text-sm outline-none placeholder:text-[var(--ft-text-muted)] focus:border-[var(--ft-accent)]"
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search personas..."
            value={search}
          />
        </div>
      </div>

      {loading ? (
        <div className="mt-4">
          <LoadingBlock label="Loading personas" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            action={<Button onClick={() => setShowCreate(true)}><Plus className="size-4" /> Create persona</Button>}
            copy="Create a synthetic, verified, or cast persona to attach to campaigns."
            icon={Bot}
            title="No personas yet"
          />
        </div>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((persona, i) => (
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              className="rounded-[var(--radius-xl)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-5 transition hover:border-[var(--ft-accent)]/30"
              initial={{ opacity: 0, y: 8 }}
              key={persona.id}
              transition={{ delay: i * 0.03 }}
            >
              <div className="flex items-start gap-3">
                <div className={cn(
                  "grid size-14 place-items-center rounded-full text-lg font-bold",
                  persona.type === "SYNTHETIC"
                    ? "bg-[var(--ft-accent)]/10 text-[var(--ft-accent)]"
                    : persona.type === "VERIFIED"
                      ? "bg-[var(--ft-green)]/10 text-[var(--ft-green)]"
                      : "bg-[var(--ft-blue)]/10 text-[var(--ft-blue)]"
                )}>
                  {persona.type === "SYNTHETIC" ? <Bot className="size-6" /> : <User className="size-6" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold">{persona.name}</span>
                    {persona.type === "VERIFIED" && persona.consentedAt && (
                      <CheckCircle2 className="size-3.5 text-[var(--ft-green)]" />
                    )}
                  </div>
                  <div className="text-xs text-[var(--ft-text-muted)]">{persona.role}</div>
                  {persona.description ? (
                    <p className="mt-1 text-xs text-[var(--ft-text-secondary)]">{persona.description}</p>
                  ) : null}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                <Badge tone={persona.type === "SYNTHETIC" ? "info" : persona.type === "VERIFIED" ? "success" : "neutral"}>
                  {persona.type.toLowerCase()}
                </Badge>
                <Badge tone={persona.status === "ACTIVE" ? "success" : "neutral"}>
                  {persona.status.toLowerCase()}
                </Badge>
                {persona.hasVoice && <Badge tone="neutral"><Mic className="mr-1 inline size-2.5" /> Voice</Badge>}
                {persona.hasMotion && <Badge tone="neutral"><Video className="mr-1 inline size-2.5" /> Motion</Badge>}
                {persona.type === "VERIFIED" && !persona.consentedAt && (
                  <Badge tone="warning">Consent needed</Badge>
                )}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  className="flex-1 justify-center"
                  disabled={busy === persona.id}
                  onClick={() => void onToggleActive(persona)}
                  variant="secondary"
                >
                  {persona.status === "ACTIVE" ? "Deactivate" : "Activate"}
                </Button>
                {persona.type === "VERIFIED" && !persona.consentedAt ? (
                  <Button
                    className="flex-1 justify-center"
                    disabled={busy === persona.id}
                    onClick={() => void onConsent(persona)}
                  >
                    <Shield className="size-4" /> Record consent
                  </Button>
                ) : null}
                <Button
                  disabled={busy === persona.id}
                  onClick={() => void onDelete(persona)}
                  variant="secondary"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <Drawer onClose={() => setShowCreate(false)} open={showCreate} title="Create Persona">
        <div className="grid gap-5">
          <Input
            id="persona-name"
            label="Name"
            onChange={(e) => setForm((f) => ({ ...f, name: e.currentTarget.value }))}
            placeholder="e.g. Chioma"
            value={form.name}
          />
          <Input
            id="persona-role"
            label="Role"
            onChange={(e) => setForm((f) => ({ ...f, role: e.currentTarget.value }))}
            placeholder="e.g. Brand Ambassador"
            value={form.role}
          />
          <div className="grid gap-1.5">
            <label className="text-sm font-medium" htmlFor="persona-type">Type</label>
            <select
              className="h-11 rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-4 text-sm outline-none focus:border-[var(--ft-accent)]"
              id="persona-type"
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as PersonaType }))}
              value={form.type}
            >
              {TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          <Input
            id="persona-description"
            label="Description (optional)"
            onChange={(e) => setForm((f) => ({ ...f, description: e.currentTarget.value }))}
            placeholder="What is this persona used for?"
            value={form.description ?? ""}
          />
          <div className="flex items-center justify-between">
            <span className="text-sm">Has voice</span>
            <Toggle
              checked={form.hasVoice ?? false}
              onChange={(checked) => setForm((f) => ({ ...f, hasVoice: checked }))}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Has motion</span>
            <Toggle
              checked={form.hasMotion ?? false}
              onChange={(checked) => setForm((f) => ({ ...f, hasMotion: checked }))}
            />
          </div>
          <Button
            className="w-full justify-center"
            disabled={!form.name.trim() || !form.role.trim() || busy === "create"}
            onClick={() => void onCreate()}
          >
            {busy === "create" ? "Creating..." : "Create persona"}
          </Button>
        </div>
      </Drawer>
    </div>
  );
}
