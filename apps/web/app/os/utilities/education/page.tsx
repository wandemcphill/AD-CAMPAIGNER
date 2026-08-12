"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

import { Button, Panel } from "@fliptrybe/ui";

import { ErrorNotice } from "../../../campaigns/components";
import {
  buyEducation,
  loadEducationPlans,
  verifyJamb,
  type BillsOrder,
  type EducationPlan,
  type MeterValidation
} from "../vtu-api";

function formatNaira(amountMinor: number) {
  return `₦${(amountMinor / 100).toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;
}

export default function EducationTabPage() {
  const [educationPlans, setEducationPlans] = useState<EducationPlan[]>([]);
  const [examType, setExamType] = useState<string>();
  const [eduPhone, setEduPhone] = useState("");
  const [profileId, setProfileId] = useState("");
  const [jambValidation, setJambValidation] = useState<MeterValidation>();
  const [jambValidating, setJambValidating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState<BillsOrder>();

  useEffect(() => {
    void loadEducationPlans()
      .then((plans) => {
        setEducationPlans(plans);
        setExamType((prev) => prev ?? plans[0]?.examType);
      })
      .catch(() => setEducationPlans([]));
  }, []);

  useEffect(() => {
    setJambValidation(undefined);
  }, [profileId]);

  const isJambExam = examType === "de" || (examType?.startsWith("utme") ?? false);
  const selectedEducationPlan = educationPlans.find((p) => p.examType === examType);

  async function submitVerifyJamb() {
    if (!profileId.trim()) return;
    setJambValidating(true);
    setError(undefined);
    setJambValidation(undefined);
    try {
      const result = await verifyJamb({ profileId: profileId.trim() });
      setJambValidation(result);
      if (!result.valid) {
        setError("JAMB profile verification failed. Check the profile ID.");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We could not verify this profile.");
    } finally {
      setJambValidating(false);
    }
  }

  async function submitEducation() {
    if (!examType || !eduPhone.trim()) return;
    if (isJambExam && (!profileId.trim() || !jambValidation?.valid)) return;
    setSubmitting(true);
    setError(undefined);
    setSuccess(undefined);
    try {
      const order = await buyEducation({
        examType,
        phoneNumber: eduPhone.trim(),
        ...(isJambExam ? { profileId: profileId.trim() } : {})
      });
      setSuccess(order);
      setEduPhone("");
      setProfileId("");
      setJambValidation(undefined);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "We could not complete this purchase. No wallet balance has moved."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <motion.div animate={{ opacity: 1 }} className="mt-6" initial={{ opacity: 0 }}>
        <Panel className="p-6 text-center">
          <CheckCircle2 className="mx-auto size-10 text-[var(--ft-green)]" />
          <h2 className="mt-3 text-lg font-semibold">
            {success.status === "DELIVERED" ? "Delivered" : "Order submitted"}
          </h2>
          <p className="mt-1 text-sm text-[var(--ft-text-secondary)]">
            {formatNaira(success.amountMinor)} charged to {success.msisdnMasked}.
          </p>
          {success.status === "AMBIGUOUS" && (
            <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--ft-yellow)]/30 bg-[var(--ft-yellow-subtle)] p-3 text-left text-xs leading-5 text-[var(--ft-text-secondary)]">
              Delivery could not be confirmed immediately. Our ops team is reviewing this order — you
              won&apos;t be double-charged either way.
            </div>
          )}
          <Button className="mt-4" onClick={() => setSuccess(undefined)} variant="secondary">
            Buy another
          </Button>
        </Panel>
      </motion.div>
    );
  }

  return (
    <motion.div animate={{ opacity: 1 }} className="mt-6" initial={{ opacity: 0 }}>
      <ErrorNotice message={error} />
      <Panel className="p-5">
        <div>
          <label className="mb-1 block text-xs text-[var(--ft-text-muted)]">Exam / PIN type</label>
          <select
            className="h-12 w-full rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-4 text-sm outline-none focus:border-[var(--ft-accent)]"
            onChange={(e) => setExamType(e.target.value)}
            value={examType ?? ""}
          >
            {educationPlans.map((p) => (
              <option key={p.examType} value={p.examType}>
                {p.displayName} — {formatNaira(p.costMinor)}
              </option>
            ))}
          </select>
        </div>

        {isJambExam && (
          <div className="mt-4">
            <label className="mb-1 block text-xs text-[var(--ft-text-muted)]">JAMB profile ID</label>
            <div className="flex gap-2">
              <input
                className="h-12 flex-1 rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-4 text-lg outline-none placeholder:text-[var(--ft-text-muted)] focus:border-[var(--ft-accent)]"
                onChange={(e) => setProfileId(e.target.value)}
                placeholder="1234567890"
                value={profileId}
              />
              <Button
                disabled={!profileId.trim() || jambValidating}
                onClick={() => void submitVerifyJamb()}
                variant="secondary"
              >
                {jambValidating ? "Checking..." : "Verify"}
              </Button>
            </div>
            {jambValidation?.valid && (
              <div className="mt-2 rounded-[var(--radius-md)] border border-[var(--ft-green)]/30 bg-[var(--ft-green)]/5 p-3 text-sm">
                <div className="font-medium">{jambValidation.customerName ?? "Profile verified"}</div>
              </div>
            )}
          </div>
        )}

        <div className="mt-4">
          <label className="mb-1 block text-xs text-[var(--ft-text-muted)]">Phone number</label>
          <input
            className="h-12 w-full rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-4 text-lg outline-none placeholder:text-[var(--ft-text-muted)] focus:border-[var(--ft-accent)]"
            onChange={(e) => setEduPhone(e.target.value)}
            placeholder="0803 000 0000"
            value={eduPhone}
          />
        </div>

        <Button
          className="mt-4 w-full justify-center"
          disabled={
            !examType ||
            !eduPhone.trim() ||
            (isJambExam && (!profileId.trim() || !jambValidation?.valid)) ||
            submitting
          }
          onClick={() => void submitEducation()}
        >
          <Sparkles className="size-4" />
          {submitting
            ? "Processing..."
            : `Buy ${selectedEducationPlan ? formatNaira(selectedEducationPlan.costMinor) : ""} PIN`}
        </Button>
      </Panel>
    </motion.div>
  );
}
