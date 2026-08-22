"use client";

import type { ReactNode } from "react";
import { FeatureFlagProvider } from "../lib/feature-flags";
import { OsShellFixed } from "./shell-fixed";

export default function OsLayout({ children }: { children: ReactNode }) {
  return (
    <FeatureFlagProvider>
      <OsShellFixed>{children}</OsShellFixed>
    </FeatureFlagProvider>
  );
}
