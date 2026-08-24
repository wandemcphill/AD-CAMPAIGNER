"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { FeatureFlagProvider } from "../lib/feature-flags";
import { TechnologyChrome } from "./technology-chrome";
import { OsShellFixed } from "./shell-fixed";
import { CustomerActionRail } from "./customer-action-rail";

export default function OsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <FeatureFlagProvider>
      <TechnologyChrome>
        <OsShellFixed>
          <CustomerActionRail pathname={pathname} />
          {children}
        </OsShellFixed>
      </TechnologyChrome>
    </FeatureFlagProvider>
  );
}
