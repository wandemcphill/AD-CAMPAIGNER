"use client";

type HomepageEventName =
  | "agency_os_tab_selected"
  | "command_generated"
  | "final_cta_started"
  | "marketplace_search_changed"
  | "motion_preference_toggled"
  | "omnichannel_channel_selected";

type HomepageEventPayload = Record<string, string | number | boolean>;

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
  }
}

export function trackHomepageEvent(name: HomepageEventName, payload: HomepageEventPayload = {}) {
  if (typeof window === "undefined") {
    return;
  }

  const detail = {
    event: `homepage_${name}`,
    ...payload
  };

  window.dispatchEvent(new CustomEvent("fliptribe:homepage-event", { detail }));
  window.dataLayer?.push(detail);
}
