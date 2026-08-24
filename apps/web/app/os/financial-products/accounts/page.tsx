"use client";

import { useCallback, useEffect, useState } from "react";
import { Building2 } from "lucide-react";
import { motion } from "framer-motion";
import { Badge, Button, Panel, PermissionDenied } from "@fliptrybe/ui";
import { EmptyState, ErrorNotice, LoadingBlock } from "../../../campaigns/components";
import { isForbiddenError } from "../../../lib/api-client";
import { CustomerJourney } from "../../components/customer-journey";
import { closeAccount, createAccount, loadAccounts, type VirtualAccount, type VirtualAccountStatus } from "../api";

const ACCOUNT_STATUS_TONE: Record<VirtualAccountStatus, "success" | "neutral"> = { ACTIVE: "success", CLOSED: "neutral" };

export default function AccountsTabPage() {
  const [accounts, setAccounts] = useState<VirtualAccount[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [newAccountName, setNewAccountName] = useState("");
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [error, setError] = useState<string>();
  const [forbidden, setForbidden] = useState(false);
  const refreshAccounts = useCallback(async () => { setError(undefined); setForbidden(false); try { setAccounts(await loadAccounts()); } catch (caught) { setError(caught instanceof Error ? caught.message : "We could not load your accounts."); setForbidden(isForbiddenError(caught)); } finally { setAccountsLoading(false); } }, []);
  useEffect(() => { void refreshAccounts(); }, [refreshAccounts]);
  const submitCreateAccount = useCallback(async () => { setCreatingAccount(true); setError(undefined); try { await createAccount(newAccountName.trim()); setNewAccountName(""); await refreshAccounts(); } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not create this account."); } finally { setCreatingAccount(false); } }, [newAccountName, refreshAccounts]);
  const submitCloseAccount = useCallback(async (id: string) => { setError(undefined); try { await closeAccount(id); await refreshAccounts(); } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not close this account."); } }, [refreshAccounts]);
  if (forbidden) return <PermissionDenied>You do not have permission to view virtual accounts for this workspace. Contact your workspace owner if you believe this is a mistake.</PermissionDenied>;
  const steps = [
    { label: "Choose purpose", detail: "Create an account for the person or business using it.", state: accounts.length ? "complete" : "current" },
    { label: "Create account", detail: "Enter a clear account name.", state: accounts.length ? "complete" : newAccountName ? "current" : "upcoming" },
    { label: "Account issued", detail: "Your account details appear here after creation.", state: accounts.length ? "complete" : "upcoming" },
    { label: "Use & manage", detail: "View details or close an active account.", state: accounts.length ? "current" : "upcoming" }
  ] as const;
  return <motion.div animate={{ opacity: 1 }} className="mt-6" initial={{ opacity: 0 }}>
    <CustomerJourney eyebrow="Multi-currency accounts" title="Create an account you can actually use" description="Keep account creation simple. Give it a clear purpose, receive the account details, then manage it from one place." steps={steps} trustNote="Only the account details returned by the platform are shown as active." />
    <ErrorNotice message={error} />
    <Panel className="mt-4 p-5"><label className="mb-1 block text-xs text-[var(--ft-text-muted)]">Account name</label><div className="flex gap-2"><input className="h-12 flex-1 rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-4 text-sm outline-none placeholder:text-[var(--ft-text-muted)] focus:border-[var(--ft-accent)]" onChange={(e) => setNewAccountName(e.target.value)} placeholder="e.g. Jane Doe · USD account" value={newAccountName} /><Button disabled={!newAccountName.trim() || creatingAccount} onClick={() => void submitCreateAccount()}>{creatingAccount ? "Creating..." : "Create account"}</Button></div></Panel>
    <div className="mt-4">{accountsLoading ? <Panel className="p-6"><LoadingBlock label="Loading your accounts" /></Panel> : accounts.length === 0 ? <Panel className="p-6"><EmptyState copy="Create your first virtual account above." icon={Building2} title="No accounts yet" /></Panel> : <div className="grid gap-2">{accounts.map((account) => <Panel className="flex items-center gap-4 p-4" key={account.id}><div className="grid size-10 place-items-center rounded-full bg-[var(--ft-accent)]/10"><Building2 className="size-4 text-[var(--ft-accent)]" /></div><div className="flex-1"><div className="font-semibold">{account.accountName}</div><div className="mt-0.5 text-xs text-[var(--ft-text-muted)]">{account.bankName} · {account.accountNumber}</div></div><Badge tone={ACCOUNT_STATUS_TONE[account.status]}>{account.status.toLowerCase()}</Badge>{account.status === "ACTIVE" && <Button className="h-9 px-3 text-xs" onClick={() => void submitCloseAccount(account.id)} variant="secondary">Close</Button>}</Panel>)}</div>}</div>
  </motion.div>;
}
