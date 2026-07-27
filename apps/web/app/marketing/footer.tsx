import { footerSignals } from "./data";

type MarketingFooterProps = {
  onToggleReducedMotion: () => void;
  reducedMotion: boolean;
};

export function MarketingFooter({ onToggleReducedMotion, reducedMotion }: MarketingFooterProps) {
  return (
    <footer className="relative z-10 border-t border-white/10 bg-[#050507] px-4 py-8 sm:px-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-5 text-sm text-white/56 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          {footerSignals.map((item) => (
            <span
              className="flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.035] px-3 py-2"
              key={item.label}
            >
              <item.icon className="size-4 text-[var(--flip-amber)]" />
              {item.label}
            </span>
          ))}
        </div>
        <button
          aria-pressed={reducedMotion}
          className="w-fit rounded-md border border-white/12 px-3 py-2 font-medium text-white/72 transition hover:border-white/24 hover:text-white"
          onClick={onToggleReducedMotion}
          type="button"
        >
          Motion {reducedMotion ? "reduced" : "active"}
        </button>
      </div>
    </footer>
  );
}
