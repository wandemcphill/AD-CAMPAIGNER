"use client";

import { ArrowUpRight, Sparkles } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";

import { trackHomepageEvent } from "./analytics";

type CommandBarProps = {
  isGenerating: boolean;
  onGenerate: (prompt: string) => void;
  prompt: string;
};

const fallbackPrompt = "I sell shoes in Lagos.";

export function CommandBar({ isGenerating, onGenerate, prompt }: CommandBarProps) {
  const [value, setValue] = useState(prompt || fallbackPrompt);

  useEffect(() => {
    setValue(prompt || fallbackPrompt);
  }, [prompt]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextPrompt = value.trim() || fallbackPrompt;
    trackHomepageEvent("command_generated", {
      promptLength: nextPrompt.length,
      source: "hero"
    });
    onGenerate(nextPrompt);
  };

  return (
    <form
      className="group relative mx-auto mt-6 w-full max-w-3xl rounded-[12px] border border-white/12 bg-white/[0.07] p-2 shadow-[0_30px_120px_rgba(0,0,0,0.5)] backdrop-blur-2xl"
      onSubmit={submit}
    >
      <div className="absolute inset-x-8 -top-px h-px bg-[linear-gradient(90deg,transparent,var(--flip-primary),var(--flip-accent),transparent)]" />
      <label className="sr-only" htmlFor="growth-command">
        Growth command
      </label>
      <div className="grid gap-2 sm:grid-cols-[auto_1fr_auto] sm:items-center">
        <span className="flex h-11 items-center gap-2 rounded-[12px] border border-white/10 bg-black/24 px-3 font-mono text-xs uppercase tracking-[0.22em] text-white/50">
          <Sparkles className="size-4 text-[var(--flip-primary)]" />
          Generate
        </span>
        <input
          className="h-12 min-w-0 rounded-md border border-transparent bg-transparent px-2 text-base text-white outline-none placeholder:text-white/36"
          id="growth-command"
          onChange={(event) => setValue(event.target.value)}
          value={value}
        />
        <button
          className="flex h-12 items-center justify-center gap-2 rounded-[12px] bg-[var(--flip-primary)] px-5 text-sm font-bold text-white transition hover:bg-[var(--flip-accent)] disabled:cursor-wait disabled:bg-white/50"
          disabled={isGenerating}
          type="submit"
        >
          {isGenerating ? "Assembling" : "Run"}
          <ArrowUpRight className="size-4" />
        </button>
      </div>
    </form>
  );
}
