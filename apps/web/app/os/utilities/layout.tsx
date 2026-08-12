"use client";

import { type ReactNode, useCallback, useEffect, useState } from "react";
import type { Route } from "next";
import { useRouter, usePathname } from "next/navigation";
import { Lightbulb } from "lucide-react";

import { PermissionDenied } from "@fliptrybe/ui";
import { TabBar } from "@fliptrybe/ui/components";

import { isForbiddenError } from "../../lib/api-client";
import { loadBillsOrders } from "./vtu-api";

const TABS = [
  { id: "electricity", label: "Electricity" },
  { id: "cable", label: "Cable TV" },
  { id: "betting", label: "Bet Funding" },
  { id: "education", label: "Education" },
  { id: "history", label: "History" }
];

export default function UtilitiesLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const activeTab = TABS.find((t) => pathname.startsWith(`/os/utilities/${t.id}`))?.id ?? "electricity";
  const [forbidden, setForbidden] = useState(false);

  const onChange = useCallback(
    (id: string) => {
      router.push(`/os/utilities/${id}` as Route);
    },
    [router]
  );

  useEffect(() => {
    void loadBillsOrders().catch((caught) => {
      setForbidden(isForbiddenError(caught));
    });
  }, []);

  if (forbidden) {
    return (
      <PermissionDenied>
        You do not have permission to view utility bill payments for this workspace. Contact your
        workspace owner if you believe this is a mistake.
      </PermissionDenied>
    );
  }

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center gap-2">
          <Lightbulb className="size-5 text-[var(--ft-accent)]" />
          <h1 className="text-xl font-bold">Utilities</h1>
        </div>

        <div className="mt-4">
          <TabBar items={TABS} onChange={onChange} value={activeTab} />
        </div>

        {children}
      </div>
    </div>
  );
}
