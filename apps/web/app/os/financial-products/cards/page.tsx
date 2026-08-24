"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowDownToLine, CreditCard, Snowflake, X } from "lucide-react";
import { motion } from "framer-motion";

import { Badge, Button, Panel, PermissionDenied } from "@fliptrybe/ui";

import { EmptyState, ErrorNotice, LoadingBlock } from "../../../campaigns/components";
import { isForbiddenError } from "../../../lib/api-client";
import {
  enrollCardCustomer,
  formatNaira,
  freezeCard,
  fundCard,
  issueCard,
  loadCardCostPreview,
  loadCardEnrollment,
  loadCards,
  terminateCard,
  unfreezeCard,
  withdrawFromCard,
  type CardCostPreview,
  type CardCurrency,
  type CardEnrollment,
  type VirtualCard,
  type VirtualCardStatus
} from "../api";

const CARD_STATUS_TONE: Record<VirtualCardStatus, "success" | "warning" | "danger"> = {
  ACTIVE: "success",
  FROZEN: "warning",
  TERMINATED: "danger"
};

const CARD_CURRENCIES: CardCurrency[] = ["USD", "NGN"];

export default function CardsTabPage() {
  const [cards, setCards] = useState<VirtualCard[]>([]);
  const [cardsLoading, setCardsLoading] = useState(true);
  const [cardholderName, setCardholderName] = useState("");
  const [fundingNaira, setFundingNaira] = useState(5000);
  const [issuingCard, setIssuingCard] = useState(false);
  const [cardActionId, setCardActionId] = useState<string>();
  const [error, setError] = useState<string>();
  const [forbidden, setForbidden] = useState(false);

  const [cardAmountInput, setCardAmountInput] = useState<Record<string, string>>({});
  const [currency, setCurrency] = useState<CardCurrency>("USD");
  const [enrollment, setEnrollment] = useState<CardEnrollment>();
  const [enrollmentLoading, setEnrollmentLoading] = useState(false);
  const [costPreview, setCostPreview] = useState<CardCostPreview | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [enrollForm, setEnrollForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    dateOfBirth: "",
    street: "",
    city: "",
    state: "",
    country: "NG",
    postalCode: "",
    idType: "BVN",
    idNumber: "",
    idImageBase64: ""
  });

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

  useEffect(() => {
    void refreshCards();
  }, [refreshCards]);

  // Asked before the form is shown so a customer needing verification is told
  // up front, instead of filling everything in and being rejected on submit.
  const refreshEnrollment = useCallback(async (forCurrency: CardCurrency) => {
    setEnrollmentLoading(true);
    try {
      setEnrollment(await loadCardEnrollment(forCurrency));
    } catch {
      // A failed lookup must not block the NGN path, which needs no customer.
      setEnrollment(undefined);
    } finally {
      setEnrollmentLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshEnrollment(currency);
  }, [currency, refreshEnrollment]);

  // What this card will actually cost in naira. Indicative only — the binding
  // rate is struck at issuance — so it is labelled as such rather than implied
  // to be locked.
  useEffect(() => {
    if (currency === "NGN" || fundingNaira <= 0) {
      setCostPreview(null);
      return;
    }
    let cancelled = false;
    void loadCardCostPreview(currency, Math.round(fundingNaira * 100))
      .then((preview) => {
        if (!cancelled) setCostPreview(preview);
      })
      .catch(() => {
        if (!cancelled) setCostPreview(null);
      });
    return () => {
      cancelled = true;
    };
  }, [currency, fundingNaira]);

  const submitIssueCard = useCallback(async () => {
    setIssuingCard(true);
    setError(undefined);
    try {
      const result = await issueCard(cardholderName.trim(), fundingNaira * 100, currency);
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
  }, [cardholderName, currency, fundingNaira, refreshCards]);

  const submitEnrollment = useCallback(async () => {
    setEnrolling(true);
    setError(undefined);
    try {
      await enrollCardCustomer({
        firstName: enrollForm.firstName.trim(),
        lastName: enrollForm.lastName.trim(),
        email: enrollForm.email.trim(),
        phone: enrollForm.phone.trim(),
        currency,
        country: enrollForm.country.trim() || "NG",
        ...(enrollForm.dateOfBirth ? { dateOfBirth: enrollForm.dateOfBirth } : {}),
        ...(enrollForm.street.trim()
          ? {
              address: {
                street: enrollForm.street.trim(),
                city: enrollForm.city.trim(),
                state: enrollForm.state.trim(),
                country: enrollForm.country.trim() || "NG",
                ...(enrollForm.postalCode.trim() ? { postalCode: enrollForm.postalCode.trim() } : {})
              }
            }
          : {}),
        ...(enrollForm.idType ? { idType: enrollForm.idType } : {}),
        ...(enrollForm.idNumber.trim() ? { idNumber: enrollForm.idNumber.trim() } : {}),
        ...(enrollForm.idImageBase64.trim() ? { idImageBase64: enrollForm.idImageBase64.trim() } : {})
      });
      await refreshEnrollment(currency);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not complete verification.");
    } finally {
      setEnrolling(false);
    }
  }, [currency, enrollForm, refreshEnrollment]);

  // Gate the issue form only when the issuer for this currency actually needs a
  // customer and this workspace has none.
  const needsEnrollment = Boolean(enrollment?.required && !enrollment.enrolled);

  // Amount is in the CARD's currency, so it cannot be a shared naira constant —
  // 500000 minor units is ₦5,000 on an NGN card but $5,000 on a USD one.
  const submitFundCard = useCallback(
    async (card: VirtualCard) => {
      const major = Number(cardAmountInput[card.id] ?? "");
      if (!Number.isFinite(major) || major <= 0) {
        setError("Enter an amount to top up.");
        return;
      }
      setCardActionId(card.id);
      setError(undefined);
      try {
        await fundCard(card.id, Math.round(major * 100));
        setCardAmountInput((prev) => ({ ...prev, [card.id]: "" }));
        await refreshCards();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not fund this card.");
      } finally {
        setCardActionId(undefined);
      }
    },
    [cardAmountInput, refreshCards]
  );

  const submitWithdraw = useCallback(
    async (card: VirtualCard) => {
      const major = Number(cardAmountInput[card.id] ?? "");
      if (!Number.isFinite(major) || major <= 0) {
        setError("Enter an amount to withdraw back to your wallet.");
        return;
      }
      setCardActionId(card.id);
      setError(undefined);
      try {
        await withdrawFromCard(card.id, Math.round(major * 100));
        setCardAmountInput((prev) => ({ ...prev, [card.id]: "" }));
        await refreshCards();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not withdraw from this card.");
      } finally {
        setCardActionId(undefined);
      }
    },
    [cardAmountInput, refreshCards]
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

  if (forbidden) {
    return (
      <PermissionDenied>
        You do not have permission to view virtual cards for this workspace. Contact your
        workspace owner if you believe this is a mistake.
      </PermissionDenied>
    );
  }

  return (
    <motion.div animate={{ opacity: 1 }} className="mt-6" initial={{ opacity: 0 }}>
      <ErrorNotice message={error} />
      <Panel className="p-5">
        <label className="mb-1 block text-xs text-[var(--ft-text-muted)]">Card currency</label>
        <div className="flex gap-2">
          {CARD_CURRENCIES.map((code) => (
            <button
              className={[
                "h-10 flex-1 rounded-[var(--radius-lg)] border text-sm font-medium transition-colors",
                currency === code
                  ? "border-[var(--ft-accent)] bg-[var(--ft-accent)]/10 text-[var(--ft-accent)]"
                  : "border-[var(--ft-border)] bg-[var(--ft-bg-surface)] text-[var(--ft-text-secondary)]"
              ].join(" ")}
              key={code}
              onClick={() => setCurrency(code)}
              type="button"
            >
              {code}
            </button>
          ))}
        </div>

        {enrollmentLoading ? (
          <p className="mt-4 text-xs text-[var(--ft-text-muted)]">Checking requirements…</p>
        ) : needsEnrollment ? (
          <div className="mt-4">
            <div className="rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] p-3 text-xs text-[var(--ft-text-secondary)]">
              A {currency} card is issued by {enrollment?.providerName}, which requires a verified
              identity before your first card. This is a one-time step — later cards skip it. Your
              details go to the card issuer and are not stored by FlipTrybe.
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {(
                [
                  ["firstName", "First name", "Jane"],
                  ["lastName", "Last name", "Doe"],
                  ["email", "Email", "jane@example.com"],
                  ["phone", "Phone (with country code)", "+2348030000000"],
                  ["dateOfBirth", "Date of birth (YYYY-MM-DD)", "1995-04-12"],
                  ["street", "Street address", "12 Admiralty Way"],
                  ["city", "City", "Lekki"],
                  ["state", "State", "Lagos"],
                  ["country", "Country code", "NG"],
                  ["postalCode", "Postal code", "100001"],
                  ["idNumber", "ID number", "22200000000"],
                  ["idImageBase64", "ID image URL or base64", "https://..."]
                ] as const
              ).map(([field, label, placeholder]) => (
                <label className="block" key={field}>
                  <span className="mb-1 block text-xs text-[var(--ft-text-muted)]">{label}</span>
                  <input
                    className="h-11 w-full rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-3 text-sm outline-none placeholder:text-[var(--ft-text-muted)] focus:border-[var(--ft-accent)]"
                    onChange={(e) =>
                      setEnrollForm((prev) => ({ ...prev, [field]: e.target.value }))
                    }
                    placeholder={placeholder}
                    value={enrollForm[field]}
                  />
                </label>
              ))}
              <label className="block">
                <span className="mb-1 block text-xs text-[var(--ft-text-muted)]">ID type</span>
                <select
                  className="h-11 w-full rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-3 text-sm outline-none focus:border-[var(--ft-accent)]"
                  onChange={(e) => setEnrollForm((prev) => ({ ...prev, idType: e.target.value }))}
                  value={enrollForm.idType}
                >
                  {["BVN", "NIN", "PASSPORT", "VIN"].map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <Button
              className="mt-4 w-full justify-center"
              disabled={
                enrolling ||
                !enrollForm.firstName.trim() ||
                !enrollForm.lastName.trim() ||
                !enrollForm.email.trim() ||
                !enrollForm.phone.trim()
              }
              onClick={() => void submitEnrollment()}
            >
              {enrolling ? "Verifying…" : `Verify identity for ${currency} cards`}
            </Button>
          </div>
        ) : (
          <>
            <label className="mb-1 mt-4 block text-xs text-[var(--ft-text-muted)]">
              Cardholder name
            </label>
            <input
              className="h-12 w-full rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-4 text-sm outline-none placeholder:text-[var(--ft-text-muted)] focus:border-[var(--ft-accent)]"
              onChange={(e) => setCardholderName(e.target.value)}
              placeholder="e.g. Jane Doe"
              value={cardholderName}
            />

            <label className="mb-1 mt-4 block text-xs text-[var(--ft-text-muted)]">
              Initial funding ({currency})
            </label>
            <input
              className="h-12 w-full rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-4 text-sm outline-none focus:border-[var(--ft-accent)]"
              min={100}
              onChange={(e) => setFundingNaira(Number(e.target.value))}
              type="number"
              value={fundingNaira}
            />

            {costPreview && (
              <p className="mt-2 text-xs text-[var(--ft-text-muted)]">
                Costs about {formatNaira(costPreview.walletCostMinor)} at ₦
                {costPreview.rate.toFixed(2)}/{costPreview.cardCurrency} — indicative, the rate is
                confirmed when the card is issued.
              </p>
            )}

            <Button
              className="mt-4 w-full justify-center"
              disabled={!cardholderName.trim() || fundingNaira < 1 || issuingCard}
              onClick={() => void submitIssueCard()}
            >
              <CreditCard className="size-4" />
              {issuingCard
                ? "Issuing..."
                : currency === "NGN"
                  ? `Issue NGN card, charge ${formatNaira(fundingNaira * 100)}`
                  : `Issue ${currency} card for ${currency} ${fundingNaira.toLocaleString()}`}
            </Button>
          </>
        )}
      </Panel>

      <div className="mt-4">
        {cardsLoading ? (
          <Panel className="p-6">
            <LoadingBlock label="Loading your cards" />
          </Panel>
        ) : cards.length === 0 ? (
          <Panel className="p-6">
            <EmptyState copy="Issue your first virtual card above." icon={CreditCard} title="No cards yet" />
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
                  <Badge tone={CARD_STATUS_TONE[card.status]}>{card.status.toLowerCase()}</Badge>
                </div>
                {card.status !== "TERMINATED" && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <input
                      className="h-9 w-32 rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-3 text-xs outline-none placeholder:text-[var(--ft-text-muted)] focus:border-[var(--ft-accent)]"
                      inputMode="decimal"
                      onChange={(e) =>
                        setCardAmountInput((prev) => ({ ...prev, [card.id]: e.target.value }))
                      }
                      placeholder={`Amount (${card.currency})`}
                      value={cardAmountInput[card.id] ?? ""}
                    />
                    <Button
                      className="h-9 px-3 text-xs"
                      disabled={cardActionId === card.id}
                      onClick={() => void submitFundCard(card)}
                      variant="secondary"
                    >
                      Top up
                    </Button>
                    {/* Withdraw first — terminating does not return the balance
                        on every issuer, so closing a funded card without this
                        would strand whatever is left on it. */}
                    <Button
                      className="h-9 px-3 text-xs"
                      disabled={cardActionId === card.id}
                      onClick={() => void submitWithdraw(card)}
                      variant="secondary"
                    >
                      <ArrowDownToLine className="size-3" />
                      Withdraw
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
  );
}
