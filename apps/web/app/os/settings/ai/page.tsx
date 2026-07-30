"use client";

import { useState } from "react";
import { Bot, Save, Sparkles, Zap } from "lucide-react";

import { Badge, Button } from "@fliptrybe/ui";
import { Toggle, Divider } from "@fliptrybe/ui/components";

export default function AiPreferencesPage() {
  const [autoSuggest, setAutoSuggest] = useState(true);
  const [aiCopywriting, setAiCopywriting] = useState(true);
  const [budgetOptimization, setBudgetOptimization] = useState(false);
  const [creativeTone, setCreativeTone] = useState("professional");

  return (
    <div className="grid gap-8">
      <div className="rounded-[var(--radius-xl)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-6">
        <div className="flex items-center gap-2">
          <Bot className="size-5 text-[var(--ft-accent)]" />
          <h2 className="font-semibold">AI Preferences</h2>
          <Badge tone="info">Beta</Badge>
        </div>
        <p className="mt-2 text-sm text-[var(--ft-text-secondary)]">
          Configure how FlipTrybe AI assists with your campaigns and creative work
        </p>

        <div className="mt-6 grid gap-5">
          <div className="flex items-center justify-between rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-4">
            <div className="flex items-center gap-3">
              <Sparkles className="size-5 text-[var(--ft-accent)]" />
              <div>
                <div className="text-sm font-medium">Auto-suggest campaign improvements</div>
                <div className="text-xs text-[var(--ft-text-muted)]">AI analyzes performance and suggests optimizations</div>
              </div>
            </div>
            <Toggle checked={autoSuggest} onChange={setAutoSuggest} />
          </div>

          <div className="flex items-center justify-between rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-4">
            <div className="flex items-center gap-3">
              <Zap className="size-5 text-[var(--ft-accent)]" />
              <div>
                <div className="text-sm font-medium">AI copywriting assistant</div>
                <div className="text-xs text-[var(--ft-text-muted)]">Generate ad copy, captions, and CTAs with AI</div>
              </div>
            </div>
            <Toggle checked={aiCopywriting} onChange={setAiCopywriting} />
          </div>

          <div className="flex items-center justify-between rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-4">
            <div className="flex items-center gap-3">
              <Bot className="size-5 text-[var(--ft-accent)]" />
              <div>
                <div className="text-sm font-medium">Auto budget optimization</div>
                <div className="text-xs text-[var(--ft-text-muted)]">Let AI redistribute budget across campaigns for best ROI</div>
              </div>
            </div>
            <Toggle checked={budgetOptimization} onChange={setBudgetOptimization} />
          </div>

          <Divider label="creative" />

          <div className="grid gap-1.5">
            <label className="text-sm font-medium" htmlFor="tone">Creative tone</label>
            <select
              className="h-11 rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-4 text-sm outline-none focus:border-[var(--ft-accent)]"
              id="tone"
              onChange={(e) => setCreativeTone(e.target.value)}
              value={creativeTone}
            >
              <option value="professional">Professional</option>
              <option value="casual">Casual & Friendly</option>
              <option value="bold">Bold & Energetic</option>
              <option value="minimal">Minimal & Clean</option>
            </select>
            <div className="text-xs text-[var(--ft-text-muted)]">Sets the default voice for AI-generated content</div>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <Button><Save className="size-4" /> Save preferences</Button>
        </div>
      </div>
    </div>
  );
}
