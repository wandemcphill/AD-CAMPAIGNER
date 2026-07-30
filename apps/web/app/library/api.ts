"use client";

import { apiRequest } from "../lib/api-client";

export type MediaAssetKind = "IMAGE" | "VIDEO" | "SCREENSHOT" | "REPORT_ATTACHMENT" | "OTHER";

export type MediaAssetRecord = {
  id: string;
  kind: MediaAssetKind;
  contentType: string;
  format?: string | null;
  url?: string | null;
  secureUrl?: string | null;
  thumbnailUrl?: string | null;
  byteSize: number;
  width?: number | null;
  height?: number | null;
  durationMs?: number | null;
  originalFilename?: string | null;
  createdAt: string;
};

export async function loadMediaAssets(kind?: string) {
  const query = kind ? `?kind=${encodeURIComponent(kind)}` : "";
  return apiRequest<MediaAssetRecord[]>(`/media/assets${query}`);
}

export function formatByteSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function assetDimensions(asset: MediaAssetRecord) {
  if (asset.width && asset.height) return `${asset.width}×${asset.height}`;
  if (asset.durationMs) {
    const totalSeconds = Math.round(asset.durationMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }
  return "—";
}
