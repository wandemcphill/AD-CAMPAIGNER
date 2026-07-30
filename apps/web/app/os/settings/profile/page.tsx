"use client";

import { useState } from "react";
import { Save, Upload, UserCircle } from "lucide-react";

import { Button } from "@fliptrybe/ui";
import { Input } from "@fliptrybe/ui/components";
import { useApiSession } from "../../../lib/use-session";

export default function ProfileSettingsPage() {
  const { session } = useApiSession();
  const [displayName, setDisplayName] = useState(session?.user.name ?? "");
  const [username, setUsername] = useState(session?.user.username ?? "");
  const [bio, setBio] = useState("");

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
    </div>
  );
}
