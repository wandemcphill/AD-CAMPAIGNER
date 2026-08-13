"use client";

import { useState } from "react";
import { CalendarCheck, Save, Upload, UserCircle } from "lucide-react";

import { Button } from "@fliptrybe/ui";
import { Input } from "@fliptrybe/ui/components";
import { apiRequest } from "../../../lib/api-client";
import { useApiSession } from "../../../lib/use-session";

export default function ProfileSettingsPage() {
  const { session } = useApiSession();
  const [displayName, setDisplayName] = useState(session?.user.name ?? "");
  const [username, setUsername] = useState(session?.user.username ?? "");
  const [bio, setBio] = useState("");

  const [dateOfBirth, setDateOfBirth] = useState("");
  const [dobSaving, setDobSaving] = useState(false);
  const [dobMessage, setDobMessage] = useState<{ tone: "ok" | "error"; text: string }>();

  async function saveDateOfBirth() {
    if (!dateOfBirth) {
      setDobMessage({ tone: "error", text: "Please enter your date of birth." });
      return;
    }
    setDobSaving(true);
    setDobMessage(undefined);
    try {
      await apiRequest("me/date-of-birth", {
        method: "PATCH",
        body: JSON.stringify({ dateOfBirth })
      });
      setDobMessage({ tone: "ok", text: "Date of birth saved. Age-restricted features are now unlocked." });
    } catch (caught) {
      setDobMessage({
        tone: "error",
        text: caught instanceof Error ? caught.message : "Could not save your date of birth."
      });
    } finally {
      setDobSaving(false);
    }
  }

  return (
    <div className="grid gap-8">
      <div className="rounded-[var(--radius-xl)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-6">
        <div className="flex items-center gap-2">
          <UserCircle className="size-5 text-[var(--ft-accent)]" />
          <h2 className="font-semibold">Profile</h2>
        </div>

        <div className="mt-6 grid gap-5">
          <div className="flex items-center gap-4">
            <div className="grid size-20 place-items-center rounded-full border-2 border-dashed border-[var(--ft-border)] bg-[var(--ft-bg-surface)]">
              <Upload className="size-5 text-[var(--ft-text-muted)]" />
            </div>
            <div>
              <div className="text-sm font-medium">Profile photo</div>
              <div className="text-xs text-[var(--ft-text-muted)]">Visible to your team and on campaigns</div>
              <Button className="mt-2" variant="secondary">Upload</Button>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Input id="display-name" label="Display name" onChange={(e) => setDisplayName(e.currentTarget.value)} type="text" value={displayName} />
            <Input id="username" label="Username" onChange={(e) => setUsername(e.currentTarget.value)} type="text" value={username} />
          </div>

          <div className="grid gap-1.5">
            <label className="text-sm font-medium" htmlFor="bio">Bio</label>
            <textarea
              className="min-h-[80px] rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-4 py-3 text-sm outline-none focus:border-[var(--ft-accent)]"
              id="bio"
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell your team about yourself"
              value={bio}
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <Button><Save className="size-4" /> Save profile</Button>
        </div>
      </div>

      {/* Date of birth — required to unlock age-restricted features (18+) such as
          virtual accounts/cards, transfers, and creating ad campaigns. */}
      <div className="rounded-[var(--radius-xl)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-6">
        <div className="flex items-center gap-2">
          <CalendarCheck className="size-5 text-[var(--ft-accent)]" />
          <h2 className="font-semibold">Date of birth</h2>
        </div>
        <p className="mt-1 text-sm text-[var(--ft-text-secondary)]">
          We use this to confirm you meet the minimum age (18+) for financial products and ad
          campaigns. You only need to set this once.
        </p>

        <div className="mt-5 flex flex-wrap items-end gap-3">
          <div className="w-full max-w-[220px]">
            <Input
              id="date-of-birth"
              label="Date of birth"
              onChange={(e) => setDateOfBirth(e.currentTarget.value)}
              type="date"
              value={dateOfBirth}
            />
          </div>
          <Button disabled={dobSaving} onClick={() => void saveDateOfBirth()}>
            <Save className="size-4" /> {dobSaving ? "Saving..." : "Save"}
          </Button>
        </div>

        {dobMessage ? (
          <div
            className={
              dobMessage.tone === "ok"
                ? "mt-3 text-sm text-[var(--ft-green)]"
                : "mt-3 text-sm text-[var(--ft-red)]"
            }
          >
            {dobMessage.text}
          </div>
        ) : null}
      </div>
    </div>
  );
}
