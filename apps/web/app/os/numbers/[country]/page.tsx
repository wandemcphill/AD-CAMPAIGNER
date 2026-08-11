"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { CheckCircle2, ChevronLeft, MessageSquare, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

import { Badge, Button, Panel, PermissionDenied, cn } from "@fliptrybe/ui";
import { ProvisionStep } from "@fliptrybe/ui/components";

import { EmptyState, ErrorNotice, LoadingBlock } from "../../../campaigns/components";
import { isForbiddenError } from "../../../lib/api-client";
import {
  formatNaira,
  loadProducts,
  purchaseNumber,
  type VirtualNumberOrder,
  type VirtualNumberProduct
} from "../api";

type PurchaseStage = "idle" | "charging" | "provisioning" | "done" | "failed";

export default function NumbersProductListPage() {
  const params = useParams<{ country: string }>();
  const countryCode = params.country;

  const [products, setProducts] = useState<VirtualNumberProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [forbidden, setForbidden] = useState(false);

  const [selectedProduct, setSelectedProduct] = useState<VirtualNumberProduct>();
  const [stage, setStage] = useState<PurchaseStage>("idle");
  const [result, setResult] = useState<VirtualNumberOrder>();
  const [purchaseError, setPurchaseError] = useState<string>();

  const refresh = useCallback(async () => {
    setError(undefined);
    setForbidden(false);
    try {
      setProducts(await loadProducts(countryCode));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We could not load numbers for this country.");
      setForbidden(isForbiddenError(caught));
    } finally {
      setLoading(false);
    }
  }, [countryCode]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function confirmPurchase() {
    if (!selectedProduct) return;
    setPurchaseError(undefined);
    setStage("charging");
    try {
      setStage("provisioning");
      const order = await purchaseNumber(selectedProduct.id);
      setResult(order);
      setStage(order.status === "FULFILLED" ? "done" : "failed");
      if (order.status !== "FULFILLED") {
        setPurchaseError(order.failureReason ?? "This number could not be provisioned.");
      }
    } catch (caught) {
      setStage("failed");
      setPurchaseError(
        caught instanceof Error
          ? caught.message
          : "We could not complete this purchase. Your wallet was not charged."
      );
    }
  }

  function reset() {
    setSelectedProduct(undefined);
    setStage("idle");
    setResult(undefined);
    setPurchaseError(undefined);
  }

  if (forbidden) {
    return (
      <PermissionDenied>
        You do not have permission to view virtual numbers for this workspace. Contact your
        workspace owner if you believe this is a mistake.
      </PermissionDenied>
    );
  }

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl">
        <a
          className="inline-flex items-center gap-1 text-sm text-[var(--ft-text-muted)] hover:text-[var(--ft-text-primary)]"
          href="/os/numbers"
        >
          <ChevronLeft className="size-4" />
          All countries
        </a>

        <h1 className="mt-2 text-xl font-bold">Available numbers</h1>

        <ErrorNotice message={error} />

        {selectedProduct ? (
          <motion.div animate={{ opacity: 1 }} className="mt-6" initial={{ opacity: 0 }}>
            <Panel className="p-6">
              {stage === "done" && result ? (
                <div className="text-center">
                  <CheckCircle2 className="mx-auto size-10 text-[var(--ft-green)]" />
                  <h2 className="mt-3 text-lg font-semibold">Number provisioned</h2>
                  <p className="mt-1 text-sm text-[var(--ft-text-secondary)]">
                    {selectedProduct.displayName} is ready. Find it under My Numbers.
                  </p>
                  <div className="mt-4 flex justify-center gap-2">
                    <Button onClick={reset} variant="secondary">
                      Buy another
                    </Button>
                    <Button onClick={() => (window.location.href = "/os/numbers/mine")}>
                      View my numbers
                    </Button>
                  </div>
                </div>
              ) : stage === "failed" ? (
                <div className="text-center">
                  <h2 className="text-lg font-semibold text-[var(--ft-red)]">Purchase failed</h2>
                  <p className="mt-1 text-sm text-[var(--ft-text-secondary)]">{purchaseError}</p>
                  <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--ft-green)]/30 bg-[var(--ft-green-subtle)] p-3 text-xs text-[var(--ft-text-secondary)]">
                    Your wallet was not charged — a provisioning failure is always refunded automatically.
                  </div>
                  <Button className="mt-4" onClick={reset} variant="secondary">
                    Try again
                  </Button>
                </div>
              ) : (
                <>
                  <h2 className="text-sm font-medium text-[var(--ft-text-muted)]">Confirm purchase</h2>
                  <div className="mt-3 flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--ft-border)] p-4">
                    <div>
                      <div className="font-semibold">{selectedProduct.displayName}</div>
                      <div className="text-xs text-[var(--ft-text-muted)]">
                        SMS receive · {selectedProduct.durationDays} days
                      </div>
                    </div>
                    <div className="text-lg font-bold">
                      {formatNaira(selectedProduct.estimatedPriceMinorNgn)}
                    </div>
                  </div>

                  {stage === "idle" ? (
                    <div className="mt-4 flex gap-2">
                      <Button onClick={reset} variant="secondary">
                        Cancel
                      </Button>
                      <Button className="flex-1 justify-center" onClick={() => void confirmPurchase()}>
                        <Sparkles className="size-4" />
                        Confirm & pay
                      </Button>
                    </div>
                  ) : (
                    <div className="mt-5 grid gap-3">
                      <ProvisionStep done={true} label="Wallet charged" />
                      <ProvisionStep
                        active={stage === "provisioning"}
                        done={false}
                        label="Provisioning your number"
                      />
                    </div>
                  )}
                </>
              )}
            </Panel>
          </motion.div>
        ) : loading ? (
          <Panel className="mt-6 p-6">
            <LoadingBlock label="Loading numbers" />
          </Panel>
        ) : products.length === 0 ? (
          <Panel className="mt-6 p-6">
            <EmptyState
              copy="No number products are active for this country yet."
              icon={MessageSquare}
              title="Nothing available"
            />
          </Panel>
        ) : (
          <div className="mt-6 grid gap-2">
            {products.map((product) => (
              <button
                className={cn(
                  "flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-4 text-left transition hover:border-[var(--ft-accent)]/40"
                )}
                key={product.id}
                onClick={() => setSelectedProduct(product)}
                type="button"
              >
                <div>
                  <div className="font-semibold">{product.displayName}</div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-[var(--ft-text-muted)]">
                    <Badge tone="info">
                      <MessageSquare className="size-3" />
                      SMS
                    </Badge>
                    {product.durationDays} days
                  </div>
                </div>
                <div className="text-lg font-bold">{formatNaira(product.estimatedPriceMinorNgn)}</div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
