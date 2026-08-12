"use client";

import { type ReactNode, useCallback, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Smartphone } from "lucide-react";

import { PermissionDenied } from "@fliptrybe/ui";
import { TabBar } from "@fliptrybe/ui/components";

import { isForbiddenError } from "../../lib/api-client";
import { loadVtuOrders } from "./vtu-api";

const TABS = [
  { id: "airtime", label: "Airtime" },
  { id: "data", label: "Data" },
  { id: "history", label: "History" }
];

const TAB_ROUTES = {
  airtime: "/os/airtime/airtime",
  data: "/os/airtime/data",
  history: "/os/airtime/history"
} as const satisfies Record<(typeof TABS)[number]["id"], string>;

export default function AirtimeLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const activeTab = TABS.find((t) => pathname.startsWith(`/os/airtime/${t.id}`))?.id ?? "airtime";
  const [forbidden, setForbidden] = useState(false);

  const onChange = useCallback(
    (id: string) => {
      const target = TAB_ROUTES[id as keyof typeof TAB_ROUTES];
      if (target) {
        router.push(target);
      }
    },
    [router]
  );

  useEffect(() => {
    void loadVtuOrders().catch((caught) => {
      setForbidden(isForbiddenError(caught));
    });
  }, []);

  if (forbidden) {
    return (
      <PermissionDenied>
        You do not have permission to view airtime and data for this workspace. Contact your
        workspace owner if you believe this is a mistake.
      </PermissionDenied>
    );
  }

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center gap-2">
          <Smartphone className="size-5 text-[var(--ft-accent)]" />
          <h1 className="text-xl font-bold">Airtime & Data</h1>
        </div>

        <div className="mt-4">
          <TabBar items={TABS} onChange={onChange} value={activeTab} />
        </div>

        {children}
      </div>
    </div>
  );
}
