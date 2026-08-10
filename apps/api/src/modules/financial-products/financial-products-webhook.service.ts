/**
 * Processes inbound ProviderWebhookEvent rows for the financial-products domain
 * (virtual accounts, virtual cards, remittance). Called from the shared webhook
 * ingestion layer after signature verification has already been performed.
 *
 * Design principles:
 * - Idempotent: every path checks whether the event was already processed.
 * - State-machine safe: status transitions are only applied when the current
 *   DB state permits them (e.g. PROCESSING → COMPLETED, not COMPLETED → *).
 * - No double financial effects: ledger entries are guarded by idempotencyKey.
 * - Unknown events are stored but not processed; they do not throw.
 */
import { Injectable, Logger } from "@nestjs/common";

import { type RemittanceTransferStatus } from "@fliptrybe/database";

import { PrismaService } from "../prisma.service";

const toStr = (v: unknown, fallback = ''): string =>
  typeof v === 'string' ? v : fallback;

interface InboundWebhookContext {
  providerWebhookEventId: string;
  provider: string;
  eventType: string;
  payload: Record<string, unknown>;
}

@Injectable()
export class FinancialProductsWebhookService {
  private readonly logger = new Logger(FinancialProductsWebhookService.name);

  constructor(private readonly prisma: PrismaService) {}

  async handle(ctx: InboundWebhookContext): Promise<void> {
    const { providerWebhookEventId, provider, eventType, payload } = ctx;

    this.logger.log(`Processing financial webhook: provider=${provider} type=${eventType} id=${providerWebhookEventId}`);

    try {
      if (this.isVirtualAccountCreditEvent(eventType)) {
        await this.handleVirtualAccountCredit(provider, payload, providerWebhookEventId);
      } else if (this.isRemittanceEvent(eventType)) {
        await this.handleRemittanceStatusUpdate(provider, payload, providerWebhookEventId);
      } else if (this.isCardEvent(eventType)) {
        await this.handleCardEvent(provider, payload, providerWebhookEventId);
      } else {
        this.logger.warn(`Unrecognised financial webhook type: ${eventType} from ${provider}`);
        return;
      }

      await this.prisma.client.providerWebhookEvent.update({
        where: { id: providerWebhookEventId },
        data: { processed: true, processedAt: new Date() }
      });
    } catch (err) {
      this.logger.error(`Failed to process financial webhook ${providerWebhookEventId}`, err);
      throw err;
    }
  }

  // ─── Virtual Account Credit ──────────────────────────────────────────────────

  private isVirtualAccountCreditEvent(eventType: string): boolean {
    // Payscribe fires `accounts.payment.status` when funds land in a VA.
    // Generic matchers cover other providers' naming.
    return /accounts?\.payment|credit|collection|deposit|inflow|receive|va_funding|virtual.?account/i.test(
      eventType
    );
  }

  private async handleVirtualAccountCredit(
    provider: string,
    payload: Record<string, unknown>,
    webhookEventId: string
  ): Promise<void> {
    // Field names vary by provider. Payscribe collection webhook uses
    // `account_number`, `trans_id`, `amount` (major units), `currency`, and a
    // nested `transaction.session_id`. GAP: the exact Payscribe VA-credit
    // payload must be confirmed in sandbox (via /collections/virtual-accounts/
    // simulate-transfer) — the field lookups below are best-effort until then.
    const txn = (payload["transaction"] as Record<string, unknown> | undefined) ?? {};
    const providerAccountId =
      toStr(payload["accountId"]) ||
      toStr(payload["account_id"]) ||
      toStr(payload["account_number"]) ||
      toStr(txn["account_number"]);
    const providerEventId =
      toStr(payload["eventId"]) ||
      toStr(payload["event_id"]) ||
      toStr(payload["trans_id"]) ||
      toStr(txn["session_id"]) ||
      webhookEventId;
    // UNIT WARNING: Payscribe reports `amount` in MAJOR units (naira), whereas
    // this ledger uses minor units (kobo). A provider-specific normalization step
    // is required before this path goes live — do NOT assume `amount` is already
    // minor. Prefer an explicit `amountMinor` when the provider supplies one.
    const amountMinor = Number(payload["amountMinor"] ?? payload["amount"] ?? 0);
    const currency = toStr(payload["currency"], "NGN");

    if (!providerAccountId || amountMinor <= 0) {
      this.logger.warn(`Skipping VA credit webhook — missing accountId or non-positive amount`);
      return;
    }

    const virtualAccount = await this.prisma.client.virtualAccount.findFirst({
      where: { providerName: provider, providerAccountId }
    });

    if (!virtualAccount) {
      this.logger.warn(`VA credit webhook: no VirtualAccount for provider=${provider} accountId=${providerAccountId}`);
      return;
    }

    // Idempotency: skip if this event was already recorded
    const existing = await this.prisma.client.virtualAccountCredit.findUnique({
      where: { providerEventId }
    });
    if (existing) {
      this.logger.log(`VA credit already processed: providerEventId=${providerEventId}`);
      return;
    }

    await this.prisma.client.$transaction(async (tx) => {
      // Find or create the NGN wallet for this workspace
      const wallet = await tx.wallet.findFirst({
        where: { workspaceId: virtualAccount.workspaceId, currency }
      });

      if (!wallet) {
        this.logger.warn(`No wallet found for workspaceId=${virtualAccount.workspaceId} currency=${currency} — recording credit without ledger entry`);
        await tx.virtualAccountCredit.create({
          data: {
            virtualAccountId: virtualAccount.id,
            workspaceId: virtualAccount.workspaceId,
            providerEventId,
            providerReference: toStr(payload["reference"]),
            amountMinor,
            currency,
            senderName: toStr(payload["senderName"]) || null,
            senderAccount: toStr(payload["senderAccount"]) || null,
            status: "NO_WALLET"
          }
        });
        return;
      }

      const idempotencyKey = `va_credit:${virtualAccount.id}:${providerEventId}`;

      // Create the ledger entry (credit the workspace wallet)
      const ledgerEntry = await tx.ledgerEntry.create({
        data: {
          walletId: wallet.id,
          kind: "CREDIT",
          amountMinor,
          currency,
          reference: providerEventId,
          description: `Virtual account inbound credit from ${provider}`,
          idempotencyKey,
          sourceType: "VIRTUAL_ACCOUNT",
          sourceId: virtualAccount.id
        }
      });

      await tx.virtualAccountCredit.create({
        data: {
          virtualAccountId: virtualAccount.id,
          workspaceId: virtualAccount.workspaceId,
          providerEventId,
          providerReference: toStr(payload["reference"]),
          amountMinor,
          currency,
          senderName: toStr(payload["senderName"]) || null,
          senderAccount: toStr(payload["senderAccount"]) || null,
          creditLedgerEntryId: ledgerEntry.id,
          status: "CREDITED"
        }
      });
    });

    this.logger.log(`VA credited: virtualAccountId=${virtualAccount.id} amount=${amountMinor} ${currency}`);
  }

  // ─── Remittance Status Update ────────────────────────────────────────────────

  private isRemittanceEvent(eventType: string): boolean {
    return /remittance|transfer|payout/i.test(eventType);
  }

  private async handleRemittanceStatusUpdate(
    _provider: string,
    payload: Record<string, unknown>,
    _webhookEventId: string
  ): Promise<void> {
    const reference = toStr(payload["reference"]) || toStr(payload["transferId"]);
    if (!reference) {
      this.logger.warn("Remittance webhook: no reference in payload");
      return;
    }

    const transfer = await this.prisma.client.remittanceTransfer.findFirst({
      where: { providerReference: reference }
    });

    if (!transfer) {
      this.logger.warn(`Remittance webhook: no transfer found for reference=${reference}`);
      return;
    }

    const rawStatus = toStr(payload["status"]).toUpperCase();
    const nextStatus = this.mapRemittanceStatus(rawStatus);

    if (!nextStatus) {
      this.logger.warn(`Remittance webhook: unrecognised status "${rawStatus}" for transfer ${transfer.id}`);
      return;
    }

    // State-machine guard: only apply valid forward transitions
    if (!this.isValidRemittanceTransition(transfer.status, nextStatus)) {
      this.logger.warn(`Remittance webhook: ignoring ${transfer.status}→${nextStatus} transition for ${transfer.id}`);
      return;
    }

    await this.prisma.client.remittanceTransfer.update({
      where: { id: transfer.id },
      data: {
        status: nextStatus as RemittanceTransferStatus,
        ...(nextStatus === "COMPLETED" ? { completedAt: new Date() } : {})
      }
    });

    this.logger.log(`Remittance ${transfer.id} status: ${transfer.status} → ${nextStatus}`);
  }

  private mapRemittanceStatus(raw: string): string | null {
    const map: Record<string, string> = {
      PROCESSING: "PROCESSING",
      PENDING: "PROCESSING",
      COMPLETED: "COMPLETED",
      SUCCESS: "COMPLETED",
      SUCCESSFUL: "COMPLETED",
      FAILED: "FAILED",
      FAILURE: "FAILED",
      REJECTED: "FAILED",
      DISPUTED: "DISPUTED"
    };
    return map[raw] ?? null;
  }

  private isValidRemittanceTransition(current: string, next: string): boolean {
    const allowed: Record<string, string[]> = {
      QUOTED: ["CHARGED", "FAILED"],
      CHARGED: ["PROCESSING", "FAILED"],
      PROCESSING: ["COMPLETED", "FAILED", "DISPUTED"],
      COMPLETED: [],
      FAILED: [],
      DISPUTED: ["COMPLETED", "FAILED"]
    };
    return (allowed[current] ?? []).includes(next);
  }

  // ─── Card Events ─────────────────────────────────────────────────────────────

  private isCardEvent(eventType: string): boolean {
    return /card/i.test(eventType);
  }

  private async handleCardEvent(
    provider: string,
    payload: Record<string, unknown>,
    _webhookEventId: string
  ): Promise<void> {
    const providerCardId = toStr(payload["cardId"]) || toStr(payload["card_id"]);
    if (!providerCardId) {
      this.logger.warn("Card webhook: no cardId in payload");
      return;
    }

    const card = await this.prisma.client.virtualCard.findFirst({
      where: { providerName: provider, providerCardId }
    });

    if (!card) {
      this.logger.warn(`Card webhook: no VirtualCard for provider=${provider} cardId=${providerCardId}`);
      return;
    }

    const rawStatus = toStr(payload["status"]).toUpperCase();
    const nextStatus = this.mapCardStatus(rawStatus);

    if (!nextStatus) {
      this.logger.log(`Card webhook: no status change for card ${card.id} (status="${rawStatus}")`);
      return;
    }

    if (card.status === nextStatus) return;

    await this.prisma.client.virtualCard.update({
      where: { id: card.id },
      data: { status: nextStatus }
    });

    this.logger.log(`Card ${card.id} status: ${card.status} → ${nextStatus}`);
  }

  private mapCardStatus(raw: string): "ACTIVE" | "FROZEN" | "TERMINATED" | null {
    const map: Record<string, "ACTIVE" | "FROZEN" | "TERMINATED"> = {
      ACTIVE: "ACTIVE",
      UNFROZEN: "ACTIVE",
      FROZEN: "FROZEN",
      SUSPENDED: "FROZEN",
      TERMINATED: "TERMINATED",
      CLOSED: "TERMINATED",
      EXPIRED: "TERMINATED"
    };
    return map[raw] ?? null;
  }
}
