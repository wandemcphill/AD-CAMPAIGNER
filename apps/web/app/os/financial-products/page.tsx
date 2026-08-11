"use client";

import { useCallback, useEffect, useState } from "react";
import { Building2, CreditCard, Send, Snowflake, X } from "lucide-react";
import { motion } from "framer-motion";

import { Badge, Button, Panel, PermissionDenied, cn } from "@fliptrybe/ui";
import { TabBar } from "@fliptrybe/ui/components";

import { EmptyState, ErrorNotice, LoadingBlock } from "../../campaigns/components";
import { isForbiddenError } from "../../lib/api-client";
import {
  closeAccount,
  createAccount,
  formatNaira,
  freezeCard,
  fundCard,
  getRemittanceQuote,
  issueCard,
  loadAccounts,
  loadCards,
  loadRemittanceTransfers,
  sendRemittance,
  terminateCard,
  unfreezeCard,
  type RemittanceQuote,
  type RemittanceStatus,
  type RemittanceTransfer,
  type VirtualAccount,
  type VirtualAccountStatus,
  type VirtualCard,
  type VirtualCardStatus
} from "./api";

const TABS = [
  { id: "accounts", label: "Accounts" },
  { id: "cards", label: "Cards" },
  { id: "remittance", label: "Remittance" }
];

const ACCOUNT_STATUS_TONE: Record<VirtualAccountStatus, "success" | "neutral"> = {
  ACTIVE: "success",
  CLOSED: "neutral"
};

const CARD_STATUS_TONE: Record<VirtualCardStatus, "success" | "warning" | "danger"> = {
  ACTIVE: "success",
  FROZEN: "warning",
  TERMINATED: "danger"
};

const REMITTANCE_STATUS_TONE: Record<RemittanceStatus, "success" | "warning" | "danger" | "neutral"> = {
  QUOTED: "neutral",
  CHARGED: "neutral",
  PROCESSING: "warning",
  COMPLETED: "success",
  FAILED: "danger",
  DISPUTED: "danger"
};

export default function FinancialProductsPage() {
  const [tab, setTab] = useState("accounts");
  const [error, setError] = useState<string>();
  const [forbidden, setForbidden] = useState(false);

  // Accounts state
  const [accounts, setAccounts] = useState<VirtualAccount[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [newAccountName, setNewAccountName] = useState("");
  const [creatingAccount, setCreatingAccount] = useState(false);

  // Cards state
  const [cards, setCards] = useState<VirtualCard[]>([]);
  const [cardsLoading, setCardsLoading] = useState(true);
  const [cardholderName, setCardholderName] = useState("");
  const [fundingNaira, setFundingNaira] = useState(5000);
  const [issuingCard, setIssuingCard] = useState(false);
  const [cardActionId, setCardActionId] = useState<string>();

  // Remittance state
  const [transfers, setTransfers] = useState<RemittanceTransfer[]>([]);
  const [transfersLoading, setTransfersLoading] = useState(true);
  const [sourceNaira, setSourceNaira] = useState(50000);
  const [destinationCurrency, setDestinationCurrency] = useState("USD");
  const [recipientName, setRecipientName] = useState("");
  const [recipientAccountNumber, setRecipientAccountNumber] = useState("");
  const [recipientBankCode, setRecipientBankCode] = useState("");
  const [recipientCountry, setRecipientCountry] = useState("US");
  const [quote, setQuote] = useState<RemittanceQuote>();
  const [quoting, setQuoting] = useState(false);
  const [sending, setSending] = useState(false);

  const refreshAccounts = useCallback(async () => {
    setError(undefined);
    setForbidden(false);
    try {
      setAccounts(await loadAccounts());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We could not load your accounts.");
      setForbidden(isForbiddenError(caught));
    } finally {
      setAccountsLoading(false);
    }
  }, []);

  const refreshCards = useCallback(async () => {
    setError(undefined);
    setForbidden(false);
    try {
      setCards(await loadCards());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We could not load your cards.");
      setForbidden(isForbiddenError(caught));
    } finally {
      setCardsLoading(false);
    }
  }, []);

  const refreshTransfers = useCallback(async () => {
    setError(undefined);
    setForbidden(false);
    try {
      setTransfers(await loadRemittanceTransfers());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We could not load your transfers.");
      setForbidden(isForbiddenError(caught));
    } finally {
      setTransfersLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshAccounts();
    void refreshCards();
    void refreshTransfers();
    // Deep-link support for the nav's "?tab=cards"/"?tab=remittance" items — read
    // once on mount via window.location instead of useSearchParams to avoid the
    // Suspense-boundary requirement that hook carries in the App Router.
    const requestedTab = new URLSearchParams(window.location.search).get("tab");
    if (requestedTab && TABS.some((t) => t.id === requestedTab)) {
      setTab(requestedTab);
    }
    // Intentionally run once on mount.
  }, []);

  const submitCreateAccount = useCallback(async () => {
    setCreatingAccount(true);
    setError(undefined);
    try {
      await createAccount(newAccountName.trim());
      setNewAccountName("");
      await refreshAccounts();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create this account.");
    } finally {
      setCreatingAccount(false);
    }
  }, [newAccountName, refreshAccounts]);

  const submitCloseAccount = useCallback(
    async (id: string) => {
      setError(undefined);
      try {
        await closeAccount(id);
        await refreshAccounts();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not close this account.");
      }
    },
    [refreshAccounts]
  );

  const submitIssueCard = useCallback(async () => {
    setIssuingCard(true);
    setError(undefined);
    try {
      const result = await issueCard(cardholderName.trim(), fundingNaira * 100);
      if (result.status !== "active") {
        setError(
          "Card funding was charged but issuance is still being confirmed — check back shortly."
        );
      }
      setCardholderName("");
      await refreshCards();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not issue this card.");
    } finally {
      setIssuingCard(false);
    }
  }, [cardholderName, fundingNaira, refreshCards]);

  const submitFundCard = useCallback(
    async (id: string) => {
      setCardActionId(id);
      setError(undefined);
      try {
        await fundCard(id, 500000);
        await refreshCards();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not fund this card.");
      } finally {
        setCardActionId(undefined);
      }
    },
    [refreshCards]
  );

  const submitToggleFreeze = useCallback(
    async (card: VirtualCard) => {
      setCardActionId(card.id);
      setError(undefined);
      try {
        if (card.status === "FROZEN") {
          await unfreezeCard(card.id);
        } else {
          await freezeCard(card.id);
        }
        await refreshCards();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not update this card.");
      } finally {
        setCardActionId(undefined);
      }
    },
    [refreshCards]
  );

  const submitTerminateCard = useCallback(
    async (id: string) => {
      setCardActionId(id);
      setError(undefined);
      try {
        await terminateCard(id);
        await refreshCards();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not terminate this card.");
      } finally {
        setCardActionId(undefined);
      }
    },
    [refreshCards]
  );

  const submitGetQuote = useCallback(async () => {
    setQuoting(true);
    setError(undefined);
    setQuote(undefined);
    try {
      setQuote(
        await getRemittanceQuote({
          sourceCurrency: "NGN",
          destinationCurrency,
          sourceAmountMinor: sourceNaira * 100
        })
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not get a quote.");
    } finally {
      setQuoting(false);
    }
  }, [destinationCurrency, sourceNaira]);

  const submitSendRemittance = useCallback(async () => {
    if (!quote) return;
    setSending(true);
    setError(undefined);
    try {
      const result = await sendRemittance({
        quoteId: quote.quoteId,
        recipientName: recipientName.trim(),
        recipientAccountNumber: recipientAccountNumber.trim(),
        recipientBankCode: recipientBankCode.trim(),
        recipientCountry,
        sourceAmountMinor: quote.sourceAmountMinor,
        sourceCurrency: quote.sourceCurrency,
        destinationAmountMinor: quote.destinationAmountMinor,
        destinationCurrency: quote.destinationCurrency,
        feeMinor: quote.feeMinor
      });
      if (result.status !== "active") {
        setError("Transfer was charged but could not be confirmed — check back shortly.");
      }
      setQuote(undefined);
      setRecipientName("");
      setRecipientAccountNumber("");
      setRecipientBankCode("");
      await refreshTransfers();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not send this transfer.");
    } finally {
      setSending(false);
    }
  }, [quote, recipientAccountNumber, recipientBankCode, recipientCountry, recipientName, refreshTransfers]);

  if (forbidden) {
    return (
      <PermissionDenied>
        You do not have permission to view virtual accounts, cards, and remittance for this
        workspace. Contact your workspace owner if you believe this is a mistake.
      </PermissionDenied>
    );
  }

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center gap-2">
          <Building2 className="size-5 text-[var(--ft-accent)]" />
          <h1 className="text-xl font-bold">Financial Products</h1>
        </div>
        <p className="mt-1 text-sm text-[var(--ft-text-secondary)]">
          Virtual accounts, virtual cards, and international transfers.
        </p>
        <div className="mt-3 rounded-[var(--radius-md)] border border-[var(--ft-yellow)]/30 bg-[var(--ft-yellow-subtle)] p-3 text-xs leading-5 text-[var(--ft-text-secondary)]">
          These are sandbox/mock-backed for now — no real bank account, card, or transfer is
          created yet.
        </div>

        <ErrorNotice message={error} />

        <div className="mt-4">
          <TabBar items={TABS} onChange={setTab} value={tab} />
        </div>

        {tab === "accounts" && (
          <motion.div animate={{ opacity: 1 }} className="mt-6" initial={{ opacity: 0 }}>
            <Panel className="p-5">
              <label className="mb-1 block text-xs text-[var(--ft-text-muted)]">Account name</label>
              <div className="flex gap-2">
                <input
                  className="h-12 flex-1 rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-4 text-sm outline-none placeholder:text-[var(--ft-text-muted)] focus:border-[var(--ft-accent)]"
                  onChange={(e) => setNewAccountName(e.target.value)}
                  placeholder="e.g. Jane Doe"
                  value={newAccountName}
                />
                <Button
                  disabled={!newAccountName.trim() || creatingAccount}
                  onClick={() => void submitCreateAccount()}
                >
                  {creatingAccount ? "Creating..." : "Create"}
                </Button>
              </div>
            </Panel>

            <div className="mt-4">
              {accountsLoading ? (
                <Panel className="p-6">
                  <LoadingBlock label="Loading your accounts" />
                </Panel>
              ) : accounts.length === 0 ? (
                <Panel className="p-6">
                  <EmptyState
                    copy="Create your first virtual account above."
                    icon={Building2}
                    title="No accounts yet"
                  />
                </Panel>
              ) : (
                <div className="grid gap-2">
                  {accounts.map((account) => (
                    <Panel className="flex items-center gap-4 p-4" key={account.id}>
                      <div className="grid size-10 place-items-center rounded-full bg-[var(--ft-accent)]/10">
                        <Building2 className="size-4 text-[var(--ft-accent)]" />
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold">{account.accountName}</div>
                        <div className="mt-0.5 text-xs text-[var(--ft-text-muted)]">
                          {account.bankName} · {account.accountNumber}
                        </div>
                      </div>
                      <Badge tone={ACCOUNT_STATUS_TONE[account.status]}>
                        {account.status.toLowerCase()}
                      </Badge>
                      {account.status === "ACTIVE" && (
                        <Button
                          className="h-9 px-3 text-xs"
                          onClick={() => void submitCloseAccount(account.id)}
                          variant="secondary"
                        >
                          Close
                        </Button>
                      )}
                    </Panel>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {tab === "cards" && (
          <motion.div animate={{ opacity: 1 }} className="mt-6" initial={{ opacity: 0 }}>
            <Panel className="p-5">
              <label className="mb-1 block text-xs text-[var(--ft-text-muted)]">
                Cardholder name
              </label>
              <input
                className="h-12 w-full rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-4 text-sm outline-none placeholder:text-[var(--ft-text-muted)] focus:border-[var(--ft-accent)]"
                onChange={(e) => setCardholderName(e.target.value)}
                placeholder="e.g. Jane Doe"
                value={cardholderName}
              />

              <label className="mb-1 mt-4 block text-xs text-[var(--ft-text-muted)]">
                Initial funding
              </label>
              <input
                className="h-12 w-full rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-4 text-sm outline-none focus:border-[var(--ft-accent)]"
                min={100}
                onChange={(e) => setFundingNaira(Number(e.target.value))}
                type="number"
                value={fundingNaira}
              />

              <Button
                className="mt-4 w-full justify-center"
                disabled={!cardholderName.trim() || fundingNaira < 100 || issuingCard}
                onClick={() => void submitIssueCard()}
              >
                <CreditCard className="size-4" />
                {issuingCard ? "Issuing..." : `Issue card, fund ${formatNaira(fundingNaira * 100)}`}
              </Button>
            </Panel>

            <div className="mt-4">
              {cardsLoading ? (
                <Panel className="p-6">
                  <LoadingBlock label="Loading your cards" />
                </Panel>
              ) : cards.length === 0 ? (
                <Panel className="p-6">
                  <EmptyState
                    copy="Issue your first virtual card above."
                    icon={CreditCard}
                    title="No cards yet"
                  />
                </Panel>
              ) : (
                <div className="grid gap-2">
                  {cards.map((card) => (
                    <Panel className="p-4" key={card.id}>
                      <div className="flex items-center gap-4">
                        <div className="grid size-10 place-items-center rounded-full bg-[var(--ft-accent)]/10">
                          <CreditCard className="size-4 text-[var(--ft-accent)]" />
                        </div>
                        <div className="flex-1">
                          <div className="font-semibold">
                            {card.brand} •••• {card.last4}
                          </div>
                          <div className="mt-0.5 text-xs text-[var(--ft-text-muted)]">
                            Expires {String(card.expiryMonth).padStart(2, "0")}/{card.expiryYear}
                          </div>
                        </div>
                        <Badge tone={CARD_STATUS_TONE[card.status]}>
                          {card.status.toLowerCase()}
                        </Badge>
                      </div>
                      {card.status !== "TERMINATED" && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            className="h-9 px-3 text-xs"
                            disabled={cardActionId === card.id}
                            onClick={() => void submitFundCard(card.id)}
                            variant="secondary"
                          >
                            Top up {formatNaira(500000)}
                          </Button>
                          <Button
                            className="h-9 px-3 text-xs"
                            disabled={cardActionId === card.id}
                            onClick={() => void submitToggleFreeze(card)}
                            variant="secondary"
                          >
                            <Snowflake className="size-3" />
                            {card.status === "FROZEN" ? "Unfreeze" : "Freeze"}
                          </Button>
                          <Button
                            className="h-9 px-3 text-xs"
                            disabled={cardActionId === card.id}
                            onClick={() => void submitTerminateCard(card.id)}
                            variant="secondary"
                          >
                            <X className="size-3" />
                            Terminate
                          </Button>
                        </div>
                      )}
                    </Panel>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {tab === "remittance" && (
          <motion.div animate={{ opacity: 1 }} className="mt-6" initial={{ opacity: 0 }}>
            <Panel className="p-5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-[var(--ft-text-muted)]">
                    Send (NGN)
                  </label>
                  <input
                    className="h-12 w-full rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-4 text-sm outline-none focus:border-[var(--ft-accent)]"
                    min={100}
                    onChange={(e) => setSourceNaira(Number(e.target.value))}
                    type="number"
                    value={sourceNaira}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-[var(--ft-text-muted)]">To</label>
                  <select
                    className="h-12 w-full rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-4 text-sm outline-none focus:border-[var(--ft-accent)]"
                    onChange={(e) => setDestinationCurrency(e.target.value)}
                    value={destinationCurrency}
                  >
                    <option value="USD">USD</option>
                    <option value="GBP">GBP</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>
              </div>

              <Button
                className="mt-3 w-full justify-center"
                disabled={sourceNaira < 100 || quoting}
                onClick={() => void submitGetQuote()}
                variant="secondary"
              >
                {quoting ? "Getting quote..." : "Get quote"}
              </Button>

              {quote && (
                <div className="mt-4 space-y-3 rounded-[var(--radius-md)] border border-[var(--ft-border)] p-3">
                  <div className="text-sm">
                    Recipient gets{" "}
                    <span className="font-semibold">
                      {quote.destinationCurrency} {(quote.destinationAmountMinor / 100).toLocaleString()}
                    </span>{" "}
                    · fee {formatNaira(quote.feeMinor)}
                  </div>

                  <input
                    className="h-11 w-full rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-4 text-sm outline-none placeholder:text-[var(--ft-text-muted)] focus:border-[var(--ft-accent)]"
                    onChange={(e) => setRecipientName(e.target.value)}
                    placeholder="Recipient name"
                    value={recipientName}
                  />
                  <input
                    className="h-11 w-full rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-4 text-sm outline-none placeholder:text-[var(--ft-text-muted)] focus:border-[var(--ft-accent)]"
                    onChange={(e) => setRecipientAccountNumber(e.target.value)}
                    placeholder="Account number"
                    value={recipientAccountNumber}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      className="h-11 w-full rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-4 text-sm outline-none placeholder:text-[var(--ft-text-muted)] focus:border-[var(--ft-accent)]"
                      onChange={(e) => setRecipientBankCode(e.target.value)}
                      placeholder="Bank code"
                      value={recipientBankCode}
                    />
                    <input
                      className="h-11 w-full rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-4 text-sm outline-none placeholder:text-[var(--ft-text-muted)] focus:border-[var(--ft-accent)]"
                      onChange={(e) => setRecipientCountry(e.target.value)}
                      placeholder="Country (e.g. US)"
                      value={recipientCountry}
                    />
                  </div>

                  <Button
                    className="w-full justify-center"
                    disabled={
                      !recipientName.trim() ||
                      !recipientAccountNumber.trim() ||
                      !recipientBankCode.trim() ||
                      sending
                    }
                    onClick={() => void submitSendRemittance()}
                  >
                    <Send className="size-4" />
                    {sending ? "Sending..." : "Send transfer"}
                  </Button>
                </div>
              )}
            </Panel>

            <div className="mt-4">
              {transfersLoading ? (
                <Panel className="p-6">
                  <LoadingBlock label="Loading your transfers" />
                </Panel>
              ) : transfers.length === 0 ? (
                <Panel className="p-6">
                  <EmptyState
                    copy="Transfers you send will show up here."
                    icon={Send}
                    title="No transfers yet"
                  />
                </Panel>
              ) : (
                <div className="grid gap-2">
                  {transfers.map((transfer) => (
                    <Panel className="flex items-center gap-4 p-4" key={transfer.id}>
                      <div
                        className={cn(
                          "grid size-10 place-items-center rounded-full bg-[var(--ft-accent)]/10"
                        )}
                      >
                        <Send className="size-4 text-[var(--ft-accent)]" />
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold">{transfer.recipientName}</div>
                        <div className="mt-0.5 text-xs text-[var(--ft-text-muted)]">
                          {formatNaira(transfer.sourceAmountMinor)} →{" "}
                          {transfer.destinationCurrency}{" "}
                          {(transfer.destinationAmountMinor / 100).toLocaleString()}
                        </div>
                      </div>
                      <Badge tone={REMITTANCE_STATUS_TONE[transfer.status]}>
                        {transfer.status.toLowerCase()}
                      </Badge>
                    </Panel>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
