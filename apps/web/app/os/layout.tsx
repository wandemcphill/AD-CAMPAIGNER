"use client";

import type { ReactNode } from "react";
import { FeatureFlagProvider } from "../lib/feature-flags";
import { TechnologyChrome } from "./technology-chrome";
import { OsShellFixed } from "./shell-fixed";

export default function OsLayout({ children }: { children: ReactNode }) {
  return (
    <FeatureFlagProvider>
      <TechnologyChrome>
        <OsShellFixed>{children}</OsShellFixed>
      </TechnologyChrome>
    </FeatureFlagProvider>
  );
}
