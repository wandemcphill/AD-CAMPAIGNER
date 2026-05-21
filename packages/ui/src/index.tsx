import type { ComponentPropsWithoutRef, ReactNode } from "react";

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export interface ButtonProps extends ComponentPropsWithoutRef<"button"> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}

export function Button({ className, variant = "primary", ...props }: ButtonProps) {
  const variants = {
    primary: "border-transparent bg-zinc-950 text-white hover:bg-zinc-800",
    secondary: "border-zinc-200 bg-white text-zinc-950 hover:bg-zinc-50",
    ghost: "border-transparent bg-transparent text-zinc-700 hover:bg-zinc-100",
    danger: "border-transparent bg-red-600 text-white hover:bg-red-700"
  };

  return (
    <button
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 rounded-md border px-4 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-sky-300 disabled:pointer-events-none disabled:opacity-50",
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
    neutral: "border-zinc-200 bg-zinc-50 text-zinc-700",
    success: "border-green-200 bg-green-50 text-green-700",
    warning: "border-orange-200 bg-orange-50 text-orange-700",
    danger: "border-red-200 bg-red-50 text-red-700",
    info: "border-sky-200 bg-sky-50 text-sky-700"
  };

  return (
    <span
      className={cn(
        "inline-flex whitespace-nowrap rounded-md border px-2 py-1 text-xs font-medium",
        tones[tone]
      )}
    >
      {children}
    </span>
  );
}

export function Panel({ className, ...props }: ComponentPropsWithoutRef<"section">) {
  return (
    <section
      className={cn("rounded-lg border border-zinc-200 bg-white shadow-sm", className)}
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
    neutral: "text-zinc-500",
    success: "text-green-600",
    warning: "text-orange-600",
    info: "text-sky-600"
  };

  return (
    <Panel className="p-4">
      <div className="text-sm text-zinc-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold tracking-normal text-zinc-950">{value}</div>
      <div className={cn("mt-2 text-sm", tones[tone])}>{detail}</div>
    </Panel>
  );
}
