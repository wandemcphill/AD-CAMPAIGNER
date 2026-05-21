import type { AnalyticsMetric } from "@fliptrybe/types";

export const analyticsMetricNames = [
  "impressions",
  "reach",
  "clicks",
  "views",
  "followers",
  "engagements",
  "conversions",
  "spend_minor",
  "roi_bps",
  "live_viewers"
] as const;

export type AnalyticsMetricName = (typeof analyticsMetricNames)[number];

export function createMetric(
  input: Omit<AnalyticsMetric, "recordedAt"> & { recordedAt?: string }
): AnalyticsMetric {
  return {
    ...input,
    recordedAt: input.recordedAt ?? new Date().toISOString()
  };
}
