"use client";

import { motion } from "framer-motion";
import { useState } from "react";

import { trackHomepageEvent } from "./analytics";
import { agencyTabs } from "./data";

type AgencyOsProps = {
  reducedMotion: boolean;
};

export function AgencyOs({ reducedMotion }: AgencyOsProps) {
  const [activeTab, setActiveTab] = useState(agencyTabs[0]?.label ?? "Clients");
  const active = agencyTabs.find((tab) => tab.label === activeTab) ?? agencyTabs[0];

  if (!active) {
    return null;
  }

  const ActiveIcon = active.icon;
  const activePanelId = `agency-panel-${active.label.toLowerCase().replaceAll(" ", "-")}`;
  const selectTab = (tab: string) => {
    setActiveTab(tab);
    trackHomepageEvent("agency_os_tab_selected", { tab });
  };

  return (
    <section
      className="relative border-t border-white/10 bg-[linear-gradient(180deg,#050507,#08080c)] px-4 py-20 sm:px-6"
      id="agency-os"
    >
      <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div>
          <div className="font-mono text-xs uppercase tracking-[0.26em] text-[var(--flip-terracotta)]">
            04 / Agency OS
          </div>
          <h2 className="mt-4 max-w-xl text-4xl font-black tracking-normal text-white sm:text-5xl">
            Run clients, people, work, and proof from one command surface.
          </h2>
          <p className="mt-5 max-w-xl text-lg leading-8 text-white/58">
            The operating layer keeps client work moving: campaign queues, AI reports, tasks,
            assignments, and team state update as one shared workspace.
          </p>
        </div>

        <div className="rounded-md border border-white/10 bg-white/[0.045] p-4 backdrop-blur-xl sm:p-5">
          <div className="grid gap-2 sm:grid-cols-4" role="tablist" aria-label="Agency OS panels">
            {agencyTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = tab.label === activeTab;

              return (
                <button
                  aria-controls={`agency-panel-${tab.label.toLowerCase().replaceAll(" ", "-")}`}
                  aria-selected={isActive}
                  className={`rounded-md border p-3 text-left transition ${
                    isActive
                      ? "border-white/24 bg-white/[0.09]"
                      : "border-white/10 bg-black/24 hover:border-white/20"
                  }`}
                  id={`agency-tab-${tab.label.toLowerCase().replaceAll(" ", "-")}`}
                  key={tab.label}
                  onClick={() => selectTab(tab.label)}
                  role="tab"
                  type="button"
                >
                  <Icon className="size-4" style={{ color: tab.accent }} />
                  <div className="mt-3 text-sm font-semibold text-white">{tab.label}</div>
                  <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-white/38">
                    {tab.stat}
                  </div>
                </button>
              );
            })}
          </div>

          <div
            aria-labelledby={`agency-tab-${active.label.toLowerCase().replaceAll(" ", "-")}`}
            className="mt-4 rounded-md border border-white/10 bg-[#060608] p-4"
            id={activePanelId}
            role="tabpanel"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span
                  className="grid size-12 place-items-center rounded-md border border-white/10"
                  style={{ color: active.accent }}
                >
                  <ActiveIcon className="size-5" />
                </span>
                <div>
                  <div className="text-xl font-bold text-white">{active.label}</div>
                  <div className="font-mono text-xs uppercase tracking-[0.2em] text-white/38">
                    Live workspace
                  </div>
                </div>
              </div>
              <span className="rounded-md border border-[rgba(16,185,129,0.24)] bg-[rgba(16,185,129,0.08)] px-3 py-2 font-mono text-xs text-[var(--flip-emerald)]">
                Updating
              </span>
            </div>

            <div className="mt-6 grid gap-3">
              {active.lines.map((line, index) => (
                <motion.div
                  animate={{ x: reducedMotion ? 0 : [0, 6, 0] }}
                  className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-md border border-white/10 bg-white/[0.035] p-3"
                  key={line}
                  transition={{ delay: index * 0.18, duration: 2.4, repeat: reducedMotion ? 0 : Infinity }}
                >
                  <span className="size-2 rounded-full" style={{ backgroundColor: active.accent }} />
                  <span className="text-sm font-medium text-white/78">{line}</span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/36">
                    {index === 0 ? "Now" : `T+${index * 7}m`}
                  </span>
                </motion.div>
              ))}
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {["Client SLA", "Creative QA", "Report sent"].map((label, index) => (
                <div className="rounded-md border border-white/10 bg-black/28 p-3" key={label}>
                  <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/36">
                    {label}
                  </div>
                  <div className="mt-2 text-2xl font-black text-white">{[96, 88, 74][index]}%</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
