import type { ComponentPropsWithoutRef, ReactNode } from "react";

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export type FliptrybeTheme = "studio" | "clay";

export const THEME_STORAGE_KEY = "ft-theme";
export const DEFAULT_THEME: FliptrybeTheme = "studio";
export const fliptrybeThemes: FliptrybeTheme[] = ["studio", "clay"];
export const themeInitScript = `(() => {
  try {
    const key = "${THEME_STORAGE_KEY}";
    const fallback = "${DEFAULT_THEME}";
    const isTheme = (value) => value === "clay" || value === "studio";
    const nextThemeLabel = (theme) => theme === "clay" ? "Studio" : "Clay";
    const syncToggles = (theme) => {
      const nextLabel = nextThemeLabel(theme);
      document.querySelectorAll("[data-ft-theme-toggle]").forEach((toggle) => {
        toggle.setAttribute("aria-pressed", theme === "clay" ? "true" : "false");
        toggle.setAttribute("aria-label", "Switch to " + nextLabel + " theme");
        toggle.setAttribute("title", "Switch to " + nextLabel + " theme");
      });
    };
    const applyTheme = (theme) => {
      document.documentElement.dataset.theme = theme;
      syncToggles(theme);
    };
    const stored = window.localStorage.getItem(key);
    const theme = isTheme(stored) ? stored : fallback;
    applyTheme(theme);
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => syncToggles(document.documentElement.dataset.theme === "clay" ? "clay" : "studio"));
    } else {
      syncToggles(theme);
    }
    document.addEventListener("click", function(event) {
      const target = event.target instanceof Element ? event.target.closest("[data-ft-theme-toggle]") : null;
      if (!target) return;
      const current = document.documentElement.dataset.theme === "clay" ? "clay" : "studio";
      const next = current === "studio" ? "clay" : "studio";
      applyTheme(next);
      window.localStorage.setItem(key, next);
    });
  } catch (error) {
    document.documentElement.dataset.theme = "${DEFAULT_THEME}";
  }
})();`;

export const focusRingClass =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ft-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--ft-bg-base)]";

export interface ButtonProps extends ComponentPropsWithoutRef<"button"> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}

export function Button({ className, variant = "primary", ...props }: ButtonProps) {
  const variants = {
    primary:
      "border-transparent bg-[var(--ft-accent)] text-[var(--ft-text-inverse)] shadow-[var(--shadow-xs)] hover:bg-[var(--ft-accent-dim)] hover:shadow-[0_0_0_3px_var(--ft-accent-glow)]",
    secondary:
      "border-[var(--ft-border-strong)] bg-[var(--ft-bg-surface)] text-[var(--ft-text-primary)] hover:border-[var(--ft-border-emphasis)] hover:bg-[var(--ft-bg-muted)]",
    ghost:
      "border-transparent bg-transparent text-[var(--ft-text-secondary)] hover:bg-[var(--ft-bg-muted)] hover:text-[var(--ft-text-primary)]",
    danger:
      "border-[var(--ft-red)]/50 bg-[var(--ft-red-subtle)] text-[var(--ft-red)] hover:bg-[var(--ft-red-hover)]"
  };

  return (
    <button
      className={cn(
        "inline-flex h-10 min-w-10 items-center justify-center gap-2 rounded-[var(--radius-sm)] border px-5 text-sm font-semibold tracking-normal transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
        focusRingClass,
        variants[variant],
        className
      )}
      {...props}
    />
  );
}

export function Badge({
  children,
  tone = "neutral"
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
}) {
  const tones = {
    neutral: "border-[var(--ft-border)] bg-[var(--ft-bg-muted)] text-[var(--ft-text-secondary)]",
    success: "border-[var(--ft-green)]/40 bg-[var(--ft-green-subtle)] text-[var(--ft-green)]",
    warning: "border-[var(--ft-yellow)]/40 bg-[var(--ft-yellow-subtle)] text-[var(--ft-yellow)]",
    danger: "border-[var(--ft-red)]/40 bg-[var(--ft-red-subtle)] text-[var(--ft-red)]",
    info: "border-[var(--ft-blue)]/40 bg-[var(--ft-blue-subtle)] text-[var(--ft-blue)]"
  };

  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-medium tracking-[0.04em] whitespace-nowrap uppercase",
        tones[tone]
      )}
    >
      {children}
    </span>
  );
}

type StatusTone = "neutral" | "success" | "warning" | "danger" | "info";

const campaignStatusVocabulary: Record<
  string,
  { label: string; tone: StatusTone; pulse?: boolean }
> = {
  ACTIVE: { label: "Campaign Live", pulse: true, tone: "success" },
  APPROVED: { label: "Plan Ready", tone: "info" },
  BRIEF_RECEIVED: { label: "Brief Received", tone: "warning" },
  CANCELLED: { label: "Cancelled", tone: "danger" },
  CHANGES_REQUESTED: { label: "Changes Requested", tone: "warning" },
  COMPLETED: { label: "Completed", tone: "neutral" },
  CREATIVE_IN_PROGRESS: { label: "Campaign Building", tone: "info" },
  DRAFT: { label: "Draft", tone: "neutral" },
  FAILED: { label: "On Hold", tone: "danger" },
  FULFILLED: { label: "Completed", tone: "neutral" },
  IN_PRODUCTION: { label: "Campaign Building", tone: "info" },
  IN_REVIEW: { label: "Under Review", tone: "warning" },
  PAID: { label: "Funded", tone: "success" },
  PAUSED: { label: "On Hold", tone: "neutral" },
  PENDING: { label: "Brief Received", tone: "warning" },
  PENDING_REVIEW: { label: "Brief Received", tone: "warning" },
  PLAN_SENT: { label: "Plan Ready", tone: "info" },
  PROCESSING: { label: "Under Review", tone: "warning" },
  QUEUED: { label: "Brief Received", tone: "warning" },
  READY: { label: "Plan Ready", tone: "info" },
  REJECTED: { label: "Rejected", tone: "danger" },
  REPORTING: { label: "Report Ready", tone: "info" },
  REQUIRES_ACTION: { label: "Invoice Due", tone: "warning" },
  RUNNING: { label: "Campaign Live", pulse: true, tone: "success" },
  SCHEDULED: { label: "Plan Ready", tone: "info" },
  SUBMITTED: { label: "Brief Received", tone: "warning" },
  WAITING: { label: "Under Review", tone: "warning" }
};

export function campaignStatusMeta(status: string) {
  const normalized = status.toUpperCase().replaceAll("-", "_").replaceAll(" ", "_");
  const direct = campaignStatusVocabulary[normalized];

  if (direct) {
    return direct;
  }
  if (normalized.includes("PAYMENT") || normalized.includes("INVOICE")) {
    return { label: "Invoice Due", tone: "warning" as const };
  }
  if (normalized.includes("LIVE") || normalized.includes("RUNNING")) {
    return { label: "Campaign Live", pulse: true, tone: "success" as const };
  }
  if (normalized.includes("REPORT")) {
    return { label: "Report Ready", tone: "info" as const };
  }
  if (normalized.includes("REVIEW")) {
    return { label: "Under Review", tone: "warning" as const };
  }
  if (normalized.includes("COMPLETE") || normalized.includes("DONE")) {
    return { label: "Completed", tone: "neutral" as const };
  }

  return { label: "Under Review", tone: "warning" as const };
}

export function Panel({ className, ...props }: ComponentPropsWithoutRef<"section">) {
  return (
    <section
      className={cn(
        "rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] shadow-[var(--shadow-sm)]",
        className
      )}
      {...props}
    />
  );
}

export function MetricCard({
  label,
  value,
  detail,
  tone = "neutral"
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "neutral" | "success" | "warning" | "info";
}) {
  const tones = {
    neutral: "text-[var(--ft-text-secondary)]",
    success: "text-[var(--ft-green)]",
    warning: "text-[var(--ft-yellow)]",
    info: "text-[var(--ft-blue)]"
  };

  return (
    <section className="rounded-[var(--radius-md)] bg-[var(--ft-bg-surface)] p-4">
      <div className="font-mono text-[11px] font-medium tracking-[0.04em] text-[var(--ft-text-muted)] uppercase">
        {label}
      </div>
      <div className="mt-2 font-mono text-2xl font-medium tracking-normal text-[var(--ft-text-primary)]">
        {value}
      </div>
      <div className={cn("mt-2 text-sm", tones[tone])}>{detail}</div>
    </section>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const meta = campaignStatusMeta(status);
  const dot = {
    neutral: "bg-[var(--ft-text-muted)]",
    success: "bg-[var(--ft-green)]",
    warning: "bg-[var(--ft-yellow)]",
    danger: "bg-[var(--ft-red)]",
    info: "bg-[var(--ft-blue)]"
  }[meta.tone];

  return (
    <Badge tone={meta.tone}>
      <span
        className={cn(
          "mr-1.5 inline-block size-1.5 rounded-full",
          meta.pulse ? "animate-[ft-pulse_1.5s_ease-in-out_infinite]" : "",
          dot
        )}
      />
      {meta.label}
    </Badge>
  );
}

export function PlatformChip({ platform }: { platform: string }) {
  const normalized = platform.toLowerCase();
  const kind = normalized.includes("instagram")
    ? "instagram"
    : normalized.includes("facebook") || normalized.includes("meta")
      ? "meta"
      : normalized.includes("tiktok")
        ? "tiktok"
        : "default";
  const styles = {
    default:
      "border-[var(--ft-platform-default-border)] bg-[var(--ft-platform-default-bg)] text-[var(--ft-platform-default-text)]",
    instagram:
      "border-[var(--ft-platform-instagram-border)] bg-[var(--ft-platform-instagram-bg)] text-[var(--ft-platform-instagram-text)]",
    meta: "border-[var(--ft-platform-meta-border)] bg-[var(--ft-platform-meta-bg)] text-[var(--ft-platform-meta-text)]",
    tiktok:
      "border-[var(--ft-platform-tiktok-border)] bg-[var(--ft-platform-tiktok-bg)] text-[var(--ft-platform-tiktok-text)]"
  }[kind];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[11px] font-medium tracking-[0.04em] uppercase",
        styles
      )}
    >
      <PlatformGlyph kind={kind} />
      {platform}
    </span>
  );
}

function PlatformGlyph({ kind }: { kind: "default" | "instagram" | "meta" | "tiktok" }) {
  if (kind === "instagram") {
    return (
      <svg aria-hidden="true" className="size-3.5" viewBox="0 0 16 16">
        <rect
          fill="none"
          height="11"
          rx="3"
          stroke="currentColor"
          strokeWidth="1.4"
          width="11"
          x="2.5"
          y="2.5"
        />
        <circle cx="8" cy="8" fill="none" r="2.1" stroke="currentColor" strokeWidth="1.4" />
        <circle cx="11.2" cy="4.8" fill="currentColor" r="0.8" />
      </svg>
    );
  }
  if (kind === "meta") {
    return (
      <svg aria-hidden="true" className="size-4" viewBox="0 0 18 12">
        <path
          d="M1.5 9.5C2.6 4.7 4.1 2 6 2c1.1 0 1.9.8 3 2.4C10.1 2.8 10.9 2 12 2c1.9 0 3.4 2.7 4.5 7.5-.7.5-1.5.5-2.3 0C13.4 6.5 12.6 5 11.9 5c-.5 0-1.1.7-1.9 2.1L9 8.8 8 7.1C7.2 5.7 6.6 5 6.1 5c-.7 0-1.5 1.5-2.3 4.5-.8.5-1.6.5-2.3 0Z"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.4"
        />
      </svg>
    );
  }
  if (kind === "tiktok") {
    return (
      <svg aria-hidden="true" className="size-3.5" viewBox="0 0 16 16">
        <path
          d="M9.8 2.4c.3 1.8 1.4 2.9 3 3.1v2.3a5 5 0 0 1-2.8-.9v3.2c0 2.2-1.4 3.5-3.5 3.5A3.4 3.4 0 0 1 3 10.1c0-2 1.5-3.4 3.4-3.4.4 0 .7 0 1 .1v2.4a2.1 2.1 0 0 0-.9-.2 1.1 1.1 0 0 0-1.2 1.1c0 .7.5 1.2 1.3 1.2.7 0 1.1-.4 1.1-1.4V2.4h2.1Z"
          fill="currentColor"
        />
      </svg>
    );
  }

  return <span className="font-mono text-[10px] text-[var(--ft-text-muted)]">AD</span>;
}

export function EmptyState({
  action,
  children,
  title
}: {
  action?: ReactNode;
  children: ReactNode;
  title: string;
}) {
  return (
    <div className="relative mx-auto grid min-h-56 max-w-md place-items-center overflow-hidden rounded-[var(--radius-md)] border border-dashed border-[var(--ft-border-strong)] bg-[var(--ft-bg-muted)] p-8 text-center">
      <div className="pointer-events-none absolute -top-6 font-mono text-8xl font-semibold text-[var(--ft-border)]/50">
        00
      </div>
      <div className="relative">
        <div className="text-base font-medium text-[var(--ft-text-primary)]">{title}</div>
        <div className="mt-2 text-sm leading-6 text-[var(--ft-text-secondary)]">{children}</div>
      </div>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function PermissionDenied({
  action,
  children,
  title = "403 — Unauthorized Access"
}: {
  action?: ReactNode;
  children?: ReactNode;
  title?: string;
}) {
  return (
    <div className="relative mx-auto grid min-h-56 max-w-md place-items-center overflow-hidden rounded-[var(--radius-md)] border border-[var(--ft-border-strong)] bg-[var(--ft-bg-muted)] p-8 text-center">
      <div className="relative">
        <div className="mx-auto grid size-12 place-items-center rounded-full border border-[var(--ft-red)]/40 bg-[var(--ft-red-subtle)]">
          <svg aria-hidden="true" className="size-6 text-[var(--ft-red)]" fill="none" viewBox="0 0 24 24">
            <rect height="11" rx="2" stroke="currentColor" strokeWidth="1.6" width="16" x="4" y="10" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
            <path d="m9.5 15 5 5m0-5-5 5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
          </svg>
        </div>
        <div className="mt-4 text-base font-medium text-[var(--ft-text-primary)]">{title}</div>
        <div className="mt-2 text-sm leading-6 text-[var(--ft-text-secondary)]">
          {children ??
            "Access denied. You do not have permission to view this page. Please contact your administrator."}
        </div>
      </div>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} />;
}

export function OtpCodeBoxes({
  className,
  code,
  label = "OTP code"
}: {
  className?: string;
  code?: string | null;
  label?: string;
}) {
  const normalized = (code ?? "").replace(/\s/g, "").slice(0, 6);
  const hasCode = normalized.length > 0;
  const characters = Array.from({ length: 6 }, (_, index) => normalized[index] ?? "");

  return (
    <div
      aria-label={hasCode ? `${label}: ${normalized.split("").join(" ")}` : `${label}: waiting`}
      aria-live="polite"
      className={cn("grid gap-2", className)}
      role="group"
    >
      <div className="font-mono text-[11px] font-medium tracking-[0.04em] text-[var(--ft-text-muted)] uppercase">
        {label}
      </div>
      <div className="grid grid-cols-6 gap-1.5 sm:gap-2">
        {characters.map((character, index) => (
          <span
            aria-hidden="true"
            className={cn(
              "grid aspect-square min-h-10 place-items-center rounded-[var(--radius-sm)] border font-mono text-lg font-semibold tabular-nums shadow-[var(--shadow-xs)]",
              character
                ? "border-[var(--ft-accent)] bg-[var(--ft-accent-subtle)] text-[var(--ft-text-primary)]"
                : "border-[var(--ft-border)] bg-[var(--ft-bg-muted)] text-[var(--ft-text-muted)]"
            )}
            key={`${index}-${character || "empty"}`}
          >
            {character || "-"}
          </span>
        ))}
      </div>
    </div>
  );
}

export function MetricStrip({
  items
}: {
  items: Array<{ label: string; value: string; detail?: string | undefined }>;
}) {
  return (
    <div className="grid overflow-hidden rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] md:grid-cols-2 xl:grid-cols-4">
      {items.map((item, index) => (
        <div
          className={cn(
            "p-4",
            index > 0 ? "border-t border-[var(--ft-border)] md:border-t-0 md:border-l" : ""
          )}
          key={item.label}
        >
          <div className="font-mono text-[11px] font-medium tracking-[0.04em] text-[var(--ft-text-muted)] uppercase">
            {item.label}
          </div>
          <div className="mt-2 font-mono text-2xl text-[var(--ft-text-primary)]">{item.value}</div>
          {item.detail ? (
            <div className="mt-1 text-sm text-[var(--ft-text-secondary)]">{item.detail}</div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export const campaignStatusTokens = {
  active: { border: "var(--ft-green)", tone: "success" },
  blocked: { border: "var(--ft-red)", tone: "danger" },
  completed: { border: "var(--ft-border-emphasis)", tone: "neutral" },
  draft: { border: "var(--ft-border-strong)", tone: "neutral" },
  live: { border: "var(--ft-green)", tone: "success" },
  paid: { border: "var(--ft-green)", tone: "success" },
  pending: { border: "var(--ft-yellow)", tone: "warning" },
  report: { border: "var(--ft-purple)", tone: "info" },
  review: { border: "var(--ft-blue)", tone: "info" }
} as const;

export const invoiceStatusTokens = {
  overdue: { border: "var(--ft-red)", tone: "danger" },
  paid: { border: "var(--ft-green)", tone: "success" },
  pending: { border: "var(--ft-yellow)", tone: "warning" }
} as const;

export const serviceCategoryTokens = {
  analytics: { color: "var(--ft-purple)", label: "Analytics / Reports" },
  branding: { color: "var(--ft-yellow)", label: "Branding" },
  content: { color: "var(--ft-purple)", label: "Content Production" },
  paidSocial: { color: "var(--ft-accent)", label: "Paid Social" },
  search: { color: "var(--ft-blue)", label: "SEO / Search" },
  web: { color: "var(--ft-blue)", label: "Web Design / Dev" }
} as const;

export const notificationToneTokens = {
  action: { tone: "warning", label: "Action required" },
  info: { tone: "info", label: "Info" },
  update: { tone: "success", label: "Update" }
} as const;

export function ThemeToggle({ className }: { className?: string }) {
  return (
    <button
      aria-label="Switch to Clay theme"
      aria-pressed={DEFAULT_THEME === "clay"}
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-full border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] px-3 text-xs font-semibold text-[var(--ft-text-secondary)] shadow-[var(--shadow-xs)] transition hover:border-[var(--ft-border-emphasis)] hover:text-[var(--ft-text-primary)]",
        focusRingClass,
        className
      )}
      data-ft-theme-toggle
      title="Switch to Clay theme"
      type="button"
    >
      <span className="grid size-4 place-items-center rounded-full border border-[var(--ft-border)] bg-[var(--ft-bg-muted)]">
        <span className="ft-only-studio size-2 rounded-full bg-[var(--ft-accent)]" />
        <span className="ft-only-clay size-2 rounded-full bg-[var(--ft-text-primary)]" />
      </span>
      <span className="ft-only-studio">Studio</span>
      <span className="ft-only-clay">Clay</span>
    </button>
  );
}

export function SummaryStatStrip({
  items,
  className
}: {
  items: Array<{ label: string; value: string | number }>;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "grid gap-3 rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] p-3 shadow-[var(--shadow-xs)] sm:grid-cols-3 lg:flex lg:items-center lg:justify-between",
        className
      )}
    >
      {items.map((item) => (
        <div className="flex items-baseline gap-2" key={item.label}>
          <span className="font-mono text-lg font-semibold text-[var(--ft-text-primary)]">
            {item.value}
          </span>
          <span className="text-sm text-[var(--ft-text-secondary)]">{item.label}</span>
        </div>
      ))}
    </section>
  );
}

export function FulfillmentStrip({
  steps,
  currentStep,
  variant = "compact",
  className
}: {
  steps: string[];
  currentStep: number;
  variant?: "compact" | "labeled";
  className?: string;
}) {
  return (
    <div className={cn("grid gap-2", className)}>
      <div className="grid grid-flow-col items-center gap-1">
        {steps.map((step, index) => {
          const done = index < currentStep;
          const active = index === currentStep;
          return (
            <div
              className="grid grid-cols-[auto_1fr] items-center gap-1 last:grid-cols-[auto]"
              key={step}
            >
              <span
                aria-label={step}
                className={cn(
                  "grid size-3 place-items-center rounded-full border transition",
                  done ? "border-[var(--ft-green)] bg-[var(--ft-green)]" : "",
                  active
                    ? "animate-[ft-pulse_1.5s_ease-out_infinite] border-[var(--ft-accent)] bg-[var(--ft-accent)]"
                    : "",
                  !done && !active
                    ? "border-[var(--ft-border-emphasis)] bg-[var(--ft-bg-surface)]"
                    : ""
                )}
                title={step}
              />
              {index < steps.length - 1 ? (
                <span
                  className={cn(
                    "h-0.5 min-w-5 rounded-full",
                    index < currentStep ? "bg-[var(--ft-green)]" : "bg-[var(--ft-border)]"
                  )}
                />
              ) : null}
            </div>
          );
        })}
      </div>
      {variant === "labeled" ? (
        <div className="grid grid-flow-col gap-2 text-center font-mono text-[10px] tracking-[0.04em] text-[var(--ft-text-muted)] uppercase">
          {steps.map((step) => (
            <span className="truncate" key={step}>
              {step}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function CampaignCard({
  budget,
  className,
  href,
  lastUpdated,
  name,
  platforms,
  progressLabel,
  serviceType = "Paid Social",
  status
}: {
  budget: string;
  className?: string;
  href?: string;
  lastUpdated: string;
  name: string;
  platforms: string[];
  progressLabel: string;
  serviceType?: string;
  status: string;
}) {
  const Wrapper = href ? "a" : "article";

  return (
    <Wrapper
      className={cn(
        "group grid gap-4 rounded-[var(--radius-md)] border border-l-[3px] border-[var(--ft-border)] border-l-[var(--ft-accent)] bg-[var(--ft-bg-surface)] p-4 shadow-[var(--shadow-sm)] transition hover:border-[var(--ft-accent)] hover:shadow-[var(--shadow-md)] active:scale-[0.99]",
        className
      )}
      href={href}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {platforms.slice(0, 3).map((platform) => (
            <PlatformChip key={platform} platform={platform} />
          ))}
        </div>
        <StatusBadge status={status} />
      </div>
      <div>
        <h3 className="line-clamp-2 text-base font-semibold text-[var(--ft-text-primary)]">
          {name}
        </h3>
        <div className="mt-2 inline-flex rounded-[var(--radius-xs)] bg-[var(--ft-bg-muted)] px-2 py-1 font-mono text-[10px] tracking-[0.04em] text-[var(--ft-text-muted)] uppercase">
          {serviceType}
        </div>
      </div>
      <FulfillmentStrip
        currentStep={Math.min(4, Math.max(0, Math.round(Number.parseInt(progressLabel, 10) / 25)))}
        steps={["Brief", "Strategy", "Creative", "Live", "Report"]}
      />
      <div className="flex items-center justify-between gap-3 border-t border-[var(--ft-border)] pt-3">
        <span className="font-mono text-sm font-semibold text-[var(--ft-text-primary)]">
          {budget}
        </span>
        <span className="font-mono text-[11px] tracking-[0.04em] text-[var(--ft-text-muted)] uppercase">
          {lastUpdated}
        </span>
      </div>
    </Wrapper>
  );
}

export function DeltaBadge({
  value,
  direction
}: {
  value: string;
  direction: "down" | "neutral" | "up";
}) {
  const classes = {
    down: "text-[var(--ft-red)]",
    neutral: "text-[var(--ft-text-muted)]",
    up: "text-[var(--ft-green)]"
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-mono text-[11px] font-semibold",
        classes[direction]
      )}
    >
      {direction === "up" ? "UP" : direction === "down" ? "DOWN" : "-"} {value}
    </span>
  );
}

export function ProofItem({
  detail,
  platform,
  title,
  type = "url",
  url
}: {
  detail?: string;
  platform?: string;
  title: string;
  type?: "file" | "image" | "url" | "video";
  url?: string;
}) {
  const icon =
    type === "video" ? "VID" : type === "image" ? "IMG" : type === "file" ? "PDF" : "URL";

  return (
    <a
      className="grid min-h-14 grid-cols-[auto_1fr_auto] items-center gap-3 rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] p-3 text-sm transition hover:border-[var(--ft-accent)]"
      href={url}
      rel="noreferrer"
      target={url ? "_blank" : undefined}
    >
      <span className="grid size-10 place-items-center rounded-[var(--radius-xs)] bg-[var(--ft-bg-surface)] font-mono text-[10px] text-[var(--ft-text-muted)]">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block truncate font-medium text-[var(--ft-text-primary)]">{title}</span>
        <span className="mt-1 block truncate text-xs text-[var(--ft-text-muted)]">
          {platform ? `${platform} - ` : ""}
          {detail ?? "Proof attached by Fliptrybe Ops"}
        </span>
      </span>
      <span className="font-mono text-[11px] tracking-[0.04em] text-[var(--ft-accent)] uppercase">
        View
      </span>
    </a>
  );
}

export function OperatorNote({
  author = "Fliptrybe Ops",
  children,
  timestamp
}: {
  author?: string;
  children: ReactNode;
  timestamp: string;
}) {
  return (
    <article className="rounded-r-[var(--radius-sm)] border-l-2 border-[var(--ft-accent)] bg-[var(--ft-accent-subtle)] p-3">
      <div className="flex items-center gap-2 text-xs text-[var(--ft-text-muted)]">
        <span className="grid size-6 place-items-center rounded-full bg-[var(--ft-accent)] font-mono text-[10px] text-[var(--ft-text-inverse)]">
          FT
        </span>
        <span className="font-medium text-[var(--ft-text-primary)]">{author}</span>
        <span>-</span>
        <span>{timestamp}</span>
      </div>
      <div className="mt-2 text-sm leading-6 text-[var(--ft-text-secondary)]">{children}</div>
    </article>
  );
}

export function TimelineEvent({
  children,
  timestamp,
  title,
  type = "system"
}: {
  children?: ReactNode;
  timestamp: string;
  title: string;
  type?: "milestone" | "operator" | "system";
}) {
  if (type === "operator") {
    return <OperatorNote timestamp={timestamp}>{children ?? title}</OperatorNote>;
  }

  return (
    <article className="relative grid gap-1 border-l border-[var(--ft-border)] pl-5">
      <span
        className={cn(
          "absolute top-1 -left-1.5 size-3 rounded-full border-2 border-[var(--ft-bg-surface)]",
          type === "milestone" ? "bg-[var(--ft-purple)]" : "bg-[var(--ft-text-muted)]"
        )}
      />
      <div className="font-medium text-[var(--ft-text-primary)]">{title}</div>
      <div className="font-mono text-[11px] tracking-[0.04em] text-[var(--ft-text-muted)] uppercase">
        {timestamp}
      </div>
      {children ? (
        <div className="text-sm leading-6 text-[var(--ft-text-secondary)]">{children}</div>
      ) : null}
    </article>
  );
}

export function InvoiceCard({
  amount,
  campaign,
  due,
  invoiceNumber,
  status
}: {
  amount: string;
  campaign: string;
  due: string;
  invoiceNumber: string;
  status: "overdue" | "paid" | "pending";
}) {
  const meta = invoiceStatusTokens[status];

  return (
    <article
      className="grid gap-3 rounded-[var(--radius-md)] border border-t-[3px] border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-4 shadow-[var(--shadow-sm)]"
      style={{ borderTopColor: meta.border }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="font-mono text-[11px] tracking-[0.04em] text-[var(--ft-text-muted)] uppercase">
          {invoiceNumber}
        </div>
        <Badge tone={meta.tone}>{status}</Badge>
      </div>
      <div className="font-mono text-2xl font-semibold text-[var(--ft-text-primary)]">{amount}</div>
      <div className="text-sm text-[var(--ft-text-secondary)]">{campaign}</div>
      <div className="text-xs text-[var(--ft-text-muted)]">
        {due} - Payment funds campaign operations managed by the Fliptrybe team.
      </div>
    </article>
  );
}

export function ReportCard({
  action,
  budget,
  campaign,
  metrics,
  period,
  platform,
  summary,
  title,
  variant = "published"
}: {
  action?: ReactNode;
  budget?: string;
  campaign: string;
  metrics: Array<{ label: string; value: string }>;
  period: string;
  platform?: string;
  summary: string;
  title: string;
  variant?: "live" | "pending" | "published";
}) {
  const meta = {
    live: { border: "var(--ft-green)", label: "Live", tone: "success" as const },
    pending: { border: "var(--ft-border-emphasis)", label: "Locked", tone: "warning" as const },
    published: { border: "var(--ft-purple)", label: "Published", tone: "info" as const }
  }[variant];

  return (
    <article
      className={cn(
        "grid gap-4 rounded-[var(--radius-md)] border border-l-[3px] border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-4 shadow-[var(--shadow-sm)]",
        variant === "pending" ? "border-dashed" : ""
      )}
      style={{ borderLeftColor: meta.border }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-[var(--ft-text-primary)]">{title}</h3>
          <p className="mt-1 text-sm text-[var(--ft-text-muted)]">
            {campaign} - {period}
          </p>
          {platform || budget ? (
            <div className="mt-2 flex flex-wrap gap-2 font-mono text-[10px] tracking-[0.04em] text-[var(--ft-text-muted)] uppercase">
              {platform ? <span>{platform}</span> : null}
              {budget ? <span>{budget}</span> : null}
            </div>
          ) : null}
        </div>
        <Badge tone={meta.tone}>{meta.label}</Badge>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {metrics.slice(0, 3).map((metric) => (
          <div
            className="rounded-[var(--radius-sm)] bg-[var(--ft-bg-muted)] p-3 text-center"
            key={metric.label}
          >
            <div className="font-mono text-xl font-semibold text-[var(--ft-text-primary)]">
              {metric.value}
            </div>
            <div className="mt-1 font-mono text-[10px] tracking-[0.04em] text-[var(--ft-text-muted)] uppercase">
              {metric.label}
            </div>
          </div>
        ))}
      </div>
      <p className="text-sm leading-6 text-[var(--ft-text-secondary)]">{summary}</p>
      {action}
    </article>
  );
}

export function WalletBalance({
  action,
  balance,
  warning
}: {
  action?: ReactNode;
  balance: string;
  warning?: string;
}) {
  return (
    <section className="rounded-[var(--radius-md)] border border-[var(--ft-accent)]/35 bg-[var(--ft-bg-surface)] p-6 text-center shadow-[var(--shadow-sm)]">
      {warning ? (
        <div className="mb-4 rounded-[var(--radius-sm)] bg-[var(--ft-yellow-subtle)] px-3 py-2 text-sm text-[var(--ft-yellow)]">
          {warning}
        </div>
      ) : null}
      <div className="font-mono text-[11px] tracking-[0.04em] text-[var(--ft-text-muted)] uppercase">
        Available balance
      </div>
      <div className="mt-3 font-mono text-4xl font-semibold text-[var(--ft-text-primary)]">
        {balance}
      </div>
      {action ? <div className="mt-5">{action}</div> : null}
    </section>
  );
}

export function WizardStepBar({ current, steps }: { current: number; steps: string[] }) {
  return (
    <nav className="grid gap-2 sm:grid-cols-5">
      {steps.map((step, index) => (
        <div
          className={cn(
            "rounded-[var(--radius-sm)] border px-3 py-2 text-sm",
            index === current
              ? "border-[var(--ft-accent)] bg-[var(--ft-accent-subtle)] text-[var(--ft-text-primary)]"
              : index < current
                ? "border-[var(--ft-green)]/35 bg-[var(--ft-green-subtle)] text-[var(--ft-green)]"
                : "border-[var(--ft-border)] bg-[var(--ft-bg-surface)] text-[var(--ft-text-secondary)]"
          )}
          key={step}
        >
          <span className="font-mono text-[11px]">{index + 1}</span> {step}
        </div>
      ))}
    </nav>
  );
}

export function ContextualHelpCard({ children, title }: { children: ReactNode; title: string }) {
  return (
    <aside className="rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-sunken)] p-4">
      <div className="font-semibold text-[var(--ft-text-primary)]">{title}</div>
      <div className="mt-2 text-sm leading-6 text-[var(--ft-text-secondary)]">{children}</div>
    </aside>
  );
}

export function PlatformSelectCard({
  checked,
  description,
  platform
}: {
  checked?: boolean;
  description: string;
  platform: string;
}) {
  return (
    <div
      className={cn(
        "grid min-h-24 gap-2 rounded-[var(--radius-md)] border p-4 transition",
        checked
          ? "border-[var(--ft-accent)] bg-[var(--ft-accent-subtle)] shadow-[0_0_0_3px_var(--ft-accent-glow)]"
          : "border-[var(--ft-border)] bg-[var(--ft-bg-surface)] hover:border-[var(--ft-accent)]"
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <PlatformChip platform={platform} />
        {checked ? (
          <span
            aria-label="Selected"
            className="grid size-5 place-items-center rounded-full bg-[var(--ft-accent)] text-transparent before:block before:size-2 before:rounded-full before:bg-[var(--ft-text-inverse)] before:content-['']"
          >
            <span aria-hidden="true" />
          </span>
        ) : null}
      </div>
      <div className="text-sm text-[var(--ft-text-secondary)]">{description}</div>
    </div>
  );
}

export function UploadZone({
  children,
  error,
  hint,
  label
}: {
  children?: ReactNode;
  error?: string | undefined;
  hint: string;
  label: string;
}) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-lg)] border-2 border-dashed bg-[var(--ft-bg-muted)] p-8 text-center transition hover:border-[var(--ft-accent)] hover:bg-[var(--ft-accent-subtle)]",
        error ? "border-[var(--ft-red)]" : "border-[var(--ft-border-strong)]"
      )}
    >
      <div className="text-sm font-semibold text-[var(--ft-text-primary)]">{label}</div>
      <p className="mt-2 text-xs leading-5 text-[var(--ft-text-muted)]">{hint}</p>
      {children ? <div className="mt-4">{children}</div> : null}
      {error ? <p className="mt-3 text-sm text-[var(--ft-red)]">{error}</p> : null}
    </div>
  );
}

export function MobileAdminCard({
  action,
  meta,
  status,
  title
}: {
  action?: ReactNode;
  meta: Array<{ label: string; value: ReactNode }>;
  status?: ReactNode;
  title: string;
}) {
  return (
    <article className="grid gap-3 rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-4 shadow-[var(--shadow-sm)] md:hidden">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold text-[var(--ft-text-primary)]">{title}</h3>
        {status}
      </div>
      <div className="grid gap-2">
        {meta.map((item) => (
          <div className="flex justify-between gap-3 text-sm" key={item.label}>
            <span className="text-[var(--ft-text-muted)]">{item.label}</span>
            <span className="text-right font-medium text-[var(--ft-text-primary)]">
              {item.value}
            </span>
          </div>
        ))}
      </div>
      {action}
    </article>
  );
}

export function OpsTaskChecklist({ items }: { items: Array<{ done?: boolean; label: string }> }) {
  return (
    <div className="grid gap-2">
      {items.map((item) => (
        <div
          className="flex items-center gap-3 rounded-[var(--radius-sm)] border border-[var(--ft-border)] bg-[var(--ft-bg-muted)] px-3 py-2 text-sm text-[var(--ft-text-secondary)]"
          key={item.label}
        >
          <span
            className={cn(
              "grid size-5 place-items-center rounded-full border font-mono text-[10px]",
              item.done
                ? "border-[var(--ft-green)] bg-[var(--ft-green)] text-transparent before:block before:size-2 before:rounded-full before:bg-[var(--ft-text-inverse)] before:content-['']"
                : "border-[var(--ft-border-emphasis)] text-[var(--ft-text-muted)]"
            )}
          >
            {item.done ? <span aria-hidden="true" /> : ""}
          </span>
          {item.label}
        </div>
      ))}
    </div>
  );
}
