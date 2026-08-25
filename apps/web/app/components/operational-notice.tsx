import type { OperationalSeverity } from "../operations/mega4-operational-state";

const TONE: Record<OperationalSeverity, string> = {
  info: "border-[var(--ft-border)] bg-[var(--ft-bg-muted)]",
  success: "border-emerald-500/20 bg-emerald-500/5",
  warning: "border-amber-500/25 bg-amber-500/5",
  critical: "border-red-500/25 bg-red-500/5"
};

export function OperationalNotice({
  severity,
  title,
  children
}: Readonly<{
  severity: OperationalSeverity;
  title: string;
  children: React.ReactNode;
}>) {
  return (
    <section className={`rounded-2xl border p-4 ${TONE[severity]}`} role={severity === "critical" ? "alert" : "status"}>
      <p className="text-sm font-semibold text-[var(--ft-text-primary)]">{title}</p>
      <div className="mt-1 text-xs leading-5 text-[var(--ft-text-secondary)]">{children}</div>
    </section>
  );
}
