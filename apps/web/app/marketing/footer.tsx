import Link from "next/link";
import { footerSignals } from "./data";

type MarketingFooterProps = {
  onToggleReducedMotion: () => void;
  reducedMotion: boolean;
};

export function MarketingFooter({ onToggleReducedMotion, reducedMotion }: MarketingFooterProps) {
  return (
    <footer className="relative z-10 border-t border-white/10 bg-[#0B0F19] px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Main footer content */}
        <div className="flex flex-col gap-5 text-sm text-white/56 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            {footerSignals.map((item) => (
              <span
                className="flex items-center gap-2 rounded-[12px] border border-white/10 bg-white/[0.035] px-3 py-2"
                key={item.label}
              >
                <item.icon className="size-4 text-[var(--flip-primary)]" />
                {item.label}
              </span>
            ))}
          </div>
          <button
            aria-pressed={reducedMotion}
            className="w-fit rounded-[12px] border border-white/12 px-3 py-2 font-medium text-white/72 transition hover:border-white/24 hover:text-white"
            onClick={onToggleReducedMotion}
            type="button"
          >
            Motion {reducedMotion ? "reduced" : "active"}
          </button>
        </div>

        {/* Legal links */}
        <div className="border-t border-white/10 pt-6">
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-white/60">
            <Link href="/terms" className="transition hover:text-white">
              Terms of Service
            </Link>
            <div className="h-4 w-px bg-white/10" />
            <Link href="/privacy" className="transition hover:text-white">
              Privacy Policy
            </Link>
          </div>
        </div>

        {/* Copyright */}
        <div className="border-t border-white/10 pt-6 text-center text-xs text-white/50">
          © 2026 FlipTrybe. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
