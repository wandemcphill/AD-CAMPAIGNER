"use client";

import { useState } from "react";
import { Monitor, Smartphone, Tablet, Trash2, Shield, Clock, MapPin } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { Badge, Button } from "@fliptrybe/ui";
import { AlertBanner } from "@fliptrybe/ui/components";

type Device = {
  id: string;
  name: string;
  type: "desktop" | "mobile" | "tablet";
  browser: string;
  location: string;
  lastActive: string;
  current: boolean;
};

const MOCK_DEVICES: Device[] = [
  { id: "1", name: "Windows PC", type: "desktop", browser: "Chrome 126", location: "Lagos, NG", lastActive: "Active now", current: true },
  { id: "2", name: "iPhone 15", type: "mobile", browser: "Safari 18", location: "Lagos, NG", lastActive: "2 hours ago", current: false },
  { id: "3", name: "iPad Air", type: "tablet", browser: "Safari 18", location: "Abuja, NG", lastActive: "3 days ago", current: false },
];

const DEVICE_ICONS = { desktop: Monitor, mobile: Smartphone, tablet: Tablet };

export default function TrustedDevicesPage() {
  const [devices, setDevices] = useState(MOCK_DEVICES);

  function handleRevoke(id: string) {
    setDevices((prev) => prev.filter((d) => d.id !== id));
  }

  return (
    <>
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-[var(--radius-md)] bg-[var(--ft-accent)]/10">
            <Shield className="size-5 text-[var(--ft-accent)]" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Trusted Devices</h1>
            <p className="text-sm text-[var(--ft-text-secondary)]">Manage devices that can skip 2FA</p>
          </div>
        </div>

        <AlertBanner className="mt-6" tone="info">
          Devices you mark as trusted skip two-factor authentication for 30 days. Revoke access for devices you no longer use.
        </AlertBanner>

        <div className="mt-6 grid gap-3">
          <AnimatePresence>
            {devices.map((device) => {
              const Icon = DEVICE_ICONS[device.type];
              return (
                <motion.div
                  animate={{ opacity: 1, height: "auto" }}
                  className="flex items-center gap-4 rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] p-4"
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  initial={{ opacity: 1, height: "auto" }}
                  key={device.id}
                  layout
                >
                  <div className="grid size-11 shrink-0 place-items-center rounded-[var(--radius-md)] bg-[var(--ft-bg-muted)]">
                    <Icon className="size-5 text-[var(--ft-text-secondary)]" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{device.name}</span>
                      {device.current && <Badge tone="success">Current</Badge>}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-[var(--ft-text-muted)]">
                      <span>{device.browser}</span>
                      <span className="flex items-center gap-1"><MapPin className="size-3" />{device.location}</span>
                      <span className="flex items-center gap-1"><Clock className="size-3" />{device.lastActive}</span>
                    </div>
                  </div>

                  {!device.current && (
                    <Button
                      className="shrink-0 text-[var(--ft-red)]"
                      onClick={() => handleRevoke(device.id)}
                      variant="ghost"
                    >
                      <Trash2 className="size-4" />
                      Revoke
                    </Button>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {devices.length > 1 && (
          <div className="mt-6 flex justify-end">
            <Button
              onClick={() => setDevices((prev) => prev.filter((d) => d.current))}
              variant="secondary"
            >
              Revoke all other devices
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
