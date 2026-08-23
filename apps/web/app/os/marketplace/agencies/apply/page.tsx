"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { Briefcase, CheckCircle2 } from "lucide-react";

import { Badge, Button, Panel } from "@fliptrybe/ui";

import { ErrorNotice } from "../../../../campaigns/components";
import { applyAsAgency } from "../../../../marketplace/api";
import Link from "next/link";

const SPECIALTIES = [
  "Social Media",
  "PPC / Google",
  "SEO",
  "Video Production",
  "Influencer Marketing"
];

export default function ApplyAsAgencyPage() {
  const [name, setName] = useState("");
  const [specialty, setSpecialty] = useState<string>(SPECIALTIES[0] ?? "Social Media");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [packagesInput, setPackagesInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string>();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);

    if (!name.trim() || !specialty.trim() || !location.trim() || !description.trim()) {
      setError("Name, specialty, location, and description are required.");
      return;
    }

    setSubmitting(true);
    try {
      await applyAsAgency({
        name: name.trim(),
        specialty: specialty.trim(),
        location: location.trim(),
        description: description.trim(),
        packages: packagesInput
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      });
      setSubmitted(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not submit your application.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="px-4 py-6 sm:px-6 lg:px-8">
        <Panel className="mx-auto max-w-xl p-6 text-center">
          <CheckCircle2 className="mx-auto size-8 text-[var(--ft-green)]" />
          <h1 className="mt-3 text-lg font-semibold">Application submitted</h1>
          <p className="mt-2 text-sm text-[var(--ft-text-secondary)]">
            Our team will review your agency application. You can track its status from{" "}
            <Link className="text-[var(--ft-accent)]" href="/os/marketplace/applications">
              My Applications
            </Link>
            .
          </p>
          <Button className="mt-5" onClick={() => (window.location.href = "/os/marketplace/agencies")} variant="secondary">
            Back to Agency Marketplace
          </Button>
        </Panel>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-xl">
        <div className="flex items-center gap-2">
          <Briefcase className="size-5 text-[var(--ft-accent)]" />
          <Badge tone="info">Marketplace</Badge>
        </div>
        <h1 className="mt-3 text-xl font-bold">Apply as an Agency</h1>
        <p className="mt-1 text-sm text-[var(--ft-text-secondary)]">
          Get listed in the Agency Marketplace so brands can discover and hire you directly.
        </p>

        <ErrorNotice message={error} />

        <form className="mt-6 grid gap-4" onSubmit={(event) => void submit(event)}>
          <label className="grid gap-2 text-sm font-medium text-[var(--ft-text-secondary)]">
            Agency name
            <input
              className="h-11 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-[var(--ft-text-primary)]"
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Northline Growth Co."
              required
              value={name}
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-[var(--ft-text-secondary)]">
            Specialty
            <select
              className="h-11 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-[var(--ft-text-primary)]"
              onChange={(event) => setSpecialty(event.target.value)}
              value={specialty}
            >
              {SPECIALTIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2 text-sm font-medium text-[var(--ft-text-secondary)]">
            Location
            <input
              className="h-11 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-[var(--ft-text-primary)]"
              onChange={(event) => setLocation(event.target.value)}
              placeholder="e.g. Lagos, Nigeria"
              required
              value={location}
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-[var(--ft-text-secondary)]">
            Description
            <textarea
              className="min-h-28 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 py-2 text-[var(--ft-text-primary)]"
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What does your agency do, and what results have you delivered?"
              required
              value={description}
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-[var(--ft-text-secondary)]">
            Packages <span className="font-normal text-[var(--ft-text-muted)]">(comma-separated, optional)</span>
            <input
              className="h-11 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-[var(--ft-text-primary)]"
              onChange={(event) => setPackagesInput(event.target.value)}
              placeholder="e.g. Starter, Growth, Enterprise"
              value={packagesInput}
            />
          </label>

          <Button disabled={submitting} type="submit">
            {submitting ? "Submitting..." : "Submit application"}
          </Button>
        </form>
      </div>
    </div>
  );
}
