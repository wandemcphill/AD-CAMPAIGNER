"use client";

import { useCallback, useEffect, useState } from "react";
import { CreditCard, Snowflake, X } from "lucide-react";
import { motion } from "framer-motion";

import { Badge, Button, Panel, PermissionDenied } from "@fliptrybe/ui";

import { EmptyState, ErrorNotice, LoadingBlock } from "../../../campaigns/components";
import { isForbiddenError } from "../../../lib/api-client";
import {
  formatNaira,
  freezeCard,
  fundCard,
  issueCard,
  loadCards,
  terminateCard,
  unfreezeCard,
  type VirtualCard,
  type VirtualCardStatus
} from "../api";

const CARD_STATUS_TONE: Record<VirtualCardStatus, "success" | "warning" | "danger"> = {
  ACTIVE: "success",
  FROZEN: "warning",
  TERMINATED: "danger"
};

export default function CardsTabPage() {
  const [cards, setCards] = useState<VirtualCard[]>([]);
  const [cardsLoading, setCardsLoading] = useState(true);
  const [cardholderName, setCardholderName] = useState("");
  const [fundingNaira, setFundingNaira] = useState(5000);
  const [issuingCard, setIssuingCard] = useState(false);
  const [cardActionId, setCardActionId] = useState<string>();
  const [error, setError] = useState<string>();
  const [forbidden, setForbidden] = useState(false);

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
        <label className="mb-1 block text-xs text-[var(--ft-text-muted)]">Cardholder name</label>
        <input
          className="h-12 w-full rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-4 text-sm outline-none placeholder:text-[var(--ft-text-muted)] focus:border-[var(--ft-accent)]"
          onChange={(e) => setCardholderName(e.target.value)}
          placeholder="e.g. Jane Doe"
          value={cardholderName}
        />

        <label className="mb-1 mt-4 block text-xs text-[var(--ft-text-muted)]">Initial funding</label>
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
  );
}
