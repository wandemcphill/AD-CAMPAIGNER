"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { CheckCircle2, Globe } from "lucide-react";

import { Badge, Button, Panel } from "@fliptrybe/ui";

import { ErrorNotice } from "../../../../campaigns/components";
import { applyAsCreator } from "../../../../marketplace/api";

const NICHES = ["Beauty", "Tech", "Fashion", "Food", "Fitness", "Lifestyle"];

export default function ApplyAsCreatorPage() {
  const [name, setName] = useState("");
  const [niche, setNiche] = useState<string>(NICHES[0] ?? "Beauty");
  const [bio, setBio] = useState("");
  const [followerCount, setFollowerCount] = useState("");
  const [languagesInput, setLanguagesInput] = useState("");
  const [platformsInput, setPlatformsInput] = useState("");
  const [rateInput, setRateInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string>();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);

    if (!name.trim() || !niche.trim() || !bio.trim()) {
      setError("Name, niche, and bio are required.");
      return;
    }

    const parsedFollowers = followerCount.trim() ? Number(followerCount) : undefined;
    if (parsedFollowers !== undefined && (!Number.isFinite(parsedFollowers) || parsedFollowers < 0)) {
      setError("Follower count must be a valid non-negative number.");
      return;
    }

    const parsedRate = rateInput.trim() ? Math.round(Number(rateInput) * 100) : undefined;
    if (parsedRate !== undefined && (!Number.isFinite(parsedRate) || parsedRate < 0)) {
      setError("Rate must be a valid non-negative amount.");
      return;
    }

    setSubmitting(true);
    try {
      await applyAsCreator({
        name: name.trim(),
        niche: niche.trim(),
        bio: bio.trim(),
        ...(parsedFollowers !== undefined ? { followerCount: parsedFollowers } : {}),
        languages: languagesInput
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        platforms: platformsInput
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        ...(parsedRate !== undefined ? { rateMinor: parsedRate } : {})
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
            Our team will review your creator application. You can track its status from{" "}
            <a className="text-[var(--ft-accent)]" href="/os/marketplace/applications">
              My Applications
            </a>
            .
          </p>
          <Button className="mt-5" onClick={() => (window.location.href = "/os/marketplace/creators")} variant="secondary">
            Back to Creator Marketplace
          </Button>
        </Panel>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-xl">
        <div className="flex items-center gap-2">
          <Globe className="size-5 text-[var(--ft-accent)]" />
          <Badge tone="info">Marketplace</Badge>
        </div>
        <h1 className="mt-3 text-xl font-bold">Apply as a Creator</h1>
        <p className="mt-1 text-sm text-[var(--ft-text-secondary)]">
          Get listed in the Creator Marketplace so brands can find and book you for campaigns.
        </p>

        <ErrorNotice message={error} />

        <form className="mt-6 grid gap-4" onSubmit={(event) => void submit(event)}>
          <label className="grid gap-2 text-sm font-medium text-[var(--ft-text-secondary)]">
            Creator / handle name
            <input
              className="h-11 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-[var(--ft-text-primary)]"
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Ada Reviews"
              required
              value={name}
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-[var(--ft-text-secondary)]">
            Niche
            <select
              className="h-11 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-[var(--ft-text-primary)]"
              onChange={(event) => setNiche(event.target.value)}
              value={niche}
            >
              {NICHES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2 text-sm font-medium text-[var(--ft-text-secondary)]">
            Bio
            <textarea
              className="min-h-28 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 py-2 text-[var(--ft-text-primary)]"
              onChange={(event) => setBio(event.target.value)}
              placeholder="Tell brands about your audience and content style."
              required
              value={bio}
            />
          </label>

          <div className="grid grid-cols-2 gap-4">
            <label className="grid gap-2 text-sm font-medium text-[var(--ft-text-secondary)]">
              Follower count <span className="font-normal text-[var(--ft-text-muted)]">(optional)</span>
              <input
                className="h-11 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-[var(--ft-text-primary)]"
                min={0}
                onChange={(event) => setFollowerCount(event.target.value)}
                placeholder="e.g. 25000"
                type="number"
                value={followerCount}
              />
            </label>

            <label className="grid gap-2 text-sm font-medium text-[var(--ft-text-secondary)]">
              Rate per post (₦) <span className="font-normal text-[var(--ft-text-muted)]">(optional)</span>
              <input
                className="h-11 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-[var(--ft-text-primary)]"
                min={0}
                onChange={(event) => setRateInput(event.target.value)}
                placeholder="e.g. 50000"
                type="number"
                value={rateInput}
              />
            </label>
          </div>

          <label className="grid gap-2 text-sm font-medium text-[var(--ft-text-secondary)]">
            Platforms <span className="font-normal text-[var(--ft-text-muted)]">(comma-separated, optional)</span>
            <input
              className="h-11 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-[var(--ft-text-primary)]"
              onChange={(event) => setPlatformsInput(event.target.value)}
              placeholder="e.g. Instagram, TikTok, YouTube"
              value={platformsInput}
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-[var(--ft-text-secondary)]">
            Languages <span className="font-normal text-[var(--ft-text-muted)]">(comma-separated, optional)</span>
            <input
              className="h-11 rounded-md border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 text-[var(--ft-text-primary)]"
              onChange={(event) => setLanguagesInput(event.target.value)}
              placeholder="e.g. English, Yoruba"
              value={languagesInput}
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
