"use client";

import type { ReactNode } from "react";
import { FeatureFlagProvider } from "../lib/feature-flags";
import { OsShell } from "./shell";

export default function OsLayout({ children }: { children: ReactNode }) {
  return (
    <FeatureFlagProvider>
      <OsShell>{children}</OsShell>
    </FeatureFlagProvider>
  );
}
