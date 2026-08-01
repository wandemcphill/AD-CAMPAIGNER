"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";

import { Button, cn } from "@fliptrybe/ui";
import { AlertBanner, Checkbox, Input, ProvisionStep } from "@fliptrybe/ui/components";

import { loadVoucherProducts, redeemVoucher, type VoucherProduct } from "./api";

type RedemptionFormProps = {
  voucherId: string;
  productId: string;
};

type RedemptionFormData = {
  url: string;
  phoneNumber: string;
  confirmation: boolean;
};

const initialFormData: RedemptionFormData = {
  url: "",
  phoneNumber: "",
  confirmation: false
};

function validateForm(data: RedemptionFormData, product: VoucherProduct | null) {
  const errors: string[] = [];
  const url = data.url.trim();
  const phoneNumber = data.phoneNumber.trim();
  const isSmmProduct = product?.category.toUpperCase() === "SMM";

  if (!url) {
    errors.push("URL is required");
  } else {
    try {
      const parsedUrl = new URL(url);

      if (parsedUrl.hostname !== "www.tiktok.com" && parsedUrl.hostname !== "tiktok.com") {
        errors.push("URL must be a valid TikTok link");
      }
    } catch {
      errors.push("Invalid URL format");
    }
  }

  if (isSmmProduct) {
    if (!phoneNumber) {
      errors.push("Phone number is required");
    } else if (!/^\+?\d{7,15}$/.test(phoneNumber)) {
      errors.push("Invalid phone number format");
    }
  }

  if (!data.confirmation) {
    errors.push("Please confirm the terms and conditions");
  }

  return errors;
}

export function RedemptionForm({ voucherId, productId }: RedemptionFormProps) {
  const [product, setProduct] = useState<VoucherProduct | null>(null);
  const [formData, setFormData] = useState<RedemptionFormData>(initialFormData);
  const [loadingProduct, setLoadingProduct] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadProduct() {
      setLoadingProduct(true);
      setLoadError(null);

      try {
        const products = await loadVoucherProducts();
        const selectedProduct = products.find((item) => item.id === productId) ?? null;

        if (!active) return;

        setProduct(selectedProduct);
        setLoadError(selectedProduct ? null : "We could not find the product for this voucher.");
      } catch {
        if (active) {
          setProduct(null);
          setLoadError("We could not load product details right now. Refresh to try again.");
        }
      } finally {
        if (active) {
          setLoadingProduct(false);
        }
      }
    }

    void loadProduct();

    return () => {
      active = false;
    };
  }, [productId]);

  const validationErrors = useMemo(() => validateForm(formData, product), [formData, product]);
  const isValid = Boolean(product) && validationErrors.length === 0;
  const isSmmProduct = product?.category.toUpperCase() === "SMM";
  const formError = submitted ? submitError ?? validationErrors[0] ?? null : submitError;

  function handleChange<Field extends keyof RedemptionFormData>(
    field: Field,
    value: RedemptionFormData[Field]
  ) {
    setFormData((current) => ({ ...current, [field]: value }));
    setSubmitError(null);
  }

  async function submitRedemption() {
    setSubmitted(true);
    setSubmitError(null);

    const errors = validateForm(formData, product);

    if (errors.length > 0) {
      return;
    }

    setIsSubmitting(true);

    try {
      await redeemVoucher(voucherId, {
        url: formData.url.trim(),
        ...(isSmmProduct ? { phoneNumber: formData.phoneNumber.trim() } : {})
      });

      setFormData(initialFormData);
      setSubmitted(false);
      setSubmitError(null);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Redemption failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitRedemption();
  }

  if (loadError) {
    return <AlertBanner tone="danger">{loadError}</AlertBanner>;
  }

  if (loadingProduct || !product) {
    return <AlertBanner tone="warning">Loading product details...</AlertBanner>;
  }

  return (
    <div className="space-y-6">
      <ProvisionStep active done={isValid} label="Enter product details" />

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <Input
            error={submitted && validationErrors.some((message) => message.includes("URL")) ? "Invalid URL format" : undefined}
            label="URL"
            onChange={(event) => handleChange("url", event.target.value)}
            value={formData.url}
          />
        </div>

        {isSmmProduct ? (
          <div>
            <Input
              error={
                submitted && validationErrors.some((message) => message.includes("Phone number"))
                  ? "Invalid phone number"
                  : undefined
              }
              label="Phone Number"
              onChange={(event) => handleChange("phoneNumber", event.target.value)}
              value={formData.phoneNumber}
            />
          </div>
        ) : null}

        <Checkbox
          checked={formData.confirmation}
          onChange={(checked) => handleChange("confirmation", checked)}
        >
          I confirm I have read the terms and conditions for this redemption
        </Checkbox>

        {formError ? (
          <AlertBanner className="mt-2" tone="danger">
            {formError}
          </AlertBanner>
        ) : (
          <AlertBanner className="mt-2" tone={isValid ? "success" : "warning"}>
            {isValid ? "All fields are valid. You can proceed with redemption." : "Please complete the fields above"}
          </AlertBanner>
        )}

        <div className="flex justify-end">
          <Button
            className={cn(!isValid || isSubmitting ? "cursor-not-allowed" : undefined)}
            disabled={!isValid || isSubmitting}
            type="submit"
          >
            {isSubmitting ? "Processing..." : "Redeem Voucher"}
          </Button>
        </div>
      </form>

      <div className="mt-4 text-sm text-slate-600">
        <strong>Note:</strong> Redemption may take 1-72 hours depending on the SMM provider&apos;s processing time.
      </div>
    </div>
  );
}
