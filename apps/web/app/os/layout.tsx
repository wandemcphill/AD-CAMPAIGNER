"use client";

import type { ReactNode } from "react";
import { OsShell } from "./shell";

export default function OsLayout({ children }: { children: ReactNode }) {
  return <OsShell>{children}</OsShell>;
}
