"use client";

import { useEffect, useState } from "react";
import { FileText, Plus, Trash2 } from "lucide-react";

import { Badge, Button } from "@fliptrybe/ui";
import { Input } from "@fliptrybe/ui/components";

import { isForbiddenError } from "../../../lib/api-client";
import {
  createInvoice,
  formatInvoiceMoney,
  listInvoices,
  markInvoicePaid,
  sendInvoice,
  voidInvoice,
  type Invoice,
  type InvoiceStatus
} from "./api";

type LineDraft = { id: string; description: string; quantity: string; unitPrice: string };

type InvoiceLineRowProps = {
  line: LineDraft;
  index: number;
  canRemove: boolean;
  onCommit: (id: string, patch: Partial<LineDraft>) => void;
  onRemove: (id: string) => void;
};

const STATUS_TONE: Record<InvoiceStatus, "neutral" | "info" | "success" | "warning" | "danger"> = {
  DRAFT: "neutral",
  SENT: "info",
  PAID: "success",
  OVERDUE: "warning",
  VOID: "danger"
};

const moneyInputClass =
  "h-11 rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-4 text-sm text-[var(--ft-text-primary)] outline-none transition placeholder:text-[var(--ft-text-muted)] focus:border-[var(--ft-accent)] focus:ring-2 focus:ring-[var(--ft-accent-glow)]";

function emptyLine(id: string): LineDraft {
  return { id, description: "", quantity: "1", unitPrice: "" };
}

function invoiceStatusTone(status: string): "neutral" | "info" | "success" | "warning" | "danger" {
  return STATUS_TONE[status as InvoiceStatus] ?? "neutral";
}

function InvoiceLineRow({ line, index, canRemove, onCommit, onRemove }: InvoiceLineRowProps) {
  const [description, setDescription] = useState(line.description);
  const [quantity, setQuantity] = useState(line.quantity);
  const [unitPrice, setUnitPrice] = useState(line.unitPrice);

  useEffect(() => {
    setDescription(line.description);
    setQuantity(line.quantity);
    setUnitPrice(line.unitPrice);
  }, [line.description, line.quantity, line.unitPrice]);

  function commit() {
    onCommit(line.id, { description, quantity, unitPrice });
  }

  return (
    <div className="grid grid-cols-[1fr_80px_120px_auto] items-end gap-2">
      <div className="grid gap-1.5">
        {index === 0 ? <label className="block text-sm font-medium text-[var(--ft-text-primary)]" htmlFor={`line-desc-${line.id}`}>Description</label> : null}
        <input
          className={moneyInputClass}
          id={`line-desc-${line.id}`}
          onBlur={commit}
          onChange={(event) => setDescription(event.currentTarget.value)}
          placeholder={index === 0 ? "What are you billing for?" : "Description"}
          type="text"
          value={description}
        />
      </div>
      <div className="grid gap-1.5">
        {index === 0 ? <label className="block text-sm font-medium text-[var(--ft-text-primary)]" htmlFor={`line-qty-${line.id}`}>Qty</label> : null}
        <input
          className={moneyInputClass}
          id={`line-qty-${line.id}`}
          min="1"
          onBlur={commit}
          onChange={(event) => setQuantity(event.currentTarget.value)}
          type="number"
          value={quantity}
        />
      </div>
      <div className="grid gap-1.5">
        {index === 0 ? <label className="block text-sm font-medium text-[var(--ft-text-primary)]" htmlFor={`line-price-${line.id}`}>Unit price</label> : null}
        <input
          className={moneyInputClass}
          id={`line-price-${line.id}`}
          min="0"
          onBlur={commit}
          onChange={(event) => setUnitPrice(event.currentTarget.value)}
          placeholder="0.00"
          step="0.01"
          type="number"
          value={unitPrice}
        />
      </div>
      <button
        aria-label="Remove line item"
        className="mb-1 grid size-9 place-items-center rounded-[var(--radius-md)] border border-[var(--ft-border)] text-[var(--ft-text-muted)] transition hover:text-[var(--ft-red)] disabled:opacity-40"
        disabled={!canRemove}
        onClick={() => onRemove(line.id)}
        type="button"
      >
        <Trash2 className="size-4" />
      </button>
    </div>
  );
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>();
  const [error, setError] = useState<string>();
  const [forbidden, setForbidden] = useState(false);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string>();

  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [currency, setCurrency] = useState("NGN");
  const [dueAt, setDueAt] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([emptyLine("line-1")]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string>();

  async function refresh() {
    setError(undefined);
    try {
      setInvoices(await listInvoices());
    } catch (caught) {
      if (isForbiddenError(caught)) {
        setForbidden(true);
      } else {
        setError(caught instanceof Error ? caught.message : "Could not load invoices.");
      }
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const draftTotalMinor = lines.reduce((sum, line) => {
    const qty = Number(line.quantity);
    const price = Number(line.unitPrice);
    if (!Number.isFinite(qty) || !Number.isFinite(price)) return sum;
    return sum + Math.round(qty * price * 100);
  }, 0);

  function resetForm() {
    setCustomerName("");
    setCustomerEmail("");
    setCurrency("NGN");
    setDueAt("");
    setNotes("");
    setLines([emptyLine("line-1")]);
    setFormError(undefined);
  }

  function commitLine(id: string, patch: Partial<LineDraft>) {
    setLines((prev) => prev.map((line) => (line.id === id ? { ...line, ...patch } : line)));
  }

  function removeLine(id: string) {
    setLines((prev) => (prev.length === 1 ? prev : prev.filter((line) => line.id !== id)));
  }

  function addLine() {
    setLines((prev) => [...prev, emptyLine(`line-${Date.now()}-${prev.length}`)]);
  }

  async function submit() {
    setFormError(undefined);
    if (!customerName.trim()) {
      setFormError("A customer name is required.");
      return;
    }
    const lineItems = lines
      .filter((line) => line.description.trim())
      .map((line) => ({
        description: line.description.trim(),
        quantity: Math.round(Number(line.quantity) || 0),
        unitPriceMinor: Math.round((Number(line.unitPrice) || 0) * 100)
      }));
    if (lineItems.length === 0) {
      setFormError("Add at least one line item with a description.");
      return;
    }
    if (lineItems.some((item) => item.quantity <= 0 || item.unitPriceMinor < 0)) {
      setFormError("Line item quantity and price must be valid.");
      return;
    }

    setSubmitting(true);
    try {
      await createInvoice({
        customerName: customerName.trim(),
        currency,
        lineItems,
        ...(customerEmail.trim() ? { customerEmail: customerEmail.trim() } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        ...(dueAt ? { dueAt } : {})
      });
      resetForm();
      setCreating(false);
      await refresh();
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "Could not create the invoice.");
    } finally {
      setSubmitting(false);
    }
  }

  async function runAction(id: string, action: (id: string) => Promise<Invoice>) {
    setBusyId(id);
    try {
      await action(id);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Action failed.");
    } finally {
      setBusyId(undefined);
    }
  }

  if (forbidden) {
    return (
      <div className="px-4 py-6 sm:px-6 lg:px-8">
        <div className="rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-8 text-center text-sm text-[var(--ft-text-muted)]">
          You do not have permission to manage invoices for this workspace.
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Invoices</h1>
          <p className="mt-1 text-sm text-[var(--ft-text-secondary)]">
            Bill customers, track what is paid, and follow up on what is due.
          </p>
        </div>
        <Button onClick={() => setCreating((prev) => !prev)}>
          <Plus className="size-4" /> {creating ? "Close" : "New invoice"}
        </Button>
      </header>

      {creating ? (
        <section className="mb-6 rounded-[var(--radius-xl)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-5">
          <h2 className="font-semibold">New invoice</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Input id="customer-name" label="Customer name" onChange={(e) => setCustomerName(e.currentTarget.value)} type="text" value={customerName} />
            <Input id="customer-email" label="Customer email (optional)" onChange={(e) => setCustomerEmail(e.currentTarget.value)} type="email" value={customerEmail} />
            <div>
              <label className="block text-sm font-medium text-[var(--ft-text-secondary)]" htmlFor="currency">
                Currency
              </label>
              <select
                className="mt-1 h-11 w-full rounded-md border border-[var(--ft-border)] bg-[var(--ft-surface)] px-3 text-sm text-[var(--ft-text-primary)]"
                id="currency"
                onChange={(event) => setCurrency(event.currentTarget.value)}
                value={currency}
              >
                <option value="NGN">NGN</option>
                <option value="USD">USD</option>
              </select>
            </div>
            <Input id="due-at" label="Due date (optional)" onChange={(e) => setDueAt(e.currentTarget.value)} type="date" value={dueAt} />
          </div>

          <div className="mt-5">
            <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--ft-text-muted)]">Line items</div>
            <div className="grid gap-2">
              {lines.map((line, index) => (
                <InvoiceLineRow
                  canRemove={lines.length > 1}
                  index={index}
                  key={line.id}
                  line={line}
                  onCommit={commitLine}
                  onRemove={removeLine}
                />
              ))}
            </div>
            <button
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[var(--ft-accent)]"
              onClick={addLine}
              type="button"
            >
              <Plus className="size-3" /> Add line item
            </button>
          </div>

          <div className="mt-4 grid gap-1.5">
            <label className="text-sm font-medium" htmlFor="notes">Notes / payment instructions (optional)</label>
            <textarea
              className="min-h-[70px] rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-4 py-3 text-sm outline-none focus:border-[var(--ft-accent)]"
              id="notes"
              onChange={(e) => setNotes(e.currentTarget.value)}
              value={notes}
            />
          </div>

          {formError ? <div className="mt-3 text-sm text-[var(--ft-red)]">{formError}</div> : null}

          <div className="mt-5 flex items-center justify-between">
            <div className="text-sm text-[var(--ft-text-muted)]">
              Total <span className="font-mono font-semibold text-[var(--ft-text-primary)]">{formatInvoiceMoney(draftTotalMinor, currency)}</span>
            </div>
            <Button disabled={submitting} onClick={() => void submit()}>
              {submitting ? "Creating..." : "Create invoice"}
            </Button>
          </div>
        </section>
      ) : null}

      {error ? <div className="mb-4 text-sm text-[var(--ft-red)]">{error}</div> : null}

      <section className="rounded-[var(--radius-xl)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-5">
        {invoices === undefined ? (
          <div className="text-sm text-[var(--ft-text-muted)]">Loading invoices...</div>
        ) : invoices.length === 0 ? (
          <div className="grid place-items-center gap-2 py-8 text-center">
            <FileText className="size-6 text-[var(--ft-text-muted)]" />
            <div className="text-sm font-medium">No invoices yet</div>
            <div className="text-xs text-[var(--ft-text-muted)]">Create your first invoice to bill a customer.</div>
          </div>
        ) : (
          <div className="grid gap-2">
            {invoices.map((invoice) => (
              <div
                className="flex flex-wrap items-center gap-3 rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-3"
                key={invoice.id}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold">{invoice.number}</span>
                    <Badge tone={invoiceStatusTone(invoice.status)}>{invoice.status.toLowerCase()}</Badge>
                  </div>
                  <div className="mt-0.5 truncate text-xs text-[var(--ft-text-muted)]">
                    {invoice.customerName}
                    {invoice.dueAt ? ` · due ${new Date(invoice.dueAt).toLocaleDateString()}` : ""}
                  </div>
                </div>
                <div className="font-mono text-sm font-semibold">
                  {formatInvoiceMoney(invoice.totalMinor, invoice.currency)}
                </div>
                <div className="flex gap-1.5">
                  {invoice.status === "DRAFT" ? (
                    <Button disabled={busyId === invoice.id} onClick={() => void runAction(invoice.id, sendInvoice)} variant="secondary">
                      Send
                    </Button>
                  ) : null}
                  {invoice.status !== "PAID" && invoice.status !== "VOID" ? (
                    <Button disabled={busyId === invoice.id} onClick={() => void runAction(invoice.id, markInvoicePaid)} variant="secondary">
                      Mark paid
                    </Button>
                  ) : null}
                  {invoice.status !== "PAID" && invoice.status !== "VOID" ? (
                    <Button disabled={busyId === invoice.id} onClick={() => void runAction(invoice.id, voidInvoice)} variant="ghost">
                      Void
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
